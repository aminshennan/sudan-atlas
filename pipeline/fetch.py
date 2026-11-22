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
