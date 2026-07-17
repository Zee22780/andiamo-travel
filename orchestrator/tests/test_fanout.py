"""P1.3 acceptance — workers actually run in parallel, results stay ordered.

No API key needed: a fake worker is injected and concurrency is measured for
real (three 0.25s workers must finish in ≈0.25s, not 0.75s).
"""

import asyncio
import time

import pytest

import app.fanout as fanout

if not hasattr(fanout, "plan_all_legs"):
    pytest.skip(
        "P1.3 not implemented yet — write plan_all_legs in app/fanout.py (GUIDE.md § P1.3)",
        allow_module_level=True,
    )


def test_workers_run_concurrently_and_results_keep_skeleton_order() -> None:
    async def fake_worker(skeleton: str) -> str:
        await asyncio.sleep(0.25)
        return f"planned-{skeleton}"

    async def run() -> tuple[list[str], float]:
        started = time.monotonic()
        results = await fanout.plan_all_legs(["porto", "lisbon", "seville"], fake_worker)
        return results, time.monotonic() - started

    results, elapsed = asyncio.run(run())
    assert results == ["planned-porto", "planned-lisbon", "planned-seville"]
    assert elapsed < 0.5, f"looks serial ({elapsed:.2f}s for three 0.25s workers)"
