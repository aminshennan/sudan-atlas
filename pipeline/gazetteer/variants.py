"""Build data/gazetteer/variants.json: other spellings of each state and locality.

Sources, each recorded on every variant:
- cod-ab: COD-AB's own reference names, base names without the state suffix
  ("Habila" for "Habila - WD"), the parts of slash names, and geoBoundaries' names.
- geonames: GeoNames admin features with their English and Arabic alternate names,
  and state capitals as town names for the locality that contains them.
- wikidata: labels and aliases of Sudan's states and localities, and locality capitals.
- towns: GeoNames towns with a recorded population of 10,000 or more, and OpenStreetMap places
  tagged city or town, each as a spelling of the locality it lies in.

OpenStreetMap spellings are ODbL, so they are built separately into variants_osm.json and never
mixed into variants.json (CC BY 4.0).

External records are linked to a P-code by name similarity, limited to the parent state
or to places near the record's location; records that do not link clearly are reported,
never guessed. The test-set datasets (data/tests/) are deliberately not used here.
"""

import csv
import io
import json
import re
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field

import geopandas as gpd
from rapidfuzz import fuzz
from shapely.geometry import Point
from sudan_atlas.match import combined
from sudan_atlas.normalise import Normaliser

from .. import config
from .places import PLACES_PATH, dump_records

GAZETTEER_DIR = config.ROOT / "data" / "gazetteer"
VARIANTS_PATH = GAZETTEER_DIR / "variants.json"
OSM_VARIANTS_PATH = GAZETTEER_DIR / "variants_osm.json"
OSM_EXPORT = config.RAW_DIR / "osm" / "hotosm_sdn_populated_places_osm_gpkg.zip"
TOWN_MIN_POPULATION = 10_000  # GeoNames towns at least this size count as common town names
TOWN_NAMESAKE_SCORE = 0.80  # a town this like a nearby locality's name belongs to it (Merowe -> Merwoe; Bulbul, 0.75 like Beliel, does not)
TOWN_CONFUSABLE_SCORE = 0.75  # a town this like another locality's name in its state would be read as it (Kuma -> Al Koma)
OSM_NAME_SEPARATORS = re.compile(r"\s*[;,،/]\s*")  # OSM packs several names into one tag ("Shabasha;Shabashah")
OSM_TOWN_PLACES = ("city", "town")
REVIEW_PATH = GAZETTEER_DIR / "review.json"
LINK_REPORT = config.REPORTS_DIR / "variant_links.json"
REJECTED_REPORT = config.REPORTS_DIR / "variants_rejected.json"

LINK_MIN_SCORE = 0.80  # within the parent state or near the record's location
LINK_ANYWHERE_SCORE = 0.92  # fallback across the whole country: the name must be near-identical
LINK_MIN_MARGIN = 0.10
LINK_RADIUS_M = 30_000
JUNK_NAME = re.compile(r"#N/A|^N/?A\b", re.IGNORECASE)
DISAMBIGUATOR = re.compile(r"\s*\([^)]*\)\s*$")  # "Shearia (Sudan)", "Al Fasher District (old)"
GEONAMES_LANGUAGES = {"", "en", "ar"}
STATE_SUFFIX_EN = re.compile(r"^(?P<base>.+?)\s+-\s+(?P<suffix>[A-Z]{2})$")
STATE_SUFFIX_AR = re.compile(r"^(?P<base>.+?)\s+-\s+(?P<suffix>\S\s\S)$")


@dataclass
class Item:
    """A record from an external source, with every name it gives for one place."""
    source: str
    ref: str
    level: int
    names: list[tuple[str, str]]  # (text, kind)
    point: Point | None = None
    state: str | None = None
    towns: list[str] = field(default_factory=list)
    iso: str = ""


# Bidirectional and zero-width marks (GeoNames "جنوب دارفور" carries a left-to-right mark) and Arabic
# vowel marks, which turn up as stray noise ("As Sِanţah", "أم ضواًبان"). Neither belongs in a stored spelling.
INVISIBLE_MARKS = re.compile("[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u064b-\u0652]")


def clean_name(text: str) -> str:
    """A source name without Wikipedia-style disambiguators, or '' for junk such as '#N/A District'."""
    text = INVISIBLE_MARKS.sub("", text or "")
    text = re.sub(r"\s+", " ", DISAMBIGUATOR.sub("", text)).strip()
    return "" if JUNK_NAME.search(text) else text


class Linker:
    def __init__(self, places: dict, normaliser: Normaliser, extra_names: dict[str, list[str]]):
        self.places = places
        self.norm = normaliser
        self.names = {p: [pl["name_en"], pl["name_ar"], *extra_names.get(p, [])] for p, pl in places.items()}
        self._namesake_scorer = combined(normaliser)
        self.state_names = sorted(
            {n for pl in places.values() if pl["level"] == 1 for n in (pl["name_en"], pl["name_ar"])}, key=len, reverse=True)
        frames = [gpd.read_file(config.BOUNDARIES_DIR / "detailed" / f"adm{lvl}.geojson") for lvl in config.LEVELS]
        self.shapes = gpd.GeoDataFrame(
            __import__("pandas").concat(frames, ignore_index=True), crs=4326
        ).set_index("pcode").to_crs(config.AREA_CRS).geometry

    def _similarity(self, a: str, b: str) -> float:
        ka, kb = self.norm.key(a), self.norm.key(b)
        if not ka or not kb or self.norm.script(ka) != self.norm.script(kb):
            return 0.0
        return fuzz.ratio(ka, kb) / 100

    def containing(self, point: Point, level: int) -> str | None:
        projected = gpd.GeoSeries([point], crs=4326).to_crs(config.AREA_CRS).iloc[0]
        for pcode, shape in self.shapes.items():
            if self.places[pcode]["level"] == level and shape.contains(projected):
                return pcode
        return None

    def _linking_names(self, item: Item) -> list[str]:
        """The item's names, plus each with a state name removed ("Habila South Kordofan" -> "Habila")."""
        names = [n for n, _ in item.names]
        extra = []
        for name in names:
            for state in self.state_names:
                if state.lower() in name.lower() and len(name) > len(state) + 2:
                    extra.append(re.sub(re.escape(state), " ", name, flags=re.IGNORECASE).strip())
                    break
        return names + extra

    def _rank(self, names: list[str], candidates: list[str]) -> list[tuple[float, str]]:
        return sorted(((max(self._similarity(n, o) for n in names for o in self.names[p]), p) for p in candidates),
                      reverse=True)

    @staticmethod
    def _decide(scored: list[tuple[float, str]], minimum: float) -> tuple[str | None, float, str]:
        if not scored:
            return None, 0.0, "no candidate place"
        best, pcode = scored[0]
        second = scored[1][0] if len(scored) > 1 else 0.0
        if best >= minimum and (best - second >= LINK_MIN_MARGIN or (best == 1.0 and second < 1.0)):
            return pcode, best, "linked"
        if best < minimum:
            return None, best, "names too different"
        return None, best, f"too close to call against {scored[1][1]}"

    def link(self, item: Item) -> tuple[str | None, float, str]:
        if not item.names:
            return None, 0.0, "no English or Arabic name"
        names = self._linking_names(item)
        level = [p for p, pl in self.places.items() if pl["level"] == item.level]
        # Either constraint can be stale (a pre-2012 parent state, a misplaced coordinate), so take their union.
        near = set()
        if item.state:
            near |= {p for p in level if p == item.state or self.places[p]["parent_pcode"] == item.state}
        if item.point is not None:
            projected = gpd.GeoSeries([item.point], crs=4326).to_crs(config.AREA_CRS).iloc[0]
            near |= {p for p in level if self.shapes[p].distance(projected) <= LINK_RADIUS_M}
        if near:
            result = self._decide(self._rank(names, sorted(near)), LINK_MIN_SCORE)
            if result[0]:
                return result
        pcode, score, outcome = self._decide(self._rank(names, level), LINK_ANYWHERE_SCORE)
        return (pcode, score, "linked (name match anywhere)") if pcode else (None, score, outcome)

    def towns(self, names: list[str], point: Point) -> tuple[list[str], str]:
        """Localities a town name stands for, and why: the nearby ones whose names begin with it (Nyala -> Nyala
        Shimal, Nyala Janoub); else the nearby locality it is named like, since a town is usually the seat of its
        namesake and its point can fall just over a border; else none, if a locality elsewhere in the same state is
        named like it (Kuma, a town in Melit, would be mistaken for Al Koma); else the locality containing it.
        The check stays within the state: across all 189 localities, short consonant skeletons coincide by chance
        (Kuraymah would look like Karrari). Cross-state look-alikes (Adeila, a town in Um Dukhun, and Adila in
        East Darfur) are settled in review instead."""
        projected = gpd.GeoSeries([point], crs=4326).to_crs(config.AREA_CRS).iloc[0]
        nearby = [p for p, pl in self.places.items() if pl["level"] == 2 and self.shapes[p].distance(projected) <= LINK_RADIUS_M]
        keys = {self.norm.key(n) for n in names} - {""}
        starts = sorted({p for p in nearby for o in self.names[p] for k in keys
                         if self.norm.key(o).startswith(k + " ") or self.norm.key(o) == k})
        if len(starts) >= 1:
            return starts, "town"
        likeness = lambda p: max((self._namesake_scorer(k, self.norm.key(o)) for k in keys for o in self.names[p]
                                  if self.norm.key(o) and self.norm.script(k) == self.norm.script(o)), default=0) / 100
        scored = sorted(((likeness(p), p) for p in nearby), reverse=True)
        if scored and scored[0][0] >= TOWN_NAMESAKE_SCORE and (len(scored) == 1 or scored[1][0] < scored[0][0]):
            return [scored[0][1]], "town (named like a nearby locality)"
        inside = self.containing(point, 2)
        if not inside:
            return [], "town outside every locality"
        state = self.places[inside]["parent_pcode"]
        own = likeness(inside)  # Kassala town in Madeinat Kassala is named like its own locality: keep it
        alike = [p for p, pl in self.places.items()
                 if pl["parent_pcode"] == state and p != inside and likeness(p) >= TOWN_CONFUSABLE_SCORE and likeness(p) > own]
        if alike:
            return [], f"town dropped: named like {', '.join(alike)} elsewhere in the state"
        return [inside], "town"


def _script(text: str, norm: Normaliser) -> str:
    return "ar" if norm.script(text) == "ar" else "en"


def cod_ab_items(places: dict) -> tuple[list[Item], dict[str, list[str]]]:
    """Variants COD-AB itself implies, plus geoBoundaries' names. Also returns extra linking names per place."""
    items, extra = [], defaultdict(list)
    for pcode, place in places.items():
        for name, pattern in ((place["name_en"], STATE_SUFFIX_EN), (place["name_ar"], STATE_SUFFIX_AR)):
            m = pattern.match(name)
            if m:
                items.append(Item("cod-ab", f"cod-ab:{pcode}", place["level"], [(m["base"], "base-name")]))
                items[-1].state = place["parent_pcode"]
                extra[pcode].append(m["base"])
            elif " - " in name or " / " in name:
                for part in re.split(r"\s+[-/]\s+", name):
                    items.append(Item("cod-ab", f"cod-ab:{pcode}", place["level"], [(part, "part")]))
                    items[-1].state = place["parent_pcode"]
                    extra[pcode].append(part)
    raw = config.COD_AB_DIR / "sdn_admin_boundaries.geojson.zip"
    for level in config.LEVELS:
        frame = gpd.read_file(f"/vsizip/{raw}/sdn_admin{level}.geojson")
        for row in frame.itertuples():
            ref = getattr(row, f"adm{level}_ref_name")
            if ref and ref != getattr(row, f"adm{level}_name"):
                items.append(Item("cod-ab", f"cod-ab:{getattr(row, f'adm{level}_pcode')}:ref_name", level, [(ref, "reference-name")],
                                  state=row.adm1_pcode if level == 2 else None))
    for level in config.LEVELS:
        gb = gpd.read_file(config.GEOBOUNDARIES_DIR / f"geoBoundaries-SDN-ADM{level}.geojson")
        for row in gb.itertuples():
            items.append(Item("geoboundaries", f"geoboundaries:{row.shapeID}", level, [(row.shapeName, "name")],
                              point=row.geometry.representative_point()))
    return items, extra


GEONAMES_COLUMNS = ["geonameid", "name", "asciiname", "alternatenames", "lat", "lon", "fclass", "fcode", "cc", "cc2",
                    "admin1", "admin2", "admin3", "admin4", "population", "elevation", "dem", "tz", "modified"]


def _read_tsv(archive: str, member: str, columns: list[str]) -> list[dict]:
    with zipfile.ZipFile(config.RAW_DIR / "geonames" / archive) as zf:
        text = zf.read(member).decode("utf-8")
    return [dict(zip(columns, line.split("\t"))) for line in text.splitlines() if line]


def geonames_items() -> list[Item]:
    rows = _read_tsv("SD.zip", "SD.txt", GEONAMES_COLUMNS)
    alternates = defaultdict(list)
    for a in _read_tsv("alternatenames-SD.zip", "SD.txt",
                       ["id", "geonameid", "lang", "name", "preferred", "short", "colloquial", "historic", "from", "to"]):
        if a["lang"] in GEONAMES_LANGUAGES:
            kind = "historic-name" if a.get("historic") == "1" else "alternate-name"
            alternates[a["geonameid"]].append((a["name"], kind))
    items = []
    for row in rows:
        point = Point(float(row["lon"]), float(row["lat"]))
        names = [(row["name"], "name"), (row["asciiname"], "name")] + alternates[row["geonameid"]]
        if row["fcode"] in ("ADM1", "ADM2"):
            items.append(Item("geonames", f"geonames:{row['geonameid']}", int(row["fcode"][-1]), names, point=point))
        elif row["fcode"] in ("PPLC", "PPLA") or (
                row["fclass"] == "P" and int(row["population"] or 0) >= TOWN_MIN_POPULATION):
            items.append(Item("geonames", f"geonames:{row['geonameid']}", 2, [], point=point,
                              towns=[n for n, _ in names]))
    return items


def osm_items() -> list[Item]:
    """OpenStreetMap places tagged city or town (Humanitarian OpenStreetMap Team export, ODbL)."""
    if not OSM_EXPORT.exists():
        return []
    with zipfile.ZipFile(OSM_EXPORT) as zf:
        member = next(n for n in zf.namelist() if n.endswith(".gpkg"))
    frame = gpd.read_file(f"/vsizip/{OSM_EXPORT}/{member}")
    frame = frame[frame["place"].isin(OSM_TOWN_PLACES)].to_crs(4326)
    items = []
    for row in frame.itertuples():
        # name_latin is a machine transliteration of the Arabic ("lsnwT"), so only real name tags are used.
        names = list(dict.fromkeys(part for n in (row.name, row.name_en, row.name_ar) if isinstance(n, str)
                                   for part in OSM_NAME_SEPARATORS.split(n) if part))
        if names:
            items.append(Item("osm", f"osm:{row.id}", 2, [], point=row.geometry.representative_point(), towns=names))
    return items


def _wikidata_value(binding: dict, key: str) -> str:
    return binding.get(key, {}).get("value", "")


def wikidata_items(state_links: dict[str, str]) -> list[Item]:
    """Localities need their state's link first, so this runs in two passes (states, then localities)."""
    bindings = json.loads((config.RAW_DIR / "wikidata" / "items.json").read_text())["results"]["bindings"]
    grouped = defaultdict(list)
    for b in bindings:
        grouped[_wikidata_value(b, "item").rsplit("/", 1)[-1]].append(b)
    items = []
    for qid, rows in grouped.items():
        first = rows[0]
        level = 1 if _wikidata_value(first, "class").endswith("Q746290") else 2
        if level == 2 and not state_links:
            continue
        names = []
        for key, kind in (("labelsEn", "label"), ("labelsAr", "label"), ("aliasesEn", "alias"), ("aliasesAr", "alias")):
            for row in rows:
                names += [(n, kind) for n in _wikidata_value(row, key).split("|") if n]
        names = [(clean_name(n), k) for n, k in dict.fromkeys(names)]
        names = [(n, k) for n, k in names if n]
        coord = _wikidata_value(first, "coord")
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", coord)
        parent = _wikidata_value(first, "parent").rsplit("/", 1)[-1]
        towns = sorted({_wikidata_value(r, k) for r in rows for k in ("capitalLabelEn", "capitalLabelAr")} - {""})
        items.append(Item("wikidata", f"wikidata:{qid}", level, names,
                          point=Point(float(m[1]), float(m[2])) if m else None,
                          state=state_links.get(parent) if level == 2 else None,
                          towns=towns if level == 2 else [], iso=_wikidata_value(first, "iso")))
    return items


def load_review() -> dict:
    """Review decisions: spellings kept or rejected, and records linked (or not) by hand."""
    if not REVIEW_PATH.exists():
        return {"variants": {}, "rejected_pairs": set(), "links": {}, "additions": []}
    review = json.loads(REVIEW_PATH.read_text())
    return {
        "variants": {(clean_name(v["text"]), tuple(v["pcodes"])): v["decision"] for v in review["variants"]},
        # A rejection applies to each spelling-place pair, so a later, correct link of the same
        # spelling to another place (Tendelti the town in Tendalti) is not rejected with it.
        "rejected_pairs": {(clean_name(v["text"]), p) for v in review["variants"] if v["decision"] == "reject" for p in v["pcodes"]},
        "links": {l["ref"]: l for l in review["links"]},
        # Spellings a reviewer added that no source gives, such as a corrected typo.
        "additions": review.get("additions", []),
    }


def build() -> tuple[list[dict], list[dict]]:
    places = {p["pcode"]: p for p in json.loads(PLACES_PATH.read_text())["places"]}
    review = load_review()

    def resolve(item: Item) -> tuple[str | None, float, str]:
        decided = review["links"].get(item.ref)
        if decided and decided["decision"] == "link":
            return decided["pcode"], 1.0, "linked (review)"
        if decided:
            return None, 0.0, "not a current place (review)"
        return linker.link(item)
    norm = Normaliser(json.loads((GAZETTEER_DIR / "normalisation.json").read_text()))
    cod_items, extra = cod_ab_items(places)
    linker = Linker(places, norm, extra)

    links, collected = [], []

    def take(item: Item, pcode: str | None, score: float, outcome: str) -> None:
        links.append({"ref": item.ref, "level": item.level, "names": [n for n, _ in item.names][:6] or item.towns[:3],
                      "pcode": pcode, "score": round(score, 3), "outcome": outcome})
        if pcode:
            collected.extend((text, kind, item.source, item.ref, pcode) for text, kind in item.names)

    for item in cod_items:
        if item.source == "cod-ab":
            take(item, item.ref.split(":")[1], 1.0, "linked")
        else:
            # geoBoundaries repackages the same COD-AB shapes, so its features link by position.
            pcode = linker.containing(item.point, item.level)
            take(item, pcode, 1.0 if pcode else 0.0, "linked (same shape)" if pcode else "outside every place")

    def town(item: Item) -> None:
        decided = review["links"].get(item.ref)
        if decided:  # a reviewer placed this town by hand (in one locality or shared by several), or dropped it
            pcodes, outcome = (decided["pcode"].split(","), "town (review)") if decided["decision"] == "link" else ([], "town dropped (review)")
        else:
            pcodes, outcome = linker.towns(item.towns, item.point)
        links.append({"ref": item.ref, "level": 2, "names": item.towns[:3], "pcode": ",".join(pcodes) or None,
                      "score": None, "outcome": outcome})
        for pcode in pcodes:
            collected.extend((t, "town", item.source, item.ref, pcode) for t in item.towns)

    for item in geonames_items():
        if item.towns:
            town(item)
        else:
            take(item, *resolve(item))
    for item in osm_items():
        town(item)

    iso_links = {}
    gb1 = gpd.read_file(config.GEOBOUNDARIES_DIR / "geoBoundaries-SDN-ADM1.geojson")
    for row in gb1.itertuples():
        pcode = linker.containing(row.geometry.representative_point(), 1)
        if pcode and row.shapeISO not in ("", "N/A"):
            iso_links[row.shapeISO] = pcode
    state_links = {}
    for item in wikidata_items({}):
        if item.level != 1:
            continue
        if item.iso in iso_links:
            pcode, score, outcome = iso_links[item.iso], 1.0, "linked (ISO 3166-2 code)"
        else:
            pcode, score, outcome = resolve(item)
        take(item, pcode, score, outcome)
        if pcode:
            state_links[item.ref.split(":")[1]] = pcode
    for item in wikidata_items(state_links):
        if item.level != 2:
            continue
        pcode, score, outcome = resolve(item)
        take(item, pcode, score, outcome)
        if pcode:
            collected.extend((t, "town", item.source, item.ref, pcode) for t in item.towns)

    for n, added in enumerate(review["additions"], 1):
        collected.extend((added["text"], "review", "review", f"review:addition/{n}", pcode) for pcode in added["pcodes"])

    official = defaultdict(set)
    for pcode, place in places.items():
        for name in (place["name_en"], place["name_ar"]):
            official[norm.key(name)].add(pcode)

    dropped, rejected = [], []
    variants = _merge([c for c in collected if c[2] != "osm"], places, official, norm, review, dropped, rejected)
    main = {(v["text"], tuple(v["pcodes"])) for v in variants}
    osm_variants = [v for v in _merge([c for c in collected if c[2] == "osm"], places, official, norm, review, dropped, rejected)
                    if (v["text"], tuple(v["pcodes"])) not in main]
    links.extend({"ref": d["ref"], "level": places[d["pcode"]]["level"], "names": [d["text"]], "pcode": d["pcode"],
                  "score": None, "outcome": f"variant dropped: {d['reason']}"} for d in dropped)
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REJECTED_REPORT.write_text(json.dumps(rejected, indent=1, ensure_ascii=False))
    return variants, osm_variants, links


def _merge(collected, places, official, norm, review, dropped, rejected) -> list[dict]:
    """Group collected (text, kind, source, ref, pcode) rows into variant records, applying the review."""
    merged: dict[tuple[str, str], dict] = {}
    for text, kind, source, ref, pcode in collected:
        text = clean_name(text)
        key = norm.key(text)
        if not key or pcode in official.get(key, set()):
            continue  # empty, junk, or just the official name again
        if (text, pcode) in review["rejected_pairs"]:
            if not any(d["text"] == text and d["pcode"] == pcode for d in dropped):
                dropped.append({"text": text, "pcode": pcode, "ref": ref, "reason": "rejected in review"})
                rejected.append({"text": text, "lang": _script(text, norm), "pcodes": [pcode],
                                 "sources": [{"source": source, "ref": ref, "kind": kind}]})
            continue
        others = sorted(official.get(key, set()) - {pcode})
        same_level = [o for o in others if places[o]["level"] == places[pcode]["level"]]
        if same_level or (others and kind != "town"):
            # Equal to another place's official name: almost always a mislink (or a town whose point falls just
            # outside its namesake locality, like Kosti), and it would make that name ambiguous. A town named
            # like a place at another level is kept: "Kassala" is both the state and the town in the Madeinat
            # Kassala locality, and a level filter tells them apart. Report, don't keep.
            dropped.append({"text": text, "pcode": pcode, "ref": ref, "reason": f"official name of {others}"})
            continue
        record = merged.setdefault((text, pcode), {"text": text, "lang": _script(text, norm), "pcodes": [pcode], "sources": []})
        source_entry = {"source": source, "ref": ref, "kind": kind}
        if source_entry not in record["sources"]:
            record["sources"].append(source_entry)

    by_text = defaultdict(list)
    for record in merged.values():
        by_text[record["text"]].append(record)
    variants = []
    for text, records in by_text.items():
        pcodes = sorted({p for r in records for p in r["pcodes"]})
        sources = list({json.dumps(s, sort_keys=True): s for r in records for s in r["sources"]}.values())
        conflicts = sorted(official.get(norm.key(text), set()) - set(pcodes))
        decision = review["variants"].get((text, tuple(pcodes)))
        entry = {"text": text, "lang": records[0]["lang"], "pcodes": pcodes,
                 "sources": sorted(sources, key=lambda s: (s["source"], s["ref"])),
                 # A reviewer's own addition is reviewed by definition.
                 "status": "kept" if decision == "keep" or all(s["source"] == "review" for s in sources) else "proposed"}
        if conflicts:
            entry["conflicts_with_official"] = conflicts
        variants.append(entry)
    variants.sort(key=lambda v: (v["pcodes"], v["lang"], v["text"]))
    return variants


def run() -> list[dict]:
    variants, osm_variants, links = build()
    VARIANTS_PATH.write_text(dump_records(
        {"version": config.DATA_VERSION, "licence": "CC BY 4.0 (Sudan Atlas); sources: COD-AB (CC BY 3.0 IGO), geoBoundaries (CC BY 3.0 IGO), GeoNames (CC BY 4.0), Wikidata (CC0)"},
        "variants", variants))
    if osm_variants:
        OSM_VARIANTS_PATH.write_text(dump_records(
            {"version": config.DATA_VERSION, "licence": "ODbL 1.0 (Open Database License); © OpenStreetMap contributors",
             "source": "OpenStreetMap places tagged city or town, via the Humanitarian OpenStreetMap Team export on HDX"},
            "variants", osm_variants))
        print(f"OSM variants: {len(osm_variants)} -> {OSM_VARIANTS_PATH.relative_to(config.ROOT)}")
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    LINK_REPORT.write_text(json.dumps(links, indent=1, ensure_ascii=False))
    outcomes = defaultdict(int)
    for link in links:
        outcomes[(link["ref"].split(":")[0], link["outcome"].split(" against")[0])] += 1
    print(f"variants: {len(variants)} -> {VARIANTS_PATH.relative_to(config.ROOT)}")
    for (source, outcome), n in sorted(outcomes.items()):
        print(f"  {source:14} {outcome:42} {n}")
    return variants
