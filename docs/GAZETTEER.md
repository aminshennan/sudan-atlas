# Gazetteer and name matcher

The gazetteer turns messy Sudanese place names into official codes. It lives in `data/gazetteer/` as JSON, so the Python and TypeScript matchers read exactly the same data.

| File | What it holds | Built by |
| --- | --- | --- |
| `places.json` | One record per state (19) and locality (189): `pcode`, `level`, `name_en`, `name_ar`, `parent_pcode`, and a `point` inside the place | `make gazetteer`, from the released boundaries |
| `variants.json` | Other spellings of a place, each with the sources it came from | `make gazetteer`, from COD-AB, geoBoundaries, GeoNames and Wikidata |
| `normalisation.json` | The rules that turn a name into a matching key | Written by hand; reviewed with the variants |
| `review.json` | Review decisions: spellings kept, rejected or added, and records linked by hand. Applied on every build, so they survive rebuilds | Review |
| `variants_osm.json` | Town names from OpenStreetMap, kept apart because they are ODbL (© OpenStreetMap contributors) | `make gazetteer`, from the HOT export on HDX |

The test set is `data/tests/match_cases.csv`; `data/tests/normalisation_cases.csv` pins down the normalisation rules for both languages.

## How a name is matched

1. **Normalise** the name with `normalisation.json`: Arabic letters unified and *al-* removed; Latin text lower-cased, accents and articles removed, common transliteration pairs unified. Generic words (*state*, *locality*, *ولاية*, *محلية*) are dropped and direction words translated (*north* → *shamal*).
2. **Exact match** on an official name's key: score 1.0, method `exact`.
3. **Variants table**: score 0.98, method `variant`.
4. **Fuzzy match**: the best of spelling, word-order, spacing, consonant-skeleton and partial-name similarity; method `fuzzy`.
5. A **state hint** limits the search to that state and its localities; a **level** limits it to states (1) or localities (2).
6. **Never guess silently.** The best candidate is returned only when it scores at least the threshold *and* beats the runner-up by the margin. Otherwise the result has no `pcode`, `method` is `ambiguous` or `none`, and the best three candidates are listed as `alternatives`.

```python
from sudan_atlas import match

match("El Hasaheesa", state_hint="Al Gezira", level=2)
# {'pcode': 'SD15034', 'name_en': 'Al Hasahisa', 'name_ar': 'الحصاحيصا', 'level': 2,
#  'score': 0.9, 'method': 'fuzzy', 'alternatives': [...]}
```

## How variants are collected

Every external record (a GeoNames feature, a Wikidata item) is linked to a P-code before its names are used:

- Within its parent state *or* near its location, the names must be similar (at least 0.80) and clearly ahead of the next place (by 0.10).
- Otherwise, anywhere in the country, the name must be near-identical (at least 0.92).
- geoBoundaries features link by position, since they repackage the same COD-AB shapes; Wikidata states link by their ISO 3166-2 codes.
- Records that do not link clearly are listed in `build/reports/variant_links.json`, never guessed. Most are former provinces and rural councils.

A variant that equals another place's official name is dropped, because it would make that name ambiguous. Town names are the exception only across levels: *Kassala* is both the state and the town in the Madeinat Kassala locality, and the level tells them apart.

## Town names

People often write the town, not the locality. Common towns are spellings of a locality: GeoNames towns with a recorded population of 10,000 or more (in `variants.json`), and OpenStreetMap places tagged city or town (in `variants_osm.json`). Each town goes to:

1. the nearby localities whose names begin with it (*Nyala* → Nyala Shimal and Nyala Janoub, so the name stays ambiguous without more information);
2. otherwise the nearby locality it is named like (a likeness of 0.80 or more, within 30 km), since a town is usually the seat of its namesake and its point can fall just over a border (*Merowe* → Merwoe, *Aroma* → Reifi Aroma; *Bulbul*, 0.75 like Beliel, is not moved);
3. otherwise nowhere, if another locality in the same state is named more like it (a likeness of 0.75 or more; *Kuma*, a town in Melit, would be mistaken for Al Koma); these are listed in `build/reports/variant_links.json`;
4. otherwise the locality containing it.

The likeness measure cannot settle every case (*Kuma* and *El Barun* score the same, but only the first is confusable), so reviewers place towns by hand in `review.json` where the rule is wrong (a town on a boundary can be shared by both localities), and reject town names that would be read as a locality in another state (*Adeila*, a town in Um Dukhun, and Adila in East Darfur). OpenStreetMap often packs several names into one tag; they are split on `;`, `,`, `،` and `/`.

A town named exactly like another locality (*Kosti* the town, whose point falls in As Salam / Ar Rawat) is dropped: the name means the locality.

## Review status

- **2026-10-31:** an independent AI agent reviewed everything: 409 spellings kept and 16 rejected, 8 unlinked records linked by hand and 25 confirmed as not current places, 8 of 9 rules agreed (dropping *area* was not, so it is no longer dropped), 291 test answers confirmed and 8 changed (`data/tests/match_cases_review.json`).
- **2026-11-01:** Amin reviewed the agent-filled review page. He decided the 17 spellings added since (15 kept, 2 rejected) and the two cases still unsure (both should match nothing), and left the agent's other decisions in place. `review.json` records who made each spelling decision.
- **2026-11-01, later:** town names were added and the UNHCR file's blank states were filled in. Four test answers changed as a result: c165 (Al Tadamon, now with its state) and c259, c264, c283 (towns that now count as their locality). A second agent review confirmed all four, which carry `verified_by = agent`. It also reviewed the 791 new spellings (734 kept, 57 rejected) and the 15 town names dropped as confusable (8 confirmed, 7 placed by hand). All spellings are now reviewed.
- **2026-11-01, final recheck:** four agents rechecked all 208 places against the boundaries, placing every town point in its locality. Every place's names and state were confirmed. Seven towns that sit on a locality boundary, or are reported in a neighbouring locality, are now shared between both localities (Abu Gomra, Gallabat, Barankwa, Kenana, and three West Darfur villages), so the matcher asks rather than guesses. Two spellings were rejected (*But*, *Almazroub*) and two added (*Bout*, and *ريفي وسط القضارف* for a Wikidata typo). Invisible direction marks and stray Arabic vowel marks are now dropped from names.
- **2026-11-01, third agent review** (asked for by Amin in place of his own re-check): the four test answers above were confirmed again, from the source rows, the boundaries, the US Census Bureau sub-locality table and the schools list. Of the towns shared in the final recheck, Kenana now links to Aj Jabalain only and Armankul to Sirba only, where every administrative source places them; Birkat Tayr and Sarafayah stay shared.

Rejections apply to each spelling-and-place pair, so a later, correct link of the same spelling to another place is not rejected with it. Rejected spellings are left out; spellings added by a rebuild have `"status": "proposed"` until reviewed. The threshold, 0.82, was agreed with Amin on 2026-11-01, together with the accuracy targets: top-1 accuracy at least 91 %, top-3 recall at least 98 %, false matches at most 1 % (`pipeline/gazetteer/evaluate.py`). See `docs/MATCHER_EVALUATION.md` for the results.
