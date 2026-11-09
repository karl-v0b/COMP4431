"""PDF ingest: text, tables, figure captions → chunk → embed."""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

import pymupdf as fitz
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.rag.caption import caption_image_file
from backend.rag.config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    MAX_DOCUMENTS,
    MAX_FIGURES_PER_PDF,
    MAX_PAGES,
    MIN_IMAGE_SIDE,
    MIN_PAGE_TEXT_CHARS,
)
from backend.rag.store import (
    add_documents,
    delete_documents_by_source,
    find_doc_id_by_filename,
    list_registry,
    register_document,
    registry_count,
    reset_store,
    set_status,
)


class IngestError(Exception):
    """Raised when a PDF cannot be ingested under project limits."""


def list_documents() -> list[dict]:
    return list_registry()


def clear_documents() -> None:
    reset_store()


def _splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )


def _extract_tables_as_text(page: fitz.Page) -> list[str]:
    blocks: list[str] = []
    try:
        finder = page.find_tables()
    except Exception:
        return blocks
    tables = getattr(finder, "tables", None) or []
    for idx, table in enumerate(tables, start=1):
        try:
            data = table.extract()
        except Exception:
            continue
        if not data:
            continue
        lines = []
        for row in data:
            cells = [("" if c is None else str(c).strip()) for c in row]
            lines.append(" | ".join(cells))
        if lines:
            blocks.append(f"[Table {idx}]\n" + "\n".join(lines))
    return blocks


def _save_pixmap(pix: fitz.Pixmap, path: Path) -> None:
    if pix.n - pix.alpha >= 4:  # CMYK or similar
        pix = fitz.Pixmap(fitz.csRGB, pix)
    pix.save(str(path))


def _collect_page_images(doc: fitz.Document, page: fitz.Page, out_dir: Path, prefix: str) -> list[Path]:
    paths: list[Path] = []
    for img_i, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        try:
            pix = fitz.Pixmap(doc, xref)
        except Exception:
            continue
        if pix.width < MIN_IMAGE_SIDE or pix.height < MIN_IMAGE_SIDE:
            continue
        path = out_dir / f"{prefix}_img_{page.number + 1}_{img_i}.png"
        try:
            _save_pixmap(pix, path)
            paths.append(path)
        except Exception:
            continue
    return paths


def _render_page(page: fitz.Page, out_dir: Path, prefix: str) -> Path:
    # ~150 dpi-ish matrix for captioning without huge files
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = out_dir / f"{prefix}_page_{page.number + 1}.png"
    pix.save(str(path))
    return path


def ingest_pdf(file_path: Path, filename: str) -> dict:
    """Ingest one PDF into the server-lifetime vector store."""
    filename = Path(filename).name
    if not filename.lower().endswith(".pdf"):
        raise IngestError("Only PDF files are supported.")

    existing = find_doc_id_by_filename(filename)
    if existing is None and registry_count() >= MAX_DOCUMENTS:
        raise IngestError(
            f"At most {MAX_DOCUMENTS} PDFs can be active until the server restarts. "
            "Clear documents first."
        )

    set_status("parsing", f"Opening {filename}", filename=filename, error=None)
    try:
        pdf = fitz.open(file_path)
    except Exception as exc:
        set_status("error", str(exc), filename=filename, error=str(exc))
        raise IngestError(f"Could not open PDF: {exc}") from exc

    page_count = pdf.page_count
    if page_count > MAX_PAGES:
        pdf.close()
        msg = f"PDF has {page_count} pages; max allowed is {MAX_PAGES}."
        set_status("error", msg, filename=filename, error=msg)
        raise IngestError(msg)

    doc_id = existing or uuid.uuid4().hex
    if existing:
        set_status("parsing", f"Replacing previous index for {filename}", filename=filename)
        delete_documents_by_source(existing)

    raw_docs: list[Document] = []
    figure_paths: list[tuple[int, Path]] = []
    assets_dir = Path(tempfile.mkdtemp(prefix="ai_tutor_pdf_assets_"))

    try:
        for page in pdf:
            page_no = page.number + 1
            text = (page.get_text("text") or "").strip()
            if text:
                raw_docs.append(
                    Document(
                        page_content=text,
                        metadata={
                            "source": filename,
                            "page": page_no,
                            "kind": "text",
                            "doc_id": doc_id,
                        },
                    )
                )

            for table_text in _extract_tables_as_text(page):
                raw_docs.append(
                    Document(
                        page_content=table_text,
                        metadata={
                            "source": filename,
                            "page": page_no,
                            "kind": "table",
                            "doc_id": doc_id,
                        },
                    )
                )

            for img_path in _collect_page_images(pdf, page, assets_dir, doc_id[:8]):
                figure_paths.append((page_no, img_path))

            if len(text) < MIN_PAGE_TEXT_CHARS:
                figure_paths.append((page_no, _render_page(page, assets_dir, doc_id[:8])))

        pdf.close()

        # Cap figures for demo hardware
        figure_paths = figure_paths[:MAX_FIGURES_PER_PDF]
        set_status(
            "captioning",
            f"Captioning {len(figure_paths)} figure(s)/page image(s)",
            filename=filename,
        )

        for page_no, img_path in figure_paths:
            try:
                caption = caption_image_file(img_path)
            except Exception as exc:
                caption = f"Figure on page {page_no}; caption unavailable ({exc})."
            raw_docs.append(
                Document(
                    page_content=f"[Figure on page {page_no}]\n{caption}",
                    metadata={
                        "source": filename,
                        "page": page_no,
                        "kind": "figure",
                        "doc_id": doc_id,
                    },
                )
            )

        if not raw_docs:
            msg = "No extractable text or figures found in this PDF."
            set_status("error", msg, filename=filename, error=msg)
            raise IngestError(msg)

        set_status("indexing", "Chunking and embedding into local vector store", filename=filename)
        chunks = _splitter().split_documents(raw_docs)
        # Ensure metadata survives split
        for ch in chunks:
            ch.metadata.setdefault("source", filename)
            ch.metadata.setdefault("doc_id", doc_id)
            ch.metadata.setdefault("kind", "text")
            ch.metadata.setdefault("page", ch.metadata.get("page", 1))

        n = add_documents(chunks)
        register_document(doc_id, filename, page_count, n)
        set_status(
            "ready",
            f"Indexed {n} chunks from {filename}",
            filename=filename,
            chunks=n,
            error=None,
        )
        return {
            "id": doc_id,
            "filename": filename,
            "pages": page_count,
            "chunks": n,
            "figures_captioned": len(figure_paths),
        }
    finally:
        # Best-effort cleanup of temporary rendered assets
        try:
            for p in assets_dir.glob("*"):
                p.unlink(missing_ok=True)
            assets_dir.rmdir()
        except Exception:
            pass
