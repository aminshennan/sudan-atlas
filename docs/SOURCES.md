# Sources

Every dataset used to build Sudan Atlas, with its URL, download date and licence. `python -m pipeline fetch` writes the exact files and their SHA-256 hashes to `data/raw/*/manifest.json`. A release copies them into `data/boundaries/manifest.json`.

| Source | URL | Downloaded | Licence | Used for |
| --- | --- | --- | --- | --- |
| COD-AB Sudan (OCHA ROSEA, via HDX), version v03, valid from 2020-08-31 | https://data.humdata.org/dataset/cod-ab-sdn | 2026-10-28 (by hand) | CC BY 3.0 IGO | Admin 0–2 boundaries, P-codes, English and Arabic names |
| geoBoundaries gbOpen SDN (ADM0–ADM2) | https://github.com/wmgeolab/geoBoundaries (`releaseData/gbOpen/SDN`) | 2026-10-28 | CC BY 3.0 IGO | Cross-check only. Not used in outputs. |

## Notes

- **COD-AB was downloaded by hand from HDX**, because HDX was not reachable from the build environment, and registered with `python -m pipeline import`. File used: `sdn_admin_boundaries.geojson.zip` (files inside dated 26 January 2026), SHA-256 `75330d4e12e53f966df0e5683e04f0919e9964952fbbf827f3729038e603c95e`. The same download's shapefile and File Geodatabase versions were compared with it and hold identical codes, names and geometry. Layers: `sdn_admin0` (1), `sdn_admin1` (19), `sdn_admin2` (189). English names are in `adm*_name` (`lang = en`), Arabic in `adm*_name1` (`lang1 = ar`). No feature lacks an Arabic name.
- **Licence:** CC BY 3.0 IGO, confirmed on the HDX dataset page on 2026-10-28 (geoBoundaries records the same). Confirm it again at each new download.

- **geoBoundaries for Sudan repackages COD-AB.** Its metadata names the source as the OCHA ROSEA Information Management Working Group (HDX dataset "Sudan administrative boundaries levels 0–2", source updated 19 January 2023, built 12 December 2023). It is therefore not an independent fallback. It also drops the P-codes, Arabic names and parent codes, keeping English names, ISO 3166-2 codes for states and its own IDs. Counts: 1 country, 19 admin-1 units, 189 admin-2 units.
