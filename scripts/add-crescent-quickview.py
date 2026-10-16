"""
Add the Crescent Quick View Catalogue 2026 photos to the Crescent products.

    python scripts/add-crescent-quickview.py

../rawdata/Crescent Lighting Quick View Catalogue 2026_tbu.pdf has no text
(the model names are part of the page art), so the photo-to-model mapping
below was read off the pages: (page, n) is the n-th photo region that
scripts/pdf_photos.py finds on that page (sorted top-to-bottom, left-to-right),
and the right side names the Crescent model families it shows, matched
against the code before the first "-", " " or "(" of each Crescent row's
sourceCode (e.g. "CRC240A-03W-RO" -> "CRC240A"), or a regex for families
the price list splits by size.

These photos are larger than the ones cut from the price list, so each goes
first in the product's images and the old photo is kept after it. Photos go
to ../rawdata/catalog-images-web as cq_p<page>_<n>.webp. Re-running is safe.
"""

import json
import re
from pathlib import Path

import pymupdf

from pdf_photos import icon_xrefs, photo_regions, textless

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
PDF = RAW / "Crescent Lighting Quick View Catalogue 2026_tbu.pdf"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"

MAP = {
    3: {3: "CRD50", 5: "CRD50B", 4: "CRD150", 2: "CRD160", 10: "CRD170", 8: "CRD200", 11: "CRD180",
        9: "CRD190", 16: "CRD120", 14: "CRD260", 15: "CRD260FB"},
    4: {1: "CRD280", 3: "CRD270", 2: "SG110A", 4: "SG210A", 6: "SG810A", 5: "SG910", 7: "SG510",
        10: "SG610", 11: "CRM20A", 9: "CRM10", 13: "CRM10B", 17: "CRM40A", 14: "CRM40B",
        15: "CRCL10", 16: "CRCL20"},
    5: {2: "CRC240A", 5: "CRC40", 6: "CRC130A", 3: "CRC140", 10: "CRC10B", 12: "CRC150", 14: "CRC20A",
        17: "CRC20B", 15: "CRC190"},
    6: {4: "CRC200", 2: "CRC210A", 3: "CRC230", 1: "CRC110", 8: "CRC10Z", 7: "CRC20Z", 10: "CRC60A",
        12: "CRG20D", 18: "CRC260", 21: "CRC60C", 25: "CRC60D", 24: "CRC60E", 22: "CRG80"},
    7: {2: "CRC170", 4: "CRC180", 6: "CRC220", 1: "CRC250", 8: "CRC30B", 10: "CRC30C", 9: "CRC30D",
        15: "CRG70", 18: "CSG80", 17: "CRTR30", 14: "CTL0001", 22: "CRW30", 21: "CRW10"},
    8: {5: "CRF60", 2: "CRF60A", 7: "CRF80A", 9: "CRF90", 6: "CRF50", 10: "CRI12", 11: "CRI14",
        13: "CRI11"},
    9: {3: "CRS50", 4: "CRS80A", 8: "CRS70", 6: "CRS100", 10: "CRS20", 11: "CRU05", 12: "CRW01",
        13: "CRU70"},
    10: {2: "CRP10", 4: "CRP40", 3: "CRP50", 8: "CRG30A", 9: "CRG30C", 11: "CRG30F", 12: "CRG90B"},
    11: {4: ["CRG60A", "CRG60B", "CRG60C", "CRG60D"], 6: "CRG40B", 7: "CRG40CM", 5: "CRG40",
         8: "CRG40M", 13: "CRG20", 12: "CRG110", 16: "CRO10", 17: "CRO20", 18: "CRO30", 19: "CRO40"},
    12: {3: "CRG50A", 2: "CRG50D", 4: "CRG50B", 5: "CRG50C", 7: "CRGL20", 6: "CRGL40", 8: "CRGL50A",
         9: "CRGL50B", 11: "CRGL60", 13: "CRGL70", 12: "CPT0010A", 15: "CPT0010B", 14: "CPT0010C"},
    13: {3: "CSS", 7: "CSR2835/120", 8: "CSR5050/60", 9: "SRC0003", 12: re.compile(r"^CSLP\d+X35X35"),
         13: re.compile(r"^CSLP\d+X54X78|^CSSLP54"), 14: re.compile(r"^CSLP\d+X50X70"), 16: "CSLPC",
         15: re.compile(r"^CSRP")},
    14: {4: "WDP0001", 8: "CSA10", 7: "CSC0001"},
    15: {3: re.compile(r"^CMS-M5"), 1: re.compile(r"^CMS-M2"), 4: re.compile(r"^CMS-M6"),
         2: re.compile(r"^CMS-M7"), 8: "CSA20", 7: re.compile(r"^CSA60-BT-GT"),
         6: re.compile(r"^CSA60-BT-RPS"), 5: re.compile(r"^CSA60-BT-RC")},
}


def family(code):
    return re.split(r"[-\s(]", code)[0]


def matches(target, code):
    if isinstance(target, re.Pattern):
        return bool(target.search(code))
    if isinstance(target, list):
        return family(code) in target
    return family(code) == target


def main():
    doc = pymupdf.open(PDF)
    clean = textless(doc)
    icons = icon_xrefs(doc)
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    crescent = [s for s in data if s.get("company") == "Crescent"]
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    touched, unused = set(), []
    for page, regions_map in MAP.items():
        regions = photo_regions(doc[page - 1], clean[page - 1], min_w=25, min_h=25, icons=icons)
        for n, target in regions_map.items():
            reg = regions[n - 1]
            name = f"cq_p{page:02d}_{n}.webp"
            hits = [s for s in crescent if matches(target, s["sourceCode"])]
            if not hits:
                unused.append((page, n, str(target)))
                continue
            reg.save(OUT_IMG / name)
            for s in hits:
                imgs = [i for i in s.get("images", []) if not i.startswith("cq_")]
                s["images"] = [name, *imgs]
                touched.add(s["id"])
    CATALOG.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"{len(touched)} Crescent products got a Quick View photo")
    if unused:
        print("no product for:", unused)


if __name__ == "__main__":
    main()
