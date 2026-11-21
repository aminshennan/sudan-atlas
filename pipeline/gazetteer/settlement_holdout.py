"""Independent test of village, town and camp matching (docs/SETTLEMENT_HOLDOUT.md).

`cases` builds data/tests/settlement_holdout_cases.csv from datasets that list villages with their
state and locality, keeping only rows whose locality is written as an official name, so every answer
comes from the dataset without judgement. `run` measures the frozen matcher once and writes the results
below the protocol in docs/SETTLEMENT_HOLDOUT.md.
"""

import csv
import json
import random
from collections import Counter, defaultdict

import pandas as pd
from sudan_atlas import Matcher
from sudan_atlas.normalise import Normaliser

from .. import config
from .holdout import _wilson
from .testcases import load_cases

CASES_PATH = config.ROOT / "data" / "tests" / "settlement_holdout_cases.csv"
STATS_PATH = config.ROOT / "data" / "tests" / "settlement_holdout_sources.json"
REPORT_PATH = config.ROOT / "docs" / "SETTLEMENT_HOLDOUT.md"
RAW = config.RAW_DIR / "settlement-test-sources"
FLOODS = config.RAW_DIR / "test-sources" / "sudan-people-affected-by-floods" / "sudan-floods-data-2021-to-2023_hxl.xlsx"
FFE_DATASET = "food-for-education-ffe-supported-schools-sudan"
SAMPLE = 400
SEED = 20261121
COLUMNS = ["id", "input_name", "state_hint", "expected_pcode", "source_dataset", "source_detail"]


def fetch() -> dict:
    """Download the Food for Education schools list (the floods file comes with fetch-test-sources)."""
    from ..fetch import _get, _now, _save

    meta = json.loads(_get(f"{config.HDX_API}?id={FFE_DATASET}"))["result"]
    resource = next(r for r in meta["resources"] if (r.get("format") or "").upper() in ("XLS", "XLSX"))
    name = resource["url"].rsplit("/", 1)[-1].split("?", 1)[0]
    files = [_save(resource["url"], RAW / FFE_DATASET / name)]
    manifest = {"source": meta["title"], "dataset_url": f"https://data.humdata.org/dataset/{FFE_DATASET}",
                "licence": meta.get("license_title"), "downloaded_at": _now(), "files": files}
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def _official(norm: Normaliser, places: list[dict]):
    """Look up a state, and a locality within a state, by an official English or Arabic name only."""
    states = {norm.key(n): p["pcode"] for p in places if p["level"] == 1 for n in (p["name_en"], p["name_ar"])}
    localities = {(p["parent_pcode"], norm.key(n)): p["pcode"]
                  for p in places if p["level"] == 2 for n in (p["name_en"], p["name_ar"])}
    return (lambda s: states.get(norm.key(str(s)))), (lambda st, loc: localities.get((st, norm.key(str(loc)))))


def _rows() -> list[dict]:
    rows = []
    sheets = pd.read_excel(FLOODS, sheet_name=None)
    for sheet, frame in sheets.items():
        frame = frame[~frame.iloc[:, 0].astype(str).str.startswith("#")]
        for r in frame.itertuples(index=False):
            d = dict(zip(frame.columns, r))
            rows.append({"village": d.get("Village Name"), "state": d.get("State"), "locality": d.get("Locality"),
                         "dataset": "sudan-people-affected-by-floods", "detail": f"{sheet}!Village Name"})
    ffe = next((RAW / FFE_DATASET).glob("*.xls*"), None)
    if ffe is not None:
        frame = pd.read_excel(ffe)
        frame.columns = [" ".join(str(c).split()) for c in frame.columns]
        for r in frame.itertuples(index=False):
            d = dict(zip(frame.columns, r))
            rows.append({"village": d.get("Location"), "state": d.get("State"), "locality": d.get("Locality"),
                         "dataset": FFE_DATASET, "detail": "Location"})
    return rows


def cases() -> dict:
    gazetteer_dir = config.ROOT / "data" / "gazetteer"
    norm = Normaliser(json.loads((gazetteer_dir / "normalisation.json").read_text(encoding="utf-8")))
    places = json.loads((gazetteer_dir / "places.json").read_text(encoding="utf-8"))["places"]
    state_of, locality_of = _official(norm, places)
    first_test = {norm.key(c["input_name"]) for c in load_cases() if c["source_dataset"] == "sudan-people-affected-by-floods"}
    seen, kept, skipped = set(), [], Counter()
    for r in _rows():
        village = " ".join(str(r["village"]).split()) if isinstance(r["village"], str) else ""
        if not village or village.lower() in ("nan", "total"):
            skipped["no village name"] += 1
            continue
        state = state_of(r["state"])
        locality = locality_of(state, r["locality"]) if state else None
        if not locality:
            skipped["locality not written as an official name"] += 1
            continue
        key = norm.key(village)
        if key in first_test:
            skipped["in the first matcher test"] += 1
            continue
        identity = (key, locality)
        if identity in seen:
            continue
        seen.add(identity)
        kept.append({"input_name": village, "state_hint": str(r["state"]).strip(), "expected_pcode": locality,
                     "source_dataset": r["dataset"], "source_detail": r["detail"]})
    pool = len(kept)
    rng = random.Random(SEED)
    sample = sorted(rng.sample(kept, SAMPLE), key=lambda c: (c["source_dataset"], c["expected_pcode"], c["input_name"])) if pool > SAMPLE else kept
    with open(CASES_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows({"id": f"v{i:03d}", **c} for i, c in enumerate(sample, 1))
    stats = {"pool": pool, "sample": len(sample), "skipped": dict(skipped),
             "by_source": dict(Counter(c["source_dataset"] for c in sample))}
    STATS_PATH.write_text(json.dumps(stats, indent=1) + "\n", encoding="utf-8")
    print(f"settlement holdout: {pool} distinct villages with an official locality; drew {len(sample)}; skipped {dict(skipped)}")
    return stats


def _outcome(result: dict, expected: str) -> str:
    if result["pcode"] == expected:
        return "right locality"
    if result["pcode"]:
        return "wrong locality"
    return "asked" if result["method"] == "ambiguous" else "not found"


OUTCOMES = ["right locality", "wrong locality", "asked", "not found"]


def run() -> dict:
    rows = list(csv.DictReader(open(CASES_PATH, encoding="utf-8")))
    matcher = Matcher()
    places = {p["pcode"]: p for p in json.loads((config.ROOT / "data" / "gazetteer" / "places.json").read_text())["places"]}
    settings = {
        "Villages on, state as a hint": lambda r: matcher.match(r["input_name"], state_hint=r["state_hint"], level=2, settlements=True),
        "Villages on, no state hint": lambda r: matcher.match(r["input_name"], level=2, settlements=True),
        "Villages off (as before), state as a hint": lambda r: matcher.match(r["input_name"], state_hint=r["state_hint"], level=2),
    }
    results = {name: [f(r) for r in rows] for name, f in settings.items()}
    n = len(rows)

    def cell(k: int) -> str:
        lo, hi = _wilson(k, n)
        return f"{k / n:.1%} ({lo * 100:.0f}–{hi * 100:.0f} %), {k}"

    stats = json.loads(STATS_PATH.read_text(encoding="utf-8"))
    skipped = "; ".join(f"{v} {k}" for k, v in stats["skipped"].items())
    sources = ", ".join(f"{v} from {k}" for k, v in stats["by_source"].items())
    lines = ["## Results", "", f"Measured on 2026-11-21 on **{n}** village names ({sources}). "
             f"Rows left out under the protocol: {skipped}. There were {stats['pool']} usable villages, "
             f"so {'all were used' if stats['pool'] <= SAMPLE else f'{SAMPLE} were drawn'}.", "",
             "| Setting | " + " | ".join(o.capitalize() for o in OUTCOMES) + " |", "| --- |" + " --- |" * len(OUTCOMES)]
    counts = {}
    for name, res in results.items():
        c = Counter(_outcome(x, r["expected_pcode"]) for x, r in zip(res, rows))
        counts[name] = c
        lines.append(f"| {name} | " + " | ".join(cell(c[o]) for o in OUTCOMES) + " |")
    lines += ["", "Each cell: share of the village names, its 95 % confidence interval (Wilson), and the count.", ""]

    main = results["Villages on, state as a hint"]
    lines += ["### How the matcher answered (villages on, state as a hint)", "", "| Answered by | Names | Right locality | Wrong locality |", "| --- | --- | --- | --- |"]
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

    wrong = [(r, x) for x, r in zip(main, rows) if _outcome(x, r["expected_pcode"]) == "wrong locality"]
    lines += ["### Every wrong locality (villages on, state as a hint)", ""]
    if wrong:
        lines += ["| Case | Village | State | Dataset's locality | Matcher's locality | Answered by | Settlement found |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for r, x in wrong:
            s = x.get("settlement") or {}
            found = f"{s.get('name')} ({s.get('id')}, {s.get('kind')})" if s else "none"
            lines.append(f"| {r['id']} | {r['input_name']} | {r['state_hint']} | {r['expected_pcode']} {places[r['expected_pcode']]['name_en']} | "
                         f"{x['pcode']} {places[x['pcode']]['name_en']} | {x['method']} | {found} |")
    else:
        lines.append("None.")
    lines.append("")

    report = REPORT_PATH.read_text(encoding="utf-8")
    REPORT_PATH.write_text(report.split("## Results", 1)[0] + "\n".join(lines), encoding="utf-8")
    summary = {k: dict(v) for k, v in counts.items()}
    print(f"settlement holdout: {n} names; {summary}")
    return summary
