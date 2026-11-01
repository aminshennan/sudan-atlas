"""Write powerbi/: TopoJSON files for Power BI's Shape map visual and a lookup table of places.

The Shape map joins a data column to one property of each shape, so every shape carries
pcode (the key to use), name_en and name_ar. Medium resolution keeps the files small
enough for Power BI to draw quickly.
"""

import csv
import json
import subprocess

from . import config
from .simplify import _mapshaper

POWERBI_DIR = config.ROOT / "powerbi"
RESOLUTION = "medium"
FILES = {1: ("sudan_states.topojson", "states"), 2: ("sudan_localities.topojson", "localities")}


def run() -> None:
    POWERBI_DIR.mkdir(exist_ok=True)
    source = config.BOUNDARIES_DIR / RESOLUTION
    quantization = config.RESOLUTIONS[RESOLUTION]["quantization"]
    for level, (filename, layer) in FILES.items():
        fields = "pcode,name_en,name_ar" + (",parent_pcode" if level == 2 else "")
        subprocess.run([_mapshaper(), "-i", str(source / f"adm{level}.geojson"), f"name={layer}",
                        "-filter-fields", fields,
                        "-o", str(POWERBI_DIR / filename), "format=topojson", f"quantization={quantization}"],
                       check=True, capture_output=True)
        print(f"{filename}: {(POWERBI_DIR / filename).stat().st_size / 1024:,.0f} KB")

    places = json.loads((config.ROOT / "data" / "gazetteer" / "places.json").read_text())["places"]
    names = {p["pcode"]: p for p in places}
    with (POWERBI_DIR / "sudan_places.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["pcode", "level", "name_en", "name_ar", "state_pcode", "state_name_en", "state_name_ar"])
        for p in sorted(places, key=lambda p: (p["level"], p["pcode"])):
            state = names[p["pcode"]] if p["level"] == 1 else names[p["parent_pcode"]]
            writer.writerow([p["pcode"], p["level"], p["name_en"], p["name_ar"], state["pcode"], state["name_en"], state["name_ar"]])
    print(f"sudan_places.csv: {len(places)} rows")
