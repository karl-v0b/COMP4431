"""Start the local AI Tutor app on 127.0.0.1:8000."""

from __future__ import annotations

import argparse
import sys
import webbrowser


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local AI Tutor chatbot.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a browser window automatically",
    )
    parser.add_argument(
        "--skip-setup",
        action="store_true",
        help="Skip prerequisite checks (Python packages / Ollama / models)",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Run setup checks (and auto-fix) then exit without starting the server",
    )
    parser.add_argument(
        "--no-auto-fix",
        action="store_true",
        help="Only report missing prerequisites; do not install packages/models",
    )
    args = parser.parse_args()

    if not args.skip_setup:
        from backend.setup_check import SetupError, run_setup

        try:
            run_setup(auto_fix=not args.no_auto_fix)
        except SetupError as exc:
            print(f"\n[setup] FAILED\n{exc}\n", file=sys.stderr)
            raise SystemExit(1) from exc

    if args.check_only:
        print("[setup] Check-only mode: not starting the server.")
        return

    # Import uvicorn only after setup so missing deps can be installed first.
    import uvicorn

    url = f"http://{args.host}:{args.port}/"
    if not args.no_browser:
        webbrowser.open(url)

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
