"""Second independent test of village, town and camp matching (docs/SETTLEMENT_HOLDOUT_2.md).

The answers come from coordinates: each test dataset gives a point for every village, and the answer
is the locality that point falls in on the COD-AB boundaries, so no one has to judge any name.
`fetch` downloads the three datasets, `cases` builds data/tests/settlement_holdout2_cases.csv, and
`run` measures the frozen matcher once and writes the results below the protocol.
"""

import csv
import importlib
import json
import random
from collections import Counter, defaultdict

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from sudan_atlas import Matcher
from sudan_atlas.normalise import Normaliser

from .. import config
from .holdout import _wilson
from .settlement_holdout import OUTCOMES, _outcome
from .testcases import load_cases

CASES_PATH = config.ROOT / "data" / "tests" / "settlement_holdout2_cases.csv"
STATS_PATH = config.ROOT / "data" / "tests" / "settlement_holdout2_sources.json"
REPORT_PATH = config.ROOT / "docs" / "SETTLEMENT_HOLDOUT_2.md"
RAW = config.RAW_DIR / "settlement-test-2"
DATASETS = {  # HDX dataset -> file format to download
    "wfp-nitrition-sites-sudan": "XLSX",
    "wfp-safe-initiative-assisted-villages": "XLS",
    "darfur-damaged-and-destroyed-villages": "CSV",
}
DARFUR_SAMPLE = 300  # the Darfur villages list is much larger than the other two: draw this many from it
SEED = 20261122
COLUMNS = ["id", "input_name", "state_hint", "expected_pcode", "source_dataset", "source_detail"]
EARLIER_TESTS = ["match_cases.csv", "holdout_cases.csv", "settlement_holdout_cases.csv"]


def fetch() -> dict:
    from ..fetch import _get, _now, _save

    manifest = {"downloaded_at": _now(), "datasets": {}}
    for dataset, fmt in DATASETS.items():
        meta = json.loads(_get(f"{config.HDX_API}?id={dataset}"))["result"]
        resource = next(r for r in meta["resources"] if (r.get("format") or "").upper() == fmt)
        name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
        manifest["datasets"][dataset] = {
            "title": meta["title"], "dataset_url": f"https://data.humdata.org/dataset/{dataset}",
            "licence": meta.get("license_title"), "files": [_save(resource["url"], RAW / dataset / name)]}
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def _rows() -> list[dict]:
    """Every named point in the three datasets: name, the dataset's state (if it has one), lon, lat."""
    rows = []
    frame = pd.read_excel(next((RAW / "wfp-nitrition-sites-sudan").glob("*.xlsx")))
    for r in frame.itertuples(index=False):
        d = dict(zip(frame.columns, r))
        rows.append({"name": d["Site"], "state": d["State"], "lon": d["X Coordinate"], "lat": d["Y Coordinate"],
                     "dataset": "wfp-nitrition-sites-sudan", "detail": "Site"})
    frame = pd.read_excel(next((RAW / "wfp-safe-initiative-assisted-villages").glob("*.xls")))
    for r in frame.itertuples(index=False):
        d = dict(zip(frame.columns, r))
        # The dataset has no state column; every locality it lists is in North Darfur.
        rows.append({"name": d["SAFE  Village"], "state": "North Darfur", "lon": d["X"], "lat": d["Y"],
                     "dataset": "wfp-safe-initiative-assisted-villages", "detail": "SAFE Village"})
    frame = pd.read_csv(next((RAW / "darfur-damaged-and-destroyed-villages").glob("*.csv")), encoding="latin-1")
    for r in frame.itertuples(index=False):
        d = dict(zip(frame.columns, r))
        # No state column either: the state its point falls in stands in for one (see the protocol).
        rows.append({"name": d["NAME"], "state": None, "lon": d["LONG_DD"], "lat": d["LAT_DD"],
                     "dataset": "darfur-damaged-and-destroyed-villages", "detail": "NAME"})
    return rows


def cases() -> dict:
    gazetteer_dir = config.ROOT / "data" / "gazetteer"
    norm = Normaliser(json.loads((gazetteer_dir / "normalisation.json").read_text(encoding="utf-8")))
    places = {p["pcode"]: p for p in json.loads((gazetteer_dir / "places.json").read_text(encoding="utf-8"))["places"]}
    earlier = {norm.key(c["input_name"]) for f in EARLIER_TESTS for c in load_cases(config.ROOT / "data" / "tests" / f)}
    skipped = Counter()
    rows = []
    for r in _rows():
        name = " ".join(str(r["name"]).split()) if isinstance(r["name"], str) else ""
        if not name or not norm.key(name):
            skipped["no name"] += 1
        elif pd.isna(r["lon"]) or pd.isna(r["lat"]):
            skipped["no coordinates"] += 1
        else:
            rows.append({**r, "name": name, "lon": float(r["lon"]), "lat": float(r["lat"])})
    localities = gpd.read_file(config.BOUNDARIES_DIR / "detailed" / "adm2.geojson")[["pcode", "parent_pcode", "geometry"]]
    points = gpd.GeoDataFrame(rows, geometry=[Point(r["lon"], r["lat"]) for r in rows], crs=4326)
    joined = gpd.sjoin(points, localities, how="left", predicate="within")
    joined = joined[~joined.index.duplicated(keep="first")]
    by_source: dict[str, list[dict]] = defaultdict(list)
    seen = set()
    for r, pcode, state in zip(rows, joined["pcode"], joined["parent_pcode"]):
        if not isinstance(pcode, str):
            skipped["point outside Sudan's localities"] += 1
            continue
        key = norm.key(r["name"])
        if key in earlier:
            skipped["name in an earlier test"] += 1
            continue
        if (r["dataset"], key, pcode) in seen:
            skipped["repeat of a name in the same locality"] += 1
            continue
        seen.add((r["dataset"], key, pcode))
        by_source[r["dataset"]].append({
            "input_name": r["name"], "state_hint": str(r["state"]).strip() if r["state"] else places[state]["name_en"],
            "expected_pcode": pcode, "source_dataset": r["dataset"], "source_detail": r["detail"]})
    pool = {k: len(v) for k, v in by_source.items()}
    rng = random.Random(SEED)
    darfur = by_source["darfur-damaged-and-destroyed-villages"]
    if len(darfur) > DARFUR_SAMPLE:
        by_source["darfur-damaged-and-destroyed-villages"] = rng.sample(darfur, DARFUR_SAMPLE)
    sample = sorted((c for v in by_source.values() for c in v),
                    key=lambda c: (c["source_dataset"], c["expected_pcode"], c["input_name"]))
    with open(CASES_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows({"id": f"w{i:03d}", **c} for i, c in enumerate(sample, 1))
    stats = {"pool": pool, "sample": len(sample), "skipped": dict(skipped),
             "by_source": dict(Counter(c["source_dataset"] for c in sample))}
    STATS_PATH.write_text(json.dumps(stats, indent=1) + "\n", encoding="utf-8")
    print(f"settlement holdout 2: pool {pool}; {len(sample)} cases; skipped {dict(skipped)}")
    return stats


def run() -> dict:
    with open(CASES_PATH, encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    places = {p["pcode"]: p for p in json.loads((config.ROOT / "data" / "gazetteer" / "places.json").read_text())["places"]}
    match_module = importlib.import_module("sudan_atlas.match")
    matcher = Matcher()

    def with_hint(r):
        return matcher.match(r["input_name"], state_hint=r["state_hint"], level=2, settlements=True)

    def exact_villages_only(r):
        saved = match_module.VILLAGE_THRESHOLD
        match_module.VILLAGE_THRESHOLD = float("inf")  # turns the close-spelling step off
        try:
            return with_hint(r)
        finally:
            match_module.VILLAGE_THRESHOLD = saved

    settings = {
        "Villages on, state as a hint": with_hint,
        "Villages on, no state hint": lambda r: matcher.match(r["input_name"], level=2, settlements=True),
        "Exact village names only, state as a hint": exact_villages_only,
        "Villages off, state as a hint": lambda r: matcher.match(r["input_name"], state_hint=r["state_hint"], level=2),
    }
    results = {name: [f(r) for r in rows] for name, f in settings.items()}
    n = len(rows)

    def cell(k: int) -> str:
        lo, hi = _wilson(k, n)
        return f"{k / n:.1%} ({lo * 100:.0f}–{hi * 100:.0f} %), {k}"

    stats = json.loads(STATS_PATH.read_text(encoding="utf-8"))
    skipped = "; ".join(f"{v} {k}" for k, v in stats["skipped"].items())
    sources = ", ".join(f"{v} from {k}" for k, v in stats["by_source"].items())
    lines = ["## Results", "", f"Measured once on **{n}** village and site names ({sources}). "
             f"Rows left out under the protocol: {skipped}.", "",
             "| Setting | " + " | ".join(o.capitalize() for o in OUTCOMES) + " |", "| --- |" + " --- |" * len(OUTCOMES)]
    counts = {}
    for name, res in results.items():
        c = Counter(_outcome(x, r["expected_pcode"]) for x, r in zip(res, rows))
        counts[name] = c
        lines.append(f"| {name} | " + " | ".join(cell(c[o]) for o in OUTCOMES) + " |")
    lines += ["", "Each cell: share of the names, its 95 % confidence interval (Wilson), and the count.", ""]

    main, exact = results["Villages on, state as a hint"], results["Exact village names only, state as a hint"]
    changed = [(r, x) for x, e, r in zip(main, exact, rows) if x != e]
    close_answers = Counter(_outcome(x, r["expected_pcode"]) for r, x in changed)
    right, wrong = close_answers["right locality"], close_answers["wrong locality"]
    kept = right >= 3 * wrong
    lines += ["### The close-spelling step", "",
              f"It changed the answer for {len(changed)} names: {right} right localities, {wrong} wrong, "
              f"{close_answers['asked']} asked about. The rule set in advance keeps the step only if it gives at "
              f"least three right localities for each wrong one: **{'kept' if kept else 'not kept'}**.", ""]

    lines += ["### How the matcher answered (villages on, state as a hint)", "",
              "| Answered by | Names | Right locality | Wrong locality |", "| --- | --- | --- | --- |"]
    by_method = defaultdict(Counter)
    for x, r in zip(main, rows):
        by_method[x["method"]][_outcome(x, r["expected_pcode"])] += 1
    for method, c in sorted(by_method.items(), key=lambda kv: -sum(kv[1].values())):
        lines.append(f"| {method} | {sum(c.values())} | {c['right locality']} | {c['wrong locality']} |")
    lines.append("")

    lines += ["### By source (villages on, state as a hint)", "", "| Source | Names | " + " | ".join(o.capitalize() for o in OUTCOMES) + " |",
              "| --- | --- |" + " --- |" * len(OUTCOMES)]
    by_source = defaultdict(Counter)
    for x, r in zip(main, rows):
        by_source[r["source_dataset"]][_outcome(x, r["expected_pcode"])] += 1
    for src, c in by_source.items():
        lines.append(f"| {src} | {sum(c.values())} | " + " | ".join(str(c[o]) for o in OUTCOMES) + " |")
    lines.append("")

    wrong_rows = [(r, x) for x, r in zip(main, rows) if _outcome(x, r["expected_pcode"]) == "wrong locality"]
    lines += ["### Every wrong locality (villages on, state as a hint)", ""]
    if wrong_rows:
        lines += ["| Case | Name | State | Locality of its point | Matcher's locality | Answered by | Score | Settlement found |",
                  "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for r, x in wrong_rows:
            s = x.get("settlement") or {}
            found = f"{s.get('name')} ({s.get('id')}, {s.get('kind')})" if s else "none"
            lines.append(f"| {r['id']} | {r['input_name']} | {r['state_hint']} | {r['expected_pcode']} {places[r['expected_pcode']]['name_en']} | "
                         f"{x['pcode']} {places[x['pcode']]['name_en']} | {x['method']} | {x['score']} | {found} |")
    else:
        lines.append("None.")
    lines.append("")

    report = REPORT_PATH.read_text(encoding="utf-8")
    REPORT_PATH.write_text(report.split("## Results", 1)[0] + "\n".join(lines), encoding="utf-8")
    summary = {k: dict(v) for k, v in counts.items()} | {"close step": dict(close_answers), "kept": kept}
    print(f"settlement holdout 2: {n} names; {summary}")
    return summary
