"""Assembly — stitch worker outputs into one C1 Itinerary.

════ YOUR PIECE — P1.4 ════
Done when:  uv run pytest tests/test_assemble.py   passes (pure, no API).
Reference:  GUIDE.md § P1.4

  def assemble(trip_name: str, legs: list[Leg]) -> Itinerary

Pure function, no LLM call. Order legs chronologically by startDate (workers
may finish out of order), keep refs intact, return a models.Itinerary. If two
legs claim the same date that's an orchestrator bug — raising is fine.
"""

# TODO(you): assemble()
