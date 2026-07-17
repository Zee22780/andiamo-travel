"""Anthropic client setup + first real call.

════ YOUR PIECE — P0.3 ════
Done when:  uv run pytest -m live tests/test_live.py::test_smoke_call   passes.
Reference:  GUIDE.md § P0.3

The model split (see PLAN.md, cost knobs): the orchestrator and critic run on
Opus; the leg-workers run on Haiku — that split is what makes the multi-agent
token blow-up affordable.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

ORCHESTRATOR_MODEL = "claude-opus-4-8"
WORKER_MODEL = "claude-haiku-4-5"

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_env() -> None:
    """Load ANTHROPIC_API_KEY from the repo root .env.local (dev convenience —
    the deployed service will get it as a real env var)."""
    load_dotenv(REPO_ROOT / ".env.local")


# TODO(you): def get_client() -> AsyncAnthropic
#   Call load_env() first, then construct anthropic.AsyncAnthropic().
#   (The SDK reads ANTHROPIC_API_KEY from the environment on its own.)

# TODO(you): async def smoke() -> str
#   One hardcoded call: ask ORCHESTRATOR_MODEL for a one-line travel tip and
#   return the text of the first text content block. This proves client + key
#   + async plumbing before any orchestration exists.
