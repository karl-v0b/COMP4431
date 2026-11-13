"""Local FastAPI app for the AI Tutor."""

from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.ollama_client import OllamaError, chat, health

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "tutor_system.txt"

app = FastAPI(title="AI Tutor", docs_url=None, redoc_url=None)

def load_system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip()

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)
    level: str = Field(default="Standard")
    language: str = Field(default="English")

class ChatResponse(BaseModel):
    reply: str
    sources: list[str] = Field(default_factory=list)

class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1)
    scope: str = Field(default="Big Picture")
    language: str = Field(default="English")

# --- DOMAIN RESTRICTION WORD LIST ---
# Add any off-topic words here to force a refusal.
OFF_TOPIC_KEYWORDS = ["cake", "recipe", "cook", "bake", "baking", "food", "weather", "joke", "cook", "sports", "football", "movie", "music"]

def is_off_topic(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in OFF_TOPIC_KEYWORDS)

@app.get("/api/health")
async def api_health():
    return await health()

@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(body: ChatRequest):
    trimmed = body.history[-12:]
    question = body.message.strip()
    
    # --- NEW: HARDCODED DOMAIN RESTRICTION ---
    if is_off_topic(question):
        refusal = "I am a COMP4431 AI Tutor and can only help with Computer Science, Artificial Intelligence, and Algorithms. Let's get back to studying!"
        if body.language == "Traditional Chinese":
            refusal = "抱歉，我是 COMP4431 AI 導師，只能協助計算機科學、人工智慧和演算法相關的問題。讓我們回到學習吧！"
        return ChatResponse(reply=refusal, sources=[])
    # ----------------------------------------
    
    mode_instruction = f"CRITICAL: You must strictly follow [MODE: {body.level}].\n"
    lang_instruction = f"CRITICAL: You must reply entirely in {body.language}.\n\n"
    
    user_content = f"{mode_instruction}{lang_instruction}Question: {question}"

    messages: list[dict[str, str]] = [
        {"role": "system", "content": load_system_prompt()},
        *[m.model_dump() for m in trimmed],
        {"role": "user", "content": user_content},
    ]
    
    try:
        reply = await chat(messages)
    except OllamaError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ChatResponse(reply=reply, sources=[])

@app.post("/api/quiz")
async def api_quiz(body: QuizRequest):
    # We should also guard the quiz generator
    if is_off_topic(body.topic):
        raise HTTPException(status_code=400, detail="Topic is outside the Computer Science domain.")

    scope_guide = {
        "Big Picture": "Ask high-level conceptual questions about how this topic connects to other ideas and its overall purpose.",
        "In-Depth": "Ask questions about layers, mechanisms, and internal workings of the topic.",
        "Very Specific": "Ask questions about particular terminology, edge cases, and fine-grained details within the topic."
    }
    guidance = scope_guide.get(body.scope, scope_guide["Big Picture"])

    prompt = (
        f"Generate EXACTLY 3 multiple-choice questions about '{body.topic}' for a COMP4431 AI/CS student.\n"
        f"Scope: {body.scope}. {guidance}\n"
        f"Language: {body.language}\n"
        "CRITICAL: Keep the question text, options, and explanation EXTREMELY SHORT (under 15 words each).\n"
        "You MUST output ONLY a valid JSON array of 3 objects, with no markdown formatting or extra text.\n"
        "Format:\n"
        "[\n"
        "  {\n"
        '    "question": "The question text",\n'
        '    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],\n'
        '    "correct_index": 0,\n'
        '    "explanation": "Short explanation"\n'
        "  },\n"
        "  ...\n"
        "]\n"
        "correct_index must be an integer between 0 and 3."
    )
    
    messages = [
        {"role": "system", "content": "You are a JSON generator. Output only raw JSON arrays."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        reply = await chat(messages)
        clean = reply.strip()
        
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
            
        clean = clean.strip()

        try:
            data = json.loads(clean)
        except json.JSONDecodeError:
            match = re.search(r'\[.*\]', clean, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
            else:
                raise ValueError("Could not find a valid JSON array in the response.")

        if not isinstance(data, list) or len(data) != 3:
            raise ValueError("Expected a list of exactly 3 questions.")
        return {"questions": data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(exc)}. Try again.") from exc

@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
