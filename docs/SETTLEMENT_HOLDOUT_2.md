# Second independent test of village, town and camp matching

The [first village test](SETTLEMENT_HOLDOUT.md) found too few villages. Since then, the village data has gained OCHA Sudan's settlement list, Overture Maps and Wikidata. The matcher has also learned close spellings: with a state hint, a name that matches nothing exactly is compared with that state's villages. This test measures the result once, on village names never used to build or tune it, with nothing changed afterwards.

## Protocol

Written on 2026-11-22, before any test case was built and before the matcher was run on any name from these datasets.

**Matcher, frozen.** Python package at commit `207c9b4`, default settings (locality threshold 0.82 and margin 0.05; close village spellings: threshold 0.80, margin 0.10), `settlements=True`, level 2, with these files (SHA-256):

| File | SHA-256 |
| --- | --- |
| `packages/py/src/sudan_atlas/match.py` | `680031c8c4afe461963d5300db9c0ccd53940ee5cd019adb42142e737609f1c5` |
| `packages/js/src/match.ts` | `153fd5aa5ea6eac90583e67af774d79271ed20389e536d8af98e1acaf1d714cf` |
| `data/gazetteer/settlements.json` | `91643e386a0933dc17167351d3dec56f18b2ad66dbac46812ae8dcbe98ca7676` |
| `data/gazetteer/settlements_osm.json` | `a166f2531ef972c146f3983297fd6082dc2e2e4deab288fa457afd318c9bf821` |
| `data/gazetteer/places.json` | `29e352c3f66147361644ff1d6cf9a66fb92c9f329dd7d4f44739e87a6d5ababa` |
| `data/gazetteer/variants.json` | `c630e861aca2da697263f357afeacd870743e5b99599875518b3e2d511da28fd` |
| `data/gazetteer/variants_osm.json` | `839fec804ec30b5b15f85f7b3157ab9620dc3ee1b9b2ffdab50ce8c3b14dddfb` |
| `data/gazetteer/normalisation.json` | `1f2de9103ffe13dcec5e708c9e3c3c5734079e28ff79618869ef2745b899d4a8` |

The close-spelling settings were chosen on the flood-report rows of the first village test, after it had been reported. The JavaScript matcher returns identical results (checked on 1,854 cases).

**Sources.** Three public datasets on HDX that give a name and a point for each village or site. None is a source of the village data. Files as downloaded on 2026-11-22 (SHA-256):

| Dataset | Licence | Year | File | SHA-256 |
| --- | --- | --- | --- | --- |
| [WFP nutrition sites](https://data.humdata.org/dataset/wfp-nitrition-sites-sudan) (World Food Programme) | CC0 | 2016 | `nutrition-sites-for-all-states.xlsx` | `0e714fea5f6e456ca323499bc37ff729f23b48e9c05a20f9a744645792dd34dc` |
| [WFP SAFE Initiative assisted villages](https://data.humdata.org/dataset/wfp-safe-initiative-assisted-villages) (World Food Programme) | CC BY | 2016 | `safe-assisted-villages.xls` | `61bd63af08c891a6f9da929bcd78cde34b66f1ae08114be50850b523e2b1d46a` |
| [Darfur damaged and destroyed villages](https://data.humdata.org/dataset/darfur-damaged-and-destroyed-villages) (U.S. Government, Humanitarian Information Unit) | CC0 | 2010 | `sudan-darfur-damageddestroyedvillages-2010dec-hiu.csv` | `75cbb214eeb06f014cfd671fe1215849a6c02fc488852b1384e9d81b6fb4d8d7` |

**Answers from coordinates, without judgement.** The answer for each name is the locality its point falls in, on the same COD-AB boundaries the village data uses. Nobody labels any name. Rows without a name or a point are left out, as are points outside Sudan's localities.

**State hint.** The nutrition-site list has a state column, which is used as written. The SAFE list has none, but every locality it names is in North Darfur, so "North Darfur" is used. The Darfur villages list has none either. For it, the name of the state its point falls in stands in for a state column, as if the dataset had a correct one. That part of the hint comes from the answer, so the Darfur figures with a state hint describe data that does have a correct state column.

**Cases.** A name is left out if, after normalising, it is a name in any earlier test (`match_cases.csv`, `holdout_cases.csv`, `settlement_holdout_cases.csv`). Within each dataset, each (name, locality) pair is used once. The nutrition-site and SAFE lists are used whole. From the Darfur list, 300 are drawn with a fixed seed (20261122), since it is far larger than the other two. The cases are written to `data/tests/settlement_holdout2_cases.csv`.

**Measures.** Every case gets one of four outcomes:

- **right locality**: the matcher gives the locality of the point, by any method;
- **wrong locality**: the matcher gives another locality;
- **asked**: no answer, but candidates are offered (ambiguous);
- **not found**: no answer and no candidate.

Four settings are compared:

- villages on, with the state hint (the main one);
- villages on, without a state hint;
- exact village names only, with the state hint (the close-spelling step turned off);
- villages off, with the state hint.

Each outcome is reported with its 95 % confidence interval (Wilson), by source and by how the matcher answered. Every wrong locality is listed. Results are reported whatever they are.

**A rule set in advance.** The close-spelling step is kept only if, on the names where it changes the answer, it gives at least three right localities for each wrong one. If it does not, it is removed before the next release, and this report says so.

**Caveats set in advance.**

- A point can be slightly off, and a village near a boundary can fall on the other side. So a "wrong locality" can be a disagreement about coordinates rather than a mistake by the matcher; the list of wrong localities lets each one be checked.
- These datasets are old (2010 and 2016). Some of their villages may since have been copied into GeoNames, OpenStreetMap or OCHA's settlement list, which would make them easier to find than names in new data.
- Two of the three datasets cover Darfur only.

