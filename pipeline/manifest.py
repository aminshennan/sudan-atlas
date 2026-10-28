"""Write data/boundaries/manifest.json describing the release.

The manifest has no build timestamp, so rebuilding unchanged sources gives a
byte-identical file.
"""

import hashlib
import json

import geopandas as gpd

from . import config


def _source(manifest_path):
    if not manifest_path.exists():
        return None
    raw = json.loads(manifest_path.read_text())
    keep = ("source", "dataset_url", "dataset_title", "dataset_date", "dataset_last_modified", "upstream", "licence", "downloaded_at")
    entry = {k: raw[k] for k in keep if raw.get(k)}
    entry["files"] = [{"file": f["file"].rsplit("/", 1)[-1], "sha256": f["sha256"]} for f in raw["files"]]
    return entry


def run() -> dict:
    files = {}
    for resolution in config.RESOLUTIONS:
        folder = config.BOUNDARIES_DIR / resolution
        for path in sorted(folder.iterdir()):
            body = path.read_bytes()
            files[f"{resolution}/{path.name}"] = {"bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}

    detailed = config.BOUNDARIES_DIR / "detailed"
    counts = {f"adm{lvl}": len(gpd.read_file(detailed / f"adm{lvl}.geojson")) for lvl in config.LEVELS}
    manifest = {
        "name": "Sudan Atlas boundaries",
        "version": config.DATA_VERSION,
        "licence": "CC BY 3.0 IGO (boundaries derived from OCHA COD-AB); see LICENSE-DATA",
        "attribution": "OCHA Regional Office for Southern and Eastern Africa (ROSEA), via HDX; Sudan Atlas",
        "schema": ["pcode", "name_en", "name_ar", "level", "parent_pcode"],
        "counts": counts,
        "resolutions": {name: {k: v for k, v in s.items()} for name, s in config.RESOLUTIONS.items()},
        "sources": [s for s in (_source(config.COD_AB_DIR / "manifest.json"),) if s],
        "files": files,
    }
    path = config.BOUNDARIES_DIR / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"manifest: {path.name} ({len(files)} files, version {config.DATA_VERSION})")
    return manifest
