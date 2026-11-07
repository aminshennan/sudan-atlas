# Sudan Atlas

An open toolkit that turns messy Sudanese place names into official codes and draws Sudan's states and localities as maps — for websites, apps and Python.

> **Status:** data release 2026.1; packages on [npm](https://www.npmjs.com/package/sudan-atlas) and [PyPI](https://pypi.org/project/sudan-atlas/). Website coming next.

## Quick start

**JavaScript** (`npm install sudan-atlas`)

```js
import { match, getFeature } from "sudan-atlas";
match("El Hasaheesa", { stateHint: "Al Gezira", level: 2 }).pcode; // "SD15034"
const shape = await getFeature("SD15034", "medium");               // GeoJSON Feature
```

**Python** (`pip install sudan-atlas`, or `"sudan-atlas[geo]"` for GeoDataFrames)

```python
from sudan_atlas import match, get_localities
match("الفاشر", level=2)["pcode"]  # 'SD02114'
get_localities("SD15")              # the localities of Aj Jazirah
```

**In a browser with no build step**: `import { match } from "https://cdn.jsdelivr.net/npm/sudan-atlas@0.1/dist/index.js"`; the data files are on jsDelivr too, under `…/sudan-atlas@0.1/data/`.

Examples: a [D3 choropleth from a messy spreadsheet](examples/d3-choropleth/), a [state-and-locality picker](examples/dropdown/), and a [Python notebook](examples/python/sudan_atlas_quickstart.ipynb).

## What a match returns

```js
{
  pcode: "SD15034", name_en: "Al Hasahisa", name_ar: "الحصاحيصا", level: 2,
  score: 0.9,            // 0 to 1
  method: "fuzzy",         // exact, variant or fuzzy; ambiguous or none when there is no match
  alternatives: [ ... ]    // the next three candidates, each with pcode, names, level and score
}
```

When the best candidate scores below 0.82, or another place scores almost as high, `pcode` is `null` (`None` in Python) and `alternatives` lists the candidates: the matcher never guesses silently. A state hint (a P-code or a state name in any spelling) and a level (1 = state, 2 = locality) settle most ambiguity. On real names from public datasets the matcher finds the right place 94 % of the time, named no wrong place on the 299 test cases, and puts the right place among its top three more than 99 % of the time; see [`docs/MATCHER_EVALUATION.md`](docs/MATCHER_EVALUATION.md).

## What it does

- **Name matching** — `El Fasher`, `Al Fashir` and `الفاشر` all resolve to the same official P-code, with a confidence score and alternatives. It never guesses silently.
- **Boundaries** — states (admin 1) and localities (admin 2) as GeoJSON and TopoJSON at three resolutions.
- **Bilingual** — every feature carries `pcode`, `name_en` and `name_ar`; every page supports right-to-left layout.
- **Static** — everything ships as files and runs on the client. User data never leaves the browser.

## Repository layout

```text
data/          boundaries, gazetteer and test fixtures (one source of truth)
pipeline/      Python scripts that rebuild data/ from data/raw/
packages/js/   npm package: data + matcher (TypeScript)
packages/py/   PyPI package: same API (Python)
site/          website: map explorer, map-maker, documentation (Vite + TypeScript)
examples/      D3 map, dropdown form, Python notebook
docs/          DATA_POLICY.md, SOURCES.md, GAZETTEER.md, MATCHER_EVALUATION.md, PUBLISHING.md
```

## Roadmap

1. Data foundation — clean, validated, versioned boundaries
2. Name matcher — Arabic and English, with confidence scores
3. Packages — npm and PyPI
4. Website and map-maker
5. Hosted API (only if users ask)


## Licence

- Code: [MIT](LICENSE)
- Boundaries: CC BY 3.0 IGO, derived from OCHA's COD-AB ([details](LICENSE-DATA))
- Gazetteer additions (variant spellings, normalisation rules, test cases): CC BY 4.0
- Sources are listed in [`docs/SOURCES.md`](docs/SOURCES.md). Boundary choices are documented in [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md).

## Rebuilding the data and packages

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

Publishing steps: [`docs/PUBLISHING.md`](docs/PUBLISHING.md).
