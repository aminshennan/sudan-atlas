# Data policy

> **Status: draft for review.** Facts marked _(to confirm on COD-AB)_ are filled in when the pipeline first runs on the COD-AB download.

## Principle: follow the UN dataset as published

Sudan Atlas boundaries follow the Common Operational Dataset for Administrative Boundaries (COD-AB) for Sudan, published by OCHA on the Humanitarian Data Exchange (HDX). We do not redraw, add or remove boundaries. Where an area is disputed, we keep the COD-AB treatment and document it here.

Boundaries are provided for humanitarian, research and practical use. **They do not imply any opinion on the legal status of any country, territory or area, or on the delimitation of any frontier.** Every page and package that displays the maps links to this policy.

## Disputed areas

### Abyei

Abyei is claimed by both Sudan and South Sudan and has a special administrative status. COD-AB includes it as a separate admin-1 unit (labelled "Abyei PCA", for the area defined by the Permanent Court of Arbitration's 2009 ruling) rather than as part of a state.

Sudan Atlas keeps it exactly so:

- Abyei is its own admin-1 feature, with its COD-AB P-code and names _(to confirm on COD-AB)_.
- It counts toward the 19 admin-1 features (18 states plus Abyei).
- It is never merged into a neighbouring state, at any resolution.

### Halaib Triangle

The Halaib Triangle is claimed by both Sudan and Egypt. The COD-AB national outline includes it: the boundary runs north of the 22nd parallel to about 23.1°N along the Red Sea coast. The same holds for the Wadi Halfa salient on the Nile.

Sudan Atlas keeps the COD-AB geometry unchanged, inside the admin-1 unit COD-AB assigns it to _(to confirm on COD-AB; expected Red Sea State)_. It is not marked or styled differently in the data. Map makers who need a different treatment can clip or restyle it themselves; we will document how.

## Naming conventions

- Every feature has `pcode`, `name_en`, `name_ar`, `level` (1 = state, 2 = locality) and `parent_pcode`.
- P-codes and names are taken from COD-AB exactly. The pipeline only trims and collapses whitespace; it never changes a spelling. Other spellings belong in the gazetteer's variants table (Phase 2), not in the boundary files.
- `parent_pcode` is the country P-code for a state and the state P-code for a locality.
- Every feature missing an Arabic name is listed in the build report and in the release notes.

## Geometry

- Localities are the building blocks. Each state is rebuilt by merging its localities, so a state border and the locality borders along it are the same line at every resolution. The difference from the COD-AB state polygons is measured and reported at each release.
- Three resolutions: `detailed` (source geometry), `medium` (web pages) and `light` (thumbnails). They are simplified with mapshaper, which keeps shared borders identical between neighbours.
- Each release is validated: valid geometry, no gaps or overlaps between neighbouring localities above 0.01 km², every locality inside its state, every `parent_pcode` present, and feature counts equal to the source.

## Versioning

- Data releases are tagged `YYYY.N`, for example `2026.1`. `N` counts releases within the year.
- A new release is made when COD-AB is updated, or when Sudan Atlas fixes or changes anything in the data.
- `data/boundaries/manifest.json` records the version, the source files with their SHA-256 hashes and download date, and every output file's hash and size.
- Each release has a changelog entry describing what changed, including any P-code or name change.

## Licence and attribution

- Boundary files are derived from COD-AB and keep its licence, **Creative Commons Attribution 3.0 IGO (CC BY 3.0 IGO)** _(to confirm against the HDX licence on download)_, with attribution to OCHA.
- Sudan Atlas's own data (the gazetteer's variant spellings, the normalisation rules and the test cases) is licensed **CC BY 4.0**.
- See [`LICENSE-DATA`](../LICENSE-DATA) for the attribution text.
