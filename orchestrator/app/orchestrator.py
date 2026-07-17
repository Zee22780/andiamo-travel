"""Orchestrator agent — trip profile + catalog → typed leg skeleton (Opus).

════ YOUR PIECE — P1.1 ════
Done when:  uv run pytest -m live tests/test_live.py::test_orchestrator_skeleton_covers_every_date  passes.
Reference:  GUIDE.md § P1.1 · notes/leg-worker-plan.md P1.1

The orchestrator does NOT write any stops. It decides the shape of the trip:
which cities, how many days each, pacing guidance, a per-leg budget split,
and where the transit days fall. Workers fill in the days from this.

Design the skeleton models here (they are Python-internal — not part of C1):

  class LegSkeleton(BaseModel):
      destination: str
      startDate: str        # YYYY-MM-DD
      endDate: str          # YYYY-MM-DD
      pacing: str           # guidance for the worker, e.g. "relaxed, 3-4 stops/day"
      budgetShare: ...      # your call — fraction, per-day USD, whatever reasons well
      arrivalNote: str | None   # e.g. "arrives 14:00 by train from Porto"

  class TripSkeleton(BaseModel):
      tripName: str
      legs: list[LegSkeleton]

Then:

  async def plan_skeleton(summary: dict, catalog: list[dict]) -> TripSkeleton

Every date between summary.startDate and summary.endDate must be covered by
exactly one leg (the live test checks this).
"""

# TODO(you): LegSkeleton, TripSkeleton, plan_skeleton()
