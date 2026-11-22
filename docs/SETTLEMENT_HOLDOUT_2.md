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

## Summary

- **The close-spelling step failed the rule set in advance and has been removed.** On the 213 names where it changed the answer, it gave 60 right localities, 48 wrong ones, and asked about 105. Most of its mistakes came from comparing consonants only: "Dreige" and "Dorgoaga" both reduce to d-r-g, and so score 0.9. The packages keep exact village names only, which is the third row of the results table below.
- **Exact village names, with the larger village data, are a large gain.** With the state as a hint, the matcher as released now gives the right locality for 45.8 % of the 800 names (95 % range 42–49 %), against 10.0 % without village matching. Wrong answers barely change: 4.4 % (35 names) against 4.2 % (34). It asks about 5.2 % and finds nothing for 44.6 %.
- **A village found by its exact name is nearly always in the right locality:** 295 of 304 (97 %). Most of the 35 wrong answers come from the ordinary locality matcher, not from the villages: 26 are site names that resemble a locality name ("Saraf Omra", "Rashad", "Dordeab"). The first tests found the same weakness.
- **Results differ a lot by source.**
  - Darfur villages list: 236 of 300 right and 5 wrong. Its state hint comes from each village's own point (see the protocol), and some of its villages may since have been copied into the sources of the village data.
  - WFP nutrition sites: 124 of 399 right and 26 wrong. Many are named after a town or a locality, and a few have a point in a different state from the one their row gives.
  - WFP SAFE villages: 6 of 101 right and 4 wrong. Most of its spellings are not in any of the village sources.
- **Without a state hint, village names are riskier:** with villages on, 11.0 % of the names went to a wrong locality. Give the state whenever the data has it.

The tables below are as measured, with the close-spelling step still in place. The rows "Exact village names only" and "Villages off" describe the packages as they are now.

## Results

Measured once on **800** village and site names (300 from darfur-damaged-and-destroyed-villages, 399 from wfp-nitrition-sites-sudan, 101 from wfp-safe-initiative-assisted-villages). Rows left out under the protocol: 37 no readable coordinates; 6320 no name; 140 name in an earlier test; 95 repeat of a name in the same locality; 5 point outside Sudan's localities.

| Setting | Right locality | Wrong locality | Asked | Not found |
| --- | --- | --- | --- | --- |
| Villages on, state as a hint | 53.2% (50–57 %), 426 | 10.4% (8–13 %), 83 | 18.4% (16–21 %), 147 | 18.0% (15–21 %), 144 |
| Villages on, no state hint | 37.0% (34–40 %), 296 | 11.0% (9–13 %), 88 | 17.1% (15–20 %), 137 | 34.9% (32–38 %), 279 |
| Exact village names only, state as a hint | 45.8% (42–49 %), 366 | 4.4% (3–6 %), 35 | 5.2% (4–7 %), 42 | 44.6% (41–48 %), 357 |
| Villages off, state as a hint | 10.0% (8–12 %), 80 | 4.2% (3–6 %), 34 | 0.2% (0–1 %), 2 | 85.5% (83–88 %), 684 |

Each cell: share of the names, its 95 % confidence interval (Wilson), and the count.

### The close-spelling step

It changed the answer for 213 names: 60 right localities, 48 wrong, 105 asked about. The rule set in advance keeps the step only if it gives at least three right localities for each wrong one: **not kept**.

### How the matcher answered (villages on, state as a hint)

| Answered by | Names | Right locality | Wrong locality |
| --- | --- | --- | --- |
| settlement | 412 | 355 | 57 |
| ambiguous | 147 | 0 | 0 |
| none | 144 | 0 | 0 |
| fuzzy | 56 | 39 | 17 |
| variant | 23 | 19 | 4 |
| exact | 18 | 13 | 5 |

### By source (villages on, state as a hint)

| Source | Names | Right locality | Wrong locality | Asked | Not found |
| --- | --- | --- | --- | --- | --- |
| darfur-damaged-and-destroyed-villages | 300 | 242 | 6 | 48 | 4 |
| wfp-nitrition-sites-sudan | 399 | 170 | 51 | 72 | 106 |
| wfp-safe-initiative-assisted-villages | 101 | 14 | 26 | 27 | 34 |

### Every wrong locality (villages on, state as a hint)

| Case | Name | State | Locality of its point | Matcher's locality | Answered by | Score | Settlement found |
| --- | --- | --- | --- | --- | --- | --- | --- |
| w012 | UM DEREISA | North Darfur | SD02113 Dar As Salam | SD02119 At Tawisha | settlement | 1.0 | Umm Dereisa (geonames:365177, village) |
| w136 | ABU GARADIL | South Darfur | SD03158 Rehaid Albirdi | SD03161 Buram | fuzzy | 0.8308 | none |
| w147 | UMM BALULA | South Darfur | SD03161 Buram | SD03162 Beliel | fuzzy | 0.9 | none |
| w153 | KUMBILAH (NORTH) | South Darfur | SD03162 Beliel | SD03164 Nyala Shimal | fuzzy | 0.873 | none |
| w177 | ARMANKUL | West Darfur | SD04115 Ag Geneina | SD04134 Sirba | variant | 0.98 | none |
| w211 | UMM SHEREINA | West Darfur | SD04125 Kereneik | SD04134 Sirba | settlement | 0.9 | Um Sharina (ocha-settlements:SD04134068, village) |
| w302 | Khoromer | East Darfur | SD02113 Dar As Salam | SD05142 Ad Du'ayn | settlement | 1.0 | Khor Omer Camp (ocha-settlements:SD05142012, village) |
| w312 | Sarafya | North Darfur | SD02114 Al Fasher | SD02118 As Serief | fuzzy | 0.9 | none |
| w337 | Saraf Omra | North Darfur | SD02118 As Serief | SD02133 Saraf Omra | exact | 1.0 | none |
| w366 | Ba'ashim/Tina | North Darfur | SD02128 Kutum | SD02171 At Tina | exact | 0.97 | none |
| w374 | Deesa | North Darfur | SD02128 Kutum | SD02114 Al Fasher | settlement | 0.8571 | Esa (osm:node/7649699826, village) |
| w392 | Mustariha | North Darfur | SD02128 Kutum | SD02124 Kebkabiya | fuzzy | 0.9 | none |
| w401 | Al janubi | North Darfur | SD02129 Melit | SD02114 Al Fasher | settlement | 0.9 | Ganbu (ocha-settlements:SD02114058, village) |
| w405 | Elneem | East Darfur | SD02129 Melit | SD05163 Assalaya | settlement | 1.0 | El Neem (ocha-camps:DTM0401006, camp) |
| w407 | Hareiga | North Darfur | SD02129 Melit | SD02117 Al Malha | fuzzy | 0.8571 | none |
| w416 | Gara Zawia | North Darfur | SD02133 Saraf Omra | SD02118 As Serief | settlement | 0.9 | Garrah Za (ocha-settlements:SD02118009, village) |
| w427 | Muzbat | North Darfur | SD02168 Kernoi | SD02120 Um Baru | settlement | 1.0 | Muzbat (ocha-settlements:SD02120031, town) |
| w442 | Abou Odam | South Darfur | SD03151 Nitega | SD03162 Beliel | settlement | 0.9 | Abo Odam (ocha-settlements:SD03162006, village) |
| w443 | Fasha | South Darfur | SD03151 Nitega | SD03162 Beliel | settlement | 1.0 | Fasha (osm:node/8603300478, village) |
| w449 | Jokhana | South Darfur | SD03161 Buram | SD03153 Gereida | fuzzy | 0.9 | none |
| w450 | Dreige | South Darfur | SD03162 Beliel | SD03147 Sharg Aj Jabal | settlement | 0.9 | Dorgoaga (ocha-settlements:SD03147029, village) |
| w452 | Dreige | South Darfur | SD03164 Nyala Shimal | SD03147 Sharg Aj Jabal | settlement | 0.9 | Dorgoaga (ocha-settlements:SD03147029, village) |
| w469 | Armankol | West Darfur | SD04115 Ag Geneina | SD04134 Sirba | fuzzy | 0.9 | none |
| w499 | Dar aslam | East Darfur | SD05139 Adila | SD05155 Abu Karinka | settlement | 0.8889 | Dar Es Salaam (ocha-settlements:SD05155008, village) |
| w504 | Um Alkhirat | South Darfur | SD05148 Shia'ria | SD03153 Gereida | settlement | 0.9474 | Umm El Khairat (ocha-settlements:SD03153083, village) |
| w506 | Wadjado | East Darfur | SD05155 Abu Karinka | SD05139 Adila | settlement | 0.8 | Waid Joda (ocha-settlements:SD05139033, village) |
| w511 | Labadu | South Darfur | SD05165 Yassin | SD03161 Buram | settlement | 1.0 | Labadu (ocha-settlements:SD03161035, village) |
| w535 | Rashad | South Kordofan | SD07090 Abassiya | SD07093 Ar Rashad | exact | 1.0 | none |
| w536 | Kabbos | South Kordofan | SD07103 Habila - SK | SD07093 Ar Rashad | settlement | 0.9 | Kabūs (geonames:373181, village) |
| w537 | Kalugi/H.Eldoum | South Kordofan | SD07103 Habila - SK | SD07108 Ghadeer | fuzzy | 0.873 | none |
| w539 | Wakara | South Kordofan | SD07103 Habila - SK | SD07106 At Tadamon - SK | variant | 0.98 | none |
| w541 | Elsahal | South Kordofan | SD07104 Abu Kershola | SD07088 Abu Jubayhah | settlement | 1.0 | As Sahal (geonames:7031653, village) |
| w542 | Abu Gebeha | South Kordofan | SD07106 At Tadamon - SK | SD07088 Abu Jubayhah | fuzzy | 0.9 | none |
| w544 | Al janubi | North Darfur | SD07106 At Tadamon - SK | SD02114 Al Fasher | settlement | 0.9 | Ganbu (ocha-settlements:SD02114058, village) |
| w546 | Eldebibat | South Kordofan | SD07106 At Tadamon - SK | SD07094 Al Quoz | settlement | 0.9333 | Dibebad (osm:node/2082551810, town) |
| w579 | Dordeab | Red Sea | SD10065 Tawkar | SD10063 Dordieb | fuzzy | 0.9 | none |
| w580 | Korait | Red Sea | SD10065 Tawkar | SD10072 Agig | settlement | 0.9 | Koret (ocha-settlements:SD10072031, village) |
| w594 | Althmara | Red Sea | SD10068 Sawakin | SD10071 Sinkat | settlement | 0.9 | T'omare (ocha-settlements:SD10071039, village) |
| w595 | Ashat | Red Sea | SD10068 Sawakin | SD10065 Tawkar | settlement | 0.9 | Hillat Ashat (geonames:6968975, village) |
| w596 | Halgeet | Red Sea | SD10068 Sawakin | SD10069 Al Ganab | settlement | 0.8333 | Hamlet (osm:node/4227803408, hamlet) |
| w600 | Aguamt | Red Sea | SD10069 Al Ganab | SD10072 Agig | settlement | 0.9 | Agamateit (ocha-settlements:SD10072005, village) |
| w620 | ayiat * | Red Sea | SD10070 Haya | SD10066 Hala'ib | settlement | 0.8571 | Eit (ocha-settlements:SD10066076, village) |
| w627 | Haleet | Red Sea | SD10071 Sinkat | SD10069 Al Ganab | settlement | 0.9091 | Hamlet (osm:node/4227803408, hamlet) |
| w644 | Alsawra | Kassala | SD11053 Madeinat Kassala | SD11058 Reifi Hamashkureib | settlement | 0.8333 | Sawarat (ocha-settlements:SD11058011, village) |
| w675 | Tahjer | Kassala | SD11059 Reifi Telkok | SD11055 Reifi Aroma | settlement | 0.9 | Tehagar (ocha-settlements:SD11055037, village) |
| w677 | Elsiragia | South Kordofan | SD13030 Ar Rahad | SD07088 Abu Jubayhah | settlement | 0.9333 | Saragia (geonames:367617, village) |
| w679 | Tajmalla | South Kordofan | SD13030 Ar Rahad | SD07093 Ar Rashad | variant | 0.98 | none |
| w681 | Tandik | South Kordofan | SD18028 Abu Zabad | SD07093 Ar Rashad | settlement | 1.0 | Kāndik (geonames:366423, village) |
| w682 | Dilling town | South Kordofan | SD18086 As Salam - WK | SD07095 Dilling | exact | 1.0 | none |
| w683 | Elfarshaya | South Kordofan | SD18086 As Salam - WK | SD07095 Dilling | variant | 0.98 | none |
| w684 | Gadeer | South Kordofan | SD18086 As Salam - WK | SD07108 Ghadeer | fuzzy | 0.9091 | none |
| w690 | Al Tarter | South Kordofan | SD18092 As Sunut | SD07106 At Tadamon - SK | fuzzy | 0.9 | none |
| w691 | Balola | South Kordofan | SD18092 As Sunut | SD07106 At Tadamon - SK | settlement | 0.8333 | Balūla (geonames:6976999, village) |
| w693 | Umajaja | North Darfur | SD18100 Babanusa | SD02129 Melit | settlement | 1.0 | Umajaja (ocha-settlements:SD02129226, village) |
| w694 | Abbassiya | South Kordofan | SD18102 Al Lagowa | SD07090 Abassiya | exact | 1.0 | none |
| w698 | Kegga Teamerow | South Kordofan | SD18102 Al Lagowa | SD07097 Ar Reif Ash Shargi | settlement | 0.9 | Kēgā Timēro (geonames:434471, village) |
| w699 | Tabasa | South Kordofan | SD18102 Al Lagowa | SD07090 Abassiya | fuzzy | 0.9091 | none |
| w700 | Al sreef | North Darfur | SD02114 Al Fasher | SD02118 As Serief | fuzzy | 0.9 | none |
| w708 | Sarafya | North Darfur | SD02114 Al Fasher | SD02118 As Serief | fuzzy | 0.9 | none |
| w716 | salogy | North Darfur | SD02114 Al Fasher | SD02113 Dar As Salam | settlement | 0.9 | Salogi (ocha-settlements:SD02113082, village) |
| w717 | sarafiya | North Darfur | SD02114 Al Fasher | SD02118 As Serief | fuzzy | 0.9 | none |
| w724 | Dely Eregat | North Darfur | SD02124 Kebkabiya | SD02114 Al Fasher | settlement | 0.9 | Eregat (ocha-settlements:SD02114049, village) |
| w732 | El Shaheed | North Darfur | SD02124 Kebkabiya | SD02113 Dar As Salam | settlement | 0.9 | Shadad (ocha-settlements:SD02113086, village) |
| w742 | Ora Villages | North Darfur | SD02124 Kebkabiya | SD02114 Al Fasher | settlement | 0.8571 | Tora (ocha-settlements:SD02114168, village) |
| w749 | Frok | North Darfur | SD02128 Kutum | SD02124 Kebkabiya | settlement | 0.9 | Farik (ocha-settlements:SD02124041, village) |
| w759 | Barbojat | North Darfur | SD02170 Tawila | SD02114 Al Fasher | settlement | 0.8 | Barboya (osm:node/7123372709, village) |
| w764 | Fata barno camp | North Darfur | SD04121 Foro Baranga | SD02128 Kutum | settlement | 0.9 | Fata Borno (Barno) (ocha-camps:DTM0104041, camp) |
| w765 | Ajiro | North Darfur | SD06132 Shamal Jabal Marrah | SD02114 Al Fasher | settlement | 0.9 | Aguri (osm:node/9611198944, hamlet) |
| w766 | Aramba tama | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Aramba (geonames:7750205, village) |
| w767 | Arba Buiet | North Darfur | SD06132 Shamal Jabal Marrah | SD02120 Um Baru | settlement | 0.8308 | Arban Bute (osm:node/9008327146, hamlet) |
| w769 | Beni Mansoor | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.8421 | Banimanso (ocha-settlements:SD02124014, village) |
| w773 | Geldama Ajab el dor | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w774 | Geldama Hilelat | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w775 | Geldama Um Huzara | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w776 | Geldama giger | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w777 | Geldama ruhal | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w778 | Geldama sinjaw | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w779 | Geldama un sayala | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Geldama (osm:node/2470834934, village) |
| w786 | Jawarie | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.8333 | Jaure (ocha-settlements:SD02124053, village) |
| w789 | Morlong | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9231 | Morlon (ocha-settlements:SD02124077, village) |
| w790 | Sanabeel | North Darfur | SD06132 Shamal Jabal Marrah | SD02124 Kebkabiya | settlement | 0.9 | Sanabil (ocha-settlements:SD02124087, village) |
| w796 | Um loata | North Darfur | SD06132 Shamal Jabal Marrah | SD02114 Al Fasher | settlement | 1.0 | Um Loata (osm:node/13359180166, village) |
| w798 | Ustaabdok | North Darfur | SD13025 Soudari | SD02114 Al Fasher | settlement | 0.8421 | Ustei Abu Dok (osm:node/7123372797, village) |
