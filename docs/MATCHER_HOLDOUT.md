# Independent test of the matcher

The first evaluation ([`MATCHER_EVALUATION.md`](MATCHER_EVALUATION.md)) chose the matcher's threshold on the same 299 names it then reported on, so it describes that set and is not an independent test. This test measures the matcher once, on names it has never seen, with nothing changed afterwards.

## Protocol

Written before any name was collected (2026-11-21).

**Matcher, frozen.** Package 0.1.4, combined scorer, threshold 0.82, margin 0.05, with these data files (SHA-256):

| File | SHA-256 |
| --- | --- |
| `data/gazetteer/places.json` | `29e352c3f66147361644ff1d6cf9a66fb92c9f329dd7d4f44739e87a6d5ababa` |
| `data/gazetteer/variants.json` | `c630e861aca2da697263f357afeacd870743e5b99599875518b3e2d511da28fd` |
| `data/gazetteer/variants_osm.json` | `839fec804ec30b5b15f85f7b3157ab9620dc3ee1b9b2ffdab50ce8c3b14dddfb` |
| `data/gazetteer/normalisation.json` | `1f2de9103ffe13dcec5e708c9e3c3c5734079e28ff79618869ef2745b899d4a8` |
| `packages/py/src/sudan_atlas/match.py` | `dc107e75f8e8b5c84e55956c432c3987fc4402a2991e9037bc6be5a5df815f99` |

No spelling, rule or setting is changed because of this test. Anything it reveals is fixed later and measured on a different set.

**Sources.** Public Sudan datasets on HDX that were not used by the first test set and are not a source of the matcher's spellings (COD-AB, COD-PS, geoBoundaries, GeoNames, Wikidata, OpenStreetMap). Each dataset, file and column is listed in the results. Names already in the first test set are left out.

**Sampling.** Distinct (name, state, level) entries from the state and locality columns, and from site, market or village columns for names that should match nothing. As in the first test, most cases are names that are not an official spelling, with some official spellings and some names that should match nothing; no more than 60 cases come from one dataset. The draw uses a fixed random seed. How common official spellings are in these datasets is reported separately.

**Answers.** Where a dataset gives its own P-code for a name, that P-code is the answer, unless it is plainly wrong for the name (for example, a code from a different state); such rows are reported. Every name is also answered independently twice, without seeing the matcher's answer or the dataset's P-code, and a third review settles any disagreement. The rules:

- The answer is the P-code of the state or locality the name refers to, in its dataset and with its state.
- A town counts as its locality when it is the locality's seat or namesake (*Kosti* is Kosti locality).
- Villages, camps, sites, markets and neighbourhoods that are not a locality or its namesake town should match nothing. So should a name that fits two localities equally well given its state, and text that is not a place (totals, headers).
- A name nobody can settle is marked unsure and left out; the number left out is reported.

**Measures**, at the frozen setting, with and without the dataset's state as a hint, for every case and for each dataset: right place first time (of the names that should match), right place among the top three, wrong matches (of all names), and names left for the user to decide. Every failure is listed. Results are reported whatever they are.

**Amendment, 2026-11-21, before any name was answered or matched.** The first eleven datasets held only 239 distinct state and locality names not already in the first test, and 76.2 % of them were official spellings, leaving 57 other spellings: too few to measure the harder part. So eight more datasets were added (older OCHA response, needs and outbreak tables, and FEWS NET), and site names were capped at 15 per dataset, so that one assessment's village list could not dominate them. Nothing about the answers or the matcher's output was known when this was decided.

## Summary

- **State and locality names: about as accurate as the first test suggested.** With the dataset's state as a hint, the matcher found the right place first time for 90.2 % of the 92 names that should match (95 % interval 82–95 %), against 94.9 % in the first test; the difference is within the margin of error. Only one of these 92 went to a wrong place: "Al Gedaref Rural" went to the city locality (Madeinat Al Gedaref) instead of the rural one (Wasat Al Gedaref).
- **Most misses are safe.** Seven names got no answer rather than a wrong one. Three of them come from a state hint that is wrong in the data (for example Ghibaish under North Kordofan; it is in West Kordofan): the matcher trusts the hint, so it does not look in other states. Others score just under the threshold or tie between two places, so the user is asked.
- **Site names are the weak point.** Of the 56 names that should match nothing, 9 were matched to a locality, so "no wrong matches" from the first test does not hold here:
  - 5 village and block names from an assessment that has no state column (*Dar alsalam*, *Albuhayra*, *Amara*, *Aboud*, *Aldawajin*). Without a state, they read as, or resemble, localities elsewhere.
  - 2 markets named after their town (*Ad-Damar Market*, *Ad-Damar General*) and a camp (*Mornie camp*) went to the locality they are in (Ad Damar, Kereneik). The test's rules count markets and camps as matching nothing, but many users would want this answer.
  - 1 old combined unit (*Central Jabal Mara/Golo/Rokoro*) went to Wasat Jabal Marrah.
- **What to take from it:** give the state whenever the data has one, and treat names from village, camp, market or site columns with care: the matcher is built for state and locality names and can map a site to a locality with a similar name.

## Results

Measured on 2026-11-21. **148** names from 16 datasets: **92** should match a state or locality and **56** should match nothing. 2 more were left out as unsure.

| Setting | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |
| --- | --- | --- | --- | --- | --- |
| With the dataset's state as a hint | 148 | 90.2% (82–95 %) | 94.6% (88–98 %) | 6.8% (4–12 %), 10 of 148 | 8 |
| Without a state hint | 148 | 91.3% (84–96 %) | 97.8% (92–99 %) | 9.5% (6–15 %), 14 of 148 | 6 |

Right place first time and in the top three are shares of the names that should match; wrong matches are a share of all names (a wrong place, or any place for a name that should match nothing). The range after each figure is its 95 % confidence interval (Wilson): with this many names, the true rate on similar data is likely to lie within it.

**Compared with the first test** (with state hints): right first time 90.2% here against 94.9%; top three 94.6% against 99.6%; wrong matches 6.8% against 0.0%. Without hints: 91.3% against 85.0% right first time, 9.5% against 2.3% wrong.

### By kind of name

| Kind | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |
| --- | --- | --- | --- | --- | --- |
| official spelling | 25 | 92.0% (75–98 %) | 92.0% (75–98 %) | 0.0% (0–13 %), 0 of 25 | 2 |
| other spelling | 67 | 89.6% (80–95 %) | 95.5% (88–98 %) | 1.5% (0–8 %), 1 of 67 | 6 |

Leaving out the 5 names whose answer was given with low confidence: right place first time 93.3%, top three 96.6%, wrong matches 8 of 143.

Of the 56 names that should match nothing, 9 were matched to a place.

### By dataset

| Dataset | Names | Right place first time | Right place in the top three | Wrong matches | Left for the user to decide |
| --- | --- | --- | --- | --- | --- |
| Sudan - Food for Education (FFE) Supported Schools | 16 | 80.0% (55–93 %) | 80.0% (55–93 %) | 0.0% (0–19 %), 0 of 16 | 3 |
| Sudan: 2020 HRP-Response Monitoring (4Ws) | 14 | 92.9% (69–99 %) | 100.0% (78–100 %) | 0.0% (0–22 %), 0 of 14 | 1 |
| Sudan (SDN): Attacks on Aid Operations, Education, Food and Water Systems, Health Care and IDP/Refugee Camps, and Conflict-Related or Political-Related Sexual Violence and Explosive Weapons Incident Data | 6 | 100.0% (57–100 %) | 100.0% (57–100 %) | 0.0% (0–39 %), 0 of 6 | 0 |
| Sudan 2022 Humanitarian Needs Overview (HNO) | 4 | 50.0% (15–85 %) | 75.0% (30–95 %) | 0.0% (0–49 %), 0 of 4 | 2 |
| Sudan IDP camps | 29 | 100.0% (74–100 %) | 100.0% (74–100 %) | 3.4% (1–17 %), 1 of 29 | 0 |
| Sudan - Conflict Events | 11 | 100.0% (34–100 %) | 100.0% (34–100 %) | 0.0% (0–26 %), 0 of 11 | 0 |
| Sudan - Food Prices | 18 | 94.1% (73–99 %) | 100.0% (82–100 %) | 5.6% (1–26 %), 1 of 18 | 0 |
| Sudan: Who is doing What and Where (3Ws) | 8 | 87.5% (53–98 %) | 87.5% (53–98 %) | 0.0% (0–32 %), 0 of 8 | 1 |
| Sudan Disease Outbreaks | 2 | 50.0% (9–91 %) | 100.0% (34–100 %) | 0.0% (0–66 %), 0 of 2 | 1 |
| Sudan: JIAF Humanitarian Needs and Response Plan | 11 | 100.0% (74–100 %) | 100.0% (74–100 %) | 0.0% (0–26 %), 0 of 11 | 0 |
| Sudan: 2021 HRP-Response Monitoring (4Ws) | 2 | 100.0% (34–100 %) | 100.0% (34–100 %) | 0.0% (0–66 %), 0 of 2 | 0 |
| Sudan : 2018 HRP-Response Monitoring (4Ws) | 1 | 100.0% (21–100 %) | 100.0% (21–100 %) | 0.0% (0–79 %), 0 of 1 | 0 |

### How common official spellings are

Across every distinct state and locality name in these datasets (276), 71.0% are already an official spelling, which the matcher finds exactly. The test draws mostly on the other names, as the first test did, so its figures are for the harder part of real data.

### How the answers were set

14 answers are the dataset's own P-code and 134 come from the independent review. Every name was answered twice, independently and without seeing the matcher's answer or the dataset's P-code; a third review settled disagreements.

The two answers agreed on 150 of 150 names. Where the dataset gives a P-code, the review agreed with it on 14 of 15; 1 dataset P-codes were plainly wrong and were not used.

Full agreement shows the answers are consistent, not that they are certainly right: both reviews drew on the same kind of knowledge and could share a mistake. The answers, each with its reason, are in `data/tests/holdout_cases.csv`, so any of them can be checked and challenged.

### Sources

| Dataset | Publisher | File | Columns | Names in the test |
| --- | --- | --- | --- | --- |
| [Sudan - Food for Education (FFE) Supported Schools](https://data.humdata.org/dataset/food-for-education-ffe-supported-schools-sudan) | OCHA Sudan | `ffe-consolidated-sudan-schools.xls` | Locality, State | 16 |
| [Sudan: 2020 HRP-Response Monitoring (4Ws)](https://data.humdata.org/dataset/sudan-2020-hrp-response-monitoring-4ws-quarter-1) | OCHA Sudan | `2020-HRP-Sectors-Response-Jan-Dec-HXLV2.xlsx` | LOCALITY | 14 |
| [Sudan (SDN): Attacks on Aid Operations, Education, Food and Water Systems, Health Care and IDP/Refugee Camps, and Conflict-Related or Political-Related Sexual Violence and Explosive Weapons Incident Data](https://data.humdata.org/dataset/sudan-violence-against-civilians-and-vital-civilian-facilities) | Insecurity Insight | `2016-2026-sdn-attacks-on-health-care-incident-data.xlsx` | Admin 1 | 6 |
| [Sudan: 2019 Humanitarian Needs Overview](https://data.humdata.org/dataset/sudan-humanitarianneeds-overview) | OCHA Sudan | `hno-2019-baseline-data-hxl.xlsx` | LOCALITY | 3 |
| [Sudan 2022 Humanitarian Needs Overview (HNO)](https://data.humdata.org/dataset/sudan-2022-humanitarian-needs-overview-hno) | OCHA Sudan | `SDN HNO 2022 V1.0.xlsx` | Locality | 4 |
| [Sudan IDP camps](https://data.humdata.org/dataset/sudan-idp-camps) | OCHA Sudan | `sudan_idp_camps.xlsx` | Locality, Locality1, Locality2, Locality3, Location, Location Arabic | 29 |
| [Sudan - Conflict Events](https://data.humdata.org/dataset/sudan-acled-conflict-data) | Armed Conflict Location & Event Data Project (ACLED) | `sudan_hrp_political_violence_events_and_fatalities_by_month-year_as-of-18nov2026.xlsx` | Admin1, Admin2 | 11 |
| [Sudan - Subnational Displacement Forecasts](https://data.humdata.org/dataset/sudan-subnational-displacement-forecasts) | Danish Refugee Council | `sudan-displacement-forecasts-nov26-jan27.xlsx` | state | 4 |
| [Sudan - Food Prices](https://data.humdata.org/dataset/wfp-food-prices-for-sudan) | WFP - World Food Programme | `wfp_food_prices_sdn.csv` | admin1, admin2, market | 18 |
| [Sudan: Who is doing What and Where (3Ws)](https://data.humdata.org/dataset/sudan-who-is-doing-what-and-where-3ws) | OCHA Sudan | `SDN 2022 3Ws-Jul-2022.xlsx` | Locality | 8 |
| [Sudan Disease Outbreaks](https://data.humdata.org/dataset/sudan-disease-outbreaks-2019) | OCHA Sudan | `Sudan Disease Outbreaks 2019.xlsx` | localities, locality | 2 |
| [Sudan: JIAF Humanitarian Needs and Response Plan](https://data.humdata.org/dataset/sdn-jiaf-humanitarian-needs-pin-and-severity) | OCHA Sudan | `sdn-caseload-dissaggregation-by-cluster.xlsx` | Admin 2 | 11 |
| [Sudan: 2021 HRP-Response Monitoring (4Ws)](https://data.humdata.org/dataset/sudan-2021-hrp-response-monitoring-4ws) | OCHA Sudan | `2021-hrp-sectors-response-jan-dec.xlsx` | LOCALITY, STATE | 2 |
| [Sudan : 2018 HRP-Response Monitoring (4Ws)](https://data.humdata.org/dataset/sudan-2018-hrp-response-monitoring-4ws) | OCHA Sudan | `sudan-people-reached-by-state-jan-dec-2018_hrp.xlsx` | State | 1 |
| [Sudan: Market Prices in River Nile State](https://data.humdata.org/dataset/sudan-market-prices-river-nile-state) | Food and Agriculture Organization (FAO) of the United Nations | `ad-damar01.csv` | market | 4 |
| [Sudan: Health and Nutrition Assessment](https://data.humdata.org/dataset/sudan_wadi-halfa-and-abri-localities_-northern-state_sudan-health-nutrition-assessment_feb2024) | Sudanese American Physicians Association | `sapa-assessment_wadihalfa_health-and-nutrition_feb2024.xlsx` | Administrative Unit, Administrative Unit (AU), Facility | 15 |
Not used: FEWS NET (`sdn-acute-food-insecurity-classification-historical`), because its files are hosted on fdw.fews.net, which could not be reached from the test environment.

### Every failure, with state hints

false match (should match nothing): 9, no answer: 7, wrong place: 1, ambiguous (no answer): 1

| Case | Name | State hint | Expected | Got | Kind | Why | Best candidates |
| --- | --- | --- | --- | --- | --- | --- | --- |
| h006 | El Selam | South Kordofan | SD18086 As Salam - WK | none | no answer | the right place is not among the candidates: the name (often a town) is not in the gazetteer | Delami 0.73; Abu Jubayhah 0.55; Abassiya 0.40 |
| h009 | Atbara River | Kassala | SD11062 Reifi Nahr Atbara | none | no answer | right place ranked first, but its score 0.70 is below the threshold | Reifi Nahr Atbara 0.70; Reifi Shamal Ad Delta 0.56; Reifi Aroma 0.55 |
| h030 | Siteet | Kassala | SD11061 Reifi Wad Elhilaiw | none | no answer | Reifi Telkok scores higher (0.38) than the right place (0.14) | Reifi Telkok 0.38; Reifi Shamal Ad Delta 0.35; Reifi Hamashkureib 0.35 |
| h046 | Al Gedaref Rural | Gedaref | SD12081 Wasat Al Gedaref | SD12080 Madeinat Al Gedaref | wrong place | Madeinat Al Gedaref scores higher (0.90) than the right place (0.69) | Madeinat Al Gedaref 0.90; Wasat Al Gedaref 0.69; Al Qureisha 0.55 |
| h052 | Mornie camp | West Darfur | none | SD04125 Kereneik | false match (should match nothing) | resembles Kereneik closely enough to pass the threshold; it is not that place | Kereneik 0.90; Beida 0.51; Foro Baranga 0.51 |
| h054 | Sharg Jabel Marra(E JM) | South Darfur | SD03147 Sharg Aj Jabal | none | no answer | right place ranked first, but its score 0.81 is below the threshold | Sharg Aj Jabal 0.81; Tulus 0.59; As Salam - SD 0.51 |
| h057 | Central Jabal Mara/Golo/Rokoro | Central Darfur | none | SD06139 Wasat Jabal Marrah | false match (should match nothing) | resembles Wasat Jabal Marrah closely enough to pass the threshold; it is not that place | Wasat Jabal Marrah 0.97; Shamal Jabal Marrah 0.87; Gharb Jabal Marrah 0.73 |
| h071 | Refy Kassala | Kassala | SD11056 Reifi Kassla | none | ambiguous (no answer) | right place ties with Madeinat Kassala (0.90), so the matcher does not choose | Madeinat Kassala 0.90; Reifi Kassla 0.90; Reifi Gharb Kassala 0.81 |
| h072 | Ghibaish | North Kordofan | SD18021 Ghubaish | none | no answer | the right place is not among the candidates: the name (often a town) is not in the gazetteer | Gebrat Al Sheikh 0.60; Gharb Bara 0.47; Sheikan 0.46 |
| h095 | Sharg Aj Jabal | Central Darfur | SD03147 Sharg Aj Jabal | none | no answer | the right place is not among the candidates: the name (often a town) is not in the gazetteer | Gharb Jabal Marrah 0.67; Shamal Jabal Marrah 0.64; Wasat Jabal Marrah 0.59 |
| h102 | Bahr El Arab | North Darfur | SD05160 Bahr Al Arab | none | no answer | the right place is not among the candidates: the name (often a town) is not in the gazetteer | Saraf Omra 0.59; Dar As Salam 0.56; Al Malha 0.53 |
| h107 | Albuhayra |  | none | SD16014 Al Buhaira | false match (should match nothing) | resembles Al Buhaira closely enough to pass the threshold; it is not that place | Al Buhaira 1.00; Bahri 0.90; Abu Jabrah 0.75 |
| h109 | Dar alsalam |  | none | SD02113 Dar As Salam | false match (should match nothing) | resembles Dar As Salam closely enough to pass the threshold; it is not that place | Dar As Salam 1.00; As Salam - SD 0.90; As Salam / Ar Rawat 0.90 |
| h110 | Aboud |  | none | SD16013 Barbar | false match (should match nothing) | resembles Barbar closely enough to pass the threshold; it is not that place | Barbar 0.90; Rehaid Albirdi 0.67; Buram 0.67 |
| h120 | Aldawajin |  | none | SD05142 Ad Du'ayn | false match (should match nothing) | resembles Ad Du'ayn closely enough to pass the threshold; it is not that place | Ad Du'ayn 0.83; Ed Damazine 0.71; Sawakin 0.71 |
| h121 | Amara |  | none | SD13024 Sheikan | false match (should match nothing) | resembles Sheikan closely enough to pass the threshold; it is not that place | Sheikan 0.98; Beida 0.80; Ad Dali 0.80 |
| h122 | Ad-Damar Market | River- Nile  State | none | SD16011 Ad Damar | false match (should match nothing) | resembles Ad Damar closely enough to pass the threshold; it is not that place | Ad Damar 0.90; Atbara 0.64; Al Matama 0.47 |
| h124 | Ad-Damar General | River- Nile  State | none | SD16011 Ad Damar | false match (should match nothing) | resembles Ad Damar closely enough to pass the threshold; it is not that place | Ad Damar 0.90; Atbara 0.50; Al Matama 0.44 |
