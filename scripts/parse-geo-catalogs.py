"""
Parse the Geo Liting decorative catalogues (PDF) into catalog-data.json rows,
with product photos.

  ../rawdata/Geo Liting Hanging & Celliling Light Part 1.pdf   one item per landscape page
  ../rawdata/Geo Liting Mix 1 Updated.pdf                      1-4 items per portrait page

Layout-aware (PyMuPDF): each "ITEM NO" label starts an item; the spec lines
under it in the same column belong to it; each photo goes to the item printed
below it in the same column (or the only item on the page). Small badge icons
are skipped. Photos are rendered from the page with its text removed (see
scripts/pdf_photos.py: no stretched slices, no specs printed over them) and
written as webp to ../rawdata/catalog-images-web, named
<g1|gm>_p<page>_<item>_r<n>.webp.

Replaces every "Geo Liting catalogue" row in catalog-data.json. Keeps the
decorative type already on a row with the same code; run
scripts/merge-decorative.py afterwards to re-apply the client's chart tags
and the Part 2 wall lamps.

Each SKU in these catalogues ends with a number printed in a lighter weight
(e.g. "H10B515HL" + "44000"). The SKU proper is the item code reversed plus a
type suffix, so that trailing number is recorded separately as `listNumber`.
It is NOT used as a price until the client confirms what it means.

Run from the repo root:  python scripts/parse-geo-catalogs.py
"""

import json
import re
from pathlib import Path

import pymupdf

from pdf_photos import icon_xrefs, photo_regions, textless

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"
SOURCE = "Geo Liting catalogue"

PDFS = [
    ("g1", RAW / "Geo Liting Hanging & Celliling Light Part 1.pdf"),
    ("gm", RAW / "Geo Liting Mix 1 Updated.pdf"),
]

LABEL_RE = re.compile(r"ITEM\s*NO\.?\s*:?", re.I)
FIELD_RE = re.compile(r"^(LAMP|SIZE|FINISH|MATERIAL|SKU)\s*:\s*(.*)$", re.I)
MIN_IMG_PT = 120  # skip badge icons (~90pt) and thin decorations


def norm_code(code) -> str:
    return re.sub(r"[\s\-]+", "", str(code or "")).upper()


def slug(code: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")


def page_items(page):
    """Items on a page: code, anchor point, and field lines in its column."""
    lines = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            spans = [s for s in l["spans"] if s["text"].strip()]
            if spans:
                lines.append(spans)

    items = []
    other = []  # (x0, y0, text) non-label lines
    badges = []  # (x0, y0, "DIMMABLE" | "TUNABLE") small icons printed by the item
    for spans in lines:
        text = "".join(s["text"] for s in spans)
        if not LABEL_RE.search(text):
            x0, y0 = spans[0]["bbox"][0], spans[0]["bbox"][1]
            word = text.strip().upper()
            if word in ("DIMMABLE", "TUNABLE"):
                badges.append((x0, y0, word))
            else:
                other.append((x0, y0, text.strip()))
            continue
        # One line can hold several "ITEM NO" labels side by side. Walk the
        # spans; a label starts a new item at that span's x.
        cur = None
        for s in spans:
            t = s["text"]
            parts = LABEL_RE.split(t)
            for i, part in enumerate(parts):
                if i > 0:
                    cur = {"x": s["bbox"][0], "y": s["bbox"][1], "code": ""}
                    items.append(cur)
                if cur is not None:
                    cur["code"] += part
    for it in items:
        it["code"] = re.sub(r"\s+", " ", it["code"]).strip(" .:")
    items = [it for it in items if it["code"]]

    # Attach field lines: same column (x within 40pt), below the label, and
    # above the next label in that column.
    for it in items:
        below = [o for o in items if o is not it and abs(o["x"] - it["x"]) < 40 and o["y"] > it["y"]]
        stop = min((o["y"] for o in below), default=it["y"] + 140)
        it["fields"] = {}
        it["loose"] = []
        for x0, y0, text in other:
            if it["y"] < y0 < stop and it["x"] - 5 <= x0 <= it["x"] + 260:
                m = FIELD_RE.match(text)
                if m:
                    it["fields"][m.group(1).upper()] = m.group(2).strip()
                elif re.fullmatch(r"\d{4,7}", text):
                    it["loose"].append(text)

    # Dimmable / tunable badges go to the nearest item.
    for it in items:
        it["badges"] = set()
    for x0, y0, word in badges:
        if items:
            near = min(items, key=lambda it: (it["x"] - x0) ** 2 + (it["y"] - y0) ** 2)
            near["badges"].add(word)
    return items


def score_for(it, bbox):
    """How well a photo at `bbox` fits an item: same column, then just above it."""
    x0, y0, x1, y1 = bbox
    overlap = x0 - 25 <= it["x"] <= x1
    gap = it["y"] - y1 if it["y"] >= y1 else (0 if y0 <= it["y"] <= y1 else 10_000)
    return (0 if overlap else 1, gap, abs(it["x"] - x0))


def assign_images(page, clean_page, items, icons):
    """Map each product photo on the page to one item."""
    out = {id(it): [] for it in items}
    if not items:
        return out
    regions = photo_regions(page, clean_page, MIN_IMG_PT, MIN_IMG_PT, icons=icons)
    for info in regions:
        if len(items) == 1:
            out[id(items[0])].append(info)
            continue
        out[id(min(items, key=lambda it: score_for(it, info.bbox)))].append(info)
    # An item left without a photo (layered "Updated" pages) shares the
    # closest photo printed in its own column, above it.
    for it in items:
        if out[id(it)]:
            continue
        fits = [r for r in regions if score_for(it, r.bbox)[0] == 0 and score_for(it, r.bbox)[1] < 10_000]
        if fits:
            out[id(it)].append(min(fits, key=lambda r: score_for(it, r.bbox)))
    return out


def split_sku(sku: str, loose):
    sku = (sku or "").replace(" ", "")
    m = re.fullmatch(r"(\d{4,7})?(.*?[A-Z])(\d{4,7})?", sku)
    if not m:
        return sku or None, (int(loose[0]) if loose else None)
    lead, base, tail = m.groups()
    num = tail or lead or (loose[0] if loose else None)
    return base or None, int(num) if num else None


def main():
    OUT_IMG.mkdir(exist_ok=True)
    for old in list(OUT_IMG.glob("g1_*.webp")) + list(OUT_IMG.glob("gm_*.webp")):
        old.unlink()
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    old_type = {
        norm_code(c["sourceCode"]): c["decorType"]
        for c in catalog
        if c["kind"] == "decorative"
    }
    kept = [c for c in catalog if c.get("source") != SOURCE]

    rows, seen_ids = [], {c["id"] for c in kept}
    stats = {"items": 0, "with_images": 0, "images": 0}
    for prefix, pdf in PDFS:
        doc = pymupdf.open(pdf)
        clean, icons = textless(doc), icon_xrefs(doc)
        for pno, page in enumerate(doc, start=1):
            items = page_items(page)
            imgs = assign_images(page, clean[pno - 1], items, icons)
            for it in items:
                f = it["fields"]
                sku, list_number = split_sku(f.get("SKU"), it["loose"])
                base_id = "geo-" + slug(it["code"])
                sysid, n = base_id, 2
                while sysid in seen_ids:
                    sysid, n = f"{base_id}-{n}", n + 1
                seen_ids.add(sysid)
                names = []
                for k, region in enumerate(imgs[id(it)], start=1):
                    name = f"{prefix}_p{pno:03d}_{sysid[4:]}_r{k}.webp"
                    region.save(OUT_IMG / name)
                    names.append(name)
                dtype = old_type.get(norm_code(it["code"]), "Hanging light")
                lamp = f.get("LAMP")
                options = [
                    {"interface": w, "control": w.lower(), "price": None}
                    for w in ("DIMMABLE", "TUNABLE")
                    if w in it["badges"]
                ]
                rows.append({
                    "id": sysid,
                    "sourceCode": it["code"],
                    "name": f"{dtype} {it['code']}",
                    "kind": "decorative",
                    "decorType": dtype,
                    "mounting": None,
                    "style": None,
                    "indoorOutdoor": None,
                    "unit": "nos",
                    "unitCost": 0,
                    "size": f.get("SIZE"),
                    "finish": f.get("FINISH"),
                    "material": f.get("MATERIAL"),
                    "lamp": lamp,
                    "sku": sku,
                    "listNumber": list_number,
                    "automatic": bool(options),
                    "interfaceOptions": options,
                    "rules": [],
                    "source": SOURCE,
                    "catalogPage": f"{pdf.stem} p.{pno}",
                    "images": names,
                })
                stats["items"] += 1
                stats["images"] += len(names)
                stats["with_images"] += bool(names)

    CATALOG.write_text(json.dumps(kept + rows, ensure_ascii=False), encoding="utf-8")
    print(stats, "no specs:", sum(1 for r in rows if not r["size"]),
          "no listNumber:", sum(1 for r in rows if r["listNumber"] is None))


if __name__ == "__main__":
    main()
