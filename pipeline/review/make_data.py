"""Bundle what the review page shows into build/review/review-data.json.

The page (pipeline/review/index.html) and this file are published together as a private
review artifact; decisions are saved in that artifact's database and read back by Claude.
Run from the repository root: PYTHONPATH=. .venv/bin/python pipeline/review/make_data.py
"""
import hashlib
import json
from pathlib import Path

from sudan_atlas import Matcher
from pipeline.gazetteer import testcases

ROOT = Path(__file__).resolve().parents[2]
(ROOT / "build" / "review").mkdir(parents=True, exist_ok=True)
G = ROOT / "data" / "gazetteer"
places = json.loads((G / "places.json").read_text())["places"]
variants = json.loads((G / "variants.json").read_text())["variants"]
rules = json.loads((G / "normalisation.json").read_text())
links = json.loads((ROOT / "build" / "reports" / "variant_links.json").read_text())
matcher = Matcher()

DATASETS = {
    "sudan-2022-hrp-response-monitoring-4ws": "OCHA 2022 response tracking",
    "sudan-acute-food-insecurity-country-data": "IPC food insecurity",
    "sudan-displacement-situation-countrywide-idps-iom-dtm": "IOM displacement tracking",
    "sudan-monthly-refugee-and-asylum-seeker-population-by-site": "UNHCR refugee sites",
    "sudan-people-affected-by-floods": "OCHA floods 2021–23",
    "sudan-people-reached-by-locality-jan-dec-2019_hrp": "OCHA people reached 2019",
    "sudan-schools": "OCHA schools 2021",
    "sudan-subnational-boundaries-and-tabular-data": "US Census Bureau",
    "sudan-who-does-what-where-november-2020": "OCHA 3W 2020",
}

cases = []
for c in testcases.load_cases():
    r = matcher.match(c["input_name"], state_hint=c["state_hint"] or None, level=int(c["level"]))
    note = c["notes"]
    cases.append({
        "id": c["id"], "input": c["input_name"], "state": c["state_hint"], "level": int(c["level"]),
        "expected": c["expected_pcode"], "dataset": DATASETS.get(c["source_dataset"], c["source_dataset"]),
        "dataset_id": c["source_dataset"], "column": c["source_detail"], "source_pcode": c["source_pcode"],
        "unsure": note.startswith("UNSURE"), "note": note.replace("UNSURE: ", "").replace("proposed by Claude: ", ""),
        "matcher": {"pcode": r["pcode"], "method": r["method"], "score": round(r["score"], 2),
                    "alternatives": [a["pcode"] for a in r["alternatives"]]},
    })

out_variants = []
for v in variants:
    vid = "v" + hashlib.sha1((v["text"] + "|" + ",".join(v["pcodes"])).encode()).hexdigest()[:10]
    out_variants.append({"id": vid, "text": v["text"], "lang": v["lang"], "pcodes": v["pcodes"],
                         "sources": [{"source": s["source"], "ref": s["ref"], "kind": s["kind"]} for s in v["sources"]],
                         "conflicts": v.get("conflicts_with_official", [])})

unlinked = [{"id": l["ref"], "level": l["level"], "names": l["names"], "score": l["score"], "reason": l["outcome"]}
            for l in links if l["pcode"] is None]

data = {
    "places": [{k: p[k] for k in ("pcode", "level", "name_en", "name_ar", "parent_pcode")} for p in places],
    "cases": cases, "variants": out_variants, "unlinked": unlinked,
    "rules": rules["notes"]["additions_for_review"],
    "threshold": matcher.threshold,
}
(ROOT / "build" / "review" / "review-data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(len(cases), "cases,", len(out_variants), "variants,", len(unlinked), "unlinked,", len(data["rules"]), "rules;",
      sum(1 for c in cases if c["matcher"]["pcode"] != (c["expected"] or None)), "where the matcher disagrees")
print("ids unique:", len({v["id"] for v in out_variants}) == len(out_variants))
