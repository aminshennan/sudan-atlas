"""Load the gazetteer: places, variant spellings and normalisation rules."""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

VARIANT_FILES = ("variants.json", "variants_osm.json")


def data_dir() -> Path:
    """The gazetteer folder: $SUDAN_ATLAS_DATA, the copy bundled with the package, or the repository's data/gazetteer."""
    if os.environ.get("SUDAN_ATLAS_DATA"):
        return Path(os.environ["SUDAN_ATLAS_DATA"])
    bundled = Path(__file__).parent / "data"
    if (bundled / "places.json").exists():
        return bundled
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data" / "gazetteer"
        if (candidate / "places.json").exists():
            return candidate
    raise FileNotFoundError("Gazetteer data not found. Set SUDAN_ATLAS_DATA to the folder holding places.json.")


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
