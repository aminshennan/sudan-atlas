import csv
from pathlib import Path

import pytest

from sudan_atlas.gazetteer import Gazetteer
from sudan_atlas.normalise import Normaliser

CASES = Path(__file__).resolve().parents[3] / "data" / "tests" / "normalisation_cases.csv"


@pytest.fixture(scope="module")
def normaliser():
    return Normaliser(Gazetteer.load().rules)


@pytest.mark.parametrize("case", list(csv.DictReader(CASES.open(encoding="utf-8"))), ids=lambda c: c["input"])
def test_shared_normalisation_cases(normaliser, case):
    # The TypeScript matcher must pass the same file.
    assert normaliser.key(case["input"]) == case["expected_key"], case["rule"]


def test_keys_include_plain_spelling_when_synonyms_change_it(normaliser):
    assert normaliser.keys("Central Darfur") == ["wasat darfur", "central darfur"]
    assert normaliser.keys("Kutum") == ["kutum"]


def test_short_skeletons_are_dropped(normaliser):
    assert normaliser.skeleton(normaliser.key("Tawila")) == ""
    assert normaliser.skeleton(normaliser.key("Qallabat")) == normaliser.skeleton(normaliser.key("Galabat"))


def test_official_names_only_collide_where_expected(normaliser):
    """Two places sharing a key make that name ambiguous. Only these collisions exist in COD-AB v03."""
    gazetteer = Gazetteer.load()
    by_key = {}
    for place in gazetteer.places.values():
        for name in (place["name_en"], place["name_ar"]):
            by_key.setdefault((normaliser.key(name), place["level"]), set()).add(place["pcode"])
    shared = {key: pcodes for key, pcodes in by_key.items() if len(pcodes) > 1}
    assert {frozenset(p) for p in shared.values()} == {
        frozenset({"SD12084", "SD13030"}),  # Ar Rahad, in Gedaref and North Kordofan
        frozenset({"SD03161", "SD07099"}),  # Buram (South Darfur) and Al Buram (South Kordofan)
    }
