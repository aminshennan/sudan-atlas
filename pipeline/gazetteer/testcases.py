"""Collect real place names from public Sudan datasets on HDX, for the matcher's test set.

`pool` extracts every distinct (name, state) pair, with the dataset's own P-code when it has
one, into build/reports/test_pool.csv. The labelled test set, data/tests/match_cases.csv, is
chosen and labelled from that pool; each label is proposed (verified_by = agent) and then
checked by a person (verified_by = amin).

These datasets are kept out of variants.json, so the test measures the matcher honestly.
"""

import csv
import json
from dataclasses import dataclass

import pandas as pd

from .. import config

TEST_SOURCES_DIR = config.RAW_DIR / "test-sources"
POOL_PATH = config.REPORTS_DIR / "test_pool.csv"
CASES_PATH = config.ROOT / "data" / "tests" / "match_cases.csv"
CASE_COLUMNS = ["id", "input_name", "state_hint", "level", "expected_pcode", "source_dataset",
                "source_detail", "source_pcode", "verified_by", "notes"]


@dataclass
class Source:
    dataset: str
    sheet: str | int
    header: int  # header row index (0-based) as pandas reads it
    state: str | None
    name: str
    level: int
    state_pcode: str | None = None
    pcode: str | None = None
    file_glob: str = "*.xlsx"
    fill_state_down: bool = False  # the state column uses merged cells: blank rows belong to the state above


SOURCES = [
    Source("sudan-2022-hrp-response-monitoring-4ws", "HRP Jan-Jun Response", 0, "STATE", "LOCALITY", 2, "P-code Admin1", "Pcode Admin2"),
    Source("sudan-2022-hrp-response-monitoring-4ws", "HRP Jan-Jun Response", 0, None, "STATE", 1, None, "P-code Admin1"),
    Source("sudan-acute-food-insecurity-country-data", 0, 0, "Level 1", "Area", 2, file_glob="ipc_sdn_area_wide_latest.csv"),
    Source("sudan-acute-food-insecurity-country-data", 0, 0, None, "Level 1", 1, file_glob="ipc_sdn_area_wide_latest.csv"),
    Source("sudan-displacement-situation-countrywide-idps-iom-dtm", "IDPs Masterlist (ADMIN2)", 3, "STATE OF DISPLACEMET", "LOCALITY OF DISPLACEMENT", 2, "STATE CODE", "LOCALITY_ CODE"),
    Source("sudan-displacement-situation-countrywide-idps-iom-dtm", "Returnees Masterlist (ADMIN2)", 3, "State of Return", "Locality Of Return", 2, "State Code", "Locality Code"),
    Source("sudan-monthly-refugee-and-asylum-seeker-population-by-site", 0, 3, "State", "Locality", 2, fill_state_down=True),
    Source("sudan-monthly-refugee-and-asylum-seeker-population-by-site", 0, 3, None, "State", 1),
    Source("sudan-monthly-refugee-and-asylum-seeker-population-by-site", 0, 3, "State", "Site", 2, fill_state_down=True),
    Source("sudan-people-affected-by-floods", "2021", 0, "State", "Locality", 2),
    Source("sudan-people-affected-by-floods", "2022", 0, "State", "Locality", 2),
    Source("sudan-people-affected-by-floods", "2023", 0, "State", "Locality", 2),
    Source("sudan-people-affected-by-floods", "2022", 0, "State", "Village Name", 2),
    Source("sudan-people-reached-by-locality-jan-dec-2019_hrp", 0, 0, "STATE", "LOCALITY", 2),
    Source("sudan-people-reached-by-locality-jan-dec-2019_hrp", 0, 0, None, "STATE", 1),
    Source("sudan-schools", "Master File", 0, "state_name", "locality_name", 2, "STCODE", "LOCCODE"),
    Source("sudan-schools", "Master File", 0, "state_name", "LOCENG", 2, "STCODE", "LOCCODE"),
    Source("sudan-schools", "Master File", 0, None, "state_name", 1, None, "STCODE"),
    Source("sudan-subnational-boundaries-and-tabular-data", "Population Estimates_2020Geog", 0, "ADM1_NAME", "ADM2_NAME", 2),
    Source("sudan-subnational-boundaries-and-tabular-data", "Population Estimates_2020Geog", 0, None, "ADM1_NAME", 1),
    Source("sudan-who-does-what-where-november-2020", 0, 0, "State", "Locality", 2),
    Source("sudan-who-does-what-where-november-2020", 0, 0, None, "State", 1),
]


# The HDX resource used from each dataset (the 2024 floods file is a Google Sheet, so the
# dataset's 2021-2023 Excel file is used instead).
RESOURCES = {
    "sudan-2022-hrp-response-monitoring-4ws": "2022-HRP-Sectors-Response-Jan-Jun.xlsx",
    "sudan-acute-food-insecurity-country-data": "ipc_sdn_area_wide_latest.csv",
    "sudan-displacement-situation-countrywide-idps-iom-dtm": "DTM Sudan Displacement and Return Snapshot (8).xlsx",
    "sudan-monthly-refugee-and-asylum-seeker-population-by-site": "HDX-unhcr-population-as-of-31-August 2026.xlsx",
    "sudan-people-affected-by-floods": "Floods Data 2021 to 2023.xlsx",
    "sudan-people-reached-by-locality-jan-dec-2019_hrp": "sudan-people-reached-by-locality-jan-dec-2019_hrp.xlsx",
    "sudan-schools": "Sudan Schools (HXLated)",
    "sudan-subnational-boundaries-and-tabular-data": "Sudan_uscb_202101.xlsx",
    "sudan-who-does-what-where-november-2020": "cleaned_compiled_Nov_3ws.xlsx",
}


def fetch() -> dict:
    """Download the test-source files from HDX into data/raw/test-sources/ and record them."""
    from .. import fetch as fetching

    entries = []
    for dataset, resource_name in RESOURCES.items():
        meta = json.loads(fetching._get(f"{config.HDX_API}?id={dataset}"))["result"]
        resource = next(r for r in meta["resources"] if r["name"] == resource_name)
        filename = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
        entry = fetching._save(resource["url"], TEST_SOURCES_DIR / dataset / filename)
        entry.update({"dataset": dataset, "dataset_url": f"https://data.humdata.org/dataset/{dataset}",
                      "title": meta.get("title"), "organisation": (meta.get("organization") or {}).get("title"),
                      "licence": meta.get("license_title"), "resource": resource_name})
        entries.append(entry)
        print(f"  {dataset}: {entry['bytes']:,} bytes ({entry['licence']})")
    manifest = {"source": "HDX datasets used for the matcher test set", "downloaded_at": fetching._now(), "files": entries}
    (TEST_SOURCES_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    return manifest


def _read(source: Source) -> pd.DataFrame:
    path = next((TEST_SOURCES_DIR / source.dataset).glob(source.file_glob))
    if path.suffix == ".csv":
        return pd.read_csv(path, dtype=str, keep_default_na=False)
    frame = pd.read_excel(path, sheet_name=source.sheet, header=source.header, dtype=str)
    return frame.fillna("")


def _clean(value) -> str:
    return " ".join(str(value or "").split())


def pool() -> list[dict]:
    """Every distinct name per source column, with its state and any P-code the dataset gives."""
    rows = {}
    for source in SOURCES:
        frame = _read(source)
        if source.fill_state_down:
            frame[source.state] = frame[source.state].replace("", pd.NA).ffill().fillna("")
        for record in frame.to_dict("records"):
            name = _clean(record.get(source.name))
            if not name or name.startswith("#"):
                continue  # empty cells and HXL tag rows
            state = _clean(record.get(source.state)) if source.state else ""
            pcode = _clean(record.get(source.pcode)) if source.pcode else ""
            key = (name, state, source.level, source.dataset, source.name)
            entry = rows.setdefault(key, {"input_name": name, "state_hint": state, "level": source.level,
                                          "source_dataset": source.dataset,
                                          "source_detail": f"{source.sheet}/{source.name}" if source.sheet != 0 else source.name,
                                          "source_pcode": pcode, "rows": 0})
            entry["rows"] += 1
            if pcode and not entry["source_pcode"]:
                entry["source_pcode"] = pcode
    result = sorted(rows.values(), key=lambda r: (r["source_dataset"], r["source_detail"], r["state_hint"], r["input_name"]))
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    with POOL_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(result[0]))
        writer.writeheader()
        writer.writerows(result)
    print(f"pool: {len(result)} distinct names -> {POOL_PATH.relative_to(config.ROOT)}")
    return result


def load_cases(path=CASES_PATH) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


# How many cases to draw from each part of the pool. Chosen once to build the first test set;
# rerunning `select` makes a fresh draft and does not keep labels, so edit match_cases.csv instead.
QUOTAS = [
    # (dataset prefix, source column suffix, level, kind, count)
    ("sudan-people-reached-by-locality", "LOCALITY", 2, "messy", 70),
    ("sudan-subnational-boundaries", "ADM2_NAME", 2, "messy", 55),
    ("sudan-monthly-refugee", "Locality", 2, "messy", 52),
    ("sudan-schools", "locality_name", 2, "messy", 35),
    ("sudan-acute-food-insecurity", "Area", 2, "messy", 10),
    ("sudan-who-does-what-where", "Locality", 2, "messy", 3),
    ("sudan-people-affected-by-floods", "Locality", 2, "messy", 2),
    ("sudan-2022-hrp", "LOCALITY", 2, "messy", 2),
    ("sudan-schools", "LOCENG", 2, "messy", 1),
    ("", "", 1, "messy", 20),
    ("sudan-displacement-situation", "", 2, "exact", 8),
    ("sudan-schools", "locality_name", 2, "exact", 8),
    ("sudan-acute-food-insecurity", "Level 1", 1, "exact", 4),
    ("sudan-monthly-refugee", "Site", 2, "negative", 22),
    ("sudan-people-affected-by-floods", "Village Name", 2, "negative", 22),
]
SEED = 2026


def select() -> list[dict]:
    """Draw a draft test set from the pool by QUOTAS, with the dataset's P-code as the proposal when valid."""
    import random

    from sudan_atlas.normalise import Normaliser
    from .places import PLACES_PATH

    places = {p["pcode"]: p for p in json.loads(PLACES_PATH.read_text())["places"]}
    norm = Normaliser(json.loads((config.ROOT / "data" / "gazetteer" / "normalisation.json").read_text()))
    official = {norm.key(n) for p in places.values() for n in (p["name_en"], p["name_ar"])}
    variants = json.loads((config.ROOT / "data" / "gazetteer" / "variants.json").read_text())["variants"]
    known = official | {norm.key(v["text"]) for v in variants}
    with POOL_PATH.open(encoding="utf-8") as handle:
        pool_rows = list(csv.DictReader(handle))

    rng = random.Random(SEED)
    chosen, seen = [], set()
    for prefix, column, level, kind, count in QUOTAS:
        def fits(r):
            key = norm.key(r["input_name"])
            if not r["source_dataset"].startswith(prefix) or not r["source_detail"].endswith(column) or int(r["level"]) != level:
                return False
            if kind == "exact":
                return key in official
            if kind == "messy":
                return key not in official
            return key not in known  # negatives: not an official name or known variant
        candidates = sorted((r for r in pool_rows if fits(r)), key=lambda r: (r["source_dataset"], r["input_name"], r["state_hint"]))
        rng.shuffle(candidates)
        taken = 0
        for r in candidates:
            identity = (norm.key(r["input_name"]), norm.key(r["state_hint"]), r["level"])
            if identity in seen:
                continue
            seen.add(identity)
            pcode = r["source_pcode"] if r["source_pcode"] in places else ""
            chosen.append({**{c: "" for c in CASE_COLUMNS}, **{k: r[k] for k in ("input_name", "state_hint", "level",
                          "source_dataset", "source_detail", "source_pcode")},
                          "expected_pcode": pcode, "verified_by": "agent",
                          "notes": "proposed from the dataset's own P-code" if pcode else ("negative: " if kind == "negative" else "")})
            taken += 1
            if taken == count:
                break
    for i, case in enumerate(chosen, 1):
        case["id"] = f"c{i:03d}"
    return chosen


def write_cases(cases: list[dict], path=CASES_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CASE_COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(cases)
