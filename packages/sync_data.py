"""Copy the released data into the Python package before building or testing it.

The package ships its own copy of data/gazetteer/ and data/boundaries/, but git keeps
only the originals: the copy is ignored. (The npm package copies its own: see
packages/js/scripts/copy-data.mjs.) Run from the repository root:

    python packages/sync_data.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAZETTEER_FILES = ["places.json", "variants.json", "variants_osm.json", "normalisation.json"]
PACKAGE = ROOT / "packages" / "py"
TARGETS = [PACKAGE / "src" / "sudan_atlas" / "data"]


def sync() -> None:
    for target in TARGETS:
        if target.exists():
            shutil.rmtree(target)
        (target / "boundaries").mkdir(parents=True)
        for name in GAZETTEER_FILES:
            source = ROOT / "data" / "gazetteer" / name
            if source.exists():
                shutil.copy2(source, target / name)
        boundaries = ROOT / "data" / "boundaries"
        shutil.copy2(boundaries / "manifest.json", target / "boundaries" / "manifest.json")
        for resolution in sorted(p for p in boundaries.iterdir() if p.is_dir()):
            shutil.copytree(resolution, target / "boundaries" / resolution.name)
        for licence in ("LICENSE", "LICENSE-DATA"):
            shutil.copy2(ROOT / licence, target / licence)
            shutil.copy2(ROOT / licence, PACKAGE / licence)  # for the package metadata
        size = sum(f.stat().st_size for f in target.rglob("*") if f.is_file())
        print(f"{target.relative_to(ROOT)}: {size / 1024:,.0f} KB")


if __name__ == "__main__":
    sync()
