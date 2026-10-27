# Sudan Atlas: Build Brief for Claude Code

Oct 18, 2026 · @Amin Shennan

## Overview

Sudan Atlas is an open toolkit that turns messy Sudanese place names into official codes and draws Sudan's states and localities as maps, for websites, apps, Python and Power BI. Version 1 is static: no server.

**Who it serves**

- NGO and UN information-management officers: matching partner spreadsheets with inconsistent spellings (El Fasher, Al Fashir, الفاشر) to official codes.
- Journalists: quick bilingual maps without GIS skills.
- Researchers and students: clean names and draw maps in a few lines of Python.
- App developers: state and locality dropdowns, name validation, map widgets.
- Corporate analysts: Power BI maps of Sudan that work out of the box.

**Design principles (apply to every phase)**

1. **Static first.** Everything ships as files and runs on the client. No server until Phase 5, and only if users ask.
2. **User data never leaves the browser.** The website processes uploads locally.
3. **Never guess silently.** Every match returns a confidence score and alternatives; below the threshold it returns no match.
4. **Arabic and English are equal.** Every feature carries `pcode`, `name_en` and `name_ar`; every page supports right-to-left layout.
5. **One source of truth.** The gazetteer, variants and normalisation rules live in `data/` as JSON. The TypeScript and Python matchers both read them and both pass the same test fixtures.
6. **Neutral boundaries.** Follow the UN COD-AB dataset; every disputed-area choice is documented in `docs/DATA_POLICY.md`.
7. **Versioned data.** Data releases are tagged `YYYY.N` (for example `2026.1`).

## How to use this brief

Run one Claude Code session per phase, in order, and stop at every human checkpoint.

1. Export this doc as Markdown and commit it to the repo as `docs/BRIEF.md`, so every session reads the same instructions.
2. Start each session with the kickoff prompt below, changing only the phase number.
3. At a **Human checkpoint**, Claude Code stops, summarises what needs review, and waits for Amin.
4. Claude Code cannot create accounts or enter passwords. Amin handles signups (GitHub, npm, PyPI, Vercel, domain) and publishing tokens; Claude Code prepares the commands.
5. A phase is done only when every acceptance check passes. Failed checks are reported, never hidden.

**Kickoff prompt**

```text
Read docs/BRIEF.md. We are on Phase N. Do only Phase N's tasks.
Before writing code, list your plan and any decisions you need from me.
Stop at every Human checkpoint and wait for my answer.
Finish by running the acceptance checks and reporting each result, including failures.
```

## Repository layout and tech stack

One monorepo, with the data pipeline in Python and the browser-facing code in TypeScript.

```text
sudan-atlas/
  data/
    raw/            downloaded sources (git-ignored)
    boundaries/     adm1 + adm2 at 3 resolutions, GeoJSON + TopoJSON
    gazetteer/      places.json, variants.json, normalisation.json
    tests/          match_cases.csv (messy name -> expected pcode)
  pipeline/         Python scripts that rebuild data/ from raw/
  packages/
    js/             npm package: data + matcher (TypeScript)
    py/             PyPI package: same API (Python)
  powerbi/          TopoJSON for the Shape map + build guide
  site/             website + map-maker
  examples/         D3 map, dropdown form, Python notebook
  docs/             BRIEF.md, DATA_POLICY.md, SOURCES.md
```

| Area | Choice |
| --- | --- |
| Data pipeline | Python 3.11+, geopandas, shapely; mapshaper CLI for simplification and TopoJSON export |
| Matcher (Python) | rapidfuzz for fuzzy matching |
| Matcher (TypeScript) | A small Levenshtein library (for example fastest-levenshtein) |
| Website | Vite + TypeScript, D3 for maps, Papa Parse for CSV, SheetJS for XLSX; no backend |
| Hosting | Vercel (site); jsDelivr serves the npm package files |
| Tests and CI | pytest and vitest, both run on `data/tests/match_cases.csv` in GitHub Actions |
| Licences | Code under MIT; data under CC BY 4.0 with attribution to each source |

## Phase 1: Data foundation

**Goal:** clean, validated, versioned boundary files for Sudan's states and localities.

**Tasks**

1. Download the Sudan COD-AB dataset (admin levels 0 to 2) from HDX ([data.humdata.org/dataset/cod-ab-sdn](https://data.humdata.org/dataset/cod-ab-sdn)) and geoBoundaries SDN ADM0 to ADM2. Save them under `data/raw/` and record each source's URL, download date and licence in `docs/SOURCES.md`.
2. Read the licence terms of each source. If the COD-AB redistribution terms are unclear, stop and ask Amin. The fallback is geoBoundaries (CC BY 4.0).
3. Normalise attributes to `pcode`, `name_en`, `name_ar`, `level` (1 or 2) and `parent_pcode`. Report every feature missing an Arabic name.
4. Validate:
   - The admin-1 count matches the source (COD-AB lists 19 features: 18 states plus Abyei).
   - The admin-2 count matches the source (189 localities in COD-AB at the time of writing).
   - All geometries are valid, with no gaps or overlaps between neighbouring localities.
   - Every locality's `parent_pcode` exists.
5. Simplify to three resolutions (detailed, medium for web pages, light for thumbnails) with mapshaper, keeping shared borders identical. Export GeoJSON and TopoJSON and report file sizes.
6. Draft `docs/DATA_POLICY.md`: how Abyei and Halaib are handled, naming conventions, and versioning.
7. Build a preview HTML page that renders every state at each resolution.

**Human checkpoint:** Amin approves `DATA_POLICY.md` and spot-checks the preview page.

**Acceptance checks**

- [ ] One command rebuilds `data/boundaries/` from `data/raw/`
- [ ] The validation script passes with zero errors
- [ ] The preview page renders all three resolutions
- [ ] Data tagged `2026.1`

## Phase 2: Name matcher

**Goal:** given any spelling of a Sudanese state or locality, in Arabic or English, return the official record with a confidence score. This is the core of the product.

**Tasks**

1. Build `data/gazetteer/places.json` from the Phase 1 data: one record per state and locality.
2. Build `variants.json` from the source names, GeoNames alternate names, OpenStreetMap tags (`name`, `name:ar`, `name:en`, `alt_name`, `old_name`), and Arabic and English Wikipedia. Record the source of every variant.
3. Write the normalisation rules in `normalisation.json`:
   - Arabic: unify alef forms (أ إ آ to ا), ta marbuta (ة to ه), alef maqsura (ى to ي); remove tatweel and diacritics; strip the ال prefix for matching.
   - Latin: lowercase; strip article variants (al-, el-, ad-, ed-, ash-, esh- and similar); collapse doubled letters; unify common transliteration pairs (ou/u, ei/ai/ay); remove punctuation.
4. Matching order: exact match on normalised text, then the variants table, then fuzzy matching (rapidfuzz in Python), restricted to the given state when a state hint is supplied.
5. Return `{pcode, name_en, name_ar, level, score, method, alternatives}` with the top 3 alternatives. Below the threshold, return no match plus the alternatives. Never pick silently.
6. Build `data/tests/match_cases.csv`: about 300 messy real names taken from public Sudan datasets on HDX, each with its expected `pcode` and a `verified_by` column (`claude` or `amin`).
7. Report top-1 accuracy, top-3 recall and false-match rate at the chosen threshold, and list every failure.

**Human checkpoint:** Amin reviews the variants table and verifies the test-set labels (about 2 to 4 evenings). Thresholds are set only after this review.

**Acceptance checks**

- [ ] All 300 test cases verified by Amin
- [ ] Accuracy targets agreed with Amin and met (suggested starting point: at least 95% top-1 on verified cases, false matches under 2%)
- [ ] Every failure listed with its cause

## Phase 3: Packages

**Goal:** anyone can use the data and the matcher from JavaScript, Python or Power BI in a few lines.

**Tasks**

1. `packages/js`: a TypeScript package with ESM and CommonJS builds, exporting `getStates()`, `getLocalities(statePcode?)`, `getFeature(pcode, resolution)` and `match(name, {stateHint?})`. The data files must also load directly from a jsDelivr URL.
2. `packages/py`: the same API in snake\_case (`get_states`, `get_localities`, `get_feature`, `match`), with geopandas as an optional extra that returns GeoDataFrames.
3. Both packages run `data/tests/match_cases.csv` in CI and must return identical results.
4. `powerbi/`: TopoJSON files for the Shape map (states and localities) with `pcode`, `name_en` and `name_ar` properties, plus a step-by-step README for building the template `.pbix`.
5. `examples/`: a D3 choropleth, a cascading state-to-locality dropdown, and a Python notebook.
6. The main README with three-line quick starts for JavaScript, Python and Power BI.

**Human checkpoint:** Amin creates the npm and PyPI accounts and publishes (Claude Code prepares the commands), and builds and tests the `.pbix` in Power BI Desktop.

**Acceptance checks**

- [ ] Both packages install and work in a clean environment
- [ ] CI shows identical match results for JavaScript and Python
- [ ] All three examples run
- [ ] The Power BI template displays both levels correctly

## Phase 4: Website and map-maker

**Goal:** a public bilingual site with documentation and a map-maker that runs entirely in the browser.

**Tasks**

1. Pages: landing (one striking example map and a before-and-after of a messy spreadsheet), docs, map-maker, data policy, about.
2. Map-maker flow:
   1. Upload a CSV or XLSX file.
   2. Pick the place-name column and the value column.
   3. Match names with the JavaScript package.
   4. Review a table sorted by confidence; filter low-confidence rows; let the user pick an alternative or mark a row unmatched.
   5. Draw a choropleth with D3: choose state or locality level, colour scale, and Arabic or English labels.
   6. Export a PNG, an SVG, an embed snippet, and the cleaned file with a `pcode` column added.
3. An Arabic and English toggle with full right-to-left layout.
4. No uploads to any server, stated clearly on the page. Privacy-friendly analytics that count page views and exported maps only, never content.
5. Mobile-friendly layout; run a Lighthouse check.
6. Deploy on Vercel.

**Human checkpoint:** Amin reviews the design, tests the Arabic layout and the site on his phone, and connects the domain.

**Acceptance checks**

- [ ] End-to-end test with a messy sample spreadsheet passes
- [ ] The browser network panel shows no uploaded data
- [ ] Both languages render correctly, including right-to-left
- [ ] Lighthouse scores reported

## Phase 5: Hosted API (only if users ask)

**Goal:** a small free API for users who cannot install a package. Skip this phase until real users request it.

**Tasks**

1. Endpoints under a versioned path `/v1/`: `GET /match?q=&state=`, `GET /places/{pcode}`, `GET /states`, `GET /localities?state=`.
2. Serverless functions on a free tier (Vercel or Cloudflare Workers) that reuse the JavaScript package, so results always match the packages.
3. CORS enabled, basic rate limiting, and the same response format as `match()`.
4. API keys only if a paid tier is introduced.

**Human checkpoint:** Amin decides whether demand justifies this phase and sets up the hosting account.

**Acceptance checks**

- [ ] API results equal package results on `match_cases.csv`
- [ ] Rate limiting tested

## Launch, maintenance and go-live (Amin-owned)

These steps are Amin's, not Claude Code's. With no validation phase, the soft launch is the first real test of whether name matching is the main pain, so treat early feedback as the validation.

**Launch**

1. Soft launch to a few users (OSM Sudan, KRI, one NGO analyst) and fix whatever confuses them.
2. Public launch: the HDX showcase section, Sudanese developer groups, and a LinkedIn post with one striking map and a before-and-after of a messy spreadsheet.
3. A GitHub README with a short animated demo, since many developers decide in the first ten seconds.

**Maintenance**

- Versioned data releases with a changelog, and a "report a missing spelling" issue template so users improve the matcher.
- GitHub Sponsors and paid custom work, such as organisation-specific regions in Power BI. If income starts, make the TM outside-business declaration.
- Track package downloads, maps exported on the site (counted without collecting data), and issues opened.

**Go-live checklist**

- [ ] A name and a domain (a subdomain of aminshennan.com works at first)
- [ ] Public GitHub repo with MIT (code) and CC BY 4.0 (data) licences
- [ ] Website deployed on Vercel
- [ ] Packages published to npm and PyPI
- [ ] Documentation and examples live
- [ ] Privacy-friendly analytics on
