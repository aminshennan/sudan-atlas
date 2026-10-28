"""Command line: python -m pipeline [fetch|normalise|simplify|validate|manifest|build].

`build` rebuilds data/boundaries/ from data/raw/ and validates it; it exits
non-zero if any validation check fails. `fetch` downloads data/raw/ and is
kept separate so a rebuild never depends on the network.
"""

import sys

from . import fetch, manifest, normalise, simplify, validate


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
    steps = {
        "fetch": lambda: fetch.run() or 0,
        "normalise": lambda: normalise.run() and 0,
        "simplify": lambda: simplify.run() and 0,
        "validate": lambda: 0 if all(r.ok for r in validate.run()) else 1,
        "manifest": lambda: manifest.run() and 0,
        "build": build,
    }
    if step not in steps:
        print(__doc__)
        return 2
    return steps[step]()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
