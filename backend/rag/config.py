"""RAG limits and local model names."""

from __future__ import annotations

import os

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "moondream")

MAX_FILE_BYTES = int(os.getenv("RAG_MAX_FILE_BYTES", str(20 * 1024 * 1024)))
MAX_PAGES = int(os.getenv("RAG_MAX_PAGES", "30"))
MAX_DOCUMENTS = int(os.getenv("RAG_MAX_DOCUMENTS", "3"))
MAX_FIGURES_PER_PDF = int(os.getenv("RAG_MAX_FIGURES", "20"))
RETRIEVE_K = int(os.getenv("RAG_RETRIEVE_K", "4"))

CHUNK_SIZE = 900
CHUNK_OVERLAP = 180
MIN_PAGE_TEXT_CHARS = 80  # below this, treat page as scan-like and caption render
MIN_IMAGE_SIDE = 64  # skip tiny icons
