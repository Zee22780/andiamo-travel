"""Fan-out — run all leg-workers in parallel. The multi-agent moment.

════ YOUR PIECE — P1.3 ════
Done when:  uv run pytest tests/test_fanout.py   passes (no API key needed —
the test injects a fake worker and measures real concurrency).
Reference:  GUIDE.md § P1.3

The signature is fixed by the acceptance test (worker is injected so the
fan-out is testable without spending tokens):

  async def plan_all_legs(leg_skeletons, worker):
      '''Run worker(skeleton) for every skeleton CONCURRENTLY and return the
      results in the same order as leg_skeletons.'''

Hint: this is a 2-3 line asyncio.gather. The real pipeline will call it as
plan_all_legs(skeleton.legs, lambda s: plan_leg(s, summary, subset_for(s))).
"""

# TODO(you): plan_all_legs()
