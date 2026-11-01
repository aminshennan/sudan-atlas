# Gazetteer and name matcher

The gazetteer turns messy Sudanese place names into official codes. It lives in `data/gazetteer/` as JSON, so the Python and TypeScript matchers read exactly the same data.

| File | What it holds | Built by |
| --- | --- | --- |
| `places.json` | One record per state (19) and locality (189): `pcode`, `level`, `name_en`, `name_ar`, `parent_pcode`, and a `point` inside the place | `make gazetteer`, from the released boundaries |
| `variants.json` | Other spellings of a place, each with the sources it came from | `make gazetteer`, from COD-AB, geoBoundaries, GeoNames and Wikidata |
| `normalisation.json` | The rules that turn a name into a matching key | Written by hand; reviewed with the variants |
| `review.json` | Review decisions: spellings kept or rejected, and records linked by hand. Applied on every build, so they survive rebuilds | Review |
| `variants_osm.json` | OpenStreetMap spellings, kept apart because they are ODbL | Not built yet |

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
#  'score': 0.875, 'method': 'fuzzy', 'alternatives': [...]}
```

## How variants are collected

Every external record (a GeoNames feature, a Wikidata item) is linked to a P-code before its names are used:

- Within its parent state *or* near its location, the names must be similar (at least 0.80) and clearly ahead of the next place (by 0.10).
- Otherwise, anywhere in the country, the name must be near-identical (at least 0.92).
- geoBoundaries features link by position, since they repackage the same COD-AB shapes; Wikidata states link by their ISO 3166-2 codes.
- Records that do not link clearly are listed in `build/reports/variant_links.json`, never guessed. Most are former provinces and rural councils.

A variant that equals another place's official name is dropped, because it would make that name ambiguous. Town names are the exception: *Kassala* is both the state and the town in the Madeinat Kassala locality, and the level tells them apart.

## Review status

- **2026-10-31:** an independent AI agent reviewed everything: 409 spellings kept and 16 rejected, 8 unlinked records linked by hand and 25 confirmed as not current places, 8 of 9 rules agreed (dropping *area* was not, so it is no longer dropped), 291 test answers confirmed and 8 changed (`data/tests/match_cases_review.json`).
- **2026-11-01:** Amin reviewed the agent-filled review page. He decided the 17 spellings added since (15 kept, 2 rejected) and the two cases still unsure (both should match nothing), and left the agent's other decisions in place. All test labels now carry `verified_by = amin`; `review.json` records who made each spelling decision.

Rejected spellings are left out of `variants.json`; spellings added by a later rebuild have `"status": "proposed"` until reviewed. The threshold is fixed with Amin; see `docs/MATCHER_EVALUATION.md` for the latest results.
