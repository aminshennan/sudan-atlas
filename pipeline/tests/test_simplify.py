import geopandas as gpd
import shapely

from pipeline import config, normalise, simplify, validate


def test_every_resolution_exports_and_validates(cod_ab):
    normalise.run(cod_ab)
    simplify.run()
    for resolution in config.RESOLUTIONS:
        folder = config.BOUNDARIES_DIR / resolution
        assert sorted(p.name for p in folder.iterdir()) == ["adm1.geojson", "adm1.topojson", "adm2.geojson", "adm2.topojson"]
        adm1 = gpd.read_file(folder / "adm1.geojson")
        adm2 = gpd.read_file(folder / "adm2.geojson")
        assert list(adm1.columns) == ["pcode", "name_en", "name_ar", "level", "parent_pcode", "geometry"]
        assert adm1.set_index("pcode").loc["SD02", "name_ar"] == "الولاية الشرقية"
        result = validate.validate(resolution, adm1, adm2, None, {1: 2, 2: 4})
        assert result.errors == [], result.errors


def test_state_borders_equal_locality_borders(cod_ab):
    normalise.run(cod_ab)
    simplify.run()
    folder = config.BOUNDARIES_DIR / "light"
    adm1 = gpd.read_file(folder / "adm1.geojson").set_index("pcode")
    adm2 = gpd.read_file(folder / "adm2.geojson")
    for pcode, children in adm2.groupby("parent_pcode"):
        assert shapely.union_all(children.geometry.values).normalize().equals_exact(adm1.loc[pcode].geometry.normalize(), 1e-9)
