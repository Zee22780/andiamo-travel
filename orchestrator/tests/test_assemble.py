"""P1.4 acceptance — assembled itinerary validates against C1 (pure, no API)."""

import json
from pathlib import Path

import pytest

import app.assemble as assemble_mod
import app.models as models

if not hasattr(assemble_mod, "assemble"):
    pytest.skip(
        "P1.4 not implemented yet — write assemble in app/assemble.py (GUIDE.md § P1.4)",
        allow_module_level=True,
    )
if not hasattr(models, "Itinerary"):
    pytest.skip("P1.4 needs the P0.1 models first", allow_module_level=True)

FIXTURE = Path(__file__).resolve().parents[1] / "app" / "stub_itinerary.json"


def test_assembled_itinerary_matches_c1_and_orders_legs_by_date() -> None:
    data = json.loads(FIXTURE.read_text())
    legs = [models.Leg.model_validate(leg) for leg in data["legs"]]
    # Feed the legs in reverse — workers finish in arbitrary order.
    itinerary = assemble_mod.assemble(data["tripName"], list(reversed(legs)))
    assert isinstance(itinerary, models.Itinerary)
    assert itinerary.model_dump(mode="json") == data
