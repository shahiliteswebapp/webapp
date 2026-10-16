"""
Import the ALS (Architectural Lighting Solutions) dealer price list, with
photos from the ALS catalogue.

    python scripts/parse-als.py

Reads from ../rawdata:
    Dealer Price List_Mar 26_ALS_tbu.pdf      one table row per product, price per metre
    ALS Catalogue 2026_Digital (11)_tbu.pdf   a product photo under each "NNN-ALS-XXXX" heading

Price = the dealer price printed in the list (per metre for profiles; the
quantity slabs in the footer are ignored). Photos are rendered from the
text-free catalogue page (scripts/pdf_photos.py) to ../rawdata/catalog-images-web
as als_p<page>_<n>.webp.

Re-running replaces the ALS rows and keeps the SKUs already handed out.
"""

import json
import re
from pathlib import Path

import pymupdf

from pdf_photos import icon_xrefs, photo_regions, textless

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
PRICES = RAW / "Dealer Price List_Mar 26_ALS_tbu.pdf"
CATALOGUE = RAW / "ALS Catalogue 2026_Digital (11)_tbu.pdf"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"
SOURCE = "ALS Dealer Price List Mar 26"
COMPANY = "ALS"



def clean(v):
    return re.sub(r"\s+", " ", (v or "").replace("\n", " ")).strip()


def layer_for(series, desc):
    text = f"{series} {desc}".lower()
    if "cove" in text or "flexible" in text or "asymmetric" in text:
        return 2
    if "channel" in text:
        return None
    return 1


CODE_WORD = re.compile(r"^(?:CH-(?:EXT-)?)?ALS-[A-Z]?\d{3,5}$")
MONEY = re.compile(r"^(\d[\d,]*\.\d{2})(/Mtr)?$", re.I)


def band_text(words, x0, x1, y0, y1):
    ws = [w for w in words if x0 <= w[0] < x1 and y0 <= (w[1] + w[3]) / 2 < y1]
    ws.sort(key=lambda w: (round(w[1] / 4), w[0]))
    return " ".join(w[4] for w in ws)


def parse_prices():
    """One product per code in the left-hand code column; its row is the band
    of the page between it and its neighbours (the tables' cell grid is too
    irregular for find_tables)."""
    doc = pymupdf.open(PRICES)
    items = {}
    for pn, page in enumerate(doc, 1):
        W = page.rect.width
        tabs = page.find_tables().tables
        title = clean((tabs[0].extract()[0][0] if tabs and tabs[0].extract() else "") or "")
        series = title if len(title) > 3 else "Aluminium Profile Series"
        words = page.get_text("words")
        codes = sorted(
            (w for w in words if CODE_WORD.match(w[4]) and w[0] < 0.4 * W and w[1] < page.rect.height - 40),
            key=lambda w: w[1],
        )
        header_y = max((w[3] for w in words if w[4] == "Price"), default=60)
        for k, w in enumerate(codes):
            code = w[4]
            yc = (w[1] + w[3]) / 2
            y0 = header_y + 1 if k == 0 else (yc + (codes[k - 1][1] + codes[k - 1][3]) / 2) / 2
            y1 = page.rect.height - 40 if k + 1 == len(codes) else (yc + (codes[k + 1][1] + codes[k + 1][3]) / 2) / 2
            if code in items:
                continue
            num = next(
                (v[4] for v in words if re.fullmatch(r"\d{3}", v[4]) and abs(v[0] - w[0]) < 20 and 0 < w[1] - v[1] < 14),
                None,
            )
            money = [v for v in words if v[0] > 0.8 * W and y0 <= (v[1] + v[3]) / 2 < y1 and MONEY.match(v[4])]
            pm = MONEY.match(min(money, key=lambda v: abs((v[1] + v[3]) / 2 - yc))[4]) if money else None
            price = float(pm.group(1).replace(",", "")) if pm else 0
            # The Dimensions column starts at its "W :" line (it sits at a different x per table).
            wx = min(
                (v[0] for v in words if v[4] == "W" and v[0] > 0.6 * W and y0 <= (v[1] + v[3]) / 2 < y1),
                default=0.75 * W,
            )
            dims_text = band_text(words, wx - 2, 0.86 * W, y0, y1)
            dims = re.findall(r"\b(W|H|L|CO)\s*:\s*([\d.]+\s*(?:mm|Mtr)?)", dims_text)
            dim_d = {a: v.replace(" ", "") for a, v in dims}
            size = " × ".join(f"{a} {dim_d[a]}" for a in ("W", "H", "L") if a in dim_d) or None
            desc_text = band_text(words, 0.42 * W, wx - 2, y0, y1)
            desc = [clean(x) for x in desc_text.split("•") if clean(x)]
            left = band_text(words, 0.09 * W, w[0] - 4, y0, y1) if w[0] > 0.12 * W else ""
            left = re.sub(r"\s*\*+\s*", " ", left.replace("­ ", "").replace("­", ""))
            left = re.sub(r"^ALS\s*", "", left.strip()).strip() or None
            left = None if left in ("-", "ALS") else left
            kind_word = "Mounting Channel" if code.startswith("CH-") else (
                "Flexible Profile" if "-F" in code else "Aluminium Profile"
            )
            name = f"{kind_word} {code}" + (f" ({left})" if left else "")
            diffuser = next((d for d in desc if d.lower().startswith("diffuser")), None)
            items[code] = {
                "id": f"als-{code.lower()}",
                "sourceCode": f"{num}-{code}" if num else code,
                "name": name,
                "kind": "functional",
                "category": series,
                "layer": layer_for(series, " ".join(desc)),
                "automatic": False,
                "interfaceOptions": [],
                "finishOptions": [],
                "unit": "mtr" if (pm and pm.group(2)) or not pm else "nos",
                "unitCost": price,
                "size": size,
                "cutout": dim_d.get("CO"),
                "finish": "Anodised aluminium" if "anodised" in desc_text.lower() else None,
                "watt": None,
                "wattNum": None,
                "ledSource": None,
                "ipRating": None,
                "colour": re.sub(r"[\s\d.]+$", "", diffuser.split("-", 1)[-1]).strip() if diffuser else None,
                "rules": [],
                "source": SOURCE,
                "company": COMPANY,
                "images": [],
            }
    return items


def attach_photos(items):
    """Each catalogue heading "NNN-ALS-XXXX" gets the biggest photo in its half of the page."""
    doc = pymupdf.open(CATALOGUE)
    clean_doc = textless(doc)
    icons = icon_xrefs(doc)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    count = 0
    for pi, page in enumerate(doc):
        heads = []
        for b in page.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                t = " ".join(s["text"] for s in ln["spans"]).strip()
                m = re.fullmatch(r"\d{3}-((?:CH-)?ALS-[A-Z]?\d{3,5})", t)
                if m and max(s["size"] for s in ln["spans"]) >= 14 and m.group(1) in items:
                    heads.append((ln["bbox"][1], m.group(1)))
        if not heads:
            continue
        heads.sort()
        regions = photo_regions(page, clean_doc[pi], min_w=120, min_h=80, icons=icons)
        if not regions:
            continue
        saved = {}
        for k, (y, code) in enumerate(heads):
            if items[code]["images"]:
                continue
            # The section of the page this heading owns.
            top = 0 if k == 0 else y - 30
            bottom = page.rect.height if k + 1 == len(heads) else heads[k + 1][0] - 10
            inside = [r for r in regions if top <= (r.rect.y0 + r.rect.y1) / 2 <= bottom]
            if not inside:
                continue
            reg = max(inside, key=lambda r: r.rect.width * r.rect.height)
            key = tuple(reg.bbox)
            if key not in saved:
                name = f"als_p{pi + 1:03d}_{len(saved) + 1}.webp"
                reg.save(OUT_IMG / name)
                saved[key] = name
                count += 1
            items[code]["images"] = [saved[key]]
    return count


def main():
    items = parse_prices()
    photos = attach_photos(items)
    rows = list(items.values())
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    old = {s["id"]: s.get("slSku") for s in data if s.get("source") == SOURCE}
    data = [s for s in data if s.get("source") != SOURCE]
    used = [int(m.group(1)) for s in data if (m := re.match(r"SL-F(\d+)$", s.get("slSku") or ""))]
    used += [int(m.group(1)) for v in old.values() if v and (m := re.match(r"SL-F(\d+)$", v))]
    nxt = max(used, default=0) + 1
    for it in rows:
        it["slSku"] = old.get(it["id"]) or f"SL-F{nxt:04d}"
        if not old.get(it["id"]):
            nxt += 1
    data.extend(rows)
    CATALOG.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    priced = sum(1 for r in rows if r["unitCost"] > 0)
    with_img = sum(1 for r in rows if r["images"])
    print(f"{len(rows)} ALS products ({priced} priced, {with_img} with photos), {photos} photos")


if __name__ == "__main__":
    main()
