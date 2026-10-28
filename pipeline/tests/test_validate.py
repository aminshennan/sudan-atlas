from shapely.geometry import Polygon, box

from pipeline import validate


def run(adm1, adm2, outline=None):
    return validate.validate("test", adm1, adm2, outline, {1: len(adm1), 2: len(adm2)})


def test_clean_data_passes(frames):
    adm1, adm2 = frames
    result = run(adm1, adm2, adm1)
    assert result.errors == []


def test_detects_overlap(frames):
    adm1, adm2 = frames
    adm2.loc[0, "geometry"] = box(30, 14, 31.2, 16)  # pushes 0.2° into its neighbour
    adm2.loc[1, "geometry"] = box(31, 14, 32, 16)
    assert any("overlap" in e for e in run(adm1, adm2, adm1).errors)


def test_detects_gap(frames):
    adm1, adm2 = frames
    adm2.loc[0, "geometry"] = box(30, 14, 30.8, 16)  # leaves a 0.2° strip uncovered
    assert any("gap" in e for e in run(adm1, adm2, adm1).errors)


def test_detects_missing_parent(frames):
    adm1, adm2 = frames
    adm2.loc[3, "parent_pcode"] = "SD99"
    assert any("parent_pcode not found" in e for e in run(adm1, adm2).errors)


def test_detects_invalid_geometry(frames):
    adm1, adm2 = frames
    adm2.loc[0, "geometry"] = Polygon([(30, 14), (31, 16), (31, 14), (30, 16)])  # bow-tie
    assert any("invalid geometry" in e for e in run(adm1, adm2).errors)


def test_count_mismatch_with_source_is_an_error(frames):
    adm1, adm2 = frames
    result = validate.validate("test", adm1, adm2, None, {1: 2, 2: 5})
    assert any("source has 5" in e for e in result.errors)


def test_missing_arabic_is_a_warning(frames):
    adm1, adm2 = frames
    adm2.loc[2, "name_ar"] = None
    result = run(adm1, adm2)
    assert result.errors == []
    assert any("no Arabic name" in w and "SD02001" in w for w in result.warnings)


def test_topojson_geometry_is_checked(cod_ab, monkeypatch):
    import json
    from pipeline import __main__ as cli, config

    monkeypatch.setattr(config, "COD_AB_DIR", cod_ab)
    cli.main(["build"])
    path = config.BOUNDARIES_DIR / "light" / "adm2.topojson"
    topo = json.loads(path.read_text())
    # A closed bow-tie ring. TopoJSON arcs are delta-encoded: each point is an offset from the last.
    topo["arcs"].append([[0, 0], [20_000, 20_000], [0, -20_000], [-20_000, 20_000], [0, -20_000]])
    topo["objects"]["adm2"]["geometries"][0]["arcs"] = [[len(topo["arcs"]) - 1]]
    path.write_text(json.dumps(topo))
    result = validate.Result("light")
    validate.check_topojson(path, 2, 4, result)
    assert any("invalid geometry after quantization" in e for e in result.errors)
