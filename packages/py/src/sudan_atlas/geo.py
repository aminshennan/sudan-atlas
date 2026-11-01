"""GeoDataFrames of Sudan's states and localities. Needs the optional extra: pip install "sudan-atlas[geo]"."""

from .gazetteer import boundaries_dir
from .places import RESOLUTIONS, get_localities

try:
    import geopandas as gpd
except ImportError as error:  # pragma: no cover - exercised only without the extra
    raise ImportError('sudan_atlas.geo needs geopandas: pip install "sudan-atlas[geo]"') from error

COLUMNS = ["pcode", "name_en", "name_ar", "level", "parent_pcode", "geometry"]


def _read(level: int, resolution: str) -> "gpd.GeoDataFrame":
    if resolution not in RESOLUTIONS:
        raise ValueError(f"resolution must be one of {', '.join(RESOLUTIONS)}")
    frame = gpd.read_file(boundaries_dir() / resolution / f"adm{level}.geojson")
    return frame[COLUMNS].sort_values("pcode").reset_index(drop=True)


def states(resolution: str = "medium") -> "gpd.GeoDataFrame":
    """The 19 admin-1 units as a GeoDataFrame (EPSG:4326)."""
    return _read(1, resolution)


def localities(state_pcode: str | None = None, resolution: str = "medium") -> "gpd.GeoDataFrame":
    """Localities as a GeoDataFrame (EPSG:4326), all of them or those in one state."""
    frame = _read(2, resolution)
    if state_pcode is not None:
        wanted = {p["pcode"] for p in get_localities(state_pcode)}
        frame = frame[frame["pcode"].isin(wanted)].reset_index(drop=True)
    return frame
