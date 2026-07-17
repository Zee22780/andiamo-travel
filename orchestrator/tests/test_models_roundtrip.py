"""P0.1 acceptance — Pydantic models ≡ the C1 contract.

Skips until you define the models in app/models.py; passes when they parse
the stub itinerary round-trip with no field loss and enforce the constraints.
"""

import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

import app.models as models

if not hasattr(models, "Itinerary"):
    pytest.skip(
        "P0.1 not implemented yet — define the models in app/models.py (GUIDE.md § P0.1)",
        allow_module_level=True,
    )

FIXTURE = Path(__file__).resolve().parents[1] / "app" / "stub_itinerary.json"


def fixture_data() -> dict:
    return json.loads(FIXTURE.read_text())


def test_itinerary_roundtrips_with_no_field_loss() -> None:
    data = fixture_data()
    itinerary = models.Itinerary.model_validate(data)
    assert itinerary.model_dump(mode="json") == data


def test_stop_union_discriminates_refs_from_inline() -> None:
    itinerary = models.Itinerary.model_validate(fixture_data())
    stops = [s for leg in itinerary.legs for day in leg.days for s in day.stops]
    refs = [s for s in stops if hasattr(s, "poi")]
    inline = [s for s in stops if hasattr(s, "title")]
    assert refs and inline
    assert len(refs) + len(inline) == len(stops)


def test_rejects_invalid_start_time() -> None:
    data = fixture_data()
    data["legs"][0]["days"][0]["stops"][0]["startTime"] = "25:00"
    with pytest.raises(ValidationError):
        models.Itinerary.model_validate(data)


def test_rejects_unknown_fields() -> None:
    data = copy.deepcopy(fixture_data())
    data["legs"][0]["surprise"] = True
    with pytest.raises(ValidationError):
        models.Itinerary.model_validate(data)


def test_trip_summary_and_catalog_entry_parse() -> None:
    if not (hasattr(models, "TripSummary") and hasattr(models, "CatalogEntry")):
        pytest.skip("TripSummary / CatalogEntry not defined yet")
    summary = models.TripSummary.model_validate(
        {
            "destination": "Porto, Portugal",
            "route": ["Porto", "Lisbon"],
            "startDate": "2027-05-14",
            "endDate": "2027-05-17",
            "travelers": 2,
            "budget": "mid",
            "pace": "balanced",
            "interests": ["food", "history"],
            "mustInclude": [
                {"title": "Port wine cellar tour", "when": "day 2", "fixed": False}
            ],
            "readyToGenerate": True,
        }
    )
    assert summary.travelers == 2
    entry = models.CatalogEntry.model_validate(
        {
            "slug": "porto/livraria-lello",
            "destination": "porto",
            "type": "activity",
            "title": "Livraria Lello",
            "typicalDurationMin": 60,
        }
    )
    assert entry.slug == "porto/livraria-lello"
