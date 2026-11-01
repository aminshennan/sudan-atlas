import json

from pipeline import config
from pipeline.gazetteer import evaluate, testcases
from pipeline.gazetteer.variants import clean_name

GAZETTEER = config.ROOT / "data" / "gazetteer"


def test_clean_name_drops_junk_and_disambiguators():
    assert clean_name("#N/A District") == ""
    assert clean_name("Shearia (Sudan)") == "Shearia"
    assert clean_name("  Al  Fasher District (old) ") == "Al Fasher District"


def test_every_variant_points_to_a_place_and_names_its_source():
    places = {p["pcode"] for p in json.loads((GAZETTEER / "places.json").read_text())["places"]}
    variants = json.loads((GAZETTEER / "variants.json").read_text())["variants"]
    assert variants
    for v in variants:
        assert v["text"] and v["lang"] in ("en", "ar")
        assert v["pcodes"] and set(v["pcodes"]) <= places
        assert v["sources"] and all(s["source"] and s["ref"] and s["kind"] for s in v["sources"])


def test_match_cases_are_well_formed():
    places = {p["pcode"] for p in json.loads((GAZETTEER / "places.json").read_text())["places"]}
    cases = testcases.load_cases()
    assert len(cases) >= 250
    assert len({c["id"] for c in cases}) == len(cases)
    for c in cases:
        assert c["expected_pcode"] == "" or c["expected_pcode"] in places
        assert c["verified_by"] in ("claude", "amin")
        assert c["level"] in ("1", "2")


def test_matcher_accuracy_does_not_regress():
    """Floors from the evaluation after the agent review of the labels (2026-10-31). The review made
    the test set harder (it gave towns such as Karima and census names such as El Meilig real answers),
    so these are below the first, unreviewed figures. Raise them as the matcher improves."""
    best = evaluate.run()
    assert best["top1_accuracy"] >= 0.92
    assert best["false_match_rate"] <= 0.01
    assert best["top3_recall"] >= 0.98
