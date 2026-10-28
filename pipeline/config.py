"""Paths, release settings and thresholds shared by every pipeline step."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
COD_AB_DIR = RAW_DIR / "cod-ab"
GEOBOUNDARIES_DIR = RAW_DIR / "geoboundaries"
INTERIM_DIR = ROOT / "build" / "interim"
BOUNDARIES_DIR = ROOT / "data" / "boundaries"
REPORTS_DIR = ROOT / "build" / "reports"

DATA_VERSION = "2026.1"

HDX_DATASET = "cod-ab-sdn"
HDX_API = "https://data.humdata.org/api/3/action/package_show"

# Counts the brief expects from COD-AB. A different count is reported, not
# treated as an error: a newer COD-AB edition may legitimately change it.
EXPECTED_COUNTS = {1: 19, 2: 189}

# Equal-area projection centred on Sudan, used for every area measurement.
AREA_CRS = "+proj=laea +lat_0=15 +lon_0=30 +datum=WGS84 +units=m +no_defs"

# Gaps and overlaps between neighbouring localities. Anything larger than
# this is an error; smaller slivers are counted in the report.
SLIVER_TOLERANCE_M2 = 10_000  # 0.01 km²

# Share of a locality's area allowed to fall outside its parent state.
PARENT_CONTAINMENT_TOLERANCE = 0.001  # 0.1 %

# mapshaper simplification per resolution: the share of removable vertices
# kept, the coordinate precision written to GeoJSON, and TopoJSON quantization.
# Precision and quantization are the coarsest values that keep every COD-AB
# 2020 (v03) geometry valid; coarser grids snap close vertices together and
# make rings cross themselves. Validation re-checks this on every build.
RESOLUTIONS = {
    "detailed": {"simplify": None, "precision": 0.0000001, "quantization": 100_000_000},
    "medium": {"simplify": "10%", "precision": 0.00001, "quantization": 1_000_000},
    "light": {"simplify": "1.5%", "precision": 0.0001, "quantization": 100_000},
}

LEVELS = (1, 2)
