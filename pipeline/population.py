"""Population estimates per state and locality, from OCHA's Common Operational Dataset on
Population Statistics for Sudan (COD-PS), published on HDX.

`python -m pipeline population` downloads the 2025 state and locality tables, checks every
P-code and name against data/gazetteer/places.json, and writes data/population/sdn_population_2025.json:
one total per place, with the source, licence, reference date and the files' SHA-256.

These are projections, not counts: UNFPA projected the 2008 census forward to mid-2025 using
fertility, mortality, refugee (UNHCR) and displacement (IOM DTM, June 2025) data. They are least
certain for Khartoum and West Darfur, and there is no figure for the Abyei PCA area.
"""

import csv
import hashlib
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "population" / "sdn_population_2025.json"
PLACES = ROOT / "data" / "gazetteer" / "places.json"

DATASET = "https://data.humdata.org/dataset/cod-ps-sdn"
FILES = {
    1: "https://data.humdata.org/dataset/f4d30e65-a162-437a-a35d-d81b99723bd6/resource/2a4ae1be-dd48-4ea1-8240-29622d7fdc6b/download/sdn_admpop_adm1_2025.csv",
    2: "https://data.humdata.org/dataset/f4d30e65-a162-437a-a35d-d81b99723bd6/resource/f340a059-e3e5-40fd-8577-e4cac8d4aa33/download/sdn_admpop_adm2_2025.csv",
}


def run() -> int:
    places = json.loads(PLACES.read_text(encoding="utf-8"))["places"]
    by_pcode = {p["pcode"]: p for p in places}
    totals: dict[str, int] = {}
    files = []
    for level, url in FILES.items():
        raw = urllib.request.urlopen(url, timeout=60).read()
        files.append({"url": url, "sha256": hashlib.sha256(raw).hexdigest()})
        rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
        for row in rows:
            pcode = row[f"ADM{level}_PCODE"]
            place = by_pcode.get(pcode)
            if not place or place["level"] != level:
                raise SystemExit(f"population: {pcode} is not an admin-{level} P-code in places.json")
            if row[f"ADM{level}_EN"] != place["name_en"]:
                raise SystemExit(f"population: {pcode} is {row[f'ADM{level}_EN']!r} in COD-PS but {place['name_en']!r} in COD-AB")
            totals[pcode] = round(float(row["T_TL"]))
    missing = sorted(p for p in by_pcode if p not in totals)
    states = sum(v for k, v in totals.items() if len(k) == 4)
    localities = sum(v for k, v in totals.items() if len(k) == 7)
    if states != localities:
        raise SystemExit(f"population: states add up to {states:,} but localities to {localities:,}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    document = {
        "title": "Estimated population by state and locality, mid-2025",
        "source": "UNFPA and the Central Bureau of Statistics (Sudan), Common Operational Dataset on Population Statistics (COD-PS) 2025, via OCHA HDX",
        "dataset": DATASET,
        "licence": "CC BY (as published on HDX)",
        "reference_date": "2025-07-01",
        "notes": "Projections from the 2008 census to mid-2025, accounting for fertility, mortality, refugees outside Sudan (UNHCR) and internal displacement (IOM DTM, June 2025). Least certain for Khartoum and West Darfur. The source files label their Year column 2024; the release note gives the reference date as July 2025. No figure for the Abyei PCA area.",
        "missing": missing,
        "total": states,
        "files": files,
        "population": dict(sorted(totals.items())),
    }
    OUT.write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"population: {len(totals)} places, total {states:,}; no figure for {', '.join(missing) or 'none'} -> {OUT.relative_to(ROOT)}")
    return 0
