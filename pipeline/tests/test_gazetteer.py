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


def test_matcher_meets_the_agreed_targets():
    """The accuracy targets agreed at the Phase 2 checkpoint (pipeline/gazetteer/evaluate.py: TARGETS)."""
    best = evaluate.run()
    assert best["top1_accuracy"] >= evaluate.TARGETS["top1_accuracy"]
    assert best["top3_recall"] >= evaluate.TARGETS["top3_recall"]
    assert best["false_match_rate"] <= evaluate.TARGETS["false_match_rate"]


def test_golden_results_are_current():
    """data/tests/match_results.json must match what the Python matcher returns now (regenerate: make golden)."""
    from pipeline.gazetteer import golden
    assert golden.GOLDEN_PATH.read_text(encoding="utf-8") == golden.render(golden.results())
