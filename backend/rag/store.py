"""Process-global in-memory vector store (cleared when the server process exits)."""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings

from backend.rag.config import EMBED_MODEL, OLLAMA_HOST

_lock = threading.Lock()
_store: InMemoryVectorStore | None = None
_registry: dict[str, dict[str, Any]] = {}
_all_docs: list[Document] = []


@dataclass
class IngestStatus:
    stage: str = "idle"
    detail: str = ""
    filename: str | None = None
    chunks: int = 0
    error: str | None = None


_status = IngestStatus()


def get_status() -> dict[str, Any]:
    with _lock:
        return {
            "stage": _status.stage,
            "detail": _status.detail,
            "filename": _status.filename,
            "chunks": _status.chunks,
            "error": _status.error,
        }


def set_status(
    stage: str,
    detail: str = "",
    filename: str | None = None,
    chunks: int | None = None,
    error: str | None = None,
) -> None:
    with _lock:
        _status.stage = stage
        _status.detail = detail
        if filename is not None:
            _status.filename = filename
        if chunks is not None:
            _status.chunks = chunks
        _status.error = error


def _embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_HOST)


def _new_store() -> InMemoryVectorStore:
    return InMemoryVectorStore(embedding=_embeddings())


def get_store() -> InMemoryVectorStore:
    global _store
    with _lock:
        if _store is None:
            _store = _new_store()
        return _store


def reset_store() -> None:
    """Drop all indexed chunks for this process."""
    global _store, _registry, _all_docs
    with _lock:
        _store = _new_store()
        _registry = {}
        _all_docs = []
    set_status("idle", "Document store cleared.")


def list_registry() -> list[dict[str, Any]]:
    with _lock:
        return [dict(v) for v in _registry.values()]


def registry_count() -> int:
    with _lock:
        return len(_registry)


def has_documents() -> bool:
    with _lock:
        return bool(_registry)


def register_document(doc_id: str, filename: str, pages: int, chunks: int) -> None:
    with _lock:
        _registry[doc_id] = {
            "id": doc_id,
            "filename": filename,
            "pages": pages,
            "chunks": chunks,
        }


def unregister_document(doc_id: str) -> None:
    with _lock:
        _registry.pop(doc_id, None)


def find_doc_id_by_filename(filename: str) -> str | None:
    with _lock:
        for doc_id, meta in _registry.items():
            if meta.get("filename") == filename:
                return doc_id
    return None


def delete_documents_by_source(doc_id: str) -> None:
    global _store, _all_docs
    with _lock:
        kept = [d for d in _all_docs if d.metadata.get("doc_id") != doc_id]
        _all_docs = kept
        _registry.pop(doc_id, None)
        _store = _new_store()
        if kept:
            _store.add_documents(kept)


def add_documents(docs: list[Document]) -> int:
    global _store, _all_docs
    if not docs:
        return 0
    with _lock:
        if _store is None:
            _store = _new_store()
        _all_docs.extend(docs)
        _store.add_documents(docs)
    return len(docs)


def similarity_search(query: str, k: int) -> list[Document]:
    if not has_documents():
        return []
    store = get_store()
    return store.similarity_search(query, k=k)
