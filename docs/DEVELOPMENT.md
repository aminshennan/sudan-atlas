# Development

Everything in `data/` is built from public sources by the pipeline, so the toolkit can be rebuilt and checked from scratch. Python 3.11 or later and Node 20 or later.

## Rebuilding

```sh
make setup      # Python venv, mapshaper and the JS package's tools
make fetch      # download COD-AB, GeoNames and Wikidata into data/raw/
make data       # rebuild and validate data/boundaries/
make gazetteer  # rebuild data/gazetteer/ (places and spellings)
make evaluate   # measure the matcher; writes docs/MATCHER_EVALUATION.md
make golden     # write the results both packages must reproduce
make packages   # build the npm and PyPI packages
make test       # Python tests;  make test-js for the TypeScript package
make preview    # then open http://localhost:8000/pipeline/preview/
```

Packages are published by [`.github/workflows/release.yml`](../.github/workflows/release.yml) when a release tagged `packages-v<version>` is published.

Rebuilding the boundaries from the same downloaded sources produces identical files. GeoNames and Wikidata change over time, so a fresh download can bring new spellings; these stay `proposed` until reviewed (see `GAZETTEER.md`). The tests check the boundaries, the gazetteer, the matcher's accuracy targets, and that the Python and JavaScript packages return identical results (`data/tests/match_results.json`).
