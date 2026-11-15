"""Local FastAPI app: chat UI, Ollama tutor, PDF RAG, quizzes, and learning modes."""

from __future__ import annotations

import json
import re
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.ollama_client import OllamaError, chat, health, summarize
from backend.quiz import router as quiz_router
from backend.rag.config import MAX_FILE_BYTES
from backend.rag.ingest import IngestError, clear_documents, ingest_pdf, list_documents
from backend.rag.retrieve import retrieve_for_query
from backend.rag.store import get_status, has_documents
from backend.summary_util import is_already_short, load_summary_prompt

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "tutor_system.txt"

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
    level: str = Field(default="Standard")
    language: str = Field(default="English")


class ChatResponse(BaseModel):
    reply: str
    summary: str | None = None
    sources: list[str] = Field(default_factory=list)


class QuickQuizRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    scope: str = Field(default="Big Picture")
    language: str = Field(default="English")


# Domain restriction word list (off-topic guardrails from test-feature).
OFF_TOPIC_KEYWORDS = [
    "cake",
    "recipe",
    "cook",
    "bake",
    "baking",
    "food",
    "weather",
    "joke",
    "sports",
    "football",
    "movie",
    "music",
]


def is_off_topic(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in OFF_TOPIC_KEYWORDS)


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
    pad = b"#" + (b" " * 2048) + b"\n"
    return line.encode("utf-8") + pad


@app.post("/api/chat")
async def api_chat(body: ChatRequest):
    """Stream progress stages as NDJSON, then a final result (or error) event."""

    async def event_stream() -> AsyncIterator[bytes]:
        trimmed = body.history[-12:]
        question = body.message.strip()

        if is_off_topic(question):
            refusal = (
                "I am a COMP4431 AI Tutor and can only help with Computer Science, "
                "Artificial Intelligence, and Algorithms. Let's get back to studying!"
            )
            if body.language == "Traditional Chinese":
                refusal = (
                    "抱歉，我是 COMP4431 AI 導師，只能協助計算機科學、人工智慧和演算法相關的問題。"
                    "讓我們回到學習吧！"
                )
            yield _ndjson(
                {"type": "result", "reply": refusal, "summary": None, "sources": []}
            )
            return

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

        mode_instruction = f"CRITICAL: You must strictly follow [MODE: {body.level}].\n"
        lang_instruction = f"CRITICAL: You must reply entirely in {body.language}.\n\n"
        user_content = f"{mode_instruction}{lang_instruction}Question: {question}"

        messages: list[dict[str, str]] = [
            {"role": "system", "content": build_system_prompt(rag_context)},
            *[m.model_dump() for m in trimmed],
            {"role": "user", "content": user_content},
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


@app.post("/api/quick-quiz")
async def api_quick_quiz(body: QuickQuizRequest):
    """Topic/scope quiz without PDF grounding (from test-feature modal)."""
    if is_off_topic(body.topic):
        raise HTTPException(
            status_code=400, detail="Topic is outside the Computer Science domain."
        )

    scope_guide = {
        "Big Picture": (
            "Ask high-level conceptual questions about how this topic connects "
            "to other ideas and its overall purpose."
        ),
        "In-Depth": (
            "Ask questions about layers, mechanisms, and internal workings of the topic."
        ),
        "Very Specific": (
            "Ask questions about particular terminology, edge cases, and "
            "fine-grained details within the topic."
        ),
    }
    guidance = scope_guide.get(body.scope, scope_guide["Big Picture"])

    prompt = (
        f"Generate EXACTLY 3 multiple-choice questions about '{body.topic}' "
        f"for a COMP4431 AI/CS student.\n"
        f"Scope: {body.scope}. {guidance}\n"
        f"Language: {body.language}\n"
        "CRITICAL: Keep the question text, options, and explanation EXTREMELY SHORT "
        "(under 15 words each).\n"
        "You MUST output ONLY a valid JSON array of 3 objects, with no markdown "
        "formatting or extra text.\n"
        "Format:\n"
        "[\n"
        "  {\n"
        '    "question": "The question text",\n'
        '    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],\n'
        '    "correct_index": 0,\n'
        '    "explanation": "Short explanation"\n'
        "  },\n"
        "  ...\n"
        "]\n"
        "correct_index must be an integer between 0 and 3."
    )

    messages = [
        {"role": "system", "content": "You are a JSON generator. Output only raw JSON arrays."},
        {"role": "user", "content": prompt},
    ]

    try:
        reply = await chat(messages)
        clean = reply.strip()

        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]

        clean = clean.strip()

        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            match = re.search(r"\[.*\]", clean, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
            else:
                raise ValueError("Could not find a valid JSON array in the response.")

        if not isinstance(data, list) or len(data) != 3:
            raise ValueError("Expected a list of exactly 3 questions.")
        return {"questions": data}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {str(exc)}. Try again.",
        ) from exc


@app.get("/")
async def index():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="frontend/index.html is missing.")
    return FileResponse(index_path)


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
