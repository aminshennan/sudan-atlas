# Sources

Every dataset used to build Sudan Atlas, with its URL, download date and licence. `python -m pipeline fetch` writes the exact files and their SHA-256 hashes to `data/raw/*/manifest.json`. A release copies them into `data/boundaries/manifest.json`.

| Source | URL | Downloaded | Licence | Used for |
| --- | --- | --- | --- | --- |
| COD-AB Sudan (OCHA ROSEA, via HDX) | https://data.humdata.org/dataset/cod-ab-sdn | _pending_ | _to confirm on download_ | Admin 1–2 boundaries, P-codes, English and Arabic names |
| geoBoundaries gbOpen SDN (ADM0–ADM2) | https://github.com/wmgeolab/geoBoundaries (`releaseData/gbOpen/SDN`) | 2026-10-28 | CC BY 3.0 IGO | Cross-check only. Not used in outputs. |

## Notes

- **geoBoundaries for Sudan repackages COD-AB.** Its metadata names the source as the OCHA ROSEA Information Management Working Group (HDX dataset "Sudan administrative boundaries levels 0–2", source updated 19 January 2023, built 12 December 2023). It is therefore not an independent fallback. It also drops the P-codes, Arabic names and parent codes, keeping English names, ISO 3166-2 codes for states and its own IDs. Counts: 1 country, 19 admin-1 units, 189 admin-2 units.
