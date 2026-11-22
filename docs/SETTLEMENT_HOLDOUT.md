# Independent test of village, town and camp matching

The matcher can also look names up among villages, towns and camps (`settlements=True`). This test measures that once, on village names it was not built from, with nothing changed afterwards.

A [second test](SETTLEMENT_HOLDOUT_2.md) followed, after the village data was enlarged and close spellings were tried.

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

## Summary

- **Most village names are not found.** Village matching uses exact names only (after normalising), and GeoNames, OpenStreetMap and the camp list contain the exact spelling for fewer than half of these villages: with the state as a hint, 125 of 227 names (55 %) were not found at all.
- **On the flood reports, whose localities are current, it helps a little.** Of 99 villages, it gave the right locality for 44 (37 without village matching) and a wrong one for 7 (5 without); 4 were asked about and 44 not found.
- **The school-feeding list cannot be scored fairly.** 115 of its 128 villages are in South Kordofan and filed under just three localities (Ar Rashad, Kadugli and Dilling) that have since been split into more; for example the village *Heiban* is filed under Ar Rashad, although Heiban is now a locality of its own. Most of its 33 "wrong localities" are therefore the dataset's older layout rather than the matcher's mistakes, but under the protocol they are counted as wrong.
- **Village names also confuse the ordinary matcher.** Without village matching, 22 of the 227 village names were matched to a wrong locality by their resemblance to a locality name, the same weakness the independent test of the matcher found.
- **What this means:** village matching, as built, finds too few villages and its answers need checking. It should be improved (and measured again on new data) before it is relied on.

## Results

Measured on 2026-11-21 on **227** village names (99 from sudan-people-affected-by-floods, 128 from food-for-education-ffe-supported-schools-sudan). Rows left out under the protocol: 232 no village name; 29 in the first matcher test; 812 locality not written as an official name. There were 227 usable villages, so all were used.

| Setting | Right locality | Wrong locality | Asked | Not found |
| --- | --- | --- | --- | --- |
| Villages on, state as a hint | 24.7% (20–31 %), 56 | 17.6% (13–23 %), 40 | 2.6% (1–6 %), 6 | 55.1% (49–61 %), 125 |
| Villages on, no state hint | 19.8% (15–25 %), 45 | 22.5% (18–28 %), 51 | 14.1% (10–19 %), 32 | 43.6% (37–50 %), 99 |
| Villages off (as before), state as a hint | 18.1% (14–24 %), 41 | 9.7% (6–14 %), 22 | 0.9% (0–3 %), 2 | 71.4% (65–77 %), 162 |

Each cell: share of the village names, its 95 % confidence interval (Wilson), and the count.

### How the matcher answered (villages on, state as a hint)

| Answered by | Names | Right locality | Wrong locality |
| --- | --- | --- | --- |
| none | 125 | 0 | 0 |
| settlement | 33 | 15 | 18 |
| exact | 30 | 28 | 2 |
| fuzzy | 19 | 8 | 11 |
| variant | 14 | 5 | 9 |
| ambiguous | 6 | 0 | 0 |

### By source (villages on, state as a hint)

| Source | Names | Right locality | Wrong locality | Asked | Not found |
| --- | --- | --- | --- | --- | --- |
| sudan-people-affected-by-floods | 99 | 44 | 7 | 4 | 44 |
| food-for-education-ffe-supported-schools-sudan | 128 | 12 | 33 | 2 | 81 |

### Every wrong locality (villages on, state as a hint)

| Case | Village | State | Dataset's locality | Matcher's locality | Answered by | Settlement found |
| --- | --- | --- | --- | --- | --- | --- |
| v003 | Um Rimta | White Nile | SD09051 Aj Jabalain | SD09045 Um Rimta | exact | none |
| v024 | Kassala | Kassala | SD11056 Reifi Kassla | SD11053 Madeinat Kassala | variant | none |
| v047 | Settaib | West Kordofan | SD18086 As Salam - WK | SD18106 Al Meiram | fuzzy | none |
| v049 | El Fula | West Kordofan | SD18105 Al Khiwai | SD18086 As Salam - WK | variant | none |
| v073 | Talanga village | Central Darfur | SD06137 Wadi Salih | SD06112 Bendasi | settlement | Talanga (osm:node/12708546894, village) |
| v097 | As Serief IDP Camp | South Darfur | SD03162 Beliel | SD03167 Nyala Janoub | settlement | Al Serief (ocha-camps:DTM0211005, camp) |
| v098 | Al Shajara, Al Janain, Dim Jaber, Dim Suakin, Koria, Salalab, Al-Qadisiyah, Riyadh, Filip, Al-Nile, Mayo, Shaqr, Hanish, and Um AlQura neighbourhoods | Red Sea | SD10064 Port Sudan | SD10068 Sawakin | fuzzy | none |
| v106 | El Mazroub | North Kordofan | SD13026 Bara | SD13029 Gharb Bara | variant | none |
| v107 | Um Kridim | North Kordofan | SD13026 Bara | SD13029 Gharb Bara | fuzzy | none |
| v111 | Tayba | North Kordofan | SD13026 Bara | SD13023 Um Rawaba | settlement | Ţayba (geonames:378166, village) |
| v113 | Ellagori | South Kordofan | SD07098 Kadugli | SD07097 Ar Reif Ash Shargi | settlement | Lagori (osm:node/13374576835, village) |
| v117 | Eltamada | South Kordofan | SD07093 Ar Rashad | SD07090 Abassiya | settlement | Tamada (geonames:7029466, village) |
| v118 | Eltash | South Kordofan | SD07098 Kadugli | SD07097 Ar Reif Ash Shargi | settlement | At Tash (osm:node/13374539446, village) |
| v121 | Erri | South Kordofan | SD07093 Ar Rashad | SD07105 Al Leri | fuzzy | none |
| v128 | Heiban | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | exact | none |
| v137 | Kalkada | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Kalkadda (geonames:373010, village) |
| v142 | Karindi (Kauda) | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v146 | Katcha | South Kordofan | SD07098 Kadugli | SD07099 Al Buram | settlement | Katcha (osm:node/13375792112, village) |
| v148 | Kauda | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v156 | Kongo (Kauda) | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v159 | Kubang | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Kubang (geonames:7031445, village) |
| v165 | Kujur Shabia | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Kujur Shabia (osm:node/13375622951, village) |
| v166 | Kulolo | South Kordofan | SD07098 Kadugli | SD07099 Al Buram | settlement | Kulolo (osm:node/13375752273, village) |
| v167 | Kumo | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Kumo (osm:node/2575812444, village) |
| v168 | Kurtala | South Kordofan | SD07095 Dilling | SD07103 Habila - SK | fuzzy | none |
| v174 | Lugi | South Kordofan | SD07098 Kadugli | SD07091 Um Durein | settlement | Lugi (osm:node/12641040961, village) |
| v176 | Luweri (Kauda) | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v192 | Shari Ober (Kauda) | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v195 | Shawaya | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Ash Shawaia (geonames:434444, village) |
| v197 | Smoken (Kauda) | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | variant | none |
| v201 | Tarogi | South Kordofan | SD07098 Kadugli | SD07099 Al Buram | fuzzy | none |
| v202 | Taulo | South Kordofan | SD07098 Kadugli | SD07091 Um Durein | settlement | Tawlo (osm:node/13375472662, village) |
| v209 | Tuna | South Kordofan | SD07098 Kadugli | SD07099 Al Buram | settlement | Tuna (osm:node/13375795197, village) |
| v211 | Tura | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | settlement | Tura (osm:node/13375641868, village) |
| v213 | Um Burambita | South Kordofan | SD07093 Ar Rashad | SD07104 Abu Kershola | fuzzy | none |
| v214 | Um Dorain | South Kordofan | SD07098 Kadugli | SD07091 Um Durein | fuzzy | none |
| v215 | Um Drafi | South Kordofan | SD07093 Ar Rashad | SD07091 Um Durein | fuzzy | none |
| v218 | Um Hitan | South Kordofan | SD07095 Dilling | SD07107 Delami | settlement | Umm Ḩīţān (geonames:364988, village) |
| v223 | Gedail | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | fuzzy | none |
| v225 | Upper Kauda | South Kordofan | SD07093 Ar Rashad | SD07096 Heiban | fuzzy | none |
