"""Thin client for the local Ollama HTTP API (127.0.0.1 only)."""

from __future__ import annotations

import os
from typing import Any

import httpx

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
# qwen2.5:3b fits ~16GB RAM / iGPU and handles Traditional Chinese far better than llama3.2:3b.
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
REQUEST_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "180"))


class OllamaError(Exception):
    """Raised when the local Ollama service cannot complete a request."""


def _is_degenerate_reply(text: str) -> bool:
    """Detect near-empty / punctuation-only replies that small models sometimes emit."""
    stripped = text.strip()
    if not stripped:
        return True
    # Only punctuation / symbols, or a very short non-word reply.
    meaningful = "".join(ch for ch in stripped if ch.isalnum() or ("\u4e00" <= ch <= "\u9fff"))
    return len(meaningful) < 2


async def _chat_once(messages: list[dict[str, str]], model: str) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 512,
        },
    }
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=REQUEST_TIMEOUT) as client:
            response = await client.post("/api/chat", json=payload)
    except httpx.ConnectError as exc:
        raise OllamaError(
            "Cannot connect to Ollama at 127.0.0.1:11434. "
            "Start the Ollama app, then retry."
        ) from exc
    except httpx.TimeoutException as exc:
        raise OllamaError(
            "Ollama timed out. The model may still be loading; try again."
        ) from exc

    if response.status_code != 200:
        detail = response.text.strip() or f"HTTP {response.status_code}"
        raise OllamaError(f"Ollama chat failed: {detail}")

    data = response.json()
    message = data.get("message") or {}
    content = message.get("content")
    if not content:
        raise OllamaError("Ollama returned an empty response.")
    return content


async def chat(messages: list[dict[str, str]], model: str | None = None) -> str:
    """Send a chat request to local Ollama; retry once if the reply is degenerate."""
    chosen = model or OLLAMA_MODEL
    content = await _chat_once(messages, chosen)
    if not _is_degenerate_reply(content):
        return content

    retry_messages = list(messages) + [
        {"role": "assistant", "content": content},
        {
            "role": "user",
            "content": (
                "Your previous reply was incomplete or only punctuation. "
                "Please answer again fully, with complete sentences and real content. "
            ),
        },
    ]
    retried = await _chat_once(retry_messages, chosen)
    if _is_degenerate_reply(retried):
        raise OllamaError(
            "The local model returned an incomplete reply. "
            "Try again, or use: ollama pull qwen2.5:3b"
        )
    return retried


async def health() -> dict[str, Any]:
    """Check whether local Ollama is up and the configured model is available."""
    model = OLLAMA_MODEL
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_HOST, timeout=5.0) as client:
            response = await client.get("/api/tags")
    except httpx.ConnectError:
        return {
            "ok": False,
            "ollama": False,
            "model": model,
            "model_available": False,
            "detail": "Ollama is not reachable at 127.0.0.1:11434.",
        }
    except httpx.TimeoutException:
        return {
            "ok": False,
            "ollama": False,
            "model": model,
            "model_available": False,
            "detail": "Timed out contacting local Ollama.",
        }

    if response.status_code != 200:
        return {
            "ok": False,
            "ollama": False,
            "model": model,
            "model_available": False,
            "detail": f"Ollama /api/tags returned HTTP {response.status_code}.",
        }

    names = [item.get("name", "") for item in response.json().get("models", [])]
    model_available = model in names or any(
        name == model or name.startswith(f"{model}-") for name in names
    )

    return {
        "ok": model_available,
        "ollama": True,
        "model": model,
        "model_available": model_available,
        "models": names,
        "detail": None
        if model_available
        else f"Model '{model}' not found. Run: ollama pull {model}",
    }
