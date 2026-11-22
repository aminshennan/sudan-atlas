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


def results() -> list[dict]:
    matcher = Matcher()
    return [{"id": c["id"], "input_name": c["input_name"], "state_hint": c["state_hint"], "level": int(c["level"]),
             "result": matcher.match(c["input_name"], state_hint=c["state_hint"] or None, level=int(c["level"]))}
            for c in load_cases()]


def render(rows: list[dict]) -> str:
    return "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n"


def run() -> None:
    GOLDEN_PATH.write_text(render(results()), encoding="utf-8")
    print(f"golden: {GOLDEN_PATH.relative_to(config.ROOT)}")
