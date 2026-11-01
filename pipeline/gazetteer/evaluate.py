"""Measure the matcher on data/tests/match_cases.csv and write docs/MATCHER_EVALUATION.md.

For each fuzzy scorer, with and without the state hints, and across a range of thresholds:
- top-1 accuracy: share of cases that should match where the matcher returns the right P-code;
- top-3 recall: share of those where the right P-code is among the three best candidates;
- false-match rate: share of all cases where the matcher returns a P-code that is wrong
  (a wrong place, or any place for a case that should match nothing).
Cases marked UNSURE are left out until a person has checked them.
"""

import json
from collections import Counter

from sudan_atlas.gazetteer import Gazetteer
from sudan_atlas.match import DEFAULT_MARGIN, DEFAULT_THRESHOLD, SCORERS, Matcher

from .. import config
from .testcases import CASES_PATH, load_cases

MAX_FALSE_MATCH_RATE = 0.01
THRESHOLDS = [0.70, 0.75, 0.78, 0.80, 0.82, 0.85, 0.88, 0.90, 0.92, 0.95]
# Agreed accuracy targets (Phase 2 checkpoint, 2026-11-01), at the default setting with state hints.
TARGETS = {"top1_accuracy": 0.91, "top3_recall": 0.98, "false_match_rate": 0.01}
REPORT_PATH = config.ROOT / "docs" / "MATCHER_EVALUATION.md"
RESULTS_PATH = config.REPORTS_DIR / "match_evaluation.json"


def _usable(case: dict) -> bool:
    return not case["notes"].startswith("UNSURE")


def score(cases: list[dict], ranked: list[list], matcher: Matcher, threshold: float) -> dict:
    matcher.threshold = threshold
    positives = [i for i, c in enumerate(cases) if c["expected_pcode"]]
    results = [matcher.decide(r) for r in ranked]
    correct = sum(1 for i in positives if results[i]["pcode"] == cases[i]["expected_pcode"])
    top3 = sum(1 for i in positives if cases[i]["expected_pcode"] in [p for p, _, _ in ranked[i][:3]])
    false = [i for i, r in enumerate(results) if r["pcode"] and r["pcode"] != cases[i]["expected_pcode"]]
    abstained = sum(1 for i in positives if not results[i]["pcode"])
    return {
        "threshold": threshold,
        "cases": len(cases),
        "should_match": len(positives),
        "top1_accuracy": correct / len(positives),
        "top3_recall": top3 / len(positives),
        "false_match_rate": len(false) / len(cases),
        "false_matches": len(false),
        "no_answer_on_matchable": abstained,
        "results": results,
    }


def run() -> dict:
    cases = [c for c in load_cases() if _usable(c)]
    gazetteer = Gazetteer.load()
    grid = {}
    ranked_by = {}
    for scorer in SCORERS:
        matcher = Matcher(gazetteer, scorer=scorer)
        for hints in (True, False):
            ranked = [matcher.rank(c["input_name"], c["state_hint"] if hints else None, int(c["level"])) for c in cases]
            ranked_by[(scorer, hints)] = ranked
            grid[(scorer, hints)] = [score(cases, ranked, matcher, t) for t in THRESHOLDS]

    # Report the default setting: the combined scorer at the agreed threshold, with state hints.
    best_scorer = "combined"
    best = next(r for r in grid[(best_scorer, True)] if r["threshold"] == DEFAULT_THRESHOLD)
    _write_report(cases, grid, best_scorer, best, ranked_by[(best_scorer, True)])
    summary = {f"{s}/{'hints' if h else 'no-hints'}": [{k: v for k, v in r.items() if k != "results"} for r in rows]
               for (s, h), rows in grid.items()}
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps({"default": {"scorer": best_scorer, "threshold": best["threshold"]},
                                        "grid": summary}, indent=1))
    print(f"evaluated {len(cases)} cases; default setting: {best_scorer} at {best['threshold']:.2f} -> "
          f"top-1 {best['top1_accuracy']:.1%}, top-3 {best['top3_recall']:.1%}, false matches {best['false_match_rate']:.1%}")
    return best


def _pct(x: float) -> str:
    return f"{x:.1%}"


def _failure_kind(case: dict, result: dict) -> str:
    expected, got = case["expected_pcode"], result["pcode"]
    if not expected:
        return "false match (should match nothing)"
    if not got:
        return "ambiguous (no answer)" if result["method"] == "ambiguous" else "no answer"
    return "wrong place"


def _cause(case: dict, result: dict, ranked: list, places: dict, threshold: float) -> str:
    """Why a case failed, from where the right place ranked and how it scored."""
    expected = case["expected_pcode"]
    if not expected:
        return f"resembles {places[result['pcode']]['name_en']} closely enough to pass the threshold; it is not that place"
    position = next((i for i, (p, _, _) in enumerate(ranked) if p == expected), None)
    if position is None:
        return "the right place is not among the candidates: the name (often a town) is not in the gazetteer"
    score = ranked[position][1]
    if position == 0:
        if score < threshold:
            return f"right place ranked first, but its score {score:.2f} is below the threshold"
        runner = ranked[1]
        return f"right place ranked first, but {places[runner[0]]['name_en']} scores too close ({runner[1]:.2f}) to call"
    top = ranked[0]
    if top[1] == score:
        return f"right place ties with {places[top[0]]['name_en']} ({score:.2f}), so the matcher does not choose"
    return f"{places[top[0]]['name_en']} scores higher ({top[1]:.2f}) than the right place ({score:.2f})"


def _write_report(cases, grid, scorer, best, ranked) -> None:
    places = Gazetteer.load().places
    name = lambda p: f"{p} {places[p]['name_en']}" if p else "—"
    lines = [
        "# Matcher evaluation",
        "",
        "> Generated by `make evaluate` from `data/tests/match_cases.csv`. Do not edit by hand.",
        "",
        f"Test cases used: **{len(cases)}** (cases marked UNSURE are left out until checked). "
        f"Cases that should match a place: **{best['should_match']}**. Cases that should match nothing: "
        f"**{len(cases) - best['should_match']}**.",
        "",
        "Labels were proposed by Claude, checked by an independent AI agent, and verified by Amin (`verified_by = amin`).",
        "",
        "## Default setting",
        "",
        f"Scorer **{scorer}**, threshold **{best['threshold']:.2f}** (agreed with Amin on 2026-11-01), margin {DEFAULT_MARGIN:.2f}, with state hints.",
        "",
        "| Measure | Result | Agreed target |",
        "| --- | --- | --- |",
        f"| Top-1 accuracy | {_pct(best['top1_accuracy'])} | at least {_pct(TARGETS['top1_accuracy'])} |",
        f"| Top-3 recall | {_pct(best['top3_recall'])} | at least {_pct(TARGETS['top3_recall'])} |",
        f"| False-match rate | {_pct(best['false_match_rate'])} ({best['false_matches']} of {best['cases']}) | at most {_pct(TARGETS['false_match_rate'])} |",
        f"| Matchable cases left without an answer | {best['no_answer_on_matchable']} | — |",
        "",
        "## Every setting",
        "",
        "Top-1 accuracy / false-match rate. Top-3 recall does not depend on the threshold.",
        "",
    ]
    for hints in (True, False):
        lines += [f"**{'With' if hints else 'Without'} state hints**", "",
                  "| Threshold | " + " | ".join(SCORERS) + " |", "| --- | " + " | ".join("---" for _ in SCORERS) + " |"]
        for i, t in enumerate(THRESHOLDS):
            cells = [f"{_pct(grid[(s, hints)][i]['top1_accuracy'])} / {_pct(grid[(s, hints)][i]['false_match_rate'])}" for s in SCORERS]
            lines.append(f"| {t:.2f} | " + " | ".join(cells) + " |")
        lines.append("| Top-3 recall | " + " | ".join(_pct(grid[(s, hints)][0]["top3_recall"]) for s in SCORERS) + " |")
        lines.append("")
    failures = [(c, r, rk) for c, r, rk in zip(cases, best["results"], ranked) if r["pcode"] != (c["expected_pcode"] or None)]
    counts = Counter(_failure_kind(c, r) for c, r, _ in failures)
    lines += ["## Every failure at the default setting", "",
              ", ".join(f"{k}: {v}" for k, v in counts.most_common()) or "None.", "",
              "| Case | Input | State hint | Expected | Got | Cause | Best candidates |",
              "| --- | --- | --- | --- | --- | --- | --- |"]
    for c, r, rk in failures:
        got = name(r["pcode"]) if r["pcode"] else r["method"]
        cands = "; ".join(f"{places[p]['name_en']} {s:.2f}" for p, s, _ in rk[:3])
        cause = _cause(c, r, rk, places, best["threshold"])
        lines.append(f"| {c['id']} | {c['input_name']} | {c['state_hint'] or '—'} | {name(c['expected_pcode'])} | {got} | {cause} | {cands} |")
    REPORT_PATH.write_text("\n".join(lines) + "\n")
