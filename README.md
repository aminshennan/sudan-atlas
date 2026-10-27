# Sudan Atlas

An open toolkit that turns messy Sudanese place names into official codes and draws Sudan's states and localities as maps — for websites, apps, Python and Power BI.

> **Status:** early development. Nothing is published yet.

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
powerbi/       TopoJSON for the Shape map + build guide
site/          website + map-maker
examples/      D3 map, dropdown form, Python notebook
docs/          BRIEF.md, DATA_POLICY.md, SOURCES.md
```

## Roadmap

1. Data foundation — clean, validated, versioned boundaries
2. Name matcher — Arabic and English, with confidence scores
3. Packages — npm, PyPI and Power BI
4. Website and map-maker
5. Hosted API (only if users ask)

See [`docs/BRIEF.md`](docs/BRIEF.md) for the full plan.

## Licence

- Code: [MIT](LICENSE)
- Data: [CC BY 4.0](LICENSE-DATA), with attribution to each source listed in [`docs/SOURCES.md`](docs/SOURCES.md)
