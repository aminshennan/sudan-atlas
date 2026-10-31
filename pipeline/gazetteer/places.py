"""Write data/gazetteer/places.json: one record per state and locality.

Records come from the released boundaries, so the gazetteer and the maps always
share codes and names. Each record carries a representative point (inside its
polygon) for apps that need a label position or a rough location.
"""

import json

import geopandas as gpd

from .. import config

PLACES_PATH = config.ROOT / "data" / "gazetteer" / "places.json"


def build() -> list[dict]:
    places = []
    for level in config.LEVELS:
        frame = gpd.read_file(config.BOUNDARIES_DIR / "detailed" / f"adm{level}.geojson")
        points = frame.geometry.representative_point()
        for row, point in zip(frame.itertuples(), points):
            places.append({
                "pcode": row.pcode,
                "level": int(row.level),
                "name_en": row.name_en,
                "name_ar": row.name_ar,
                "parent_pcode": row.parent_pcode,
                "point": [round(point.x, 4), round(point.y, 4)],
            })
    places.sort(key=lambda p: (p["level"], p["pcode"]))
    return places


def dump_records(header: dict, key: str, records: list[dict]) -> str:
    """JSON with one record per line, so diffs and reviews stay readable."""
    head = json.dumps(header, ensure_ascii=False)[:-1]
    lines = ",\n  ".join(json.dumps(r, ensure_ascii=False) for r in records)
    return f'{head}, "{key}": [\n  {lines}\n]}}\n'


def run() -> list[dict]:
    places = build()
    PLACES_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLACES_PATH.write_text(dump_records({"version": config.DATA_VERSION}, "places", places))
    print(f"places: {len(places)} records -> {PLACES_PATH.relative_to(config.ROOT)}")
    return places
