"""Read the COD-AB layers and write them in the Sudan Atlas schema.

Every output feature carries pcode, name_en, name_ar, level and parent_pcode.
COD-AB editions differ in file format and layer names, so layers are found by
their columns (ADM1_PCODE, ADM2_PCODE, ...) rather than by file name.
"""

import json
import re
import shutil
import zipfile
from pathlib import Path

import geopandas as gpd
import pyogrio
import shapely

from . import config

SCHEMA = ["pcode", "name_en", "name_ar", "level", "parent_pcode"]
DATASET_SUFFIXES = {".gpkg", ".geojson", ".shp", ".json"}


def _safe_extract(archive: Path, target: Path) -> None:
    with zipfile.ZipFile(archive) as zf:
        for member in zf.infolist():
            destination = (target / member.filename).resolve()
            if not destination.is_relative_to(target.resolve()):
                raise SystemExit(f"Refusing unsafe path {member.filename!r} in {archive.name}")
        zf.extractall(target)


def _datasets(raw_dir: Path) -> list[Path]:
    """Every readable dataset under raw_dir, with zip archives extracted first."""
    extract_dir = config.INTERIM_DIR / "cod-ab-extracted"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    for archive in sorted(raw_dir.rglob("*.zip")):
        _safe_extract(archive, extract_dir / archive.stem)

    found = []
    for base in (raw_dir, extract_dir):
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix.lower() == ".gdb" and path.is_dir():
                found.append(path)
            elif path.is_file() and path.suffix.lower() in DATASET_SUFFIXES and path.name != "manifest.json":
                if not any(parent.suffix.lower() == ".gdb" for parent in path.parents):
                    found.append(path)
    return found


def _column(columns: list[str], *patterns: str) -> str | None:
    for pattern in patterns:
        for column in columns:
            if re.fullmatch(pattern, column, flags=re.IGNORECASE):
                return column
    return None


def find_layers(raw_dir: Path) -> dict[int, dict]:
    """Map admin level (0, 1, 2) to the first polygon layer holding it."""
    layers: dict[int, dict] = {}
    seen = []
    for dataset in _datasets(raw_dir):
        for layer_name, geometry_type in pyogrio.list_layers(dataset):
            if "polygon" not in (geometry_type or "").lower():
                continue
            columns = list(pyogrio.read_info(dataset, layer=layer_name)["fields"])
            seen.append({"dataset": str(dataset), "layer": layer_name, "columns": columns})
            for level in (0, 1, 2):
                own = _column(columns, rf"ADM{level}_PCODE", rf"ADM{level}_PCOD")
                child = _column(columns, rf"ADM{level + 1}_PCODE", rf"ADM{level + 1}_PCOD")
                if own and not child and level not in layers:
                    layers[level] = {"dataset": dataset, "layer": layer_name, "columns": columns}

    missing = [level for level in config.LEVELS if level not in layers]
    if missing:
        listing = json.dumps(seen, indent=2, default=str)
        raise SystemExit(f"No polygon layer found for admin level(s) {missing}. Layers seen:\n{listing}")
    return layers


def _clean(value) -> str | None:
    if value is None or (isinstance(value, float) and value != value):
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _name_columns(raw: gpd.GeoDataFrame, level: int) -> dict[str, str]:
    """Name columns by language.

    Older COD-AB editions name them ADM1_EN, ADM1_AR. Newer ones use adm1_name,
    adm1_name1, ... with lang, lang1, ... holding each column's language code.
    """
    columns = list(raw.columns)
    found = {}
    for suffix in ("", "1", "2", "3"):
        name = _column(columns, rf"ADM{level}_NAME{suffix}")
        lang = _column(columns, rf"LANG{suffix}")
        if not name or not lang:
            continue
        codes = set(raw[lang].dropna().astype(str).str.lower())
        if len(codes) == 1:
            found.setdefault(codes.pop(), name)
    for code in ("en", "ar"):
        legacy = _column(columns, rf"ADM{level}_{code}")
        if legacy:
            found.setdefault(code, legacy)
    return found


def normalise_layer(source: dict, level: int) -> tuple[gpd.GeoDataFrame, dict]:
    columns = source["columns"]
    raw = gpd.read_file(source["dataset"], layer=source["layer"])
    names = _name_columns(raw, level)
    mapping = {
        "pcode": _column(columns, rf"ADM{level}_PCODE", rf"ADM{level}_PCOD"),
        "name_en": names.get("en") or _column(columns, rf"ADM{level}_REF_NAME", rf"ADM{level}_REF"),
        "name_ar": names.get("ar"),
        "parent_pcode": _column(columns, rf"ADM{level - 1}_PCODE", rf"ADM{level - 1}_PCOD") if level else None,
    }
    # The admin-0 layer is only the national outline for the gap check, so it
    # needs nothing beyond a P-code.
    if not mapping["pcode"] or (level > 0 and not mapping["name_en"]):
        raise SystemExit(f"Admin {level} layer lacks a P-code or English name column. Columns: {columns}")
    if level > 0 and not mapping["name_ar"]:
        print(f"WARNING: admin {level} layer has no Arabic name column. Columns: {columns}")

    if raw.crs is None:
        raise SystemExit(f"Admin {level} layer has no coordinate reference system")
    raw = raw.to_crs(4326)

    out = gpd.GeoDataFrame(
        {
            "pcode": raw[mapping["pcode"]].map(_clean),
            "name_en": raw[mapping["name_en"]].map(_clean) if mapping["name_en"] else None,
            "name_ar": raw[mapping["name_ar"]].map(_clean) if mapping["name_ar"] else None,
            "level": level,
            "parent_pcode": raw[mapping["parent_pcode"]].map(_clean) if mapping["parent_pcode"] else None,
        },
        geometry=raw.geometry.values,
        crs=4326,
    )

    invalid = ~out.geometry.is_valid
    repaired = out.loc[invalid, "pcode"].tolist()
    if repaired:
        fixed = shapely.make_valid(out.loc[invalid].geometry.values)
        out.loc[invalid, "geometry"] = [_polygonal(g) for g in fixed]

    out = out.sort_values("pcode", kind="stable").reset_index(drop=True)
    report = {
        "dataset": _display(Path(source["dataset"])),
        "layer": source["layer"],
        "column_mapping": mapping,
        "edition": _edition(raw),
        "source_feature_count": int(len(raw)),
        "repaired_geometries": repaired,
        "missing_arabic_name": out.loc[out["name_ar"].isna(), ["pcode", "name_en"]].to_dict("records"),
    }
    return out, report


def _edition(raw: gpd.GeoDataFrame) -> dict:
    """COD-AB version and validity dates, when the layer records them."""
    edition = {}
    for key in ("version", "valid_on", "valid_to"):
        column = _column(list(raw.columns), key, f"{key.replace('_', '')}")
        if column:
            values = sorted(set(raw[column].dropna().astype(str)))
            edition[key] = values[0] if len(values) == 1 else values
    return edition


def _display(path: Path) -> str:
    return path.relative_to(config.ROOT).as_posix() if path.is_relative_to(config.ROOT) else str(path)


def _polygonal(geometry):
    """Keep only the polygon parts that make_valid can return alongside lines or points."""
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
        return geometry
    parts = [g for g in getattr(geometry, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts)


def write_geojson(frame: gpd.GeoDataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame[SCHEMA + ["geometry"]].to_file(path, driver="GeoJSON", COORDINATE_PRECISION=7, WRITE_NAME="NO")


def run(raw_dir: Path | None = None) -> dict:
    layers = find_layers(raw_dir or config.COD_AB_DIR)
    report = {}
    for level in sorted(layers):
        frame, layer_report = normalise_layer(layers[level], level)
        write_geojson(frame, config.INTERIM_DIR / f"adm{level}.geojson")
        report[f"adm{level}"] = layer_report
        print(
            f"adm{level}: {len(frame)} features from {layer_report['layer']!r}; "
            f"{len(layer_report['missing_arabic_name'])} missing an Arabic name; "
            f"{len(layer_report['repaired_geometries'])} geometries repaired"
        )
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORTS_DIR / "normalise.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    return report
