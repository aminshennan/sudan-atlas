import json
import zipfile

import geopandas as gpd

from pipeline import config, normalise


def test_finds_layers_by_column(cod_ab):
    layers = normalise.find_layers(cod_ab)
    assert {level: layer["layer"] for level, layer in layers.items()} == {0: "sdn_admin0", 1: "sdn_admin1", 2: "sdn_admin2"}


def test_writes_schema_and_reports_missing_arabic(cod_ab):
    report = normalise.run(cod_ab)
    adm2 = gpd.read_file(config.INTERIM_DIR / "adm2.geojson")
    assert list(adm2.columns) == ["pcode", "name_en", "name_ar", "level", "parent_pcode", "geometry"]
    assert adm2.loc[0, "name_en"] == "Al Fasher"  # whitespace collapsed, spelling untouched
    assert set(adm2["parent_pcode"]) == {"SD01", "SD02"}
    assert report["adm2"]["missing_arabic_name"] == [{"pcode": "SD02002", "name_en": "Halfa"}]
    assert json.loads((config.REPORTS_DIR / "normalise.json").read_text())["adm1"]["source_feature_count"] == 2


def test_reads_zipped_sources(cod_ab):
    archive = cod_ab / "cod.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        zf.write(cod_ab / "sdn_cod_ab.gpkg", "inner/sdn_cod_ab.gpkg")
    (cod_ab / "sdn_cod_ab.gpkg").unlink()
    assert sorted(normalise.find_layers(cod_ab)) == [0, 1, 2]


def test_reads_language_indexed_name_columns(cod_ab):
    """COD-AB v03 layout: adm1_name / adm1_name1 with lang / lang1 naming the language."""
    gpkg = cod_ab / "sdn_cod_ab.gpkg"
    for layer, level in (("sdn_admin1", 1), ("sdn_admin2", 2)):
        frame = gpd.read_file(gpkg, layer=layer)
        renamed = frame.rename(columns={
            f"ADM{level}_PCODE": f"adm{level}_pcode",
            f"ADM{level}_EN": f"adm{level}_name1",  # English deliberately in the second slot
            f"ADM{level}_AR": f"adm{level}_name",
            "ADM1_PCODE": "adm1_pcode",
            "ADM0_PCODE": "adm0_pcode",
        })
        renamed["lang"], renamed["lang1"] = "ar", "en"
        renamed.to_file(gpkg, layer=layer, driver="GPKG")

    report = normalise.run(cod_ab)
    adm1 = gpd.read_file(config.INTERIM_DIR / "adm1.geojson").set_index("pcode")
    assert adm1.loc["SD01", "name_en"] == "West State"
    assert adm1.loc["SD01", "name_ar"] == "الولاية الغربية"
    assert report["adm2"]["column_mapping"]["name_en"] == "adm2_name1"
