# Project Progress File

## For any possible contributors

1. Read this file before changing the project.
2. Keep the app **local-only** (Ollama on `127.0.0.1`, no cloud API keys).
3. After you change project files, **update this `progress.md`**: only revise outdated facts below.
4. If you are an AI agents, please check if this file is up-to-date by compare info below and the actual implementation, and modify it if it isn't.

---

## Context

- **Product:** Local AI tutor chatbot
- **Constraints:** Offline after model download; ~16GB RAM + iGPU; compact plain UI
- **Workspace:** `COMP4431`

Basic: domain Q&A via local LLM with bilingual + learning modes.  
Additional (done): Summary/Full toggle, Fast Check glossary, modal quiz, avatar / mute / break reminders.  
Removed: PDF upload RAG and lecture (PDF-grounded) quiz panel.

---

## Components

| Layer | Stack |
| --- | --- |
| UI | Vanilla HTML/CSS/JS + offline `marked.min.js` |
| App server | FastAPI + Uvicorn (`127.0.0.1:8000`) |
| Chat | Ollama `qwen2.5:3b` |

**Run:** `python run.py` (auto-checks packages / Ollama / models; pulls/installs when possible)  
**Flags:** `--check-only`, `--no-auto-fix`, `--skip-setup`, `--no-browser`

---

## Project structure

```text
COMP4431/
  progress.md
  README.md
  requirements.txt
  run.py / run.bat
  backend/
    main.py                 # FastAPI + chat / quiz routes
    ollama_client.py        # local chat / health / summarize
    setup_check.py          # startup prerequisite checks + auto-fix
    summary_util.py         # is_already_short + load summary prompt
    prompts/tutor_system.txt
    prompts/summary_system.txt
  frontend/
    index.html
    styles.css
    app.js
    glossary.js             # Fast Check term glossary
    glossary_match.js       # longest-match identifyTerm
    fastcheck.js            # highlight → popup
    marked.min.js
  tests/
    test_quiz.py
    test_summary.py
    test_fastcheck.py
```

**Defaults:** chat model `qwen2.5:3b`

---

## APIs

Base URL: `http://127.0.0.1:8000`  
All JSON unless noted. Frontend uses these same endpoints.

### `GET /`
Serves the chat UI (`frontend/index.html`). Static assets are under `/static/...`.

### `GET /api/health`
**Why:** Check if Ollama + chat model are ready.  
**Response (shape):**
```json
{
  "ok": true,
  "ollama": true,
  "model": "qwen2.5:3b",
  "model_available": true,
  "models": ["qwen2.5:3b", "..."],
  "detail": null
}
```
`ok` is true only when the **chat** model is available. UI shows errors from `detail` when unhealthy.

### `POST /api/chat`
**Why:** Main tutor turn with learning mode + language instructions and off-topic guardrails.  
**Request:**
```json
{
  "message": "What is a heuristic?",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "level": "Standard",
  "language": "English"
}
```
- `history`: prior user/assistant turns only (no system). Server keeps last ~12 turns.
**Response:** NDJSON stream (`application/x-ndjson`), one JSON object per line:
```json
{"type":"stage","stage":"write","label":"Writing answer"}
{"type":"stage","stage":"summary","label":"Preparing summary"}
{"type":"result","reply":"...","summary":"...|null"}
```
- `summary` only when a summary will be generated. UI updates the thinking label from `label`.
- Mid-stream failure: `{"type":"error","detail":"..."}`. Summary failures do not emit error; `summary` may be null.

### `POST /api/quiz`
**Why:** Modal quiz — 3 multiple-choice questions from topic / scope / language (no PDF).  
**Request:** `{ "topic": "BFS", "scope": "Big Picture", "language": "English" }`  
**Response:** `{ "questions": [ { "question", "options", "correct_index", "explanation" }, ... ] }`  
**Errors:** `400` off-topic topic; `500` invalid model JSON / generation failure.

---

## UI behavior

- Compact UI in indigo / gray test-feature style (no decorative emoji except AI avatar).
- Tutor replies: Markdown via offline `marked.min.js`; user messages stay plain text.
- Actions under each tutor reply: **Summary** / **Full** toggle (when `summary` is present) then **Copy**.
  - Default view is the full reply; **Summary** switches to the short version.
  - **Copy** copies the currently displayed text.
  - Conversation history always stores the full `reply`.
- Thinking animation while `/api/chat` is in flight; labels: **Writing answer** → **Preparing summary**.
- Settings bar: Language, Mode (Standard / ELI5 / Deep Dive / Exam Prep), Audio mute.
- Header: avatar, **Remind Me** break toasts, **Generate Quiz** modal.
- **Fast Check:** click-drag highlight inside a tutor reply body. Longest glossary match; popup; no Ollama.
  - Course glossary: **114** distinct concepts across 10 shallow topics + 2 app extras (`RAG`, `prompt`).
- Header model status hidden unless unhealthy.

---

## Known limits

- **Local only:** no cloud LLM APIs; bind `127.0.0.1`.
- **Chinese:** use `qwen2.5:3b`; `llama3.2:3b` often failed Traditional Chinese.
- **Hardware:** ~16GB RAM + iGPU; prefer ~3B chat models; first replies on CPU can be slow.
- **Chat length:** full tutor replies use `OLLAMA_NUM_PREDICT` (default **2048**). Summaries use 768.
- **Setup auto-fix:** `run.py` can pip-install deps and `ollama pull` models; Ollama app install is best-effort.
- **Guardrails:** keyword list is heuristic; easy to bypass with paraphrases.
- **Quiz quality:** 3B model JSON can be flaky; answers/explanations may be wrong.

## Modal quiz

- Implemented in `backend/main.py` (`POST /api/quiz`) + modal UI in `frontend/index.html` / `app.js`.
- Scope: Big Picture / In-Depth / Very Specific; bilingual.
- Tests: `tests/test_quiz.py` (mocked chat; off-topic; fence stripping; invalid JSON).

## Summary / Full toggle

- After each successful chat reply, the server may generate a shorter structured Markdown summary.
- Summary language follows the chat language setting (prompt + summarize instruction).
- UI toggle next to Copy; no extra models.
- Tests: `tests/test_summary.py`.

## Fast Check

- Client-side longest-match glossary lookup (instant).
- Files: `frontend/glossary.js`, `frontend/glossary_match.js`, `frontend/fastcheck.js`.
- Tests: `tests/test_fastcheck.py`.
