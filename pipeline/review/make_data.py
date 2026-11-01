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
if (G / "variants_osm.json").exists():
    variants += json.loads((G / "variants_osm.json").read_text())["variants"]
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

REVIEW = json.loads((G / "review.json").read_text()) if (G / "review.json").exists() else {"variants": [], "links": [], "rules": []}
CASE_REVIEW_PATH = ROOT / "data" / "tests" / "match_cases_review.json"
_case_review = json.loads(CASE_REVIEW_PATH.read_text()) if CASE_REVIEW_PATH.exists() else {}
CASE_REVIEW = {d["id"]: d for d in _case_review.get("decisions", [])}
SECOND_REVIEW = {d["id"]: d for d in _case_review.get("second_review", {}).get("decisions", [])}


def agent(decision: str, **extra) -> dict:
    return {"decision": decision, "by": "agent", **{k: v for k, v in extra.items() if v not in (None, "")}}


cases = []
for c in testcases.load_cases():
    r = matcher.match(c["input_name"], state_hint=c["state_hint"] or None, level=int(c["level"]))
    note = c["notes"]
    a = SECOND_REVIEW.get(c["id"]) if c["verified_by"] == "claude" else CASE_REVIEW.get(c["id"])
    review = None
    if a and not note.startswith("UNSURE"):
        # Agent changes are already applied to the CSV, so against the current answer they read as "correct".
        changed = a["decision"] in ("change", "no-match")
        review = agent("correct", pcode=c["expected_pcode"], confidence=a["confidence"],
                       agent_note=("Changed my proposal: " if changed else "") + a["note"])
    cases.append({
        "id": c["id"], "input": c["input_name"], "state": c["state_hint"], "level": int(c["level"]),
        "expected": c["expected_pcode"], "dataset": DATASETS.get(c["source_dataset"], c["source_dataset"]),
        "dataset_id": c["source_dataset"], "column": c["source_detail"], "source_pcode": c["source_pcode"],
        "unsure": note.startswith("UNSURE"),
        "note": note.replace("UNSURE: ", "").replace("proposed by Claude: ", ""),
        "matcher": {"pcode": r["pcode"], "method": r["method"], "score": round(r["score"], 2),
                    "alternatives": [a["pcode"] for a in r["alternatives"]]},
        "agent": review,
    })

variant_decisions = {(v["text"], tuple(v["pcodes"])): v for v in REVIEW["variants"]}
rejected = json.loads((ROOT / "build" / "reports" / "variants_rejected.json").read_text())
out_variants = []
for v in variants + [{**r, "rejected": True} for r in rejected]:
    vid = "v" + hashlib.sha1((v["text"] + "|" + ",".join(v["pcodes"])).encode()).hexdigest()[:10]
    d = variant_decisions.get((v["text"], tuple(v["pcodes"])))
    if d is None and v.get("rejected"):  # rejections apply per spelling and place, as in the build
        d = next((r for r in REVIEW["variants"] if r["text"] == v["text"] and r["decision"] == "reject"
                  and set(v["pcodes"]) <= set(r["pcodes"])), None)
    out_variants.append({"id": vid, "text": v["text"], "lang": v["lang"], "pcodes": v["pcodes"],
                         "sources": [{"source": s["source"], "ref": s["ref"], "kind": s["kind"]} for s in v["sources"]],
                         "conflicts": v.get("conflicts_with_official", []),
                         "agent": agent(d["decision"], agent_note=d.get("note")) if d else None})

reviewed_links = {l["ref"]: l for l in REVIEW["links"]}
still_unlinked = {l["ref"]: l for l in links if l["pcode"] is None and l["ref"] not in reviewed_links
                  and not l["outcome"].startswith(("variant dropped", "not a current place"))}
unlinked = [{"id": ref, "level": next((x["level"] for x in links if x["ref"] == ref), 2), "names": l["names"],
             "reason": "reviewed", "agent": agent(l["decision"], pcode=l["pcode"], agent_note=l["note"])}
            for ref, l in reviewed_links.items()]
unlinked += [{"id": ref, "level": l["level"], "names": l["names"], "reason": l["outcome"], "agent": None}
             for ref, l in still_unlinked.items()]

rule_texts = rules["notes"]["additions_for_review"]
rule_reviews = {r["rule"]: r for r in REVIEW["rules"]}
rule_agent = []
for i, t in enumerate(rule_texts):
    if t in rule_reviews:
        rule_agent.append(agent(rule_reviews[t]["decision"], agent_note=rule_reviews[t]["note"]))
    elif i < len(REVIEW["rules"]):  # the rule was reworded after the review
        r = REVIEW["rules"][i]
        rule_agent.append(agent(r["decision"], agent_note=f"Reviewed an earlier wording, since changed in response: {r['note']}"))
    else:
        rule_agent.append(None)

data = {
    "places": [{k: p[k] for k in ("pcode", "level", "name_en", "name_ar", "parent_pcode")} for p in places],
    "cases": cases, "variants": out_variants, "unlinked": unlinked,
    "rules": rule_texts,
    "rule_agent": rule_agent,
    "threshold": matcher.threshold,
}
(ROOT / "build" / "review" / "review-data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(len(cases), "cases,", len(out_variants), "variants,", len(unlinked), "unlinked,", len(data["rules"]), "rules;",
      sum(1 for c in cases if c["matcher"]["pcode"] != (c["expected"] or None)), "where the matcher disagrees")
print("ids unique:", len({v["id"] for v in out_variants}) == len(out_variants))
