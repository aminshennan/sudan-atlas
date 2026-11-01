import pytest

import sudan_atlas
from sudan_atlas import RESOLUTIONS, get_feature, get_localities, get_states


def test_states_and_localities():
    states = get_states()
    assert len(states) == 19 and all(s["level"] == 1 and s["parent_pcode"] == "SD" for s in states)
    assert len(get_localities()) == 189
    assert "SD15034" in {p["pcode"] for p in get_localities("sd15")}
    with pytest.raises(KeyError):
        get_localities("SD99")


def test_records_are_copies():
    get_states()[0]["name_en"] = "changed"
    assert get_states()[0]["name_en"] == "Khartoum"


@pytest.mark.parametrize("resolution", RESOLUTIONS)
def test_get_feature(resolution):
    feature = get_feature("sd02114", resolution)
    assert feature["type"] == "Feature" and feature["properties"]["pcode"] == "SD02114"
    assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")


def test_get_feature_rejects_bad_input():
    with pytest.raises(KeyError):
        get_feature("SD99")
    with pytest.raises(ValueError):
        get_feature("SD01", "huge")


def test_versions():
    assert sudan_atlas.DATA_VERSION == "2026.1"
    assert sudan_atlas.__version__.count(".") == 2


def test_geo_extra():
    geo = pytest.importorskip("sudan_atlas.geo")
    states = geo.states("light")
    assert len(states) == 19 and str(states.crs) == "EPSG:4326"
    assert list(states.columns) == ["pcode", "name_en", "name_ar", "level", "parent_pcode", "geometry"]
    assert set(geo.localities("SD15")["pcode"]) == {p["pcode"] for p in get_localities("SD15")}
