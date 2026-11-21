"""Measure the frozen matcher once on the independent test set and write the results into
docs/MATCHER_HOLDOUT.md (below "## Results"; the protocol above it is left as written).

The cases are in data/tests/holdout_cases.csv, and the sources and answer statistics in
data/tests/holdout_sources.json. Nothing here changes the matcher: the threshold, margin and
scorer are the defaults the protocol froze.
"""

import json
from collections import Counter, defaultdict

from sudan_atlas.gazetteer import Gazetteer
from sudan_atlas.match import DEFAULT_THRESHOLD, Matcher

from .. import config
from .evaluate import _cause, _failure_kind, _pct, score
from .testcases import load_cases

CASES_PATH = config.ROOT / "data" / "tests" / "holdout_cases.csv"
SOURCES_PATH = config.ROOT / "data" / "tests" / "holdout_sources.json"
REPORT_PATH = config.ROOT / "docs" / "MATCHER_HOLDOUT.md"
FIRST_TEST = {"top1_accuracy": 0.949, "top3_recall": 0.996, "false_match_rate": 0.0,
              "no_hint_top1": 0.850, "no_hint_false": 0.023}
KIND_LABEL = {"official": "official spelling", "other": "other spelling", "none": "should match nothing"}


# Sampling (see the protocol): mostly names that are not an official spelling, as in the first test.
SEED = 20261121
PER_DATASET = 60
SITES_PER_DATASET = 15
TARGET = {"other": 230, "official": 25, "site": 45}
CASE_COLUMNS = ["id", "input_name", "state_hint", "level", "expected_pcode", "source_dataset", "source_detail",
                "source_pcode", "answer_from", "kind", "notes"]


def select(pool_paths: list, out_path) -> tuple[list[dict], dict]:
    """Draw the test names from the collected pools (one row per distinct dataset, column, name and state).

    Names already in the first test set are left out. Official spellings are told apart with the matcher's
    normalising rules only; no matching is done here. Writes the drawn names without answers."""
    import csv
    import random

    from sudan_atlas.normalise import Normaliser

    norm = Normaliser(json.loads((config.ROOT / "data" / "gazetteer" / "normalisation.json").read_text()))
    places = json.loads((config.ROOT / "data" / "gazetteer" / "places.json").read_text())["places"]
    official = {norm.key(n) for p in places for n in (p["name_en"], p["name_ar"])}
    first_test = {norm.key(c["input_name"]) for c in load_cases()}
    pool, seen = [], set()
    for path in pool_paths:
        with open(path, newline="", encoding="utf-8") as handle:
            for r in csv.DictReader(handle):
                key = norm.key(r["input_name"])
                identity = (key, norm.key(r["state_hint"]), r["column_kind"])
                if not key or key in first_test or identity in seen:
                    continue
                seen.add(identity)
                stratum = "site" if r["column_kind"] == "site" else ("official" if key in official else "other")
                pool.append({**r, "stratum": stratum})
    admin = [r for r in pool if r["stratum"] != "site"]
    stats = {"distinct_names": len(admin), "official_share": sum(r["stratum"] == "official" for r in admin) / max(1, len(admin))}

    rng = random.Random(SEED)
    rng.shuffle(pool)
    taken, per = [], Counter()
    for stratum, want in TARGET.items():
        got = 0
        for r in sorted((r for r in pool if r["stratum"] == stratum), key=lambda r: per[r["dataset"]]):
            if got == want:
                break
            if per[r["dataset"]] >= PER_DATASET or r in taken:
                continue
            if stratum == "site" and sum(t["dataset"] == r["dataset"] and t["stratum"] == "site" for t in taken) >= SITES_PER_DATASET:
                continue
            taken.append(r)
            per[r["dataset"]] += 1
            got += 1
    rows = []
    for i, r in enumerate(taken, 1):
        rows.append({"id": f"h{i:03d}", "input_name": r["input_name"], "state_hint": r["state_hint"],
                     "level": "1" if r["column_kind"] == "state" else "2", "expected_pcode": "",
                     "source_dataset": r["dataset"], "source_detail": r["column"], "source_pcode": r["source_pcode"],
                     "answer_from": "", "kind": r["stratum"], "notes": ""})
    with open(out_path, "w", newline="", encoding="utf-8") as handle:
        w = csv.DictWriter(handle, fieldnames=CASE_COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"holdout: pool {len(pool)} names ({stats['distinct_names']} state or locality names, "
          f"{stats['official_share']:.1%} official spellings); drew {len(rows)}: {dict(Counter(r['kind'] for r in rows))}, "
          f"per dataset {dict(per)}")
    return rows, stats


def _usable(case: dict) -> bool:
    return not case["notes"].startswith("UNSURE")


def _measure(cases: list[dict], matcher: Matcher, hints: bool) -> tuple[dict, list]:
    ranked = [matcher.rank(c["input_name"], c["state_hint"] if hints else None, int(c["level"])) for c in cases]
    return score(cases, ranked, matcher, DEFAULT_THRESHOLD), ranked


def _wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95 % Wilson interval for k successes out of n."""
    if n == 0:
        return 0.0, 0.0
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / (1 + z * z / n)
    return max(0.0, centre - half), min(1.0, centre + half)


def _ci(share: float, n: int) -> str:
    lo, hi = _wilson(round(share * n), n)
    return f"{_pct(share)} ({lo * 100:.0f}–{hi * 100:.0f} %)"


def _row(label: str, r: dict) -> str:
    m = r["should_match"]
    return (f"| {label} | {r['cases']} | {_ci(r['top1_accuracy'], m)} | {_ci(r['top3_recall'], m)} | "
            f"{_ci(r['false_match_rate'], r['cases'])}, {r['false_matches']} of {r['cases']} | {r['no_answer_on_matchable']} |")


def _subset(cases, ranked, matcher, keep) -> dict | None:
    idx = [i for i, c in enumerate(cases) if keep(c)]
    sub = [cases[i] for i in idx]
    if not sub or not any(c["expected_pcode"] for c in sub):
        return None
    return score(sub, [ranked[i] for i in idx], matcher, DEFAULT_THRESHOLD)


def run() -> dict:
    every = load_cases(CASES_PATH)
    cases = [c for c in every if _usable(c)]
    unsure = len(every) - len(cases)
    meta = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    gazetteer = Gazetteer.load()
    matcher = Matcher(gazetteer)
    with_hints, ranked = _measure(cases, matcher, True)
    without_hints, _ = _measure(cases, matcher, False)
    places = {p["pcode"]: p for p in json.loads((config.ROOT / "data" / "gazetteer" / "places.json").read_text())["places"]}

    lines = ["## Results", ""]
    should = sum(1 for c in cases if c["expected_pcode"])
    answered = Counter(c["answer_from"] for c in cases)
    lines += [f"Measured on {meta['measured_on']}. **{len(cases)}** names from {len(meta['sources'])} datasets: "
              f"**{should}** should match a state or locality and **{len(cases) - should}** should match nothing. "
              f"{unsure} more were left out as unsure.", ""]
    lines += ["| Setting | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |",
              "| --- | --- | --- | --- | --- | --- |",
              _row("With the dataset's state as a hint", with_hints),
              _row("Without a state hint", without_hints), ""]
    lines += ["Right place first time and in the top three are shares of the names that should match; wrong matches "
              "are a share of all names (a wrong place, or any place for a name that should match nothing). The range "
              "after each figure is its 95 % confidence interval (Wilson): with this many names, the true rate on similar "
              "data is likely to lie within it.", ""]
    lines += ["**Compared with the first test** (with state hints): right first time "
              f"{_pct(with_hints['top1_accuracy'])} here against {_pct(FIRST_TEST['top1_accuracy'])}; top three "
              f"{_pct(with_hints['top3_recall'])} against {_pct(FIRST_TEST['top3_recall'])}; wrong matches "
              f"{_pct(with_hints['false_match_rate'])} against {_pct(FIRST_TEST['false_match_rate'])}. Without hints: "
              f"{_pct(without_hints['top1_accuracy'])} against {_pct(FIRST_TEST['no_hint_top1'])} right first time, "
              f"{_pct(without_hints['false_match_rate'])} against {_pct(FIRST_TEST['no_hint_false'])} wrong.", ""]

    lines += ["### By kind of name", "",
              "| Kind | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |",
              "| --- | --- | --- | --- | --- | --- |"]
    for kind in ("official", "other"):
        r = _subset(cases, ranked, matcher, lambda c, k=kind: c["kind"] == k)
        if r:
            lines.append(_row(KIND_LABEL[kind], r))
    negatives = [i for i, c in enumerate(cases) if not c["expected_pcode"]]
    wrong_neg = sum(1 for i in negatives if with_hints["results"][i]["pcode"])
    lines += ["", f"Of the {len(negatives)} names that should match nothing, {wrong_neg} were matched to a place.", ""]

    lines += ["### By dataset", "",
              "| Dataset | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |",
              "| --- | --- | --- | --- | --- | --- |"]
    for src in meta["sources"]:
        r = _subset(cases, ranked, matcher, lambda c, d=src["dataset"]: c["source_dataset"] == d)
        if r:
            lines.append(_row(src["title"], r))
    lines.append("")

    pool = meta.get("pool", {})
    if pool:
        lines += ["### How common official spellings are", "",
                  f"Across every distinct state and locality name in these datasets ({pool['distinct_names']}), "
                  f"{_pct(pool['official_share'])} are already an official spelling, which the matcher finds exactly. "
                  "The test draws mostly on the other names, as the first test did, so its figures are for the harder part "
                  "of real data.", ""]

    agree = meta.get("answers", {})
    lines += ["### How the answers were set", "",
              f"{answered.get('dataset', 0)} answers are the dataset's own P-code and {answered.get('review', 0)} come from the "
              "independent review. Every name was answered twice, independently and without seeing the matcher's answer or the "
              "dataset's P-code; a third review settled disagreements."]
    if agree:
        lines += ["", f"The two answers agreed on {agree['agreed']} of {agree['answered']} names. Where the dataset gives a "
                  f"P-code, the review agreed with it on {agree['agreed_with_dataset']} of {agree['with_dataset_pcode']}"
                  + (f"; {agree['dataset_pcode_overruled']} dataset P-codes were plainly wrong and were not used" if agree.get("dataset_pcode_overruled") else "")
                  + "."]
    lines.append("")

    lines += ["### Sources", "", "| Dataset | Publisher | File | Columns | Names in the test |", "| --- | --- | --- | --- | --- |"]
    per = Counter(c["source_dataset"] for c in cases)
    for s in meta["sources"]:
        lines.append(f"| [{s['title']}](https://data.humdata.org/dataset/{s['dataset']}) | {s['publisher']} | `{s['file_name']}` | "
                     f"{', '.join(s['columns'])} | {per.get(s['dataset'], 0)} |")
    lines.append("")

    failures = [i for i, r in enumerate(with_hints["results"]) if r["pcode"] != cases[i]["expected_pcode"]]
    kinds = Counter(_failure_kind(cases[i], with_hints["results"][i]) for i in failures)
    lines += ["### Every failure, with state hints", "",
              ", ".join(f"{k}: {v}" for k, v in kinds.most_common()) or "None.", ""]
    if failures:
        lines += ["| Case | Name | State hint | Expected | Got | Kind | Why | Best candidates |",
                  "| --- | --- | --- | --- | --- | --- | --- | --- |"]
        for i in failures:
            c, r, rk = cases[i], with_hints["results"][i], ranked[i]
            exp = f"{c['expected_pcode']} {places[c['expected_pcode']]['name_en']}" if c["expected_pcode"] else "none"
            got = f"{r['pcode']} {places[r['pcode']]['name_en']}" if r["pcode"] else "none"
            best = "; ".join(f"{places[p]['name_en']} {s:.2f}" for p, s, _ in rk[:3])
            lines.append(f"| {c['id']} | {c['input_name']} | {c['state_hint']} | {exp} | {got} | "
                         f"{_failure_kind(c, r)} | {_cause(c, r, rk, places, DEFAULT_THRESHOLD)} | {best} |")
        lines.append("")

    report = REPORT_PATH.read_text(encoding="utf-8")
    head = report.split("## Results", 1)[0]
    REPORT_PATH.write_text(head + "\n".join(lines), encoding="utf-8")
    print(f"holdout: {len(cases)} cases ({should} should match); with hints top-1 {_pct(with_hints['top1_accuracy'])}, "
          f"top-3 {_pct(with_hints['top3_recall'])}, wrong {with_hints['false_matches']}; without hints top-1 "
          f"{_pct(without_hints['top1_accuracy'])}, wrong {without_hints['false_matches']}")
    return with_hints
