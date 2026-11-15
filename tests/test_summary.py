"""Tests for summary helpers and prompt rules (no Ollama / no chat stream)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.summary_util import (  # noqa: E402
    SHORT_REPLY_MAX_LINES,
    SHORT_REPLY_MAX_WORDS,
    is_already_short,
    load_summary_prompt,
)


class SummaryUtilTests(unittest.TestCase):
    def test_empty_and_short_replies_skip_summary(self):
        self.assertTrue(is_already_short(""))
        self.assertTrue(is_already_short("  Hi there.  "))
        self.assertTrue(is_already_short("line1\nline2\nline3"))
        self.assertLess(SHORT_REPLY_MAX_LINES, 10)
        self.assertLess(SHORT_REPLY_MAX_WORDS, 100)

    def test_long_reply_needs_summary(self):
        # Helper skips when lines ≤3 OR words <40, so a long multi-line reply is required.
        lines = "\n".join(
            f"Point {i}: detail about search and learning with more words here."
            for i in range(SHORT_REPLY_MAX_LINES + 3)
        )
        self.assertGreaterEqual(len(lines.split()), SHORT_REPLY_MAX_WORDS)
        self.assertFalse(is_already_short(lines))

    def test_summary_prompt_has_stronger_structure_rules(self):
        prompt = load_summary_prompt().lower()
        self.assertIn("term:", prompt)
        self.assertIn("table", prompt)
        self.assertIn("half", prompt)
        self.assertIn("code", prompt)
        self.assertIn("do not copy full code", prompt)
        self.assertIn("bullet", prompt)
        self.assertIn("no preamble", prompt)
        self.assertIn("same language", prompt)
        self.assertIn("core knowledge", prompt)


class SummarizeClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_summarize_returns_model_text(self):
        from backend import ollama_client

        with patch.object(
            ollama_client,
            "_chat_once",
            AsyncMock(return_value="A*: f(n)=g(n)+h(n)\nBFS: level-order queue"),
        ) as mock_chat:
            out = await ollama_client.summarize(
                "A long tutor reply about A* and BFS " * 20,
                "system prompt",
            )
        self.assertIn("A*", out)
        self.assertEqual(mock_chat.await_count, 1)
        kwargs = mock_chat.await_args.kwargs
        self.assertEqual(kwargs.get("temperature"), 0.3)
        self.assertEqual(kwargs.get("num_predict"), 768)

    async def test_summarize_retries_degenerate_once(self):
        from backend import ollama_client

        with patch.object(
            ollama_client,
            "_chat_once",
            AsyncMock(side_effect=[".", "Heuristic: estimate to goal"]),
        ) as mock_chat:
            out = await ollama_client.summarize("full reply text " * 30, "sys")
        self.assertEqual(out, "Heuristic: estimate to goal")
        self.assertEqual(mock_chat.await_count, 2)


if __name__ == "__main__":
    unittest.main()
