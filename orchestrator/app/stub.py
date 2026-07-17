"""Canned C2 stream — the stub planner.

Streams a fixed 2-leg itinerary (app/stub_itinerary.json) as the exact SSE
sequence the real pipeline will emit: skeleton → leg (per leg) → itinerary →
done. This exists so the Next.js side can integrate against the contract
before any real agent works, and doubles as a working reference for the
async-generator + SSE pattern the real pipeline will use.

The fixture is also the round-trip fixture for the P0.1 model tests — it
exercises both stop variants (catalog refs and inline stops) and every
nullable field.
"""

import asyncio
import json
from pathlib import Path
from typing import Any, AsyncIterator

from .sse import sse_event

STUB_PATH = Path(__file__).with_name("stub_itinerary.json")


def load_stub_itinerary() -> dict[str, Any]:
    return json.loads(STUB_PATH.read_text())


async def stream_stub_plan(summary: dict[str, Any]) -> AsyncIterator[str]:
    itinerary = load_stub_itinerary()
    # Echo something from the request so end-to-end wiring is provable: a
    # saved trip named "[stub] …" means the request body made it through.
    destination = summary.get("destination")
    if isinstance(destination, str) and destination.strip():
        itinerary["tripName"] = f"[stub] {destination.strip()}"

    legs = itinerary["legs"]
    yield sse_event(
        "skeleton",
        {
            "tripName": itinerary["tripName"],
            "legs": [
                {k: leg[k] for k in ("destination", "startDate", "endDate")}
                for leg in legs
            ],
        },
    )
    for index, leg in enumerate(legs):
        await asyncio.sleep(0.3)  # simulate a worker finishing
        yield sse_event("leg", {"index": index, "total": len(legs), "leg": leg})
    yield sse_event("itinerary", itinerary)
    yield sse_event("done", {})
