# Data policy

> **Status: approved for data release 2026.1** (28 October 2026). Facts below are checked against COD-AB Sudan version v03 (valid from 31 August 2020).

## Principle: follow the UN dataset as published

Sudan Atlas boundaries follow the Common Operational Dataset for Administrative Boundaries (COD-AB) for Sudan, published by OCHA on the Humanitarian Data Exchange (HDX). We do not redraw, add or remove boundaries. Where an area is disputed, we keep the COD-AB treatment and document it here.

Boundaries are provided for humanitarian, research and practical use. **They do not imply any opinion on the legal status of any country, territory or area, or on the delimitation of any frontier.** Every page and package that displays the maps links to this policy.

## Disputed areas

### Abyei

Abyei is claimed by both Sudan and South Sudan and has a special administrative status. COD-AB includes it as a separate admin-1 unit (labelled "Abyei PCA", for the area defined by the Permanent Court of Arbitration's 2009 ruling) rather than as part of a state.

Sudan Atlas keeps it exactly so:

- Abyei is its own admin-1 feature: `SD19`, "Abyei PCA" (إدارية أبيي), about 10,537 km².
- It has a single admin-2 feature: `SD19001`, "Abyei PCA area".
- It counts toward the 19 admin-1 features (18 states plus Abyei).
- It is never merged into a neighbouring state, at any resolution.

COD-AB also has a separate locality named **"Abyei" (`SD18087`) in West Kordofan**. This is a different feature from the Abyei PCA area. The matcher (Phase 2) must not resolve "Abyei" silently to either one; it returns both as alternatives unless a state hint decides it.

### Halaib Triangle

The Halaib Triangle is claimed by both Sudan and Egypt. The COD-AB national outline includes it: the boundary runs north of the 22nd parallel to about 23.1°N along the Red Sea coast. COD-AB places it in **Red Sea State (`SD10`)** as its own locality, **`SD10066` "Hala'ib" (حلايب)**.

The **Wadi Halfa salient** on the Nile, also north of the 22nd parallel, is in Northern State (`SD17`), Halfa locality (`SD17014`). **Bir Tawil**, south of the 22nd parallel and claimed by neither country, lies outside the COD-AB outline.

Sudan Atlas keeps the COD-AB geometry unchanged. Halaib is not marked or styled differently in the data. Map makers who need a different treatment can clip or restyle `SD10066` themselves; we will document how.

## Naming conventions

- Every feature has `pcode`, `name_en`, `name_ar`, `level` (1 = state, 2 = locality) and `parent_pcode`.
- P-codes and names are taken from COD-AB exactly. The pipeline only trims and collapses whitespace; it never changes a spelling. Other spellings belong in the gazetteer's variants table (Phase 2), not in the boundary files.
- `parent_pcode` is the country P-code for a state and the state P-code for a locality.
- Every feature missing an Arabic name is listed in the build report and in the release notes.

## Geometry

- Localities are the building blocks. Each state is rebuilt by merging its localities, so a state border and the locality borders along it are the same line at every resolution. The difference from the COD-AB state polygons is measured and reported at each release.
- Three resolutions: `detailed` (source geometry), `medium` (web pages) and `light` (thumbnails). They are simplified with mapshaper, which keeps shared borders identical between neighbours.
- Each release is validated: valid geometry (in both GeoJSON and TopoJSON), no gaps or overlaps between neighbouring localities above 0.01 km², every locality inside its state, every `parent_pcode` present, and feature counts equal to the source.
- Coordinates are rounded as coarsely as possible while keeping every shape valid: 7 decimal places (about 1 cm) for `detailed`, 5 for `medium`, 4 for `light`. Coarser rounding was tested and made some COD-AB rings cross themselves.
- Known source imperfections we keep rather than edit: one 1,696 m² gap between localities near 31.445°E, 9.898°N (below the 0.01 km² tolerance).

## Versioning

- Data releases are tagged `YYYY.N`, for example `2026.1`. `N` counts releases within the year.
- A new release is made when COD-AB is updated, or when Sudan Atlas fixes or changes anything in the data.
- `data/boundaries/manifest.json` records the version, the source files with their SHA-256 hashes and download date, and every output file's hash and size.
- Each release has a changelog entry describing what changed, including any P-code or name change.

## Licence and attribution

- Boundary files are derived from COD-AB and keep its licence, **Creative Commons Attribution 3.0 IGO (CC BY 3.0 IGO)**, with attribution to OCHA.
- Sudan Atlas's own data (the gazetteer's variant spellings, the normalisation rules and the test cases) is licensed **CC BY 4.0**.
- See [`LICENSE-DATA`](../LICENSE-DATA) for the attribution text.
