"""Synthetic COD-AB-style fixtures: one country, two states, four localities.

Coordinates sit inside Sudan so the equal-area projection behaves as it does
on real data. Each state is 2° x 2° and holds two 1° x 2° localities.
"""

import geopandas as gpd
import pytest
from shapely.geometry import box

from pipeline import config


def _states():
    return gpd.GeoDataFrame(
        {
            "ADM0_PCODE": ["SD", "SD"],
            "ADM1_PCODE": ["SD01", "SD02"],
            "ADM1_EN": ["West State", "East State"],
            "ADM1_AR": ["الولاية الغربية", "الولاية الشرقية"],
        },
        geometry=[box(30, 14, 32, 16), box(32, 14, 34, 16)],
        crs=4326,
    )


def _localities():
    return gpd.GeoDataFrame(
        {
            "ADM0_PCODE": ["SD"] * 4,
            "ADM1_PCODE": ["SD01", "SD01", "SD02", "SD02"],
            "ADM2_PCODE": ["SD01001", "SD01002", "SD02001", "SD02002"],
            "ADM2_EN": ["  Al  Fasher ", "Kutum", "Kassala", "Halfa"],
            "ADM2_AR": ["الفاشر", "كتم", "كسلا", None],
        },
        geometry=[box(30, 14, 31, 16), box(31, 14, 32, 16), box(32, 14, 33, 16), box(33, 14, 34, 16)],
        crs=4326,
    )


@pytest.fixture
def cod_ab(tmp_path, monkeypatch):
    """A raw COD-AB GeoPackage with polygon layers for levels 0-2, plus redirected pipeline paths."""
    raw = tmp_path / "raw"
    raw.mkdir()
    gpkg = raw / "sdn_cod_ab.gpkg"
    country = gpd.GeoDataFrame({"ADM0_PCODE": ["SD"], "ADM0_EN": ["Sudan"]}, geometry=[box(30, 14, 34, 16)], crs=4326)
    country.to_file(gpkg, layer="sdn_admin0", driver="GPKG")
    _states().to_file(gpkg, layer="sdn_admin1", driver="GPKG")
    _localities().to_file(gpkg, layer="sdn_admin2", driver="GPKG")

    monkeypatch.setattr(config, "INTERIM_DIR", tmp_path / "interim")
    monkeypatch.setattr(config, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(config, "BOUNDARIES_DIR", tmp_path / "boundaries")
    monkeypatch.setattr(config, "EXPECTED_COUNTS", {1: 2, 2: 4})
    return raw


@pytest.fixture
def frames():
    """Normalised adm1/adm2 frames, as normalise.run would write them."""
    adm1 = gpd.GeoDataFrame(
        {"pcode": ["SD01", "SD02"], "name_en": ["West State", "East State"], "name_ar": ["غرب", "شرق"], "level": 1, "parent_pcode": "SD"},
        geometry=_states().geometry.values,
        crs=4326,
    )
    adm2 = gpd.GeoDataFrame(
        {
            "pcode": ["SD01001", "SD01002", "SD02001", "SD02002"],
            "name_en": ["Al Fasher", "Kutum", "Kassala", "Halfa"],
            "name_ar": ["الفاشر", "كتم", "كسلا", "حلفا"],
            "level": 2,
            "parent_pcode": ["SD01", "SD01", "SD02", "SD02"],
        },
        geometry=_localities().geometry.values,
        crs=4326,
    )
    return adm1, adm2
