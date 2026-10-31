import pytest

from sudan_atlas import Matcher, match


@pytest.fixture(scope="module")
def matcher():
    return Matcher()


def test_result_shape():
    result = match("El Fasher", level=2)
    assert set(result) == {"pcode", "name_en", "name_ar", "level", "score", "method", "alternatives"}
    assert result["pcode"] == "SD02114" and result["method"] == "exact" and result["score"] == 1.0
    assert all(set(a) == {"pcode", "name_en", "name_ar", "level", "score"} for a in result["alternatives"])
    assert len(result["alternatives"]) <= 3


@pytest.mark.parametrize("name, hint, level, expected, method", [
    ("الفاشر", None, 2, "SD02114", "exact"),
    ("Habila", "West Darfur", 2, "SD04122", "variant"),
    ("Habila", "SD07", 2, "SD07103", "variant"),
    ("El Hasaheesa", "Al Gezira", 2, "SD15034", "fuzzy"),
    ("Khartoum North (Bahri)", "Khartoum", 2, "SD01003", "exact"),
    ("Centeral Darfur", None, 1, "SD06", "fuzzy"),
    ("Kassala", None, 1, "SD11", "exact"),
    ("Kassala", None, 2, "SD11053", "variant"),
])
def test_matches(matcher, name, hint, level, expected, method):
    result = matcher.match(name, state_hint=hint, level=level)
    assert (result["pcode"], result["method"]) == (expected, method)


@pytest.mark.parametrize("name, hint, level", [
    ("Khartoum", None, None),  # the state and the locality
    ("Ar Rahad", None, 2),  # one in Gedaref, one in North Kordofan
    ("Habila", None, 2),
    ("Nyala", None, 2),  # the town spans Nyala Shimal and Nyala Janoub
])
def test_ambiguous_names_are_not_guessed(matcher, name, hint, level):
    result = matcher.match(name, state_hint=hint, level=level)
    assert result["pcode"] is None and result["method"] == "ambiguous"
    assert len(result["alternatives"]) >= 2


@pytest.mark.parametrize("name", ["Total", "Grand Total", "Nairobi", "", "#adm2+name"])
def test_non_places_get_no_match(matcher, name):
    result = matcher.match(name, level=2)
    assert result["pcode"] is None and result["method"] in ("none", "ambiguous")


def test_state_hint_restricts_candidates(matcher):
    result = matcher.match("Ar Rahad", state_hint="Gedaref", level=2)
    assert result["pcode"] == "SD12084"
    assert all(a["pcode"].startswith("SD12") for a in result["alternatives"])


def test_unknown_state_hint_is_ignored(matcher):
    assert matcher.match("Kutum", state_hint="Atlantis", level=2)["pcode"] == "SD02128"
