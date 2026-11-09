"""Local vision captions for PDF figures (once at ingest)."""

from __future__ import annotations

import base64
from pathlib import Path

import httpx

from backend.rag.config import OLLAMA_HOST, VISION_MODEL

CAPTION_PROMPT = (
    "Describe this figure from a course PDF in 2-4 short sentences. "
    "Include the figure type (chart, diagram, photo, table image, etc.), "
    "any readable labels/axes/titles, and the main takeaway. "
    "If text is unreadable, say so briefly. Do not invent numbers."
)


def caption_image_file(image_path: Path, timeout: float = 120.0) -> str:
    """Ask the local Ollama vision model to caption an image file."""
    data = image_path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    payload = {
        "model": VISION_MODEL,
        "prompt": CAPTION_PROMPT,
        "images": [b64],
        "stream": False,
    }
    try:
        with httpx.Client(base_url=OLLAMA_HOST, timeout=timeout) as client:
            response = client.post("/api/generate", json=payload)
    except httpx.ConnectError as exc:
        raise RuntimeError(
            f"Cannot reach Ollama for vision captions ({VISION_MODEL})."
        ) from exc
    except httpx.TimeoutException as exc:
        raise RuntimeError(
            f"Vision caption timed out for model {VISION_MODEL}."
        ) from exc

    if response.status_code != 200:
        detail = response.text.strip() or f"HTTP {response.status_code}"
        raise RuntimeError(f"Vision caption failed: {detail}")

    text = (response.json().get("response") or "").strip()
    if not text:
        return "Figure present; no caption could be generated."
    return text
