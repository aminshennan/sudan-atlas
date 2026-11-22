"""Download the raw sources into data/raw/ and record what was downloaded.

COD-AB comes from HDX. geoBoundaries is downloaded as a cross-check: for Sudan
it is a repackaging of the same OCHA dataset without P-codes or Arabic names.
"""

import hashlib
import json
import os
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from . import config

# Formats tried in order; only the first one HDX offers is downloaded.
FORMAT_PREFERENCE = ("GEOPACKAGE", "GPKG", "GEOJSON", "SHP", "ZIPPED SHAPEFILE", "GEODATABASE", "GDB")

GEOBOUNDARIES_BASE = (
    "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/SDN"
)


def _context() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE"))


def _get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "sudan-atlas-pipeline"})
    with urllib.request.urlopen(request, context=_context(), timeout=300) as response:
        return response.read()


def _save(url: str, target: Path) -> dict:
    body = _get(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return {
        "url": url,
        "file": target.relative_to(config.ROOT).as_posix(),
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
    }


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_cod_ab() -> dict:
    metadata = json.loads(_get(f"{config.HDX_API}?id={config.HDX_DATASET}"))["result"]
    resources = metadata["resources"]
    offered = {(r.get("format") or "").upper() for r in resources}
    chosen_format = next((f for f in FORMAT_PREFERENCE if f in offered), None)
    if chosen_format is None:
        raise SystemExit(f"No geographic format found on HDX. Formats offered: {sorted(offered)}")

    files = []
    for resource in resources:
        if (resource.get("format") or "").upper() != chosen_format:
            continue
        name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
        entry = _save(resource["url"], config.COD_AB_DIR / name)
        entry["resource_name"] = resource.get("name")
        entry["resource_last_modified"] = resource.get("last_modified")
        files.append(entry)

    manifest = {
        "source": "COD-AB Sudan (OCHA, via HDX)",
        "dataset_url": f"https://data.humdata.org/dataset/{config.HDX_DATASET}",
        "dataset_title": metadata.get("title"),
        "dataset_date": metadata.get("dataset_date"),
        "dataset_last_modified": metadata.get("last_modified") or metadata.get("metadata_modified"),
        "licence": metadata.get("license_title"),
        "licence_other": metadata.get("license_other"),
        "caveats": metadata.get("caveats"),
        "format": chosen_format,
        "downloaded_at": _now(),
        "files": files,
    }
    (config.COD_AB_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    return manifest


def fetch_geoboundaries() -> dict:
    files = []
    for level in ("ADM0", "ADM1", "ADM2"):
        for suffix in ("-metaData.json", ".geojson"):
            name = f"geoBoundaries-SDN-{level}{suffix}"
            files.append(_save(f"{GEOBOUNDARIES_BASE}/{level}/{name}", config.GEOBOUNDARIES_DIR / name))
    meta = json.loads((config.GEOBOUNDARIES_DIR / "geoBoundaries-SDN-ADM1-metaData.json").read_text())
    manifest = {
        "source": "geoBoundaries gbOpen SDN",
        "dataset_url": "https://www.geoboundaries.org/",
        "upstream": meta.get("boundarySource"),
        "licence": meta.get("boundaryLicense"),
        "downloaded_at": _now(),
        "files": files,
    }
    (config.GEOBOUNDARIES_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


GEONAMES_FILES = {
    "SD.zip": "https://download.geonames.org/export/dump/SD.zip",
    "alternatenames-SD.zip": "https://download.geonames.org/export/dump/alternatenames/SD.zip",
}
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"


def fetch_geonames() -> dict:
    files = [_save(url, config.RAW_DIR / "geonames" / name) for name, url in GEONAMES_FILES.items()]
    manifest = {
        "source": "GeoNames (Sudan extract and alternate names)",
        "dataset_url": "https://www.geonames.org/",
        "licence": "CC BY 4.0",
        "downloaded_at": _now(),
        "files": files,
    }
    (config.RAW_DIR / "geonames" / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def fetch_wikidata() -> dict:
    query = (config.ROOT / "pipeline" / "gazetteer" / "wikidata.rq").read_text()
    url = f"{WIKIDATA_SPARQL}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}"
    request = urllib.request.Request(url, headers={
        "User-Agent": "sudan-atlas-pipeline (https://github.com/aminshennan/sudan-atlas)",
        "Accept": "application/sparql-results+json",
    })
    with urllib.request.urlopen(request, context=_context(), timeout=300) as response:
        body = response.read()
    target = config.RAW_DIR / "wikidata" / "items.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    manifest = {
        "source": "Wikidata: states and localities of Sudan",
        "dataset_url": "https://www.wikidata.org/",
        "query": "pipeline/gazetteer/wikidata.rq",
        "licence": "CC0 1.0",
        "downloaded_at": _now(),
        "files": [{"url": WIKIDATA_SPARQL, "file": target.relative_to(config.ROOT).as_posix(), "bytes": len(body),
                   "sha256": hashlib.sha256(body).hexdigest()}],
    }
    (target.parent / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


OSM_DATASET = "hotosm_sdn_populated_places"


def fetch_osm() -> dict:
    """OpenStreetMap populated places for Sudan: the Humanitarian OpenStreetMap Team's export on HDX (ODbL)."""
    meta = json.loads(_get(f"{config.HDX_API}?id={OSM_DATASET}"))["result"]
    resource = next(r for r in meta["resources"] if (r.get("format") or "").lower() == "geopackage")
    name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
    files = [_save(resource["url"], config.RAW_DIR / "osm" / name)]
    manifest = {
        "source": "OpenStreetMap populated places of Sudan (Humanitarian OpenStreetMap Team export)",
        "dataset_url": f"https://data.humdata.org/dataset/{OSM_DATASET}",
        "dataset_last_modified": meta.get("last_modified"),
        "licence": meta.get("license_title"),
        "attribution": "© OpenStreetMap contributors",
        "downloaded_at": _now(),
        "files": files,
    }
    (config.RAW_DIR / "osm" / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


CAMPS_DATASET = "sudan-idp-camps"


def fetch_camps() -> dict:
    """OCHA Sudan's list of IDP camps and sites, with coordinates and English and Arabic names (CC0)."""
    meta = json.loads(_get(f"{config.HDX_API}?id={CAMPS_DATASET}"))["result"]
    resource = next(r for r in meta["resources"] if (r.get("format") or "").upper() in ("XLSX", "XLS"))
    name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
    files = [_save(resource["url"], config.RAW_DIR / "ocha-camps" / name)]
    manifest = {
        "source": "Sudan IDP camps (OCHA Sudan, via HDX)",
        "dataset_url": f"https://data.humdata.org/dataset/{CAMPS_DATASET}",
        "dataset_last_modified": meta.get("last_modified"),
        "licence": meta.get("license_title"),
        "downloaded_at": _now(),
        "files": files,
    }
    (config.RAW_DIR / "ocha-camps" / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


OCHA_SETTLEMENTS_DATASET = "sudan-settlement-26-july-2020"


def fetch_ocha_settlements() -> dict:
    """OCHA Sudan's settlement list: villages and towns with coordinates and locality P-codes (CC BY)."""
    meta = json.loads(_get(f"{config.HDX_API}?id={OCHA_SETTLEMENTS_DATASET}"))["result"]
    resource = next(r for r in meta["resources"] if (r.get("format") or "").upper() in ("XLSX", "XLS"))
    name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
    files = [_save(resource["url"], config.RAW_DIR / "ocha-settlements" / name)]
    manifest = {
        "source": "Sudan: Settlements (OCHA Sudan and humanitarian partners, via HDX)",
        "dataset_url": f"https://data.humdata.org/dataset/{OCHA_SETTLEMENTS_DATASET}",
        "dataset_last_modified": meta.get("last_modified"),
        "licence": meta.get("license_title"),
        "downloaded_at": _now(),
        "files": files,
    }
    (config.RAW_DIR / "ocha-settlements" / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


OVERTURE_BUCKET = "https://overturemaps-us-west-2.s3.amazonaws.com"
OVERTURE_SUBTYPES = ("locality", "neighborhood", "microhood", "macrohood")


def fetch_overture() -> dict:
    """Sudan's localities and neighbourhoods from Overture Maps' divisions theme (latest release).

    The theme is one large file for the whole world, so it is downloaded once, Sudan's rows are kept
    in data/raw/overture/sd_divisions.parquet, and the large file is deleted. Overture records carry
    their own source and licence: OpenStreetMap (ODbL) or Esri Community Maps (CC BY 4.0)."""
    import re
    import tempfile

    import pyarrow.parquet as pq

    listing = _get(f"{OVERTURE_BUCKET}/?list-type=2&prefix=release/&delimiter=/").decode()
    release = sorted(re.findall(r"<Prefix>release/([^<]+)/</Prefix>", listing))[-1]
    prefix = f"release/{release}/theme=divisions/type=division/"
    keys = re.findall(r"<Key>([^<]+)</Key>", _get(f"{OVERTURE_BUCKET}/?list-type=2&prefix={prefix}").decode())
    target = config.RAW_DIR / "overture" / "sd_divisions.parquet"
    target.parent.mkdir(parents=True, exist_ok=True)
    tables = []
    with tempfile.TemporaryDirectory() as tmp:
        for key in keys:
            part = Path(tmp) / "part.parquet"
            part.write_bytes(_get(f"{OVERTURE_BUCKET}/{key}"))
            tables.append(pq.read_table(part, columns=["id", "country", "subtype", "class", "names", "sources", "geometry"],
                                        filters=[("country", "=", "SD"), ("subtype", "in", OVERTURE_SUBTYPES)]))
            part.unlink()
    import pyarrow as pa

    table = pa.concat_tables(tables)
    pq.write_table(table, target)
    body = target.read_bytes()
    manifest = {
        "source": "Overture Maps Foundation, divisions theme (localities and neighbourhoods of Sudan)",
        "release": release,
        "dataset_url": "https://docs.overturemaps.org/guides/divisions/",
        "licence": "ODbL 1.0 for OpenStreetMap records; CC BY 4.0 for Esri Community Maps records (per record)",
        "downloaded_at": _now(),
        "files": [{"url": f"{OVERTURE_BUCKET}/{prefix}", "file": target.relative_to(config.ROOT).as_posix(),
                   "rows": table.num_rows, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}],
    }
    (target.parent / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


WIKIDATA_SETTLEMENTS_QUERY = """
SELECT ?item ?coord (GROUP_CONCAT(DISTINCT ?name; separator="|") AS ?names) WHERE {
  ?item wdt:P17 wd:Q1049; wdt:P625 ?coord; wdt:P31/wdt:P279* wd:Q486972 .
  { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
  FILTER(LANG(?name) IN ("en", "ar"))
} GROUP BY ?item ?coord
"""


def fetch_wikidata_settlements() -> dict:
    """Human settlements in Sudan with coordinates, and their English and Arabic names and aliases (CC0)."""
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode(
        {"query": WIKIDATA_SETTLEMENTS_QUERY, "format": "json"})
    body = _get(url)
    target = config.RAW_DIR / "wikidata" / "settlements.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    manifest_path = target.parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    manifest.setdefault("files", [])
    manifest["files"] = [f for f in manifest["files"] if not f.get("file", "").endswith("settlements.json")] + [{
        "url": "https://query.wikidata.org/sparql (settlements of Sudan)", "file": target.relative_to(config.ROOT).as_posix(),
        "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "downloaded_at": _now()}]
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return manifest


def register_local(archive: Path, note: str) -> dict:
    """Copy a COD-AB archive downloaded by hand into data/raw/cod-ab/ and record it."""
    body = archive.read_bytes()
    target = config.COD_AB_DIR / archive.name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    manifest = {
        "source": "COD-AB Sudan (OCHA, via HDX)",
        "dataset_url": f"https://data.humdata.org/dataset/{config.HDX_DATASET}",
        "licence": "CC BY 3.0 IGO",
        "obtained": note,
        "downloaded_at": _now(),
        "files": [{
            "url": None,
            "file": target.relative_to(config.ROOT).as_posix(),
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
        }],
    }
    (config.COD_AB_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"COD-AB: registered {target.name} ({len(body):,} bytes)")
    return manifest


def run() -> None:
    cod = fetch_cod_ab()
    print(f"COD-AB: {len(cod['files'])} file(s), format {cod['format']}, licence {cod['licence']!r}")
    gb = fetch_geoboundaries()
    print(f"geoBoundaries: {len(gb['files'])} file(s), licence {gb['licence']!r}")
    gn = fetch_geonames()
    print(f"GeoNames: {len(gn['files'])} file(s), licence {gn['licence']!r}")
    wd = fetch_wikidata()
    print(f"Wikidata: {wd['files'][0]['bytes']:,} bytes, licence {wd['licence']!r}")
    osm = fetch_osm()
    print(f"OpenStreetMap: {osm['files'][0]['bytes']:,} bytes, licence {osm['licence']!r}")
    camps = fetch_camps()
    print(f"OCHA IDP camps: {camps['files'][0]['bytes']:,} bytes, licence {camps['licence']!r}")
    ocha = fetch_ocha_settlements()
    print(f"OCHA settlements: {ocha['files'][0]['bytes']:,} bytes, licence {ocha['licence']!r}")
    overture = fetch_overture()
    print(f"Overture Maps {overture['release']}: {overture['files'][0]['rows']:,} Sudan places")
    wikidata = fetch_wikidata_settlements()
    print(f"Wikidata settlements: {wikidata['files'][-1]['bytes']:,} bytes, CC0")
