"""Isolated API tests: model and PDF retrieval mocked; no model downloads needed."""
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Keep retrieval dependencies out of this isolated test process.
package = types.ModuleType('backend.rag')
package.__path__ = [str(Path(__file__).resolve().parents[1] / 'backend' / 'rag')]
sys.modules['backend.rag'] = package
store = types.ModuleType('backend.rag.store')
store.has_documents = lambda: True
store.similarity_search = lambda *args: []
sys.modules['backend.rag.store'] = store
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import quiz

class QuizTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(quiz.router)
        self.client = TestClient(app)
        quiz._sessions.clear()
        self.doc = types.SimpleNamespace(page_content='BFS uses a queue.', metadata={'source':'lecture.pdf','page':2})
        self.raw = json.dumps({'questions':[{'question':'What does BFS use?', 'options':['Queue','Stack','Heap','Set'], 'answer':0,'explanation':'BFS uses a queue.','source':1}]})

    def generate(self):
        with patch.object(quiz, 'similarity_search', return_value=[self.doc]), patch.object(quiz, 'quiz_json', AsyncMock(return_value=self.raw)):
            return self.client.post('/api/quiz', json={'topic':'BFS','count':1})

    def test_generation_hides_answers_and_grades(self):
        response = self.generate()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn('answer', data['questions'][0])
        self.assertNotIn('explanation', data['questions'][0])
        for selected, expected in [(0,1),(1,0)]:
            result = self.client.post(f"/api/quiz/{data['id']}/submit", json={'answers':[selected]}).json()
            self.assertEqual(result['score'], expected)
            self.assertEqual(result['results'][0]['page'], 2)
            self.assertEqual(result['results'][0]['excerpt'], self.doc.page_content)

    def test_missing_pdf(self):
        with patch.object(quiz, 'has_documents', return_value=False):
            self.assertEqual(self.client.post('/api/quiz', json={'topic':'BFS'}).status_code, 400)

    def test_invalid_model_retries(self):
        with patch.object(quiz, 'similarity_search', return_value=[self.doc]), patch.object(quiz, 'quiz_json', AsyncMock(return_value='bad json')) as model:
            self.assertEqual(self.client.post('/api/quiz', json={'topic':'BFS'}).status_code, 502)
            self.assertEqual(model.await_count, 2)

    def test_invalid_and_expired_submissions(self):
        key = self.generate().json()['id']
        self.assertEqual(self.client.post(f'/api/quiz/{key}/submit', json={'answers':[4]}).status_code, 422)
        quiz._sessions[key]['created'] -= quiz.TTL + 1
        self.assertEqual(self.client.post(f'/api/quiz/{key}/submit', json={'answers':[0]}).status_code, 404)

    def test_rejects_bad_references_and_duplicate_options(self):
        for change in ({'source':2}, {'options':['A','A','B','C']}, {'answer':4}):
            data = json.loads(self.raw)
            data['questions'][0].update(change)
            with self.assertRaises(ValueError):
                quiz.validate_questions(json.dumps(data),1,1)

if __name__ == '__main__':
    unittest.main()
