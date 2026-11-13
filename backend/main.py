"""Local FastAPI app: chat UI, Ollama tutor, and server-lifetime PDF RAG."""

from __future__ import annotations

import json
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.ollama_client import OllamaError, chat, health, summarize
from backend.rag.config import MAX_FILE_BYTES
from backend.rag.ingest import IngestError, clear_documents, ingest_pdf, list_documents
from backend.rag.retrieve import retrieve_for_query
from backend.rag.store import get_status, has_documents

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "tutor_system.txt"

from backend.quiz import router as quiz_router
from backend.summary_util import is_already_short, load_summary_prompt

app = FastAPI(title="AI Tutor", docs_url=None, redoc_url=None)
app.include_router(quiz_router)


def load_system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()


def build_system_prompt(rag_context: str) -> str:
    base = load_system_prompt()
    if not rag_context.strip():
        return base
    return (
        f"{base}\n\n"
        "Uploaded PDF reference context (server-lifetime RAG):\n"
        "Use this context when it helps answer the user. Prefer it for questions about "
        "the uploaded material. Cite pages like (p. 3) when you use it. "
        "If the answer is not in the context, say so and you may still use general "
        "course knowledge when appropriate.\n\n"
        f"{rag_context}"
    )


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    summary: str | None = None
    sources: list[str] = Field(default_factory=list)


@app.get("/api/health")
async def api_health():
    data = await health()
    data["rag"] = {
        "documents": list_documents(),
        "has_documents": has_documents(),
        "ingest": get_status(),
    }
    return data


@app.get("/api/documents")
async def api_list_documents():
    return {"documents": list_documents(), "ingest": get_status()}


@app.delete("/api/documents")
async def api_clear_documents():
    clear_documents()
    return {"ok": True, "documents": [], "ingest": get_status()}


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)):
    filename = Path(file.filename or "upload.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size is {MAX_FILE_BYTES // (1024 * 1024)}MB.",
        )

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        result = ingest_pdf(tmp_path, filename)
    except IngestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {exc}") from exc
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    return {
        "ok": True,
        "document": result,
        "documents": list_documents(),
        "ingest": get_status(),
    }


def _ndjson(payload: dict) -> bytes:
    """One NDJSON line as bytes, plus padding so stage events flush before long awaits."""
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    # Non-JSON padding line (client skips parse failures); helps ASGI/proxy flush.
    pad = b"#" + (b" " * 2048) + b"\n"
    return line.encode("utf-8") + pad


@app.post("/api/chat")
async def api_chat(body: ChatRequest):
    """Stream progress stages as NDJSON, then a final result (or error) event."""

    async def event_stream() -> AsyncIterator[bytes]:
        trimmed = body.history[-12:]
        question = body.message.strip()
        rag_context = ""
        sources: list[str] = []

        if has_documents():
            yield _ndjson(
                {
                    "type": "stage",
                    "stage": "retrieve",
                    "label": "Retrieving notes",
                }
            )
            try:
                rag_context, sources = retrieve_for_query(question)
            except Exception as exc:
                yield _ndjson(
                    {"type": "error", "detail": f"RAG retrieval failed: {exc}"}
                )
                return

        yield _ndjson(
            {"type": "stage", "stage": "write", "label": "Writing answer"}
        )
        messages: list[dict[str, str]] = [
            {"role": "system", "content": build_system_prompt(rag_context)},
            *[m.model_dump() for m in trimmed],
            {"role": "user", "content": question},
        ]
        try:
            reply = await chat(messages)
        except OllamaError as exc:
            yield _ndjson({"type": "error", "detail": str(exc)})
            return

        summary: str | None = None
        if not is_already_short(reply):
            yield _ndjson(
                {
                    "type": "stage",
                    "stage": "summary",
                    "label": "Preparing summary",
                }
            )
            try:
                summary = await summarize(reply, load_summary_prompt())
            except OllamaError:
                summary = None
            if summary and summary.strip() == reply.strip():
                summary = None

        yield _ndjson(
            {
                "type": "result",
                "reply": reply,
                "summary": summary,
                "sources": sources,
            }
        )

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/")
async def index():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="frontend/index.html is missing.")
    return FileResponse(index_path)


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
