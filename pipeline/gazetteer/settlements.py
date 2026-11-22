"""Villages, towns and camps, each placed in its locality by its coordinates.

Writes two files, kept apart because of their licences:
- data/gazetteer/settlements.json: GeoNames populated places (CC BY 4.0), OCHA Sudan's list of IDP
  camps and sites (CC0), Wikidata settlements (CC0), and Overture Maps places from Esri Community
  Maps (CC BY 4.0);
- data/gazetteer/settlements_osm.json: OpenStreetMap villages, hamlets, towns and neighbourhoods,
  from the Humanitarian OpenStreetMap Team's export and from Overture Maps, which adds the
  alternative and other-language names OpenStreetMap records (ODbL, © OpenStreetMap contributors).

Each settlement keeps its names as written by its source (English, Arabic and alternates), its
point, its kind, and the state and locality it falls in, worked out from the detailed COD-AB
boundaries. The matcher uses them only when asked to (`settlements=True`).
"""

import re
import zipfile
from collections import Counter, defaultdict

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from sudan_atlas.normalise import Normaliser

from .. import config
from .places import dump_records
from .variants import GEONAMES_COLUMNS, GEONAMES_LANGUAGES, OSM_EXPORT, _read_tsv

GAZETTEER_DIR = config.ROOT / "data" / "gazetteer"
NORMALISATION_PATH = GAZETTEER_DIR / "normalisation.json"
SETTLEMENTS_PATH = GAZETTEER_DIR / "settlements.json"
OSM_SETTLEMENTS_PATH = GAZETTEER_DIR / "settlements_osm.json"
CAMPS_DIR = config.RAW_DIR / "ocha-camps"
OVERTURE_FILE = config.RAW_DIR / "overture" / "sd_divisions.parquet"
WIKIDATA_FILE = config.RAW_DIR / "wikidata" / "settlements.json"
OVERTURE_KINDS = {"city": "town", "town": "town", "village": "village", "hamlet": "hamlet"}

# OpenStreetMap place values kept, and what they are called here. Single farms (isolated_dwelling),
# city blocks and islands are left out. A named residential area with no place tag is a settlement.
OSM_KINDS = {"city": "town", "town": "town", "village": "village", "hamlet": "hamlet", "neighbourhood": "neighbourhood"}
GEONAMES_KINDS = {"PPLC": "town", "PPLA": "town", "PPLA2": "town", "PPLW": "destroyed village",
                  "PPLQ": "abandoned village", "PPLX": "neighbourhood"}
NAME_SEPARATORS = re.compile(r"\s*[;،/]\s*")  # several names in one field ("Shabasha;Shabashah")
DEDUPE_METRES = 2_000  # the same name within this distance is one place
COORD_DECIMALS = 5  # about 1 m


def _names(*values) -> list[str]:
    out = []
    for v in values:
        if not isinstance(v, str):
            continue
        for part in NAME_SEPARATORS.split(v.strip()):
            part = " ".join(part.split())
            if part and not part.isdigit() and part not in out:
                out.append(part)
    return out


def _arabic(name: str) -> bool:
    return any("؀" <= c <= "ۿ" for c in name)


def geonames() -> list[dict]:
    rows = _read_tsv("SD.zip", "SD.txt", GEONAMES_COLUMNS)
    alternates = defaultdict(list)
    for a in _read_tsv("alternatenames-SD.zip", "SD.txt",
                       ["id", "geonameid", "lang", "name", "preferred", "short", "colloquial", "historic", "from", "to"]):
        if a["lang"] in GEONAMES_LANGUAGES:
            alternates[a["geonameid"]].append(a["name"])
    out = []
    for r in rows:
        if r["fclass"] != "P":
            continue
        names = _names(r["name"], r["asciiname"], *alternates[r["geonameid"]])
        out.append({"id": f"geonames:{r['geonameid']}", "names": names,
                    "kind": GEONAMES_KINDS.get(r["fcode"], "village"),
                    "lon": float(r["lon"]), "lat": float(r["lat"])})
    return out


def camps() -> list[dict]:
    path = next(CAMPS_DIR.glob("*.xls*"), None)
    if path is None:
        return []
    frame = pd.read_excel(path, header=1)
    frame.columns = [str(c).strip() for c in frame.columns]
    out = []
    for r in frame.itertuples(index=False):
        row = dict(zip(frame.columns, r))
        lat, lon = row.get("_GPS_latitude"), row.get("_GPS_longitude")
        if pd.isna(lat) or pd.isna(lon):
            continue
        kind = str(row.get("Location Classification") or "camp").strip().lower()
        out.append({"id": f"ocha-camps:{str(row.get('Reg_location')).strip()}",
                    "names": _names(row.get("Location"), row.get("Location Arabic")),
                    "kind": {"neighborhood": "neighbourhood"}.get(kind, kind),
                    "lon": float(lon), "lat": float(lat)})
    return [s for s in out if s["names"]]


def osm() -> list[dict]:
    if not OSM_EXPORT.exists():
        return []
    with zipfile.ZipFile(OSM_EXPORT) as zf:
        member = next(n for n in zf.namelist() if n.endswith(".gpkg"))
    frame = gpd.read_file(f"/vsizip/{OSM_EXPORT}/{member}").to_crs(4326)
    out = []
    for r in frame.itertuples():
        if isinstance(r.place, str):
            kind = OSM_KINDS.get(r.place)
        else:
            kind = "settlement" if r.landuse == "residential" else None
        # name_latin is a machine transliteration of the Arabic, so only real name tags are used.
        names = _names(r.name, r.name_en, r.name_ar)
        if not kind or not names or r.geometry is None:
            continue
        point = r.geometry.representative_point()
        out.append({"id": f"osm:{r.id}", "names": names, "kind": kind, "lon": point.x, "lat": point.y})
    return out


def overture() -> tuple[list[dict], list[dict]]:
    """Overture Maps places, split by licence: (OpenStreetMap records, Esri Community Maps records).

    An OpenStreetMap record keeps its OpenStreetMap id ("osm:node/123"), so its names merge with the
    same place from the Humanitarian OpenStreetMap Team export."""
    if not OVERTURE_FILE.exists():
        return [], []
    import pyarrow.parquet as pq
    from shapely import wkb

    osm_records, esri_records = [], []
    for r in pq.read_table(OVERTURE_FILE).to_pylist():
        n = r["names"] or {}
        common = n.get("common") or []
        common = [v for _, v in common] if common and isinstance(common[0], (list, tuple)) else []
        names = _names(n.get("primary"), *common, *[x.get("value") for x in (n.get("rules") or [])])
        if not names or not r["geometry"]:
            continue
        point = wkb.loads(r["geometry"]).representative_point()
        kind = OVERTURE_KINDS.get(r["class"] or "", "neighbourhood" if r["subtype"] != "locality" else "settlement")
        osm_ids = [s["record_id"].split("@")[0] for s in (r["sources"] or []) if s.get("dataset") == "OpenStreetMap"]
        record = {"names": names, "kind": kind, "lon": point.x, "lat": point.y}
        if osm_ids:
            rid = osm_ids[0]
            typ = {"n": "node", "w": "way", "r": "relation"}.get(rid[:1])
            osm_records.append({"id": f"osm:{typ}/{rid[1:]}" if typ else f"overture:{r['id']}", **record})
        else:
            esri_records.append({"id": f"overture:{r['id']}", **record})
    return osm_records, esri_records


def wikidata() -> list[dict]:
    if not WIKIDATA_FILE.exists():
        return []
    import json

    out = []
    for b in json.loads(WIKIDATA_FILE.read_text(encoding="utf-8"))["results"]["bindings"]:
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["coord"]["value"])
        if not m:
            continue
        names = _names(*b["names"]["value"].split("|"))
        if names:
            out.append({"id": "wikidata:" + b["item"]["value"].rsplit("/", 1)[-1], "names": names, "kind": "village",
                        "lon": float(m.group(1)), "lat": float(m.group(2))})
    return out


def _merge_ids(records: list[dict]) -> list[dict]:
    """Records with the same id (one OpenStreetMap place from two exports) become one, names merged."""
    by_id: dict[str, dict] = {}
    for r in records:
        if r["id"] in by_id:
            by_id[r["id"]]["names"] += [n for n in r["names"] if n not in by_id[r["id"]]["names"]]
        else:
            by_id[r["id"]] = {**r, "names": list(r["names"])}
    return list(by_id.values())


def _place(records: list[dict]) -> list[dict]:
    """Add the state and locality each point falls in; drop points outside Sudan."""
    localities = gpd.read_file(config.BOUNDARIES_DIR / "detailed" / "adm2.geojson")[["pcode", "parent_pcode", "geometry"]]
    points = gpd.GeoDataFrame(records, geometry=[Point(r["lon"], r["lat"]) for r in records], crs=4326)
    joined = gpd.sjoin(points, localities, how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")]
    out = []
    for r, pcode, state in zip(records, joined["pcode"], joined["parent_pcode"]):
        if isinstance(pcode, str):
            out.append({**r, "pcode": pcode, "state": state})
    return out


def _dedupe(records: list[dict], norm: Normaliser) -> list[dict]:
    """The same name within DEDUPE_METRES in the same locality is one place: keep the first, merge names."""
    kept, index = [], defaultdict(list)
    for r in records:
        keys = {norm.key(n) for n in r["names"]} - {""}
        twin = None
        for k in keys:
            for other in index[(k, r["pcode"])]:
                dx = (other["lon"] - r["lon"]) * 107_000  # metres per degree of longitude near 15°N
                dy = (other["lat"] - r["lat"]) * 110_600
                if (dx * dx + dy * dy) ** 0.5 <= DEDUPE_METRES:
                    twin = other
                    break
            if twin:
                break
        if twin:
            twin["names"] += [n for n in r["names"] if n not in twin["names"]]
            for k in keys:
                index[(k, twin["pcode"])].append(twin)
            continue
        kept.append(r)
        for k in keys:
            index[(k, r["pcode"])].append(r)
    return kept


def _finish(records: list[dict]) -> list[dict]:
    out = []
    for r in sorted(records, key=lambda r: (r["pcode"], r["names"][0], r["id"])):
        names = sorted(r["names"], key=lambda n: (_arabic(n), n == n.upper()))  # Latin first, all-caps last
        out.append({"id": r["id"], "name": names[0], "names": names, "kind": r["kind"],
                    "lat": round(r["lat"], COORD_DECIMALS), "lon": round(r["lon"], COORD_DECIMALS),
                    "pcode": r["pcode"], "state": r["state"]})
    return out


def run() -> dict:
    import json

    norm = Normaliser(json.loads(NORMALISATION_PATH.read_text(encoding="utf-8")))
    overture_osm, overture_esri = overture()
    open_records = _finish(_dedupe(_place(geonames() + camps() + wikidata() + overture_esri), norm))
    osm_records = _finish(_dedupe(_place(_merge_ids(osm() + overture_osm)), norm))
    SETTLEMENTS_PATH.write_text(dump_records(
        {"version": config.DATA_VERSION,
         "description": "Villages, towns and camps with the state and locality each falls in, from its coordinates and the detailed COD-AB boundaries.",
         "licence": "GeoNames records: CC BY 4.0 (www.geonames.org). OCHA Sudan IDP camps: CC0. Wikidata: CC0. Overture Maps records from Esri Community Maps: CC BY 4.0."},
        "settlements", open_records), encoding="utf-8")
    OSM_SETTLEMENTS_PATH.write_text(dump_records(
        {"version": config.DATA_VERSION,
         "description": "OpenStreetMap villages, hamlets, towns and neighbourhoods (from the Humanitarian OpenStreetMap Team's export and Overture Maps) with the state and locality each falls in.",
         "licence": "ODbL 1.0 (Open Database License); © OpenStreetMap contributors"},
        "settlements", osm_records), encoding="utf-8")
    summary = {"settlements.json": dict(Counter(r["kind"] for r in open_records)),
               "settlements_osm.json": dict(Counter(r["kind"] for r in osm_records))}
    print(f"settlements: {len(open_records)} (GeoNames and camps), {len(osm_records)} (OpenStreetMap); {summary}")
    return summary
