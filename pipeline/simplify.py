"""Simplify the normalised boundaries with mapshaper and export every resolution.

States are rebuilt by dissolving the simplified localities, so a state border
is exactly the same line as the locality borders along it, at every resolution.
State attributes are then joined back from the normalised COD-AB state layer.
"""

import shutil
import subprocess
from pathlib import Path

from . import config

FIELDS = "pcode,name_en,name_ar,level,parent_pcode"


def _mapshaper() -> str:
    local = config.ROOT / "node_modules" / ".bin" / "mapshaper"
    if local.exists():
        return str(local)
    found = shutil.which("mapshaper")
    if not found:
        raise SystemExit("mapshaper not found. Run `npm install` at the repository root.")
    return found


def command(settings: dict, interim: Path, out_dir: Path) -> list[str]:
    geojson = ["format=geojson", f"precision={settings['precision']}"]
    topojson = ["format=topojson", f"quantization={settings['quantization']}"]
    args = [_mapshaper(), "-i", str(interim / "adm2.geojson"), "name=adm2"]
    if settings["simplify"]:
        args += ["-simplify", settings["simplify"], "keep-shapes"]
    args += ["-filter-fields", FIELDS]
    args += ["-o", str(out_dir / "adm2.geojson"), *geojson]
    args += ["-o", str(out_dir / "adm2.topojson"), *topojson]
    args += ["-dissolve", "parent_pcode", "+", "name=adm1"]
    args += ["-rename-fields", "pcode=parent_pcode"]
    args += ["-join", str(interim / "adm1.geojson"), "keys=pcode,pcode", "fields=name_en,name_ar,level,parent_pcode"]
    args += ["-filter-fields", FIELDS]
    args += ["-o", str(out_dir / "adm1.geojson"), *geojson]
    args += ["-o", str(out_dir / "adm1.topojson"), *topojson]
    return args


def run(interim: Path | None = None, boundaries: Path | None = None) -> dict[str, dict]:
    interim = interim or config.INTERIM_DIR
    boundaries = boundaries or config.BOUNDARIES_DIR
    sizes = {}
    for resolution, settings in config.RESOLUTIONS.items():
        out_dir = boundaries / resolution
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True)
        result = subprocess.run(
            command(settings, interim, out_dir),
            cwd=config.ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise SystemExit(f"mapshaper failed for {resolution}:\n{result.stderr}")
        sizes[resolution] = {f.name: f.stat().st_size for f in sorted(out_dir.iterdir())}
        listing = ", ".join(f"{name} {size / 1024:,.0f} KB" for name, size in sizes[resolution].items())
        print(f"{resolution}: {listing}")
    return sizes
