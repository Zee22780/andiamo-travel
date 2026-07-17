"""Andiamo orchestrator service — FastAPI app.

Run locally:  uv run uvicorn app.main:app --reload --port 8100
Contract:     CONTRACT.md (C2 — request/SSE shapes)
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .stub import stream_stub_plan

app = FastAPI(title="Andiamo orchestrator")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/plan", response_model=None)
async def plan(request: Request) -> StreamingResponse | JSONResponse:
    body = await request.json()
    summary = body.get("summary") if isinstance(body, dict) else None
    if not isinstance(summary, dict):
        return JSONResponse({"error": "summary required"}, status_code=422)

    # TODO(you, after P0.1): validate the body with your models instead of the
    # bare dict checks above — models.TripSummary / list[models.CatalogEntry].
    #
    # TODO(you, after P1.4): replace the stub with the real pipeline —
    #   skeleton = await orchestrator.plan_skeleton(summary, catalog)
    #   legs     = await fanout.plan_all_legs(...)   # emit a `leg` event as each finishes
    #   itinerary = assemble.assemble(skeleton.tripName, legs)
    # then P1.5 (critic) slots in before the final `itinerary` event.
    return StreamingResponse(
        stream_stub_plan(summary),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
