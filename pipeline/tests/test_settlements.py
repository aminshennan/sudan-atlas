"""Checks on the village, town and camp files built by `python -m pipeline settlements`."""

import json

import pytest

from pipeline import config

GAZETTEER = config.ROOT / "data" / "gazetteer"


def _load(name: str) -> list[dict]:
    return json.loads((GAZETTEER / name).read_text(encoding="utf-8"))["settlements"]


@pytest.fixture(scope="module")
def places() -> dict:
    return {p["pcode"]: p for p in json.loads((GAZETTEER / "places.json").read_text(encoding="utf-8"))["places"]}


@pytest.mark.parametrize("name, sources", [("settlements.json", {"geonames", "ocha-settlements", "ocha-camps", "wikidata", "overture"}),
                                            ("settlements_osm.json", {"osm"})])
def test_each_file_holds_only_its_own_sources(name, sources):
    # OpenStreetMap (ODbL) must stay in its own file, and nothing else may go into it.
    found = {s["id"].split(":", 1)[0] for s in _load(name)}
    assert found <= sources and found


@pytest.mark.parametrize("name", ["settlements.json", "settlements_osm.json"])
def test_every_settlement_is_in_a_locality_of_its_state(name, places):
    for s in _load(name):
        locality = places[s["pcode"]]
        assert locality["level"] == 2, s
        assert locality["parent_pcode"] == s["state"], s
        assert s["names"] and s["name"] == s["names"][0], s
        assert 8.6 <= s["lat"] <= 23.2 and 21.8 <= s["lon"] <= 38.6, s  # Sudan's bounding box


@pytest.mark.parametrize("name", ["settlements.json", "settlements_osm.json"])
def test_ids_are_unique(name):
    ids = [s["id"] for s in _load(name)]
    assert len(ids) == len(set(ids))
