# AI Tutor Chatbot (COMP4431 Group Project)

Local, offline AI course tutor chatbot. No cloud API keys. Runs on your machine via Ollama + a small FastAPI app.

## Features

- Domain AI/CS tutoring in English or Chinese
- Markdown tutor replies + Copy button + **Summary / Full** toggle (AI short study summary generated with each reply)
- **Fast Check:** highlight words in a tutor reply to instantly identify one technical term and see a ≤3-sentence gloss (local glossary: **114** course terms across 10 shallow lecture topics, plus RAG/prompt app extras; no model call)
- **PDF upload RAG (additional feature):** upload lecture PDFs; the tutor answers using retrieved text, tables, and short captions of figures/graphs. Indexed documents live **until the server process stops**.

## Hardware note

| Role | Model | Why |
| --- | --- | --- |
| Chat | `qwen2.5:3b` | Fits ~16GB RAM + iGPU; good English + Chinese |
| Embeddings | `nomic-embed-text` | Local RAG embeddings |
| Figure captions | `moondream` | Small local vision model; captions images once at upload |

Vector store: LangChain **InMemoryVectorStore** (server lifetime). Chroma was not used because `onnxruntime` has no Python 3.15 wheel on this setup; behavior still matches “until server shut down.”

## Requirements

- Windows / macOS / Linux
- Python 3.10+ (tested on 3.15)
- [Ollama](https://ollama.com) installed and running locally

## Setup / Run

`python run.py` **checks prerequisites on startup** and tries to fix them when possible:

- Python 3.10+
- pip packages from `requirements.txt` (auto `pip install` if missing)
- Ollama running on `127.0.0.1:11434` (tries to start / `winget`/`brew` install when available)
- Models: `qwen2.5:3b`, `nomic-embed-text`, `moondream` (auto `ollama pull` if missing)

Internet is only needed the first time packages/models are downloaded. After that, the app can run **offline**.

```bash
python run.py
```

Opens **`http://127.0.0.1:8000/`**.

Useful flags:

```bash
python run.py --no-browser
python run.py --check-only          # check/fix only, do not start server
python run.py --no-auto-fix      # report missing items without installing
python run.py --skip-setup          # start immediately (advanced)
```

or `run.bat`.

If Ollama cannot be installed automatically, install from https://ollama.com/download, start the app, then re-run `python run.py`.

### Useful APIs

- `GET /api/health`
- `POST /api/chat` — `{"message":"...","history":[]}` → NDJSON stream of `stage` events (`Retrieving notes` / `Writing answer` / `Preparing summary`) then `{"type":"result","reply":"...","summary":"...|null","sources":[]}`
- `POST /api/upload` — multipart PDF field `file`
- `GET /api/documents`
- `DELETE /api/documents` — clear indexed PDFs for this server run

### Environment variables (optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Chat model |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model |
| `OLLAMA_VISION_MODEL` | `moondream` | Figure caption model |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Local Ollama |
| `OLLAMA_TIMEOUT` | `180` | Chat timeout (seconds) |
| `OLLAMA_NUM_PREDICT` | `2048` | Max tokens for a full tutor reply (raise if answers still truncate) |
| `RAG_MAX_FILE_BYTES` | `20971520` | Max PDF size (~20MB) |
| `RAG_MAX_PAGES` | `30` | Max pages per PDF |
| `RAG_MAX_DOCUMENTS` | `3` | Max active PDFs |
| `RAG_MAX_FIGURES` | `20` | Max figures captioned per PDF |
| `RAG_RETRIEVE_K` | `4` | Chunks retrieved per question |

## Demo tips

1. Ask a normal AI question (no PDF).
2. In a tutor reply, click-drag to highlight a phrase that includes a course term (e.g. “breadth-first search”) → Fast Check popup; click away to clear.
3. Upload a lecture PDF → wait until status shows indexed chunks.
4. Ask “What does this PDF say about …?” or “What does the figure on page N show?”
5. Switch to Traditional Chinese and re-ask.
6. Clear PDF or stop the server to drop the PDF index.

## Project layout

```text
COMP4431/
  run.py
  run.bat
  requirements.txt
  README.md
  backend/
    main.py
    ollama_client.py
    prompts/tutor_system.txt
    prompts/summary_system.txt
    rag/
      config.py
      store.py
      ingest.py
      retrieve.py
      caption.py
  frontend/
    index.html
    styles.css
    app.js
    quiz.js
    glossary.js
    fastcheck.js
    marked.min.js
```

## Quiz mode

1. Run `python run.py` and upload lecture PDFs as usual.
2. Select **Quiz**, enter a topic present in your notes, and choose 1, 3, or 5 questions, difficulty, and English or Traditional Chinese.
3. Select **Generate quiz**, answer every question, and select **Submit answers**.
4. Review your score, explanations, and expandable source passages. Generate another quiz to practise again.

Quiz generation runs locally using the existing chat and embedding models. No extra models or packages are required. Answers are stored on the server and returned only after submission. Each quiz lasts one hour or until the server restarts; at most 100 quizzes are retained. Clearing uploaded PDFs does not clear an already generated quiz's evidence snapshot. Quiz history is not saved to disk.

Questions are based on six retrieved passages, not exhaustive coverage of all uploaded notes. Generated answer keys and explanations may be wrong; review the evidence. Difficulty is requested from the model, not formally calibrated. Local generation may take a few minutes. Invalid output is retried once and then shown as an actionable error.

API: `POST /api/quiz` accepts `topic`, `count` (1–5), `difficulty` (easy/medium/hard), and `language` (English/Traditional Chinese). `POST /api/quiz/{id}/submit` accepts zero-based `answers` in question order.

Isolated tests (with dependencies installed; Node required for Fast Check tests): `python -m unittest discover -s tests`.
Covers quiz API, summary helpers/prompt, and Fast Check glossary matching (not chat NDJSON streaming).
