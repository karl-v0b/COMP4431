"""Local FastAPI app: serves the chat UI and proxies chat to Ollama."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.ollama_client import OllamaError, chat, health

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "tutor_system.txt"

app = FastAPI(title="AI Tutor", docs_url=None, redoc_url=None)


def load_system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


@app.get("/api/health")
async def api_health():
    return await health()


@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(body: ChatRequest):
    # Keep history bounded so CPU demos stay responsive.
    trimmed = body.history[-12:]
    messages: list[dict[str, str]] = [
        {"role": "system", "content": load_system_prompt()},
        *[m.model_dump() for m in trimmed],
        {"role": "user", "content": body.message.strip()},
    ]
    try:
        reply = await chat(messages)
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ChatResponse(reply=reply)


@app.get("/")
async def index():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="frontend/index.html is missing.")
    return FileResponse(index_path)


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
