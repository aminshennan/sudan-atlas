"""Sudan's states and localities, and their boundaries."""

import json
from functools import lru_cache

from .gazetteer import Gazetteer, boundaries_dir

RESOLUTIONS = ("detailed", "medium", "light")


@lru_cache(maxsize=1)
def _gazetteer() -> Gazetteer:
    return Gazetteer.load()


def _record(place: dict) -> dict:
    record = {k: place[k] for k in ("pcode", "name_en", "name_ar", "level", "parent_pcode")}
    record["point"] = list(place["point"])
    return record


def get_states() -> list[dict]:
    """The 19 admin-1 units (18 states and the Abyei PCA area), sorted by P-code."""
    return [_record(p) for p in sorted(_gazetteer().places.values(), key=lambda p: p["pcode"]) if p["level"] == 1]


def get_localities(state_pcode: str | None = None) -> list[dict]:
    """The localities (admin 2), all of them or those in one state, sorted by P-code."""
    places = _gazetteer().places
    if state_pcode is not None:
        state_pcode = state_pcode.upper()
        if state_pcode not in places or places[state_pcode]["level"] != 1:
            raise KeyError(f"No state with P-code {state_pcode!r}")
    return [_record(p) for p in sorted(places.values(), key=lambda p: p["pcode"])
            if p["level"] == 2 and (state_pcode is None or p["parent_pcode"] == state_pcode)]


@lru_cache(maxsize=6)
def _features(resolution: str, level: int) -> dict[str, dict]:
    path = boundaries_dir() / resolution / f"adm{level}.geojson"
    collection = json.loads(path.read_text(encoding="utf-8"))
    return {f["properties"]["pcode"]: f for f in collection["features"]}


def get_feature(pcode: str, resolution: str = "medium") -> dict:
    """The GeoJSON Feature for a state or locality, at "detailed", "medium" or "light" resolution."""
    if resolution not in RESOLUTIONS:
        raise ValueError(f"resolution must be one of {', '.join(RESOLUTIONS)}")
    pcode = pcode.upper()
    place = _gazetteer().places.get(pcode)
    if place is None:
        raise KeyError(f"No place with P-code {pcode!r}")
    return _features(resolution, place["level"])[pcode]


def data_version() -> str:
    return _gazetteer().version
