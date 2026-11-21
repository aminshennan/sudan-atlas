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

## Results

Pending.
