"""
Add the Lampzon outdoor catalogue (2026-27) to the catalogue.

    python scripts/add-lampzon.py

../rawdata/LZ-merged_tbu.pdf is scanned (every page is one image, no text),
so the products below were typed in from it. Each row gives the catalogue page
(printed number; PDF page = printed + 3) and the product photo's box on that
page in 80-dpi pixels (page = 662 x 936 px), which is rendered at 200 dpi to
../rawdata/catalog-images-web as lz_p<page>_<n>.webp.

The catalogue prints no price, so unitCost is 0 and employees type a rate.
Unless a row says otherwise every product is die-cast aluminium, body colour
Graphite Grey | Black, AC 100-240V, IP65.

Re-running replaces the Lampzon rows and keeps the SKUs already handed out.
"""

import io
import json
import re
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
PDF = RAW / "LZ-merged_tbu.pdf"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"
SOURCE = "Lampzon Product Catalogue 2026-27"
COMPANY = "Lampzon"
PAGE_OFFSET = 3
CCT3 = "3000K | 4000K | 6000K"

# Photo boxes shared by the gate / bollard layouts (80-dpi px).
TWO_ROW = [(325, 125, 480, 385), (325, 515, 480, 815)]
THREE_ROW = [(215, 130, 355, 285), (215, 365, 355, 565), (215, 635, 355, 885)]


def posts(page, series, code, led, glass, heights, width, layout, cct=CCT3, extra=None):
    """Gate / bollard / tall bollard versions of one post-light series."""
    kinds = ["Gate Light", "Bollard Light", "Tall Bollard Light"]
    boxes = TWO_ROW if layout == 2 else THREE_ROW
    out = []
    for i, h in enumerate(heights):
        out.append({
            "page": page,
            "box": boxes[i],
            "series": series,
            "type": kinds[i],
            "code": code,
            "led": (extra or {}).get(i, led),
            "cct": cct,
            "material": f"Die Casting Aluminium With {glass}",
            "size": f'H {h}" × W {width}"',
            "category": "Gate & Bollard Lights",
        })
    return out


def wall(page, box, series, code, led, size, cct="3000K | 6000K", lens="Pc Lens", kind="Wall Light",
         category="Outdoor Wall Lights"):
    return {
        "page": page,
        "box": box,
        "series": series,
        "type": kind,
        "code": code,
        "led": led,
        "cct": cct,
        "material": f"Die Casting Aluminium With {lens}" if lens else "Die Casting Aluminium",
        "size": size,
        "category": category,
    }


PC, TG, PD = "Pc Glass", "Toughened Glass", "Pc Diffuser"

ITEMS = [
    *posts(1, "Meta", "IL-1461", "12W", PC, [12, 24], 6, 2),
    *posts(2, "Meta Crysta", "IL-1462", "12W", PC, [12, 24], 6, 2),
    *posts(3, "Meta Cob", "IL-1463", "12W COB", PC, [12, 24], 6, 2),
    *posts(4, "Tulip", "IL-8607", "12W", PC, [9, 24], 9, 2),
    *posts(5, "Shivt", "IL-1519", "12W", PC, [12, 24], 6.5, 2),
    *posts(6, "Unicorn", "IL-1515", "12W COB", TG, [10, 24], 6, 2),
    *posts(7, "Eiffel Tower", "IL-1465", "12W", PC, [12, 24], 4, 2),
    *posts(8, "Glanza", "IL-1086", "12W", PC, [10, 24], 3, 2),
    *posts(9, "Signature", "IL-8899", "12W COB", TG, [10.5, 24], 3.5, 2),
    *posts(10, "Quad", "IL-9885", "12W COB", TG, [12, 24], 4, 2),
    {**posts(11, "Glare", "IL-1052", "12W | 18W", TG, [14], 11, 2)[0]},
    {**posts(11, "Glare", "IL-177 LED", "12W | 18W", TG, [15], 11, 2)[0],
     "type": "Bollard Light", "box": (330, 560, 470, 805)},
    {**posts(12, "Quantum", "IL-7788", "8W LED / Holder E-27", PC, [6.5], 6.5, 2)[0]},
    {**posts(12, "Quantum", "IL-7788", "15W LED / Holder E-27", PC, [10.5], 10.5, 2)[0],
     "type": "Large Gate Light", "box": (325, 575, 480, 760)},
    *posts(13, "TDI", "IL-177", "Holder E-27", TG, [15, 27, 39], 11, 3, cct=None),
    *posts(14, "TDI LED", "IL-177 (LED)", "12W | 18W", TG, [15, 27, 39], 11, 3),
    *posts(15, "Yureca", "IL-1050", "12W", PC, [10, 20, 30], 8.25, 3),
    *posts(16, "Pearl", "IL-1051", "12W", PC, [11, 20, 30], 8, 3),
    *posts(17, "Moon Round", "IL-7080", "12W | 18W", PC, [10, 20, 30], 7, 3),
    *posts(18, "Moon Square", "IL-7082", "12W", PD, [10, 20, 30], 7, 3),
    *posts(19, "Leo", "IL-1062", "12W", PD, [10, 20, 30], 8, 3),
    *posts(20, "Twin Tower", "IL-1063", "24W", PD, [10, 20, 30], 16, 3),
    wall(21, (30, 125, 175, 275), "Sunny", "IL-4408", "8W", "77 × 77mm", cct="3000K | 6000K | RGB"),
    wall(21, (30, 330, 175, 490), "Crystal Ball", "IL-4404", "1×4=4W | 3×4=12W", "77 × 77mm",
         cct="3000K | 6000K | RGB"),
    wall(21, (30, 520, 175, 675), "Crystal Ball", "IL-4406", "2×3=6W", "77 × 77mm"),
    wall(21, (30, 720, 175, 870), "Crystal Ball", "IL-4403", "1×3=3W", "77 × 77mm"),
    wall(22, (20, 140, 185, 240), "Turtle", "IL-4102", "2W", "75 × 75mm", cct="3000K | 6000K | RGB"),
    wall(22, (20, 340, 185, 455), "Turtle", "IL-4104", "4W", "155 × 80mm", cct="3000K | 6000K | RGB"),
    wall(22, (20, 530, 185, 650), "Turtle", "IL-4106", "6W", "170 × 80mm", cct="3000K | 6000K | RGB"),
    wall(23, (230, 130, 345, 285), "Nexon A", "IL-8720", "8W", "55 × 100mm", cct="3000K"),
    wall(23, (230, 395, 345, 550), "Nexon B", "IL-8720", "8W", "55 × 100mm", cct="3000K"),
    wall(23, (230, 660, 345, 815), "Nexon C", "IL-8720", "8W", "55 × 100mm", cct="3000K"),
    wall(24, (225, 130, 320, 285), "Nexon D", "IL-8720", "8W", "55 × 100mm", cct="3000K"),
    wall(24, (225, 395, 320, 550), "Nexon P", "IL-8720", "8W", "55 × 100mm", cct="3000K"),
    wall(25, (215, 170, 350, 275), "Harrier 1", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(25, (215, 435, 350, 540), "Harrier 2", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(25, (215, 700, 350, 810), "Harrier 3", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(26, (215, 170, 350, 275), "Harrier 4", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(26, (215, 435, 350, 540), "Harrier 5", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(26, (215, 700, 350, 810), "Harrier 6", "IL-7835", "12W", "165 × 85mm", cct="3000K | RGB"),
    wall(27, (30, 120, 175, 280), "Wonder", "IL-4566", "8W", "50 × 100mm"),
    wall(27, (30, 335, 175, 490), "Dhruv", "IL-218", "12W", "68 × 190mm"),
    wall(27, (30, 580, 175, 655), "Hybrid", "IL-939", "2W", "100 × 60mm"),
    wall(27, (20, 760, 185, 840), "Hybrid", "IL-939", "3W", "160 × 60mm"),
    wall(28, (30, 95, 145, 285), "Leaf", "IL-0606", "2W", "87 × 125mm", cct="3000K"),
    wall(28, (20, 330, 185, 490), "Butterfly", "IL-066", "6W", "150 × 150mm", cct="3000K"),
    wall(28, (20, 550, 175, 705), "Sheild", "IL-129 (2+1)", "3W", "100 × 125mm", cct="3000K"),
    wall(28, (5, 725, 190, 875), "Sheild", "IL-129 (3+2)", "5W", "100 × 125mm", cct="3000K"),
    *[
        wall(29, (x0, y0, x0 + 175, y0 + 163), "Prism", f"IL-0222/{v}", f"{w}W", dim, cct=None, lens=None,
             kind="Outdoor Light")
        for (v, w, dim), (x0, y0) in zip(
            [("1", 1, "140 × 95 × 40mm"), ("2", 2, "175 × 95 × 40mm"), ("3", 3, "Ø175 × 40mm"),
             ("Y", 4, "175 × 130 × 40mm"), ("X", 4, "160 × 100 × 40mm"), ("4", 4, "Ø175 × 40mm"),
             ("5", 5, "Ø175 × 40mm"), ("6", 6, "Ø175 × 40mm"), ("8", 8, "Ø175 × 40mm")],
            [(x, y) for y in (135, 388, 637) for x in (43, 243, 443)],
        )
    ],
    wall(30, (50, 105, 155, 270), "Moon Round", "IL-7080", "12W", "Ø175mm", lens=PD),
    wall(30, (55, 310, 160, 485), "Moon Square", "IL-7082", "12W", "175 × 175mm", lens=PD),
    wall(31, (35, 120, 150, 265), "Cube", "IL-1192", "1W", "40 × 45mm"),
    wall(31, (35, 310, 150, 455), "Cube", "IL-1192", "2W", "40 × 50mm"),
    wall(31, (20, 550, 160, 660), "Square Foot Light", "IL-25", "3W", "80 × 46mm", lens=None,
         kind="Foot Light", category="Foot Lights"),
    wall(31, (20, 730, 160, 840), "Round Foot Light", "IL-25", "3W", "80 × 46mm", lens=None,
         kind="Foot Light", category="Foot Lights"),
    wall(32, (40, 155, 145, 255), "Foot Light", "IL-033 (3x3)", "3W", "76 × 76mm", lens=PC,
         kind="Foot Light", category="Foot Lights"),
    wall(32, (30, 340, 155, 440), "Foot Light", "IL-7422 (4x3)", "6W", "101 × 76mm", lens=PC,
         kind="Foot Light", category="Foot Lights"),
    wall(32, (20, 525, 165, 640), "Foot Light", "IL-7422 (5x3)", "6W", "127 × 76mm", lens=PC,
         kind="Foot Light", category="Foot Lights"),
    wall(33, (35, 150, 150, 270), "K-Lite", "IL-059", "3W | 5W", "80 × 75mm", lens=TG),
    wall(33, (35, 310, 150, 460), "K-Lite", "IL-059", "6W | 10W", "80 × 140mm", lens=TG),
    wall(33, (40, 555, 145, 660), "Purse", "IL-234", "12W", "115 × 80mm", lens=TG),
    wall(33, (20, 745, 160, 840), "Purse", "IL-234", "18W", "175 × 90mm", lens=TG),
]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    doc = pymupdf.open(PDF)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    per_page = {}
    rows, seen = [], set()
    for it in ITEMS:
        pn = it["page"] + PAGE_OFFSET
        n = per_page[pn] = per_page.get(pn, 0) + 1
        x0, y0, x1, y1 = it["box"]
        page = doc[pn - 1]
        # Boxes are in 80-dpi px; render that part of the page at 200 dpi.
        clip = pymupdf.Rect(x0, y0, x1, y1) * (72 / 80)
        pix = page.get_pixmap(dpi=200, clip=clip, alpha=False)
        im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        im.thumbnail((1200, 1200))
        name = f"lz_p{it['page']:02d}_{n}.webp"
        im.save(OUT_IMG / name, "WEBP", quality=82, method=6)

        watts = [float(w) for w in re.findall(r"(\d+(?:\.\d+)?)\s*W\b", it["led"].replace("×", " "))]
        series = it["series"]
        label = f"{series} {it['type']}" if it["type"] not in series else series
        name_txt = f"{label} {it['code']}"
        if it["type"] in ("Gate Light", "Bollard Light", "Tall Bollard Light", "Large Gate Light"):
            name_txt += f' ({it["size"].split(" ×")[0].replace("H ", "")})'
        base = f"lz-{slug(it['code'])}-{slug(series)}-{slug(it['type'])}"
        iid, k = base, 2
        while iid in seen:
            iid, k = f"{base}-{k}", k + 1
        seen.add(iid)
        rows.append({
            "id": iid,
            "sourceCode": it["code"],
            "name": name_txt,
            "kind": "functional",
            "category": it["category"],
            "layer": 5,
            "automatic": False,
            "interfaceOptions": [],
            "finishOptions": [],
            "unit": "nos",
            "unitCost": 0,
            "size": it["size"],
            "cutout": None,
            "finish": "Graphite Grey | Black",
            "watt": it["led"],
            "wattNum": max(watts) if watts else None,
            "ledSource": None,
            "material": it["material"],
            "ipRating": "IP65",
            "colour": it["cct"],
            "rules": [],
            "source": SOURCE,
            "company": COMPANY,
            "images": [name],
        })

    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    old = {s["id"]: s.get("slSku") for s in data if s.get("source") == SOURCE}
    data = [s for s in data if s.get("source") != SOURCE]
    used = [int(m.group(1)) for s in data if (m := re.match(r"SL-F(\d+)$", s.get("slSku") or ""))]
    used += [int(m.group(1)) for v in old.values() if v and (m := re.match(r"SL-F(\d+)$", v))]
    nxt = max(used, default=0) + 1
    for r in rows:
        r["slSku"] = old.get(r["id"]) or f"SL-F{nxt:04d}"
        if not old.get(r["id"]):
            nxt += 1
    data.extend(rows)
    CATALOG.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"{len(rows)} Lampzon products")


if __name__ == "__main__":
    main()
