# Changelog

Data releases are tagged `YYYY.N`. See [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md).

## 2026.1 — unreleased (awaiting review)

First release of the boundary files.

- **Source:** COD-AB Sudan (OCHA ROSEA, via HDX), version v03, valid from 31 August 2020. Licence CC BY 3.0 IGO.
- **Features:** 19 admin-1 units (18 states plus the Abyei PCA area) and 189 localities. Every feature has a P-code and English and Arabic names.
- **Resolutions:** `detailed`, `medium` and `light`, in GeoJSON and TopoJSON. States are rebuilt from their localities so borders match exactly at every resolution. At `detailed` they match the COD-AB state polygons exactly.
- **Validation:** zero errors. No gaps or overlaps above 0.01 km²; one 1,696 m² gap from the source is kept, as documented in the data policy.
