# AI Tutor Chatbot (COMP4431 Group Project)

Local, offline AI course tutor chatbot. No cloud API keys. Runs on your machine via Ollama + a small FastAPI app.

## Hardware note

Default model: **`llama3.2:3b`**

Chosen for typical student laptops with **~16GB RAM and integrated graphics**. Ollama will usually run on CPU. Larger 7B/8B models are not the project default (slower / tighter on 16GB for a live demo).

Optional lighter fallback:

```text
ollama pull llama3.2:1b
set OLLAMA_MODEL=llama3.2:1b
```

## Requirements

- Windows / macOS / Linux
- Python 3.10+
- [Ollama](https://ollama.com) installed and running locally

## Setup (one-time; needs internet only to download the model)

1. Install Ollama and start it.
2. Pull the model:

```bash
ollama pull llama3.2:3b
```

3. Install Python dependencies from the project root:

```bash
pip install -r requirements.txt
```

After the model is downloaded, the app can run **offline**.

## Run (local only)

From the project root:

```bash
python run.py
```

This starts the app on **`http://127.0.0.1:8000/`** and opens a browser.

To skip opening a browser:

```bash
python run.py --no-browser
```

Windows shortcut:

```bash
run.bat
```

### Useful checks

- Health: `http://127.0.0.1:8000/api/health`
- Chat API: `POST http://127.0.0.1:8000/api/chat` with JSON `{"message":"...","history":[]}`

### Environment variables (optional)

| Variable       | Default                     | Meaning              |
| -------------- | --------------------------- | -------------------- |
| `OLLAMA_MODEL` | `llama3.2:3b`               | Model name in Ollama |
| `OLLAMA_HOST`  | `http://127.0.0.1:11434`    | Local Ollama URL     |
| `OLLAMA_TIMEOUT` | `180`                     | Chat timeout (seconds) |

## Demo tips

Example questions:

1. What is a heuristic in informed search?
2. Give a small example with A*.
3. Off-topic: What’s the weather? (should redirect to course topics)

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
  frontend/
    index.html
    styles.css
    app.js
    marked.min.js   # local markdown renderer (offline)
```

Tutor replies are rendered as Markdown in the chat window (headings, lists, code, bold/italic). User messages stay plain text.
