"""Write site/src/data/areas.json: the area of every state and locality in km², from the detailed
COD-AB boundaries in the Africa Albers equal-area projection. Run from the repository root with the
pipeline's environment: .venv/bin/python site/scripts/areas.py"""
import json
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[2]
areas = {}
for level in (1, 2):
    frame = gpd.read_file(ROOT / "data" / "boundaries" / "detailed" / f"adm{level}.geojson").to_crs("ESRI:102022")
    for row in frame.itertuples():
        areas[row.pcode] = round(row.geometry.area / 1e6)
out = ROOT / "site" / "src" / "data" / "areas.json"
out.write_text(json.dumps(dict(sorted(areas.items())), separators=(",", ":")) + "\n")
print(f"{len(areas)} areas -> {out.relative_to(ROOT)}; SD02 = {areas['SD02']:,} km², SD01 = {areas['SD01']:,} km²")
