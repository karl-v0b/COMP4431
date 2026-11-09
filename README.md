# AI Tutor Chatbot (COMP4431 Group Project)

Local, offline AI course tutor chatbot. No cloud API keys. Runs on your machine via Ollama + a small FastAPI app.

## Features

- Domain AI/CS tutoring in English or Chinese
- Markdown tutor replies + Copy button
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

## Setup (one-time; internet only to download models)

```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
ollama pull moondream

pip install -r requirements.txt
```

After models are downloaded, the app can run **offline**.

## Run (local only)

```bash
python run.py
```

Opens **`http://127.0.0.1:8000/`**.

```bash
python run.py --no-browser
```

or `run.bat`.

### Useful APIs

- `GET /api/health`
- `POST /api/chat` — `{"message":"...","history":[]}`
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
| `RAG_MAX_FILE_BYTES` | `20971520` | Max PDF size (~20MB) |
| `RAG_MAX_PAGES` | `30` | Max pages per PDF |
| `RAG_MAX_DOCUMENTS` | `3` | Max active PDFs |
| `RAG_MAX_FIGURES` | `20` | Max figures captioned per PDF |
| `RAG_RETRIEVE_K` | `4` | Chunks retrieved per question |

## Demo tips

1. Ask a normal AI question (no PDF).
2. Upload a lecture PDF → wait until status shows indexed chunks.
3. Ask “What does this PDF say about …?” or “What does the figure on page N show?”
4. Switch to Traditional Chinese and re-ask.
5. Clear PDF or stop the server to drop the PDF index.

No PDF is loaded by default.

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
    marked.min.js
```
