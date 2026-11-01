# sudan-atlas

Official codes, names and boundaries for Sudan's 18 states, the Abyei PCA area and 189 localities, with a matcher that turns messy Arabic and English place names into official P-codes.

```sh
pip install sudan-atlas            # matcher and data
pip install "sudan-atlas[geo]"     # plus GeoDataFrames (geopandas)
```

```python
from sudan_atlas import match, get_states, get_localities, get_feature

match("El Hasaheesa", state_hint="Al Gezira", level=2)
# {'pcode': 'SD15034', 'name_en': 'Al Hasahisa', 'name_ar': 'الحصاحيصا', 'level': 2,
#  'score': 0.9, 'method': 'fuzzy', 'alternatives': [...]}

get_states()              # 19 dicts: pcode, name_en, name_ar, level, parent_pcode, point
get_localities("SD15")    # the localities of one state
get_feature("SD15034", "medium")   # GeoJSON Feature dict; "detailed", "medium" or "light"

from sudan_atlas import geo        # needs the [geo] extra
geo.localities("SD02")             # GeoDataFrame, EPSG:4326
```

## Matching

`match(name, state_hint=None, level=None)` tries an exact match on the official names, then a table of known spellings, then fuzzy matching. A state hint (a P-code or a state name in any spelling) limits the search to that state; `level` is 1 for states, 2 for localities.

It never guesses silently. When the best candidate scores below 0.82, or a second place scores almost as high, `pcode` is `None`, `method` is `"ambiguous"` or `"none"`, and `alternatives` lists the best three candidates for a person to choose from. `Matcher(threshold=..., margin=...)` changes those settings.

The npm package (`npm install sudan-atlas`) returns identical results.

## Licences and sources

Code: MIT. Boundaries: CC BY 3.0 IGO, from OCHA's COD-AB for Sudan (version v03); credit "OCHA (COD-AB Sudan), via HDX; Sudan Atlas". Spellings and rules: CC BY 4.0, with sources including GeoNames (CC BY 4.0) and Wikidata (CC0); town spellings from OpenStreetMap are kept in a separate file under the ODbL (© OpenStreetMap contributors). Boundaries do not imply any opinion on the legal status of any territory. Details: https://github.com/aminshennan/sudan-atlas
