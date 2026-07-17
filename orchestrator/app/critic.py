"""Critic / reconciliation — cross-leg seam check (Opus, patch-based).

════ P1.5 — PAIR ON THIS ONE ════
Grab Claude when you get here; it's the subtlest piece. Design constraints
locked in the plan (notes/leg-worker-plan.md P1.5 + the cost knobs):

- Input: COMPACT per-leg summaries (city, dates, budget used, transit in/out,
  day themes) — not the full itinerary. Pull full detail only for a leg it
  flags. This is the context-scoping discipline again.
- Output: PATCHES (targeted edits), never a rewritten itinerary.
- Skip entirely on short trips (1-2 legs) — nothing to reconcile.
- Checks: transit alignment between legs, budget rollup vs the profile,
  pacing consistency.
"""

# Deliberately empty — designed together at P1.5.
