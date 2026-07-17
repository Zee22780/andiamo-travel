"""C1 schema contract — Pydantic models mirroring `ItinerarySchema` (Zod).

════ YOUR PIECE — P0.1 ════
Done when:  uv run pytest tests/test_models_roundtrip.py   passes (no skips).
Reference:  CONTRACT.md § C1 (field-by-field table) · GUIDE.md § P0.1 (hints)
Source of truth on the TS side: src/lib/ai/schemas.ts

Rules the tests enforce:
- Field names are camelCase, exactly as on the wire: startTime, durationMin,
  costEstimate, mustDo, userAdded, tripName, … (no snake_case aliasing).
- Every model forbids unknown fields — model_config = ConfigDict(extra="forbid").
  This is also what makes the RefStop | InlineStop union unambiguous.
- Value constraints match Zod: the two regexes below are provided for you.

Models to define (see the CONTRACT.md tables for the exact fields):
  InlineStop, RefStop, Stop (the union type alias), Day, Leg, Itinerary,
  MustInclude, TripSummary, CatalogEntry
"""

from __future__ import annotations

# from pydantic import BaseModel, ConfigDict, Field

TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"  # 24h HH:MM (Zod: InlineStop/RefStop startTime)
DATE_RE = r"^\d{4}-\d{2}-\d{2}$"  # YYYY-MM-DD (Zod: Day.date, Leg.startDate/endDate)

# TODO(you): define the models. Start with InlineStop and RefStop, then the
# Stop union, then build upward (Day → Leg → Itinerary), then the request
# models (TripSummary + MustInclude, CatalogEntry). Run the test after each
# model — it tells you exactly what's still missing.
