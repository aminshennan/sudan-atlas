"""Command line: python -m pipeline STEP

Boundaries:  fetch | import ARCHIVE | normalise | simplify | validate | manifest | build
Gazetteer:   gazetteer | fetch-test-sources | test-pool | evaluate | golden
Packages:    powerbi

`build` rebuilds data/boundaries/ from data/raw/ and validates it; it exits
non-zero if any validation check fails. `fetch` downloads data/raw/ and is
kept separate so a rebuild never depends on the network. `import` registers
a COD-AB archive downloaded by hand from HDX, when HDX is not reachable.
`gazetteer` rebuilds data/gazetteer/places.json and variants.json; `evaluate`
measures the matcher on data/tests/match_cases.csv.
"""

import sys
from pathlib import Path

from . import fetch, manifest, normalise, powerbi, simplify, validate
from .gazetteer import evaluate, golden, places, testcases, variants


def build() -> int:
    normalise.run()
    simplify.run()
    results = validate.run()
    manifest.run()
    failed = [r.target for r in results if not r.ok]
    if failed:
        print(f"\nValidation FAILED for: {', '.join(failed)}")
        return 1
    print("\nValidation passed with zero errors.")
    return 0


def main(argv: list[str]) -> int:
    step = argv[0] if argv else "build"
    if step == "import":
        if len(argv) != 2:
            print(__doc__)
            return 2
        fetch.register_local(Path(argv[1]), "downloaded by hand from HDX and imported with `python -m pipeline import`")
        return 0
    steps = {
        "fetch": lambda: fetch.run() or 0,
        "normalise": lambda: normalise.run() and 0,
        "simplify": lambda: simplify.run() and 0,
        "validate": lambda: 0 if all(r.ok for r in validate.run()) else 1,
        "manifest": lambda: manifest.run() and 0,
        "build": build,
        "gazetteer": lambda: (places.run(), variants.run()) and 0,
        "fetch-test-sources": lambda: testcases.fetch() and 0,
        "test-pool": lambda: testcases.pool() and 0,
        "evaluate": lambda: evaluate.run() and 0,
        "golden": lambda: golden.run() or 0,
        "powerbi": lambda: powerbi.run() or 0,
    }
    if step not in steps:
        print(__doc__)
        return 2
    return steps[step]()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
