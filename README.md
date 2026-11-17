# AI Tutor Chatbot (COMP4431 Group Project)

Local, offline AI course tutor chatbot. No cloud API keys. Runs on your machine via Ollama + a small FastAPI app.
Domain AI/CS tutoring in English or Traditional Chinese with Off-topic guardrails

## Features

- Learning modes: Standard, ELI5, Deep Dive, Exam Prep
- **Summary / Full** toggle: Shorter version of response keeping essential & important key word and their explanation
- **Fast Check:** highlight words in a tutor reply to identify a course term with short explanation
- Modal quiz generator by topic / scope / language
- Avatar, TTS & mute toggle, and break reminders
- Modal chat history

## Hardware note

| Role | Model | Why |
| --- | --- | --- |
| Chat | `qwen2.5:3b` | Fits ~16GB RAM + iGPU; good English + Chinese |

## Requirements

- Windows / macOS / Linux
- Python 3.10+ (tested on 3.15)
- [Ollama](https://ollama.com) installed and running locally

## Setup / Run

`python run.py` **checks prerequisites on startup** and tries to fix them when possible:

- Python 3.10+
- pip packages from `requirements.txt` (auto `pip install` if missing)
- Ollama running on `127.0.0.1:11434` (tries to start / `winget`/`brew` install when available)
- Model: `qwen2.5:3b` (auto `ollama pull` if missing)

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
- `POST /api/chat` — `{"message":"...","history":[],"level":"Standard","language":"English"}` → NDJSON stream of `stage` events then `{"type":"result","reply":"...","summary":"...|null"}`
- `POST /api/quiz` — `{"topic":"...","scope":"Big Picture","language":"English"}` → `{"questions":[...]}`

### Environment variables (optional)

| Variable | Default | Meaning |
| --- | --- | --- |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Chat model |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Local Ollama |
| `OLLAMA_TIMEOUT` | `180` | Chat timeout (seconds) |
| `OLLAMA_NUM_PREDICT` | `2048` | Max tokens for a full tutor reply |

## Demo tips

1. Ask a normal AI/CS question.
2. Switch language / learning mode and re-ask.
3. In a tutor reply, click-drag to highlight a course term → Fast Check popup.
4. Open **Generate Quiz**, pick topic/scope/language, then reveal answers.
5. Try **Remind Me** and the mute toggle.

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
    setup_check.py
    summary_util.py
    prompts/tutor_system.txt
    prompts/summary_system.txt
  frontend/
    index.html
    styles.css
    app.js
    glossary.js
    glossary_match.js
    fastcheck.js
    marked.min.js
  tests/
    test_quiz.py
    test_summary.py
    test_fastcheck.py
```

## Quiz (modal)

1. Run `python run.py`.
2. Click **Generate Quiz**, enter a topic, choose scope and language.
3. Click **Generate**, then **Show Answer** per question.

API: `POST /api/quiz` accepts `topic`, `scope` (`Big Picture` / `In-Depth` / `Very Specific`), and `language`.

Isolated tests: `python -m unittest discover -s tests`.
Covers modal quiz API, summary helpers/prompt, and Fast Check glossary matching.
