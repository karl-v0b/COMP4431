"""Helpers for tutor-reply summarization (shared by app and tests)."""

from __future__ import annotations

from pathlib import Path

SUMMARY_PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "summary_system.txt"
SHORT_REPLY_MAX_LINES = 3
SHORT_REPLY_MAX_WORDS = 40


def load_summary_prompt() -> str:
    return SUMMARY_PROMPT_PATH.read_text(encoding="utf-8").strip()


def is_already_short(reply: str) -> bool:
    """Skip summary when the full reply is already brief."""
    text = reply.strip()
    if not text:
        return True
    lines = [ln for ln in text.splitlines() if ln.strip()]
    words = text.split()
    return len(lines) <= SHORT_REPLY_MAX_LINES or len(words) < SHORT_REPLY_MAX_WORDS
