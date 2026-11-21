"""Write data/tests/match_results.json: the Python matcher's full result for every test case.

The TypeScript matcher's tests compare their results with this file field by field, so
the two languages are held to identical output. Regenerate it (make golden) whenever the
matcher, the gazetteer or the test cases change; a Python test fails if it is out of date.
"""

import json

from sudan_atlas import Matcher

from .. import config
from .testcases import load_cases

GOLDEN_PATH = config.ROOT / "data" / "tests" / "match_results.json"
SETTLEMENT_GOLDEN_PATH = config.ROOT / "data" / "tests" / "settlement_results.json"
SETTLEMENT_SAMPLE_EVERY = 100  # one settlement in every hundred, in file order, so the sample is fixed


def settlement_cases() -> list[dict]:
    """Names to match with settlements=True: a fixed sample of village, town and camp names (with their
    state as a hint and without), their Arabic names, and the site names of the independent test."""
    from sudan_atlas.gazetteer import Gazetteer

    settlements = Gazetteer.load().settlements()
    cases = []
    for s in settlements[::SETTLEMENT_SAMPLE_EVERY]:
        cases.append({"input_name": s["name"], "state_hint": s["state"]})
        cases.append({"input_name": s["name"], "state_hint": ""})
    arabic = [s for s in settlements if any("\u0600" <= c <= "\u06ff" for n in s["names"] for c in n)]
    for s in arabic[::SETTLEMENT_SAMPLE_EVERY // 10]:
        name = next(n for n in s["names"] if any("\u0600" <= c <= "\u06ff" for c in n))
        cases.append({"input_name": name, "state_hint": s["state"]})
    for c in load_cases(config.ROOT / "data" / "tests" / "holdout_cases.csv"):
        if c["kind"] in ("none", "other") and c["level"] == "2":
            cases.append({"input_name": c["input_name"], "state_hint": c["state_hint"]})
    return [{"id": f"s{i:03d}", **c} for i, c in enumerate(cases, 1)]


def settlement_results() -> list[dict]:
    matcher = Matcher()
    return [{**c, "level": 2, "result": matcher.match(c["input_name"], state_hint=c["state_hint"] or None, level=2,
                                                       settlements=True)}
            for c in settlement_cases()]


def results() -> list[dict]:
    matcher = Matcher()
    return [{"id": c["id"], "input_name": c["input_name"], "state_hint": c["state_hint"], "level": int(c["level"]),
             "result": matcher.match(c["input_name"], state_hint=c["state_hint"] or None, level=int(c["level"]))}
            for c in load_cases()]


def render(rows: list[dict]) -> str:
    return "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n"


def run() -> None:
    GOLDEN_PATH.write_text(render(results()), encoding="utf-8")
    SETTLEMENT_GOLDEN_PATH.write_text(render(settlement_results()), encoding="utf-8")
    print(f"golden: {GOLDEN_PATH.relative_to(config.ROOT)}, {SETTLEMENT_GOLDEN_PATH.relative_to(config.ROOT)}")
