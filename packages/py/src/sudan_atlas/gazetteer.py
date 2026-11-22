"""Load the gazetteer: places, variant spellings and normalisation rules."""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

VARIANT_FILES = ("variants.json", "variants_osm.json")


def _repository_data() -> Path | None:
    """The repository's data/ folder, when the package runs from a source checkout (not when installed)."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "data" / "gazetteer" / "places.json").exists() and (parent / "pipeline").is_dir():
            return parent / "data"
    return None


def data_dir() -> Path:
    """The gazetteer folder: $SUDAN_ATLAS_DATA, the repository's data/gazetteer when running from a
    checkout (so the live data is used, not a stale copy), or the copy bundled with the package."""
    if os.environ.get("SUDAN_ATLAS_DATA"):
        return Path(os.environ["SUDAN_ATLAS_DATA"])
    repository = _repository_data()
    if repository:
        return repository / "gazetteer"
    bundled = Path(__file__).parent / "data"
    if (bundled / "places.json").exists():
        return bundled
    raise FileNotFoundError("Gazetteer data not found. Set SUDAN_ATLAS_DATA to the folder holding places.json.")


def boundaries_dir() -> Path:
    """The boundaries folder, found the same way as data_dir()."""
    beside = data_dir() / "boundaries"
    if (beside / "manifest.json").exists():
        return beside
    repository = _repository_data()
    if repository and (repository / "boundaries" / "manifest.json").exists():
        return repository / "boundaries"
    raise FileNotFoundError("Boundary data not found. Run packages/sync_data.py, or set SUDAN_ATLAS_DATA.")


@dataclass
class Gazetteer:
    places: dict[str, dict]
    variants: list[dict]
    rules: dict
    version: str = ""
    sources: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, folder: Path | None = None) -> "Gazetteer":
        folder = Path(folder) if folder else data_dir()
        document = json.loads((folder / "places.json").read_text(encoding="utf-8"))
        places = {p["pcode"]: p for p in document["places"]}
        variants, sources = [], []
        for name in VARIANT_FILES:
            path = folder / name
            if path.exists():
                variants += json.loads(path.read_text(encoding="utf-8"))["variants"]
                sources.append(name)
        rules = json.loads((folder / "normalisation.json").read_text(encoding="utf-8"))
        return cls(places, variants, rules, document.get("version", ""), sources)
