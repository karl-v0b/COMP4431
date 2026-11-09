# Project Progress File

## For any possible contributors

1. Read this file before changing the project.
2. Keep the app **local-only** (Ollama on `127.0.0.1`, no cloud API keys).
3. After you change project files, **update this `progress.md`**: revise outdated facts below.

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

**Run:** `pip install -r requirements.txt` → `python run.py`  
**Pulls:** `ollama pull qwen2.5:3b nomic-embed-text moondream`

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
    prompts/tutor_system.txt
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
    marked.min.js
```

**Main APIs:** `POST /api/chat` (`reply`, `sources`), `POST /api/upload`, `GET|DELETE /api/documents`, `GET /api/health`

**Defaults:** max ~20MB / 30 pages / 3 PDFs; retrieve `k=4`; chat model `qwen2.5:3b`