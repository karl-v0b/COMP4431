"""Startup checks: Python deps, Ollama, and required models (auto-fix when possible)."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIREMENTS = ROOT / "requirements.txt"

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
CHAT_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
VISION_MODEL = os.getenv("OLLAMA_VISION_MODEL", "moondream")

REQUIRED_MODELS = (CHAT_MODEL, EMBED_MODEL, VISION_MODEL)

REQUIRED_IMPORTS: list[tuple[str, str]] = [
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("httpx", "httpx"),
    ("multipart", "python-multipart"),
    ("pymupdf", "pymupdf"),
    ("langchain", "langchain"),
    ("langchain_community", "langchain-community"),
    ("langchain_ollama", "langchain-ollama"),
    ("langchain_text_splitters", "langchain-text-splitters"),
]


class SetupError(Exception):
    """Unrecoverable setup failure."""


def _log(msg: str) -> None:
    print(f"[setup] {msg}", flush=True)


def check_python(min_major: int = 3, min_minor: int = 10) -> None:
    if sys.version_info < (min_major, min_minor):
        raise SetupError(
            f"Python {min_major}.{min_minor}+ is required. "
            f"Current: {sys.version.split()[0]}. Install from https://www.python.org/downloads/"
        )
    _log(f"Python OK ({sys.version.split()[0]})")


def _missing_imports() -> list[tuple[str, str]]:
    missing: list[tuple[str, str]] = []
    for module_name, pip_name in REQUIRED_IMPORTS:
        if importlib.util.find_spec(module_name) is None:
            missing.append((module_name, pip_name))
    return missing


def ensure_python_packages(auto_fix: bool) -> None:
    missing = _missing_imports()
    if not missing:
        _log("Python packages OK")
        return

    names = ", ".join(pip for _, pip in missing)
    _log(f"Missing packages: {names}")
    if not auto_fix:
        raise SetupError(f'Install packages first: pip install -r "{REQUIREMENTS}"')

    _log(f"Installing from {REQUIREMENTS} …")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        cwd=str(ROOT),
    )
    if result.returncode != 0:
        raise SetupError(f'pip install failed. Run: pip install -r "{REQUIREMENTS}"')

    still = _missing_imports()
    if still:
        left = ", ".join(pip for _, pip in still)
        raise SetupError(f"Still missing after install: {left}")
    _log("Python packages installed")


def ollama_cli() -> str | None:
    path = shutil.which("ollama")
    if path:
        return path
    if sys.platform == "win32":
        local = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe"
        if local.exists():
            return str(local)
    return None


def ollama_http_ok(timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _try_install_ollama() -> bool:
    if sys.platform == "win32" and shutil.which("winget"):
        _log("Trying: winget install Ollama.Ollama …")
        result = subprocess.run(
            [
                "winget",
                "install",
                "-e",
                "--id",
                "Ollama.Ollama",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
            cwd=str(ROOT),
        )
        return result.returncode == 0

    if sys.platform == "darwin" and shutil.which("brew"):
        _log("Trying: brew install ollama …")
        return subprocess.run(["brew", "install", "ollama"], cwd=str(ROOT)).returncode == 0

    return False


def _wait_for_ollama(wait_seconds: int) -> bool:
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if ollama_http_ok():
            return True
        time.sleep(1.5)
    return False


def ensure_ollama(auto_fix: bool, wait_seconds: int = 90) -> None:
    if ollama_http_ok():
        _log(f"Ollama service OK ({OLLAMA_HOST})")
        return

    cli = ollama_cli()
    if cli:
        _log("Ollama CLI found but service not responding; starting it …")
        subprocess.Popen(
            [cli, "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(ROOT),
        )
        if _wait_for_ollama(wait_seconds):
            _log("Ollama service is up")
            return
        raise SetupError(
            "Ollama CLI exists but did not become ready. "
            "Open the Ollama app manually, then re-run."
        )

    _log("Ollama not found.")
    if auto_fix and _try_install_ollama():
        _log("Ollama install finished. Waiting for service …")
        cli = ollama_cli()
        if cli and not ollama_http_ok():
            subprocess.Popen(
                [cli, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        if _wait_for_ollama(wait_seconds):
            _log("Ollama service is up")
            return

    raise SetupError(
        "Ollama is required but not available.\n"
        "  1. Install from https://ollama.com/download\n"
        "  2. Start the Ollama app\n"
        "  3. Re-run: python run.py"
    )


def _list_models() -> list[str]:
    try:
        with urllib.request.urlopen(f"{OLLAMA_HOST}/api/tags", timeout=10) as resp:
            data = json.load(resp)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise SetupError(f"Cannot list Ollama models: {exc}") from exc
    return [item.get("name", "") for item in data.get("models", [])]


def _model_present(name: str, installed: list[str]) -> bool:
    return any(
        item == name or item.startswith(f"{name}:") or item.startswith(f"{name}-")
        for item in installed
    ) or name in installed


def _pull_model(model: str) -> None:
    cli = ollama_cli()
    if cli:
        _log(f"Running: ollama pull {model}")
        result = subprocess.run([cli, "pull", model], cwd=str(ROOT))
        if result.returncode != 0:
            raise SetupError(f"ollama pull {model} failed. Try manually.")
        return

    _log(f"Pulling {model} via Ollama HTTP API …")
    payload = json.dumps({"name": model, "stream": False}).encode()
    req = urllib.request.Request(
        f"{OLLAMA_HOST}/api/pull",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3600) as resp:
            resp.read()
    except Exception as exc:
        raise SetupError(
            f"Failed to pull {model}: {exc}\nRun manually: ollama pull {model}"
        ) from exc


def ensure_models(auto_fix: bool) -> None:
    installed = _list_models()
    missing = [m for m in REQUIRED_MODELS if not _model_present(m, installed)]
    if not missing:
        _log("Ollama models OK: " + ", ".join(REQUIRED_MODELS))
        return

    _log("Missing models: " + ", ".join(missing))
    if not auto_fix:
        raise SetupError(
            "Pull models manually:\n  " + "\n  ".join(f"ollama pull {m}" for m in missing)
        )

    for model in missing:
        _pull_model(model)

    installed = _list_models()
    still = [m for m in REQUIRED_MODELS if not _model_present(m, installed)]
    if still:
        raise SetupError("Models still missing after pull: " + ", ".join(still))
    _log("All required models are ready")


def run_setup(*, auto_fix: bool = True) -> None:
    """Check and optionally fix local prerequisites. Raises SetupError on failure."""
    _log("Checking local prerequisites …")
    check_python()
    ensure_python_packages(auto_fix=auto_fix)
    ensure_ollama(auto_fix=auto_fix)
    ensure_models(auto_fix=auto_fix)
    _log("Setup checks passed.")
