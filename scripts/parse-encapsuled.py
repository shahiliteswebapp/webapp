"""
Import the Encapsuled IP67 profile light catalogue.

    python scripts/parse-encapsuled.py

Reads ../rawdata/Product Catalogue-Encapsuled (IP-67 Profile Lights) (3)_tbu.pdf:
landscape spreads, each half (or quarter) a product headed by its name in
12pt ("EL-R1520U"), with a spec table (Watts/ Meter, Dimension, Finish, ...)
and a photo. The catalogue prints no price, so unitCost is 0 and employees
type a rate per metre. Photos go to ../rawdata/catalog-images-web as
encap_p<page>_<n>.webp.

Re-running replaces the Encapsuled rows and keeps the SKUs already handed out.
"""

import json
import re
from pathlib import Path

import pymupdf

from pdf_photos import icon_xrefs, photo_regions, textless

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
PDF = RAW / "Product Catalogue-Encapsuled (IP-67 Profile Lights) (3)_tbu.pdf"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"
SOURCE = "Encapsuled IP67 Profile Lights catalogue"
COMPANY = "Encapsuled"

FIELDS = {
    "watts": re.compile(r"^watts?\s*/\s*met(er|re)", re.I),
    "dimension": re.compile(r"^(overall\s+)?dimensions?$", re.I),
    "finish": re.compile(r"^finish", re.I),
    "cct": re.compile(r"^colou?r\s*temp", re.I),
    "colour": re.compile(r"^colou?r$", re.I),
    "mounting": re.compile(r"^mounting", re.I),
    "optics": re.compile(r"^optics", re.I),
    "dimming": re.compile(r"^dimming", re.I),
}


def clean(s):
    return re.sub(r"\s+", " ", s).strip()


def lines_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = clean(" ".join(s["text"] for s in ln["spans"]))
            if t:
                out.append({"t": t, "r": pymupdf.Rect(ln["bbox"]), "size": max(s["size"] for s in ln["spans"])})
    return out


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    doc = pymupdf.open(PDF)
    clean_doc = textless(doc)
    icons = icon_xrefs(doc)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    items, seen = [], set()
    for pi, page in enumerate(doc):
        lines = lines_of(page)
        titles = [l for l in lines if abs(l["size"] - 12) < 0.3 and re.match(r"^EL\s*[-–]", l["t"], re.I)]
        if not titles:
            continue
        mid = page.rect.width / 2 if page.rect.width > page.rect.height else page.rect.width
        regions = photo_regions(page, clean_doc[pi], min_w=80, min_h=50, icons=icons)
        saved = 0
        for t in titles:
            half = 0 if t["r"].x0 < mid else 1
            x0, x1 = (0, mid) if half == 0 else (mid, page.rect.width)
            # A title owns its half of the spread down to the next title in it.
            below = [o["r"].y0 for o in titles if o is not t and x0 <= o["r"].x0 < x1 and o["r"].y0 > t["r"].y0]
            y0 = t["r"].y0 - 5
            y1 = min(below, default=page.rect.height)
            sect = pymupdf.Rect(x0, y0 if t["r"].y0 > 100 else 0, x1, y1)
            f = {}
            for l in lines:
                if not sect.contains(l["r"]):
                    continue
                for k, rx in FIELDS.items():
                    if rx.match(l["t"]) and k not in f:
                        # Value lines to the right, centred within the label's row
                        # (a two-line value straddles a one-line label).
                        cy = (l["r"].y0 + l["r"].y1) / 2
                        vals = sorted(
                            (v for v in lines
                             if v is not l and sect.contains(v["r"]) and v["r"].x0 > l["r"].x1 + 4
                             and v["r"].x0 < l["r"].x1 + 260
                             and abs((v["r"].y0 + v["r"].y1) / 2 - cy) < 7),
                            key=lambda v: (v["r"].y0, v["r"].x0),
                        )
                        f[k] = clean(" ".join(v["t"] for v in vals)) or None
            name = clean(t["t"].replace("–", "-"))
            name = re.sub(r"^EL\s*-\s*", "EL-", name)
            code = name.split(" ")[0] if not re.match(r"^EL-(R|OVER|TILT|OPTICS|FLEX)\b\s+\S", name) else name
            iid = f"encap-{slug(name)}"
            # Lens photometry pages and the combined Tilt intro are not products
            # of their own (the Optics and Tilt variants are).
            if "LENS" in name or name.startswith("EL-TILT ASYMMYTRIC/"):
                continue
            if iid in seen:
                continue
            seen.add(iid)
            reg = [r for r in regions if sect.intersects(r.rect) and (r.rect & sect).width * (r.rect & sect).height > 0.6 * r.rect.width * r.rect.height]
            images = []
            if reg:
                big = max(reg, key=lambda r: r.rect.width * r.rect.height)
                saved += 1
                img = f"encap_p{pi + 1:02d}_{saved}.webp"
                big.save(OUT_IMG / img)
                images = [img]
            if not images and not f:
                continue  # customisation sketches, not products
            watts = f.get("watts")
            wnum = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*W", watts or "")]
            dim = f.get("dimension")
            items.append({
                "id": iid,
                "sourceCode": code,
                "name": f"IP67 Encapsulated Profile Light {name}",
                "kind": "functional",
                "category": "IP67 Profile Lights",
                "layer": 5,
                "automatic": False,
                "interfaceOptions": [],
                "finishOptions": [],
                "unit": "mtr",
                "unitCost": 0,
                "size": dim,
                "cutout": None,
                "finish": f.get("finish"),
                "watt": watts,
                "wattNum": max(wnum) if wnum else None,
                "ledSource": None,
                "ipRating": "IP67",
                "colour": f.get("cct"),
                "rules": [],
                "source": SOURCE,
                "company": COMPANY,
                "images": images,
            })

    data = json.loads(CATALOG.read_text(encoding="utf-8"))
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
    CATALOG.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    for it in items:
        print(it["sourceCode"], "|", it["watt"], "|", it["size"], "|", it["finish"], "|", it["images"])
    print(f"{len(items)} Encapsuled products")


if __name__ == "__main__":
    main()
