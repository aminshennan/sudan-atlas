import json

from pipeline import __main__ as cli
from pipeline import config


def test_build_runs_every_step_and_passes(cod_ab, monkeypatch, capsys):
    monkeypatch.setattr(config, "COD_AB_DIR", cod_ab)
    assert cli.main(["build"]) == 0
    assert "Validation passed with zero errors." in capsys.readouterr().out
    manifest = json.loads((config.BOUNDARIES_DIR / "manifest.json").read_text())
    assert manifest["version"] == config.DATA_VERSION
    assert manifest["counts"] == {"adm1": 2, "adm2": 4}
    assert len(manifest["files"]) == 12


def test_build_is_reproducible(cod_ab, monkeypatch):
    monkeypatch.setattr(config, "COD_AB_DIR", cod_ab)
    cli.main(["build"])
    first = (config.BOUNDARIES_DIR / "manifest.json").read_text()
    cli.main(["build"])
    assert (config.BOUNDARIES_DIR / "manifest.json").read_text() == first


def test_validate_fails_on_a_corrupted_output(cod_ab, monkeypatch, capsys):
    monkeypatch.setattr(config, "COD_AB_DIR", cod_ab)
    cli.main(["build"])
    adm2 = config.BOUNDARIES_DIR / "medium" / "adm2.topojson"
    topo = json.loads(adm2.read_text())
    topo["objects"]["adm2"]["geometries"].pop()
    adm2.write_text(json.dumps(topo))
    assert cli.main(["validate"]) == 1
    assert "FAIL" in capsys.readouterr().out
