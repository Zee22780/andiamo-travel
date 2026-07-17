"""Harness tests — these run green from day one (stub service + contract)."""

import json

from fastapi.testclient import TestClient

from app.main import app
from app.stub import load_stub_itinerary

client = TestClient(app)


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for chunk in text.strip().split("\n\n"):
        lines = chunk.split("\n")
        assert lines[0].startswith("event: ") and lines[1].startswith("data: "), chunk
        events.append((lines[0][len("event: ") :], json.loads(lines[1][len("data: ") :])))
    return events


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_plan_requires_summary() -> None:
    assert client.post("/plan", json={"catalog": []}).status_code == 422


def test_stub_plan_streams_the_c2_sequence() -> None:
    response = client.post(
        "/plan", json={"summary": {"destination": "Testland"}, "catalog": []}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = parse_sse(response.text)
    names = [name for name, _ in events]
    assert names[0] == "skeleton"
    assert names[-2:] == ["itinerary", "done"]

    legs = [data for name, data in events if name == "leg"]
    assert legs, "expected at least one leg event"
    assert all(leg["total"] == len(legs) for leg in legs)
    assert [leg["index"] for leg in legs] == list(range(len(legs)))

    skeleton = events[0][1]
    assert {"destination", "startDate", "endDate"} <= skeleton["legs"][0].keys()

    itinerary = next(data for name, data in events if name == "itinerary")
    assert itinerary["tripName"] == "[stub] Testland"  # request echoed → wiring proven
    assert len(itinerary["legs"]) == len(legs)


def test_stub_fixture_exercises_both_stop_variants() -> None:
    itinerary = load_stub_itinerary()
    stops = [s for leg in itinerary["legs"] for day in leg["days"] for s in day["stops"]]
    refs = [s for s in stops if "poi" in s]
    inline = [s for s in stops if "poi" not in s]
    assert refs and inline
    assert any(s["durationMin"] is None for s in refs)
    assert any(s["description"] is None for s in inline)
    assert any(s["costEstimate"] is None for s in inline)
    assert any(s["type"] == "transit" for s in inline)
