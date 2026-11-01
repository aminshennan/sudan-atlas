# sudan-atlas

Official codes, names and boundaries for Sudan's 18 states, the Abyei PCA area and 189 localities, with a matcher that turns messy Arabic and English place names into official P-codes.

```sh
npm install sudan-atlas
```

```js
import { match, getStates, getLocalities, getFeature } from "sudan-atlas";

match("El Hasaheesa", { stateHint: "Al Gezira", level: 2 });
// { pcode: "SD15034", name_en: "Al Hasahisa", name_ar: "الحصاحيصا", level: 2,
//   score: 0.9, method: "fuzzy", alternatives: [...] }

getStates();               // 19 records: pcode, name_en, name_ar, level, parent_pcode, point
getLocalities("SD15");     // the localities of one state
await getFeature("SD15034", "medium");  // GeoJSON Feature; "detailed", "medium" or "light"
```

In a browser with no build step:

```html
<script type="module">
  import { match } from "https://cdn.jsdelivr.net/npm/sudan-atlas@0.1.0/dist/index.js";
</script>
```

## Matching

`match(name, { stateHint, level })` tries an exact match on the official names, then a table of known spellings, then fuzzy matching. A state hint (a P-code or a state name in any spelling) limits the search to that state; `level` is 1 for states, 2 for localities.

It never guesses silently. When the best candidate scores below 0.82, or a second place scores almost as high, `pcode` is `null`, `method` is `"ambiguous"` or `"none"`, and `alternatives` lists the best three candidates for a person to choose from. `new Matcher(undefined, { threshold, margin })` changes those settings.

The Python package (`pip install sudan-atlas`) returns identical results.

## Boundaries

`getFeature` loads boundary files only when first asked. In Node it reads them from this package; in a browser it fetches them from jsDelivr. To serve them yourself, copy the package's `data/` folder and call `setDataUrl("/static/sudan-atlas/")`. The raw files are also at `https://cdn.jsdelivr.net/npm/sudan-atlas@0.1.0/data/boundaries/{detailed|medium|light}/adm{1|2}.{geojson|topojson}`.

## Licences and sources

Code: MIT. Boundaries: CC BY 3.0 IGO, from OCHA's COD-AB for Sudan (version v03); credit "OCHA (COD-AB Sudan), via HDX; Sudan Atlas". Spellings and rules: CC BY 4.0, with sources including GeoNames (CC BY 4.0) and Wikidata (CC0); town spellings from OpenStreetMap are kept in a separate file under the ODbL (© OpenStreetMap contributors). Boundaries do not imply any opinion on the legal status of any territory. Details: https://github.com/aminshennan/sudan-atlas
