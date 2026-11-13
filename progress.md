# Project Progress File

## For any possible contributors

1. Read this file before changing the project.
2. Keep the app **local-only** (Ollama on `127.0.0.1`, no cloud API keys).
3. After you change project files, **update this `progress.md`**: only revise outdated facts below.
4. If you are an AI agents, please check if this file is up-to-date by compare info below and the actual implementation, and modify it if it isn't.

---

## Context


- **Product:** Local AI tutor chatbot
- **Constraints:** Offline after model download; ~16GB RAM + iGPU; minimal plain UI (Can be changed if implementing additional feature)
- **Workspace:** `COMP4431`

Basic: domain Q&A via local LLM.  
Additional (done): PDF upload RAG (text/tables + figure captions) until server stops.

---

## Components

| Layer | Stack |
| --- | --- |
| UI | Vanilla HTML/CSS/JS + offline `marked.min.js` |
| App server | FastAPI + Uvicorn (`127.0.0.1:8000`) |
| Chat | Ollama `qwen2.5:3b` |
| Embeddings | Ollama `nomic-embed-text` |
| Figure captions | Ollama `moondream` (at PDF upload only) |
| RAG | LangChain + `InMemoryVectorStore` (not Chroma — no onnxruntime on Python 3.15) |
| PDF parse | PyMuPDF |

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
    main.py                 # FastAPI + routes
    ollama_client.py        # local chat/health
    setup_check.py          # startup prerequisite checks + auto-fix
    prompts/tutor_system.txt
    prompts/summary_system.txt  # Summary/Full rewrite rules
    quiz.py                 # PDF-grounded quiz API
    rag/
      config.py             # limits + model names
      store.py              # in-memory vector store
      ingest.py             # PDF → chunks
      retrieve.py           # context + PDF source names
      caption.py            # moondream captions
  frontend/
    index.html
    styles.css
    app.js
    quiz.js
    marked.min.js
  tests/
    test_quiz.py
```

**Defaults:** max ~20MB / 30 pages / 3 PDFs; retrieve `k=4`; chat model `qwen2.5:3b`

---

## APIs

Base URL: `http://127.0.0.1:8000`  
All JSON unless noted. Frontend uses these same endpoints.

### `GET /`
Serves the chat UI (`frontend/index.html`). Static assets are under `/static/...`.

### `GET /api/health`
**Why:** Check if Ollama + chat model are ready; also returns current RAG state.  
**Response (shape):**
```json
{
  "ok": true,
  "ollama": true,
  "model": "qwen2.5:3b",
  "model_available": true,
  "models": ["qwen2.5:3b", "..."],
  "detail": null,
  "rag": {
    "documents": [{"id": "...", "filename": "a.pdf", "pages": 4, "chunks": 7}],
    "has_documents": true,
    "ingest": {"stage": "ready", "detail": "...", "filename": "a.pdf", "chunks": 7, "error": null}
  }
}
```
`ok` is true only when the **chat** model is available. UI shows errors from `detail` when unhealthy.

### `POST /api/chat`
**Why:** Main tutor turn. Optional RAG: if PDFs are indexed, retrieves top chunks, injects into system prompt, then calls Ollama.  
**Request:**
```json
{
  "message": "What is a heuristic?",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```
- `history`: prior user/assistant turns only (no system). Server keeps last ~12 turns.
**Response:**
```json
{
  "reply": "markdown text from tutor",
  "summary": "shorter structured markdown | null",
  "sources": ["lecture.pdf"]
}
```
- `sources`: PDF filenames used in retrieval for this turn (may be `[]` if no PDFs / no hits). UI labels messages with these names.
- `summary`: optional AI rewrite of `reply` (second Ollama call in the same turn). `null` when the full reply is already short (≤3 non-empty lines or &lt;40 words), summarization fails, or the rewrite matches the full text. Chat history should keep `reply` only.  
**Errors:** `503` if Ollama/RAG fails on the **full** reply (`detail` string). Summary failures do not fail the chat turn.

### `POST /api/upload`
**Why:** Add/replace a PDF in the **server-lifetime** index (text, tables, figure captions → embed).  
**Request:** `multipart/form-data` field `file` (`.pdf` only).  
**Limits:** size/pages/count from `backend/rag/config.py` (defaults ~20MB, 30 pages, max 3 PDFs). Same filename replaces previous chunks.  
**Response:**
```json
{
  "ok": true,
  "document": {
    "id": "...",
    "filename": "lecture.pdf",
    "pages": 4,
    "chunks": 7,
    "figures_captioned": 2
  },
  "documents": [ /* full active list */ ],
  "ingest": { "stage": "ready", "detail": "...", "...": "..." }
}
```
**Errors:** `400` bad/oversized/non-PDF/ingest limit; `500` unexpected ingest failure.  
**Note:** Needs embed model; figure captions need vision model (`moondream`). Cleared when process exits.

### `GET /api/documents`
**Why:** List PDFs currently indexed for this server run + last ingest status.  
**Response:** `{ "documents": [...], "ingest": {...} }`

### `DELETE /api/documents`
**Why:** Clear all uploaded PDF chunks for this run (UI “Clear PDF”).  
**Response:** `{ "ok": true, "documents": [], "ingest": {...} }`

---

## UI behavior

- Minimal plain UI (no CDN icons/fonts for core chrome).
- Tutor replies: Markdown via offline `marked.min.js`; user messages stay plain text.
- Actions under each tutor reply (bottom-right row): **Summary** / **Full** toggle (when `summary` is present) then **Copy**.
  - Default view is the full reply; **Summary** switches to the short version and the button label becomes **Full**.
  - **Copy** copies the currently displayed text.
  - Conversation history always stores the full `reply`.
- Thinking animation while `/api/chat` is in flight (includes summary generation when applicable).
- Header model status hidden unless unhealthy.
- PDF panel: Upload PDF / Clear PDF.
  - Status: `x PDF is Loaded` / `All PDF is Cleared` (after clear) / `Loading PDF…`
  - List: `No PDF Loaded` / `filename.pdf Loaded`
- When a turn uses retrieved PDFs, user + tutor messages show `PDF: name.pdf` (or multiple names). No label if `sources` is empty.
- No PDF loaded by default; index is empty until upload in this server process.

---

## Known limits

- **Local only:** no cloud LLM APIs; bind `127.0.0.1`.
- **PDF index is not durable:** stopping `run.py` clears uploads; Clear PDF does the same for the run.
- **Chroma not used:** Python 3.15 had no usable `onnxruntime` wheel → `InMemoryVectorStore` instead (same server-lifetime idea).
- **Chinese:** use `qwen2.5:3b`; `llama3.2:3b` often failed Traditional Chinese (`.` / empty lists).
- **Figures:** `moondream` captions at upload are short summaries, not perfect chart OCR; chat model never sees raw page images.
- **Hardware:** ~16GB RAM + iGPU; prefer ~3B chat models; first replies on CPU can be slow.
- **Setup auto-fix:** `run.py` can pip-install deps and `ollama pull` models; Ollama app install is best-effort (`winget`/`brew`) — may still need manual install from https://ollama.com/download.
- **Upload caps (defaults):** ~20MB / 30 pages / 3 PDFs / 20 figures captioned per PDF (`backend/rag/config.py`).

## Quiz mode addition

- Implemented PDF-grounded multiple-choice quizzes in `backend/quiz.py` and `frontend/quiz.js`.
- Chat/Quiz navigation; topic, count, difficulty, and language controls.
- Structured JSON generation through existing local Ollama model; validation and one retry.
- Server-side answer keys and scoring; explanations and retrieved source/page/excerpt after submission.
- Up to 100 in-memory quiz sessions; one-hour expiry. Existing PDF clearing leaves quiz snapshots intact.
- Added isolated API tests in `tests/test_quiz.py`. Real-model answer quality still needs review on the target machine.

## Summary / Full toggle

- After each successful chat reply, the server may generate a shorter structured Markdown summary (`backend/prompts/summary_system.txt` + `summarize()` in `ollama_client.py`).
- Rules (prompt-enforced): &lt;~half length; structure-first (tables, `Term: meaning`, formulas); keep core points; same language; no new facts; keep citations/notation.
- UI toggle next to Copy; no extra models. Summary quality depends on the local 3B model.
