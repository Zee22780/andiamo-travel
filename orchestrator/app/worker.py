"""Leg-worker agent — one leg skeleton → that leg's days and stops (Haiku).

════ YOUR PIECE — P1.2 ════
Done when:  uv run pytest -m live tests/test_live.py::test_worker_fills_one_leg  passes.
Reference:  GUIDE.md § P1.2 · notes/leg-worker-plan.md P1.2

Context scoping is the whole point (and the biggest cost lever): a worker
sees ONLY the shared traveler profile, ITS OWN leg skeleton, and ITS CITY'S
slice of the catalog — never the whole plan, never other cities' catalogs.

  async def plan_leg(
      leg_skeleton,              # one LegSkeleton (P1.1) — or any obj/dict with
                                 # destination/startDate/endDate/pacing
      summary: dict,             # the shared traveler profile (C1 TripSummary shape)
      catalog_subset: list[dict] # ONLY this destination's CatalogEntry rows
  ) -> Leg                       # C1 Leg (models.Leg), refs intact

Rules for the prompt (mirror GENERATE_SYSTEM's spirit — see CONTRACT.md):
- Catalog places may be scheduled as compact refs: {"poi": slug, …}. Only
  slugs from catalog_subset; never invent one.
- One Day per date from startDate to endDate, every date covered.
- Do NOT resolve refs — TS owns resolution.
"""

# TODO(you): plan_leg() — structured output against models.Leg on WORKER_MODEL
