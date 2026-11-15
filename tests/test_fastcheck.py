"""Fast Check glossary + longest-match tests (Node; no browser / no Ollama)."""
import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def _require_node() -> str:
    path = shutil.which("node")
    if not path:
        raise unittest.SkipTest("node is required for Fast Check glossary tests")
    return path


def _run_identify(selection: str):
    node = _require_node()
    script = f"""
const fs = require('fs');
const vm = require('vm');
const frontend = {json.dumps(str(FRONTEND))};
const window = {{}};
const ctx = {{ window, console, Map }};
vm.createContext(ctx);
for (const file of ['glossary.js', 'glossary_match.js']) {{
  vm.runInContext(fs.readFileSync(frontend + '/' + file, 'utf8'), ctx);
}}
const hit = ctx.window.AI_TUTOR_IDENTIFY_TERM(
  {json.dumps(selection)},
  ctx.window.AI_TUTOR_GLOSSARY
);
process.stdout.write(JSON.stringify(hit));
"""
    proc = subprocess.run(
        [node, "-e", script],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr or proc.stdout or "node failed")
    raw = proc.stdout.strip()
    if raw == "null" or raw == "":
        return None
    return json.loads(raw)


class FastCheckGlossaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _require_node()
        node = shutil.which("node")
        script = f"""
const fs = require('fs');
const vm = require('vm');
const window = {{}};
const ctx = {{ window, console, Map }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync({json.dumps(str(FRONTEND / 'glossary.js'))}, 'utf8'), ctx);
const g = ctx.window.AI_TUTOR_GLOSSARY;
process.stdout.write(JSON.stringify({{
  course: g.courseEntryCount,
  extras: g.appExtraCount,
  keys: g.keysLongestFirst.length
}}));
"""
        proc = subprocess.run(
            [node, "-e", script],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        cls.meta = json.loads(proc.stdout)

    def test_course_entry_counts(self):
        self.assertEqual(self.meta["course"], 114)
        self.assertEqual(self.meta["extras"], 2)
        self.assertGreaterEqual(self.meta["keys"], 114)

    def test_longest_match_prefers_phrase_over_short_token(self):
        hit = _run_identify("breadth-first search uses a queue")
        self.assertIsNotNone(hit)
        self.assertIn("breadth-first search", hit["key"])
        self.assertIn("BFS", hit["display"])

    def test_short_acronym_requires_word_boundary(self):
        hit = _run_identify("the bfs explores each branch")
        self.assertIsNotNone(hit)
        self.assertEqual(hit["key"], "bfs")

        # "ai" must not match inside ordinary words like "detail"
        self.assertIsNone(_run_identify("detailed notes"))

    def test_a_star_and_transformer_terms(self):
        hit = _run_identify("use A* search with an admissible heuristic")
        self.assertIsNotNone(hit)
        self.assertTrue("a*" in hit["key"] or "admissible" in hit["key"])

        hit2 = _run_identify("the transformer uses self-attention")
        self.assertIsNotNone(hit2)
        self.assertIn("self-attention", hit2["key"].replace(" ", ""))

    def test_unknown_selection_returns_null(self):
        self.assertIsNone(_run_identify("completely unrelated hobby baking tips"))

    def test_definitions_are_at_most_three_sentences(self):
        node = _require_node()
        script = f"""
const fs = require('fs');
const vm = require('vm');
const window = {{}};
const ctx = {{ window, console, Map }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync({json.dumps(str(FRONTEND / 'glossary.js'))}, 'utf8'), ctx);
const seen = new Set();
let bad = [];
for (const key of ctx.window.AI_TUTOR_GLOSSARY.keysLongestFirst) {{
  const entry = ctx.window.AI_TUTOR_GLOSSARY.byKey.get(key);
  if (seen.has(entry.display)) continue;
  seen.add(entry.display);
  const parts = entry.def.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 3) bad.push(entry.display + ' => ' + parts.length);
}}
process.stdout.write(JSON.stringify(bad));
"""
        proc = subprocess.run(
            [node, "-e", script],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        bad = json.loads(proc.stdout)
        self.assertEqual(bad, [], msg=f"defs with >3 sentences: {bad}")


if __name__ == "__main__":
    unittest.main()
