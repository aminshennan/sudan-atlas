# Sources

Every dataset used to build Sudan Atlas, with its URL, download date and licence. `python -m pipeline fetch` writes the exact files and their SHA-256 hashes to `data/raw/*/manifest.json`. A release copies them into `data/boundaries/manifest.json`.

| Source | URL | Downloaded | Licence | Used for |
| --- | --- | --- | --- | --- |
| COD-AB Sudan (OCHA ROSEA, via HDX), version v03, valid from 2020-08-31 | https://data.humdata.org/dataset/cod-ab-sdn | 2026-10-28 (by hand) | CC BY 3.0 IGO | Admin 0–2 boundaries, P-codes, English and Arabic names |
| GeoNames: Sudan extract and alternate names | https://www.geonames.org/ (`export/dump/SD.zip`, `export/dump/alternatenames/SD.zip`) | 2026-10-31 | CC BY 4.0 | Variant spellings (`data/gazetteer/variants.json`), and towns with a recorded population of 10,000 or more as town names |
| Wikidata: states (Q746290) and localities (Q505830) of Sudan | https://www.wikidata.org/ (query: `pipeline/gazetteer/wikidata.rq`) | 2026-10-31 | CC0 1.0 | Variant spellings, locality capitals as town names |
| OpenStreetMap populated places of Sudan (Humanitarian OpenStreetMap Team export) | https://data.humdata.org/dataset/hotosm_sdn_populated_places | 2026-11-01 | ODbL 1.0, © OpenStreetMap contributors | Town names (places tagged city or town), kept separately in `data/gazetteer/variants_osm.json` |
| geoBoundaries gbOpen SDN (ADM0–ADM2) | https://github.com/wmgeolab/geoBoundaries (`releaseData/gbOpen/SDN`) | 2026-10-28 | CC BY 3.0 IGO | Cross-check of the boundaries; its spellings (such as "Gezira") are variants |

## Notes

- **COD-AB was downloaded by hand from HDX**, because HDX was not reachable from the build environment, and registered with `python -m pipeline import`. File used: `sdn_admin_boundaries.geojson.zip` (files inside dated 26 January 2026), SHA-256 `75330d4e12e53f966df0e5683e04f0919e9964952fbbf827f3729038e603c95e`. The same download's shapefile and File Geodatabase versions were compared with it and hold identical codes, names and geometry. Layers: `sdn_admin0` (1), `sdn_admin1` (19), `sdn_admin2` (189). English names are in `adm*_name` (`lang = en`), Arabic in `adm*_name1` (`lang1 = ar`). No feature lacks an Arabic name.
- **Licence:** CC BY 3.0 IGO, confirmed on the HDX dataset page on 2026-10-28 (geoBoundaries records the same). Confirm it again at each new download.

- **geoBoundaries for Sudan repackages COD-AB.** Its metadata names the source as the OCHA ROSEA Information Management Working Group (HDX dataset "Sudan administrative boundaries levels 0–2", source updated 19 January 2023, built 12 December 2023). It is therefore not an independent fallback. It also drops the P-codes, Arabic names and parent codes, keeping English names, ISO 3166-2 codes for states and its own IDs. Counts: 1 country, 19 admin-1 units, 189 admin-2 units.

## Matcher test set

`data/tests/match_cases.csv` takes real place names, as people typed them, from these public datasets on HDX (downloaded 2026-10-31 with `python -m pipeline fetch-test-sources`). They are kept out of `variants.json`, so the test measures the matcher fairly.

| Dataset | Publisher | URL | File used | Licence |
| --- | --- | --- | --- | --- |
| Sudan: 2022 HRP-Response Monitoring (4Ws) | OCHA Sudan | https://data.humdata.org/dataset/sudan-2022-hrp-response-monitoring-4ws | `2022-HRP-Sectors-Response-Jan-Jun.xlsx` | Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO) |
| Sudan: Acute Food Insecurity Country Data | Integrated Food Security Phase Classification (IPC) | https://data.humdata.org/dataset/sudan-acute-food-insecurity-country-data | `ipc_sdn_area_wide_latest.csv` | Public Domain / No restrictions (CC0) |
| Sudan: Displacement Situation - IDPs [IOM DTM] | International Organization for Migration (IOM) | https://data.humdata.org/dataset/sudan-displacement-situation-countrywide-idps-iom-dtm | `DTM Sudan Displacement and Return Snapshot (8).xlsx` | Creative Commons Attribution International (CC BY) |
| Sudan: Monthly Refugee and Asylum-Seeker Population by Site, Disaggregated by Age and Gender | UNHCR - The UN Refugee Agency | https://data.humdata.org/dataset/sudan-monthly-refugee-and-asylum-seeker-population-by-site | `HDX-unhcr-population-as-of-31-August 2026.xlsx` | Creative Commons Attribution International (CC BY) |
| Sudan: People Affected by Floods | OCHA Sudan | https://data.humdata.org/dataset/sudan-people-affected-by-floods | `Floods Data 2021 to 2023.xlsx` | Creative Commons Attribution International (CC BY) |
| SUDAN : People Reached by locality (HRP) | OCHA Sudan | https://data.humdata.org/dataset/sudan-people-reached-by-locality-jan-dec-2019_hrp | `sudan-people-reached-by-locality-jan-dec-2019_hrp.xlsx` | Creative Commons Attribution International (CC BY) |
| Sudan - Schools | OCHA Sudan | https://data.humdata.org/dataset/sudan-schools | `Sudan Schools (HXLated)` | Creative Commons Attribution International (CC BY) |
| Sudan Subnational Population and Housing Data Tables with Administrative Boundaries, Based on National Census and Surveys | U.S. Census Bureau | https://data.humdata.org/dataset/sudan-subnational-boundaries-and-tabular-data | `Sudan_uscb_202101.xlsx` | Creative Commons Attribution International (CC BY) |
| Sudan Who does What & Where November 2020 | OCHA Sudan | https://data.humdata.org/dataset/sudan-who-does-what-where-november-2020 | `cleaned_compiled_Nov_3ws.xlsx` | Creative Commons Attribution International (CC BY) |

The floods dataset's 2024 file is a Google Sheet; its 2021–2023 Excel file is used instead. In the UNHCR file the state column uses merged cells, so each blank state is filled down from the row above.
