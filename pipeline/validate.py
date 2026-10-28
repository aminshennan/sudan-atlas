"""Validate the normalised source layers and every exported resolution.

Errors fail the build. Warnings are reported but do not fail it: a missing
Arabic name, or a feature count that differs from the brief's expectation
while still matching the source.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

import geopandas as gpd
import shapely
from shapely.strtree import STRtree

from . import config


@dataclass
class Result:
    target: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors


def check_schema(frame: gpd.GeoDataFrame, level: int, result: Result) -> None:
    missing = [c for c in ("pcode", "name_en", "name_ar", "level", "parent_pcode") if c not in frame.columns]
    if missing:
        result.errors.append(f"adm{level}: missing columns {missing}")
        return
    if frame["pcode"].isna().any():
        result.errors.append(f"adm{level}: {int(frame['pcode'].isna().sum())} feature(s) without a pcode")
    duplicates = sorted(frame.loc[frame["pcode"].duplicated(), "pcode"].dropna().unique())
    if duplicates:
        result.errors.append(f"adm{level}: duplicate pcodes {duplicates}")
    no_name = frame.loc[frame["name_en"].isna(), "pcode"].tolist()
    if no_name:
        result.errors.append(f"adm{level}: no English name for {no_name}")
    wrong_level = frame.loc[frame["level"] != level, "pcode"].tolist()
    if wrong_level:
        result.errors.append(f"adm{level}: wrong level value for {wrong_level}")
    no_arabic = frame.loc[frame["name_ar"].isna(), "pcode"].tolist()
    if no_arabic:
        result.warnings.append(f"adm{level}: no Arabic name for {len(no_arabic)} feature(s): {no_arabic}")


def check_counts(frame: gpd.GeoDataFrame, level: int, source_count: int | None, result: Result) -> None:
    count = len(frame)
    result.stats[f"adm{level}_count"] = count
    if source_count is not None and count != source_count:
        result.errors.append(f"adm{level}: {count} features, but the source has {source_count}")
    expected = config.EXPECTED_COUNTS.get(level)
    if expected is not None and count != expected:
        result.warnings.append(f"adm{level}: {count} features; the brief expected {expected}")


def check_geometry(frame: gpd.GeoDataFrame, level: int, result: Result) -> None:
    geoms = frame.geometry
    for label, mask in (
        ("missing or empty geometry", geoms.isna() | geoms.is_empty),
        ("invalid geometry", ~geoms.is_valid),
        ("non-polygon geometry", ~geoms.geom_type.isin(["Polygon", "MultiPolygon"])),
    ):
        bad = frame.loc[mask, "pcode"].tolist()
        if bad:
            result.errors.append(f"adm{level}: {label} for {bad}")


def check_parents(adm1: gpd.GeoDataFrame, adm2: gpd.GeoDataFrame, result: Result) -> None:
    states = set(adm1["pcode"])
    orphans = adm2.loc[~adm2["parent_pcode"].isin(states), ["pcode", "parent_pcode"]]
    if len(orphans):
        result.errors.append(f"adm2: parent_pcode not found for {orphans.to_dict('records')}")
    childless = sorted(states - set(adm2["parent_pcode"]))
    if childless:
        result.errors.append(f"adm1: no localities found for {childless}")


def _areas(geometries) -> list[float]:
    """Areas in m². Set operations run in the source coordinates (where shared
    borders are exactly equal); only their results are projected to be measured."""
    geometries = list(geometries)
    if not geometries:
        return []
    return gpd.GeoSeries(geometries, crs=4326).to_crs(config.AREA_CRS).area.tolist()


def _parts(geometry) -> list:
    return [g for g in getattr(geometry, "geoms", [geometry]) if not g.is_empty]


def check_overlaps(adm2: gpd.GeoDataFrame, result: Result) -> None:
    geoms = adm2.to_crs(4326).geometry.values
    pcodes = adm2["pcode"].tolist()
    tree = STRtree(geoms)
    left, right = tree.query(geoms, predicate="intersects")
    pairs = [(i, j) for i, j in zip(left, right) if i < j]
    areas = _areas(shapely.intersection(geoms[i], geoms[j]) for i, j in pairs)
    overlaps, slivers = [], 0
    for (i, j), area in zip(pairs, areas):
        if area > config.SLIVER_TOLERANCE_M2:
            overlaps.append({"a": pcodes[i], "b": pcodes[j], "km2": round(area / 1e6, 4)})
        elif area > 0:
            slivers += 1
    result.stats["overlap_slivers_below_tolerance"] = slivers
    if overlaps:
        result.errors.append(f"adm2: {len(overlaps)} overlap(s) above tolerance: {overlaps}")


def check_gaps(adm2: gpd.GeoDataFrame, outline: gpd.GeoDataFrame | None, result: Result) -> None:
    covered = shapely.union_all(adm2.to_crs(4326).geometry.values)
    holes = [shapely.Polygon(ring) for poly in _parts(covered) for ring in poly.interiors]
    pieces = list(holes)
    if outline is not None:
        country = shapely.union_all(outline.to_crs(4326).geometry.values)
        country_holes = [shapely.Polygon(r) for p in _parts(country) for r in p.interiors]
        pieces = [h for h in holes if not any(h.equals(c) for c in country_holes)]
        pieces += _parts(shapely.difference(country, covered))
    areas = _areas(pieces)
    gaps = sorted(
        ({"km2": round(a / 1e6, 4), "near": _lonlat(p.representative_point())}
         for p, a in zip(pieces, areas) if a > config.SLIVER_TOLERANCE_M2),
        key=lambda g: -g["km2"],
    )
    result.stats["gap_slivers_below_tolerance"] = sum(1 for a in areas if 0 < a <= config.SLIVER_TOLERANCE_M2)
    if gaps:
        result.errors.append(f"adm2: {len(gaps)} gap(s) above tolerance: {gaps}")


def _lonlat(point) -> list[float]:
    return [round(point.x, 4), round(point.y, 4)]


def check_containment(adm1: gpd.GeoDataFrame, adm2: gpd.GeoDataFrame, result: Result) -> None:
    states = adm1.to_crs(4326).set_index("pcode").geometry
    rows = [r for r in adm2.to_crs(4326).itertuples() if r.parent_pcode in states.index]
    whole = _areas(r.geometry for r in rows)
    outside_area = _areas(shapely.difference(r.geometry, states[r.parent_pcode]) for r in rows)
    outside = []
    for row, total, out in zip(rows, whole, outside_area):
        share = out / total if total else 0
        if share > config.PARENT_CONTAINMENT_TOLERANCE:
            outside.append({"pcode": row.pcode, "parent": row.parent_pcode, "share_outside": round(share, 4)})
    if outside:
        result.errors.append(f"adm2: localities extending outside their state: {outside}")


def check_derived_states(source_adm1: gpd.GeoDataFrame, derived_adm1: gpd.GeoDataFrame, result: Result) -> None:
    """Compare each state rebuilt from its localities with the COD-AB state polygon."""
    source = source_adm1.to_crs(4326).set_index("pcode").geometry
    derived = derived_adm1.to_crs(4326).set_index("pcode").geometry
    pcodes = [p for p in source.index if p in derived.index]
    totals = _areas(source[p] for p in pcodes)
    differences = _areas(shapely.symmetric_difference(source[p], derived[p]) for p in pcodes)
    shares = {p: d / t for p, t, d in zip(pcodes, totals, differences) if t}
    result.stats["max_state_difference_vs_cod_ab"] = round(max(shares.values(), default=0), 6)
    differing = {k: round(v, 4) for k, v in shares.items() if v > config.PARENT_CONTAINMENT_TOLERANCE}
    if differing:
        result.warnings.append(f"adm1: states rebuilt from localities differ from COD-AB state polygons by {differing}")


def check_topojson(path: Path, level: int, expected: int, result: Result) -> None:
    topo = json.loads(path.read_text())
    geometries = topo.get("objects", {}).get(f"adm{level}", {}).get("geometries", [])
    if len(geometries) != expected:
        result.errors.append(f"{path.name}: {len(geometries)} geometries, expected {expected}")
    if any(not (g.get("properties") or {}).get("pcode") for g in geometries):
        result.errors.append(f"{path.name}: geometries without a pcode property")


def validate(
    target: str,
    adm1: gpd.GeoDataFrame,
    adm2: gpd.GeoDataFrame,
    outline: gpd.GeoDataFrame | None = None,
    source_counts: dict[int, int] | None = None,
) -> Result:
    result = Result(target)
    source_counts = source_counts or {}
    for level, frame in ((1, adm1), (2, adm2)):
        check_schema(frame, level, result)
        check_counts(frame, level, source_counts.get(level), result)
        check_geometry(frame, level, result)
    if result.errors:
        return result  # later checks assume a sound schema and valid geometry
    check_parents(adm1, adm2, result)
    check_overlaps(adm2, result)
    check_gaps(adm2, outline, result)
    check_containment(adm1, adm2, result)
    return result


def run() -> list[Result]:
    normalise_report = json.loads((config.REPORTS_DIR / "normalise.json").read_text())
    source_counts = {lvl: normalise_report[f"adm{lvl}"]["source_feature_count"] for lvl in config.LEVELS}

    adm0_path = config.INTERIM_DIR / "adm0.geojson"
    outline = gpd.read_file(adm0_path) if adm0_path.exists() else None
    results = [
        validate(
            "source (normalised COD-AB)",
            gpd.read_file(config.INTERIM_DIR / "adm1.geojson"),
            gpd.read_file(config.INTERIM_DIR / "adm2.geojson"),
            outline if outline is not None else gpd.read_file(config.INTERIM_DIR / "adm1.geojson"),
            source_counts,
        )
    ]
    for resolution in config.RESOLUTIONS:
        folder = config.BOUNDARIES_DIR / resolution
        result = validate(
            resolution,
            gpd.read_file(folder / "adm1.geojson"),
            gpd.read_file(folder / "adm2.geojson"),
            None,
            source_counts,
        )
        for level in config.LEVELS:
            check_topojson(folder / f"adm{level}.topojson", level, source_counts[level], result)
        if resolution == "detailed":
            check_derived_states(gpd.read_file(config.INTERIM_DIR / "adm1.geojson"), gpd.read_file(folder / "adm1.geojson"), result)
        results.append(result)

    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (config.REPORTS_DIR / "validate.json").write_text(
        json.dumps([r.__dict__ for r in results], indent=2, ensure_ascii=False)
    )
    for r in results:
        status = "PASS" if r.ok else "FAIL"
        print(f"[{status}] {r.target}: {len(r.errors)} error(s), {len(r.warnings)} warning(s) {r.stats}")
        for e in r.errors:
            print(f"   ERROR   {e}")
        for w in r.warnings:
            print(f"   WARNING {w}")
    return results
