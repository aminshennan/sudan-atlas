# Sudan maps in Power BI

Files for Power BI's **Shape map** visual, so a report can colour Sudan's states or localities by any value.

| File | What it is |
| --- | --- |
| `sudan_states.topojson` | The 19 admin-1 units (18 states and the Abyei PCA area), 16 KB |
| `sudan_localities.topojson` | The 189 localities, 71 KB |
| `sudan_places.csv` | A lookup table: every place's P-code, level, English and Arabic name, and its state |

Each shape carries `pcode`, `name_en` and `name_ar` (localities also carry `parent_pcode`). Join your data on **`pcode`**: names have too many spellings to be a reliable key. If your data has names but no codes, match them first with the Sudan Atlas map-maker or packages, which add a `pcode` column.

The boundaries are from OCHA's COD-AB for Sudan (version v03), drawn at medium resolution. Licence: CC BY 3.0 IGO. Credit "OCHA (COD-AB Sudan), via HDX; Sudan Atlas" in the report. Boundaries do not imply any opinion on the legal status of any territory; see [`docs/DATA_POLICY.md`](../docs/DATA_POLICY.md).

## Quick start

1. In Power BI Desktop, add a **Shape map** visual. If it is not in the Visualizations pane, turn it on under **File → Options and settings → Options → Preview features → Shape map visual**, then restart Power BI.
2. Drag your P-code column to **Location** and your value to **Color saturation**.
3. In the visual's format pane, open **Map settings**, set **Map type** to **Custom map**, and choose **Add map type** to load `sudan_states.topojson` or `sudan_localities.topojson`.

Menu names move between Power BI versions; if a step does not match, look for the same setting in the Shape map's format pane.

## Building the template report (`sudan-atlas-template.pbix`)

The template shows both levels from one table, so a user can replace the sample values with their own.

### 1. Load the places table

1. **Home → Get data → Text/CSV**, choose `sudan_places.csv`, and check that the Arabic columns preview correctly (the file is UTF-8). Choose **Load**.
2. In the Data view, set `pcode`, `state_pcode` and the name columns to **Text**, and `level` to **Whole number**.

### 2. Add sample values

The template needs a value to colour by. Add a column that is clearly a placeholder, so nobody mistakes it for real data:

1. **Modeling → New column**: `Sample value = MOD(VALUE(RIGHT([pcode], 2)) * 37, 100)`
2. Rename the table to `Places`.

Users replace this with a relationship from their own table on `pcode` (step 5).

### 3. States map

1. Add a **Shape map** visual. Load `sudan_states.topojson` as its custom map (Quick start, step 3).
2. Drag `Places[pcode]` to **Location** and `Places[Sample value]` to **Color saturation**.
3. Add a visual-level filter: `Places[level]` is `1`.
4. In **Map settings → Map keys**, check that the keys listed are P-codes such as `SD01`. If Power BI shows a different property, pick `pcode`.
5. Set the title to "States" and add `name_en` and `name_ar` to **Tooltips**.

### 4. Localities map

1. Copy the states map (Ctrl+C, Ctrl+V).
2. Change its custom map to `sudan_localities.topojson`.
3. Change the filter to `Places[level]` is `2`.
4. Add a slicer on `Places[state_name_en]` (or `state_name_ar`) so a user can show one state's localities.
5. Set the title to "Localities".

### 5. Using your own data

1. Load your table. It needs a P-code column at the level you want to map.
2. **Model view**: drag your P-code column onto `Places[pcode]` to create a many-to-one relationship.
3. Put your value on **Color saturation** in place of `Sample value`.

### 6. Check before saving

- [ ] Every one of the 19 states is coloured on the states map, including Abyei PCA, Halaib in Red Sea State, and the Wadi Halfa salient north of 22°N.
- [ ] Choosing a state in the slicer shows only its localities, and none is grey.
- [ ] Hovering a shape shows its English and Arabic names, and the Arabic reads right to left.
- [ ] The report credits OCHA (COD-AB Sudan) and Sudan Atlas.

Save as `powerbi/sudan-atlas-template.pbix`.

## Regenerating these files

From the repository root, after a new boundary release: `python -m pipeline powerbi`.
