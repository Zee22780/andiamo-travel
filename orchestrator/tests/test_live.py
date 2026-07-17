"""Live acceptance checks — real Anthropic API calls (cost money).

Excluded from the default run; invoke explicitly:
    uv run pytest -m live tests/test_live.py -v
Each test skips cleanly until its piece exists, so you can run this file at
any point and see exactly where you are.
"""

import asyncio
import os
from datetime import date, timedelta

import pytest

import app.claude as claude

pytestmark = pytest.mark.live

PROFILE = {
    "destination": "Portugal",
    "route": ["Porto", "Lisbon"],
    "startDate": "2027-05-14",
    "endDate": "2027-05-19",
    "travelers": 2,
    "budget": "mid",
    "pace": "balanced",
    "interests": ["food", "history", "views"],
    "mustInclude": [],
    "readyToGenerate": True,
}

CATALOG = [
    {"slug": "porto/livraria-lello", "destination": "porto", "type": "activity", "title": "Livraria Lello", "typicalDurationMin": 60},
    {"slug": "porto/cais-da-ribeira", "destination": "porto", "type": "activity", "title": "Cais da Ribeira", "typicalDurationMin": 90},
    {"slug": "lisbon/torre-de-belem", "destination": "lisbon", "type": "activity", "title": "Torre de Belém", "typicalDurationMin": 60},
    {"slug": "lisbon/pasteis-de-belem", "destination": "lisbon", "type": "meal", "title": "Pastéis de Belém", "typicalDurationMin": 45},
]


def require_key() -> None:
    claude.load_env()
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set (expected in repo root .env.local)")


def date_range(start: str, end: str) -> list[str]:
    d0, d1 = date.fromisoformat(start), date.fromisoformat(end)
    return [(d0 + timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)]


def test_smoke_call() -> None:
    """P0.3 — one real AsyncAnthropic call works end to end."""
    if not hasattr(claude, "smoke"):
        pytest.skip("P0.3 not implemented yet — write smoke() in app/claude.py")
    require_key()
    text = asyncio.run(claude.smoke())
    assert isinstance(text, str) and text.strip()


def test_orchestrator_skeleton_covers_every_date() -> None:
    """P1.1 — a real profile yields a sane skeleton; every date covered once."""
    import app.orchestrator as orchestrator

    if not hasattr(orchestrator, "plan_skeleton"):
        pytest.skip("P1.1 not implemented yet — write plan_skeleton in app/orchestrator.py")
    require_key()

    skeleton = asyncio.run(orchestrator.plan_skeleton(PROFILE, CATALOG))
    assert skeleton.tripName
    assert len(skeleton.legs) >= 2  # two-city route → at least two legs

    covered: list[str] = []
    for leg in skeleton.legs:
        covered.extend(date_range(leg.startDate, leg.endDate))
    expected = date_range(PROFILE["startDate"], PROFILE["endDate"])
    assert sorted(covered) == expected, "every trip date must be covered exactly once"


def test_worker_fills_one_leg() -> None:
    """P1.2 — one leg fills correctly in isolation, from scoped context only."""
    import app.models as models
    import app.worker as worker

    if not hasattr(worker, "plan_leg"):
        pytest.skip("P1.2 not implemented yet — write plan_leg in app/worker.py")
    if not hasattr(models, "Leg"):
        pytest.skip("P1.2 needs the P0.1 models first")
    require_key()

    leg_skeleton = {
        "destination": "Porto",
        "startDate": "2027-05-14",
        "endDate": "2027-05-15",
        "pacing": "balanced — 3-4 stops per day, one anchor sight per day",
        "arrivalNote": "arrives mid-morning on the 14th",
    }
    porto_catalog = [c for c in CATALOG if c["destination"] == "porto"]

    leg = asyncio.run(worker.plan_leg(leg_skeleton, PROFILE, porto_catalog))
    assert isinstance(leg, models.Leg)
    assert leg.destination.lower().startswith("porto")
    assert [day.date for day in leg.days] == ["2027-05-14", "2027-05-15"]
    assert all(day.stops for day in leg.days)

    # Refs must only use slugs from the scoped catalog subset.
    allowed = {c["slug"] for c in porto_catalog}
    for day in leg.days:
        for stop in day.stops:
            if hasattr(stop, "poi"):
                assert stop.poi in allowed, f"invented or out-of-scope slug: {stop.poi}"
