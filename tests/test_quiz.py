"""Tests for the modal /api/quiz endpoint (no PDF / no lecture-quiz router)."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app, is_off_topic  # noqa: E402


SAMPLE_QUESTIONS = [
    {
        "question": "What does BFS use?",
        "options": ["A. Queue", "B. Stack", "C. Heap", "D. Set"],
        "correct_index": 0,
        "explanation": "BFS explores level by level with a queue.",
    },
    {
        "question": "DFS primary structure?",
        "options": ["A. Queue", "B. Stack", "C. Heap", "D. Graph"],
        "correct_index": 1,
        "explanation": "DFS uses a stack or recursion.",
    },
    {
        "question": "A* needs which function?",
        "options": ["A. Random", "B. Heuristic", "C. Sort", "D. Hash"],
        "correct_index": 1,
        "explanation": "A* uses f(n)=g(n)+h(n).",
    },
]


class OffTopicTests(unittest.TestCase):
    def test_detects_off_topic_keywords(self):
        self.assertTrue(is_off_topic("How do I bake a cake?"))
        self.assertFalse(is_off_topic("Explain breadth-first search"))


class ModalQuizApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_rejects_off_topic_topic(self):
        res = self.client.post(
            "/api/quiz",
            json={"topic": "chocolate cake recipe", "scope": "Big Picture"},
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Computer Science", res.json()["detail"])

    def test_returns_three_questions_from_model_json(self):
        payload = json.dumps(SAMPLE_QUESTIONS)
        with patch("backend.main.chat", AsyncMock(return_value=payload)) as mock_chat:
            res = self.client.post(
                "/api/quiz",
                json={
                    "topic": "BFS",
                    "scope": "In-Depth",
                    "language": "English",
                },
            )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["questions"]), 3)
        self.assertEqual(data["questions"][0]["correct_index"], 0)
        self.assertEqual(mock_chat.await_count, 1)
        user_msg = mock_chat.await_args.args[0][-1]["content"]
        self.assertIn("BFS", user_msg)
        self.assertIn("In-Depth", user_msg)
        self.assertIn("English", user_msg)

    def test_strips_markdown_fences_around_json(self):
        fenced = "```json\n" + json.dumps(SAMPLE_QUESTIONS) + "\n```"
        with patch("backend.main.chat", AsyncMock(return_value=fenced)):
            res = self.client.post("/api/quiz", json={"topic": "DFS"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["questions"]), 3)

    def test_invalid_model_output_returns_500(self):
        with patch("backend.main.chat", AsyncMock(return_value="not json at all")):
            res = self.client.post("/api/quiz", json={"topic": "A* search"})
        self.assertEqual(res.status_code, 500)
        self.assertIn("Quiz generation failed", res.json()["detail"])

    def test_wrong_question_count_returns_500(self):
        bad = json.dumps(SAMPLE_QUESTIONS[:2])
        with patch("backend.main.chat", AsyncMock(return_value=bad)):
            res = self.client.post("/api/quiz", json={"topic": "Neural nets"})
        self.assertEqual(res.status_code, 500)


class SummaryLanguagePromptTests(unittest.TestCase):
    def test_load_summary_prompt_includes_language(self):
        from backend.summary_util import load_summary_prompt

        prompt = load_summary_prompt("Traditional Chinese")
        self.assertIn("Traditional Chinese", prompt)
        self.assertIn("CRITICAL", prompt)


if __name__ == "__main__":
    unittest.main()
