"""
Import the Arya "Majestic" LED price list (rawdata/GOVINDAM.pdf, from the
distributor Govindam) into the catalogue.

    python scripts/add-arya.py

The PDF is a scan (one picture per page, no text), so the rows below are
typed in from it. Each product's photo is cut from the framed box on the left
of its section and saved to rawdata/catalog-images-web as arya_p<page>_<n>_r1.webp.
Price = the Dealer Price, the only price printed (client's choice).
Re-running replaces the Arya rows and keeps the SKUs already handed out.
"""

import json
import re
import sys
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pdf_photos import _trim  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT.parent / "rawdata" / "GOVINDAM.pdf"
DATA = ROOT / "src" / "lib" / "catalog-data.json"
IMG_DIR = ROOT.parent / "rawdata" / "catalog-images-web"
SOURCE = "GOVINDAM.pdf (Arya Majestic LED price list)"
COMPANY = "Arya"

# (page, photo frame in points, series, category, layer, rows: (model, dimension, cut-off, price))
SECTIONS = [
    (2, (64, 92, 206, 220), "Spoton M", "COB Spot Lights", 3, [
        ("ANCBSM-7W", "63*61", "50", 277),
        ("ANCBSM-12W", "82*79", "74", 354),
        ("ANCBSM-18W", "95*100", "85", 490),
    ]),
    (2, (64, 253, 206, 380), "Spoton Gold", "COB Spot Lights", 3, [
        ("ANCBGM-7W", "75*60", "50", 395),
        ("ANCBGM-12W", "85*70", "74", 507),
    ]),
    (2, (64, 413, 206, 540), "Spoton Surface (Cylinder)", "COB Spot Lights", 3, [
        ("ANCBC-7W", "60*75", None, 354),
        ("ANCBC-12W", "70*85", None, 490),
        ("ANCBC-18W", "85*100", None, 696),
    ]),
    (2, (64, 573, 206, 700), "Spoton (Curve)", "COB Spot Lights", 3, [
        ("ANCB0SC-7W", "70*50", "65", 300),
        ("ANCB0SC-12W", "85*65", "80", 395),
        ("ANCB0SC-18W", "95*75", "90", 507),
    ]),
    (3, (64, 92, 206, 220), "CB06 Housing (Tracklight Linear Patti)", "Track & Wall Lights", 3, [
        ("ANCBT-10W", "50*130", None, 354),
        ("ANCBT-20W", "65*160", None, 608),
        ("ANCBT-30W", "75*180", None, 797),
    ]),
    (3, (64, 251, 206, 378), "CB06 Housing (Tracklight Wall Mounted)", "Track & Wall Lights", 3, [
        ("CB06-20W", None, None, 667),
        ("CB06-30W", None, None, 903),
    ]),
    (3, (64, 412, 206, 540), "CB07 Housing (Tracklight Lens)", "Track & Wall Lights", 3, [
        ("ANCBTL-10W", "50*130", None, 460),
        ("ANCBTL-20W", "65*160", None, 637),
        ("ANCBTL-30W", "75*180", None, 855),
    ]),
    (3, (64, 624, 206, 752), "CB11 Roto M (Moveable)", "COB Spot Lights", 3, [
        ("ANCBRM-3W", "67*36", "53", 224),
        ("ANCBRM-6W", "85*52", "80", 295),
        ("ANCBRM-9W", "85*52", "80", 348),
        ("ANCBRM-16W", "105*60", "95", 513),
        ("ANCBRM-24W", "135*72", "115", 725),
        ("ANCBRM-30W", "154*87", "135", 991),
        ("ANCBRM-50W", "130*160", "138", 1204),
    ]),
    (4, (64, 92, 206, 220), "Cylinder Tilt Housing", "COB Spot Lights", 3, [
        ("ANCBCT-7W", None, None, 408),
        ("ANCBCT-12W", None, None, 495),
        ("ANCBCT-18W", None, None, 738),
    ]),
    (4, (64, 253, 206, 380), "Drum Deep Down Light", "Panel & Down Lights", 1, [
        ("ANDDT10-12W", None, None, 330),
        ("ANDDT10-18W", None, None, 448),
    ]),
    (4, (64, 413, 206, 540), "Wall Mount Series", "Façade Lights", 6, [
        ("ANCBFK-4W", None, None, 200),
    ]),
    (4, (64, 573, 206, 700), "Wall Mount Series", "Façade Lights", 6, [
        ("ANCBFK-7W", None, None, 297),
    ]),
    (5, (64, 92, 206, 220), "Wall Mount Boll Light Small 4 Way (8W & 12W)", "Façade Lights", 6, [
        ("ANWIBS", None, None, 265),
    ]),
    (5, (64, 253, 206, 380), "Wall Mount Boll Light Big 4 Way (12W & 16W)", "Façade Lights", 6, [
        ("ANWIBC", None, None, 330),
    ]),
    (5, (64, 413, 206, 540), "Wall Mount Up-Down Light 1+1", "Façade Lights", 6, [
        ("ANCBWC 1+1-4W", None, None, 218),
    ]),
    (5, (64, 573, 206, 700), "Wall Mount Up-Down Light 2+2", "Façade Lights", 6, [
        ("ANCBWC 2+2-8W", None, None, 295),
    ]),
    (6, (64, 92, 206, 220), "Wall Mount Up-Down Light 3+3", "Façade Lights", 6, [
        ("ANCBWC 3+3-12W", None, None, 372),
    ]),
]


def mm(v):
    return f"{v.replace('*', ' x ')} mm" if v else None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    doc = pymupdf.open(PDF)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    items, per_page = [], {}
    for page, frame, series, cat, layer, rows in SECTIONS:
        n = per_page[page] = per_page.get(page, 0) + 1
        name = f"arya_p{page}_{n}_r1.webp"
        x0, y0, x1, y1 = frame
        rect = pymupdf.Rect(x0 + 4, y0 + 4, x1 - 4, y1 - 4)  # inside the printed frame
        pix = doc[page - 1].get_pixmap(dpi=300, clip=rect, alpha=False)
        im = _trim(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
        im.thumbnail((1200, 1200), Image.LANCZOS)
        im.save(IMG_DIR / name, "WEBP", quality=82, method=6)
        for model, dim, cut, price in rows:
            watt = re.search(r"(\d+)W\b", model) or re.search(r"(\d+)W", series)
            items.append({
                "id": f"arya-{slug(model)}",
                "sourceCode": model,
                "name": f"{series} {model}",
                "kind": "functional",
                "category": cat,
                "layer": layer,
                "automatic": False,
                "interfaceOptions": [],
                "finishOptions": [],
                "unit": "nos",
                "unitCost": float(price),
                "size": mm(dim),
                "cutout": mm(cut),
                "finish": None,
                "watt": f"{watt.group(1)}W" if watt else None,
                "wattNum": float(watt.group(1)) if watt else None,
                "ledSource": "COB" if model.startswith(("ANCB", "CB0")) else None,
                "ipRating": None,
                "colour": None,
                "rules": [],
                "source": SOURCE,
                "company": COMPANY,
                "images": [name],
            })

    data = json.loads(DATA.read_text(encoding="utf-8"))
    old = {s["id"]: s.get("slSku") for s in data if s.get("source") == SOURCE}
    data = [s for s in data if s.get("source") != SOURCE]
    used = [int(m.group(1)) for s in data if (m := re.match(r"SL-F(\d+)$", s.get("slSku") or ""))]
    used += [int(m.group(1)) for v in old.values() if v and (m := re.match(r"SL-F(\d+)$", v))]
    nxt = max(used, default=0) + 1
    for it in items:
        it["slSku"] = old.get(it["id"]) or f"SL-F{nxt:04d}"
        if not old.get(it["id"]):
            nxt += 1
    data.extend(items)
    DATA.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"{len(items)} Arya products, {len(SECTIONS)} photos")


if __name__ == "__main__":
    main()
