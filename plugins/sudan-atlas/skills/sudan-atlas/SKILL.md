---
name: sudan-atlas
description: Match Sudanese place names written any way (Arabic or English, any spelling) to official OCHA P-codes, and look up Sudan's states and localities, their populations and boundaries, with Sudan Atlas. Use when the user works with places in Sudan, cleans or maps a spreadsheet or humanitarian dataset that names Sudanese states or localities, mentions P-codes such as SD02 or SD02114, or asks for a map of Sudan by state or locality.
license: MIT (this skill). Data: CC BY 3.0 IGO (boundaries), CC BY 4.0 (spellings), ODbL 1.0 (OpenStreetMap spellings only).
---

# Sudan Atlas

Sudan Atlas gives the official names (Arabic and English), P-codes and boundaries of Sudan's 18 states, the Abyei PCA area and 189 localities, from OCHA's COD-AB for Sudan (version v03), and matches names written any way to them.

- Website and map-maker: https://atlas-sudan.vercel.app
- MCP server: `https://atlas-sudan.vercel.app/api/mcp`
- Packages: `pip install sudan-atlas`, `npm install sudan-atlas`
- Cite: Sudan Atlas, https://doi.org/10.5281/zenodo.24191931

## Choose how to reach it

1. If the Sudan Atlas MCP tools are available (`match_place_name`, `match_place_names`, `search_places`, `get_place`, `list_places`, `get_boundary`), use them.
2. If they are not, and the user wants them, they can add the server. In Claude Code: `claude mcp add --transport http sudan-atlas https://atlas-sudan.vercel.app/api/mcp`.
3. When you are writing or running code, or the data is sensitive, use the packages instead: they run entirely on the user's machine (see "In code" below).

Names sent to the MCP server are processed on the Sudan Atlas server and not stored. Send only the place-name column (and the state, if there is one), never whole rows: humanitarian files often hold personal data. For files the user would rather keep on their device, point them to the map-maker at https://atlas-sudan.vercel.app/maker/, which works entirely in the browser.

## The rules that matter

- **Never pick a place silently.** When a result has `pcode: null`, the matcher was not confident. Show the user the `alternatives` (name, state, P-code, score) and ask, or leave the row unmatched and say so. Do not fill in the top alternative yourself.
- **Pass a state hint whenever there is one.** A state column, a state named in the file or the conversation, or a state P-code. It settles most ambiguity: many locality names repeat across states (three localities are called As Salam). The state can be any spelling or a P-code (`SD02`).
- **Pass the level when you know it**: 1 for states, 2 for localities.
- **Only states and localities can match.** Villages, towns, camps and sites have no P-code here and should come back unmatched. Say that this is expected. Never assign a camp or village to a locality unless the user asks you to and the file records that it was done.
- **Check matches for village, camp, market and site names.** A site whose name resembles a locality can still be matched to it, especially without a state hint: in an independent test, 9 of 56 such names were. When a name comes from a village, camp, market or site column, show the user any match and ask before using it.
- **"Abyei" is ambiguous**: it can mean the Abyei PCA area (SD19, administered jointly, not part of a state) or Abyei locality in West Kordofan. Ask which one.
- **Keep the user's original values.** Add columns next to them (P-code, official English name, official Arabic name, method, score); never overwrite the original names.
- **Report what happened**: how many names matched, how many need a decision, how many matched nothing, and why.

## Reading a match result

```json
{ "pcode": "SD02114", "name_en": "Al Fasher", "name_ar": "الفاشر", "level": 2,
  "score": 0.98, "method": "variant", "alternatives": [ ... ] }
```

| `method` | Meaning | What to do |
| --- | --- | --- |
| `exact` | An official name | Accept |
| `variant` | A known, reviewed spelling | Accept |
| `fuzzy` | A close spelling (typo or new spelling) | Accept; show the user a sample if there are many |
| `ambiguous` | Two places too close to call; `pcode` is null | Ask, showing the alternatives |
| `none` | Nothing close enough; `pcode` is null | Leave unmatched; it may be a village or camp |

A score is a similarity from 0 to 1, not a probability. The matcher accepts a candidate only if it scores at least 0.82 and is at least 0.05 ahead of the next place.

## Cleaning a spreadsheet column

1. Find the column with place names, and a state column if there is one. Decide the level (state or locality).
2. Collect the distinct names (with their state) and match them in one call with `match_place_names` (up to 1,000 items, each with its own `state_hint`). Match each distinct name once, not every row.
3. Sort the results into three groups: matched, needs a decision (`ambiguous`, or `none` with close alternatives), and no match.
4. Ask the user about the second group, a few at a time, showing each name with its candidates.
5. Write the result: the original columns, plus `pcode`, `name_en`, `name_ar`, `match_method`, `match_score`, and a note for anything left unmatched.

## Looking places up

- `search_places`: find states and localities by part of a name, in Arabic or English.
- `get_place`: names, parent state, localities (for a state), area in km² and estimated population for a P-code.
- `list_places`: all 19 admin-1 units (18 states and the Abyei PCA area), or the localities of the country or of one state.
- `get_boundary`: a GeoJSON Feature (EPSG:4326); `light` is enough for most maps, `medium` is more detailed.

## Populations

Populations are UNFPA and CBS Sudan COD-PS 2025 estimates for mid-2025: projections from the 2008 census, adjusted for refugees and internal displacement. They are not counts. They are least certain for Khartoum and West Darfur, and there is no figure for the Abyei PCA area. When you compute rates per 1,000 people, say that rates can mislead where many people have fled or arrived.

## Boundaries and wording

Boundaries follow OCHA's COD-AB and do not imply any opinion on the legal status of any territory. Use neutral wording for disputed and jointly administered areas (for example "the Abyei PCA area").

## In code (runs locally)

Python:

```python
from sudan_atlas import match, get_states, get_localities, get_feature

r = match("Elfasher", state_hint="North Darfur", level=2)
r["pcode"]          # 'SD02114', or None when not confident: then look at r["alternatives"]
get_localities("SD02")             # the localities of North Darfur
get_feature("SD02114", "medium")   # GeoJSON Feature
```

JavaScript or TypeScript:

```js
import { match, getStates, getLocalities, getPlace, getFeature } from "sudan-atlas";

const r = match("الفاشر", { stateHint: "SD02", level: 2 });
r.pcode;                                   // "SD02114", or null: then look at r.alternatives
const shape = await getFeature("SD02114", "medium");
```

Full documentation: https://atlas-sudan.vercel.app/docs/

## Credit

When results are published, cite Sudan Atlas (https://doi.org/10.5281/zenodo.24191931) and credit the boundaries: "OCHA (COD-AB Sudan), via HDX". If results rely heavily on OpenStreetMap spellings, add "Contains information from OpenStreetMap, available under the ODbL".
