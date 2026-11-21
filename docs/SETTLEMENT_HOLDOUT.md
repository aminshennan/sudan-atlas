# Independent test of village, town and camp matching

The matcher can also look names up among villages, towns and camps (`settlements=True`). This test measures that once, on village names it was not built from, with nothing changed afterwards.

## Protocol

Written before any test name was collected (2026-11-21).

**Matcher, frozen.** Python package at commit `f3aa17e`, default threshold and margin, `settlements=True`, level 2, with these files (SHA-256):

| File | SHA-256 |
| --- | --- |
| `data/gazetteer/settlements.json` | `39dbd4316ada941c228d4c43bd96bb4eb5fee34137fc3c4d6bc3d6ebc6b2541e` |
| `data/gazetteer/settlements_osm.json` | `b8f4d2bcdba02e1bd351d4f6d156bf0957fbbb541614896f6a0efd11bfc8b284` |
| `data/gazetteer/places.json` | `29e352c3f66147361644ff1d6cf9a66fb92c9f329dd7d4f44739e87a6d5ababa` |
| `data/gazetteer/variants.json` | `c630e861aca2da697263f357afeacd870743e5b99599875518b3e2d511da28fd` |
| `data/gazetteer/variants_osm.json` | `839fec804ec30b5b15f85f7b3157ab9620dc3ee1b9b2ffdab50ce8c3b14dddfb` |
| `data/gazetteer/normalisation.json` | `1f2de9103ffe13dcec5e708c9e3c3c5734079e28ff79618869ef2745b899d4a8` |
| `packages/py/src/sudan_atlas/match.py` | `9c0f379e4f349d014a29b718ef86e6731e1ecf43f8fccfd4475881e7961a7b7c` |

No village, rule or setting is changed because of this test.

**Sources.** Public datasets that list village names together with the state and locality each village is in, under an open licence, and that are not a source of the village data (GeoNames, OpenStreetMap, OCHA's IDP camp list): OCHA Sudan's reports of people affected by floods (2021–2023) and OCHA Sudan's list of schools supported by Food for Education. Both CC BY. The 22 flood village names already in the first matcher test are left out.

**Answers, without judgement.** A row is used only when its locality is written as the official English or Arabic name of a locality in its state (after the matcher's normalising rules, which change spelling forms but never choose a place). The answer is that locality's P-code. Other rows are left out, and how many is reported.

**Sampling.** Distinct (village, state, locality) rows; if there are more than 400, 400 are drawn with a fixed seed.

**Measures**, for every case, with the dataset's state as a hint and without it:

- **right locality**: the matcher gives the dataset's locality (by any method);
- **wrong locality**: the matcher gives another locality;
- **asked**: no answer, with candidates (ambiguous);
- **not found**: no answer and no candidate.

Each is reported with its 95 % confidence interval, by source, and by how the matcher answered (village, or a state or locality name). For comparison, the same names are also matched without `settlements=True`. Every wrong locality is listed. Results are reported whatever they are.

**Caveat set in advance.** Village coordinates in GeoNames and OpenStreetMap, and locality boundaries, are not perfect, and reporters sometimes file a village under a neighbouring locality. A "wrong locality" can therefore be a disagreement between sources rather than a mistake by the matcher; the list of wrong localities lets each one be checked.

## Results

Pending.
