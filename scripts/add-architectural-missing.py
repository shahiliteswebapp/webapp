"""
Add any priced row of the Architectural price list that is missing from
catalog-data.json. The original import skipped rows whose ordering code is
all digits (EAGLE, some ORRIN, VEROS PRO, RIO-SF, BELLO...).

A priced row is one text line:  <ordering code> <description> <MRP>
Its category comes from the description (DL / PANEL / WL / IP), falling back
to the last category heading printed above it.

Idempotent. Run from the repo root:  python scripts/add-architectural-missing.py
"""

import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT.parent / "rawdata" / "Architectural Product list -Dec'25.pdf"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"
SOURCE = "Architectural Product list -Dec'25.pdf"

ROW_RE = re.compile(r"^([0-9A-Z]{8,14}) (.+?) (\d{3,6})$")


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    arch = [c for c in catalog if c.get("source") == SOURCE]
    have = {c["sourceCode"].upper() for c in arch}
    ids = {c["id"] for c in catalog}
    categories = sorted({c["category"] for c in arch if c["category"] != "Uncategorized"}, key=len, reverse=True)

    text = "\n".join((p.extract_text() or "") for p in PdfReader(PDF).pages)
    current = "Uncategorized"
    added = []
    for line in text.splitlines():
        line = line.strip()
        up = line.upper()
        for cat in categories:
            if up.startswith(cat):
                current = cat
                break
        m = ROW_RE.match(line)
        if not m or m.group(1).upper() in have:
            continue
        code, desc, mrp = m.group(1), m.group(2).strip(), float(m.group(3))
        # Headings don't extract in reading order reliably; the description
        # names the product family well enough to categorise it.
        category = current
        if "PANEL" in desc:
            category = "LED PANEL - RECESSED" if "REC" in desc else "LED PANEL - SURFACE"
        elif re.search(r"\bWL\b|\bIP\s?\d{2}\b", desc):
            category = "TISVA OUTDOOR RANGE"
        elif re.search(r"\bDL\w*\b", desc):
            category = "LED COB DOWNLIGHTER - RECESSED"
        watt = re.search(r"(\d+(?:\.\d+)?)\s*W\b", desc)
        ip = re.search(r"\bIP\s?(\d{2})\b", desc)
        sysid = "arch-" + code.lower()
        if sysid in ids:
            continue
        ids.add(sysid)
        have.add(code.upper())
        added.append({
            "id": sysid,
            "sourceCode": code,
            "name": desc,
            "kind": "functional",
            "category": category,
            "layer": 5 if "OUTDOOR" in category else 1,
            "automatic": bool(re.search(r"\b(DIM|TUN)\b", desc)),
            "interfaceOptions": [],
            "finishOptions": [],
            "unit": "nos",
            "unitCost": mrp,
            "size": None,
            "cutout": None,
            "finish": None,
            "watt": f"{watt.group(1)}W" if watt else None,
            "wattNum": float(watt.group(1)) if watt else None,
            "ledSource": None,
            "ipRating": f"IP{ip.group(1)}" if ip else None,
            "colour": None,
            "rules": [],
            "source": SOURCE,
        })

    CATALOG.write_text(json.dumps(catalog + added, ensure_ascii=False), encoding="utf-8")
    print(f"added {len(added)}:", [(a["sourceCode"], a["name"], a["category"], a["unitCost"]) for a in added])


if __name__ == "__main__":
    main()
