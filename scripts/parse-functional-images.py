"""
Product photos for the functional (priced) catalogues.

  ../rawdata/ECO 25-26 (V 1.5).pdf                  photo sits left of each "ITEM NO-GCL-xxx" block
  ../rawdata/Architectural Product list -Dec'25.pdf one photo (or a few) per product family,
                                                    left of an "Ordering Code" price table

Photos are rendered from the page with its text removed (scripts/pdf_photos.py)
so they keep the proportions and orientation they are printed with; badge
icons ("DIMMABLE", "TUNABLE") are skipped.

Writes webp files to ../rawdata/catalog-images-web (eco_* / arch_*) and sets
`images` on the matching functional rows of catalog-data.json. Idempotent.
Upload with scripts/upload-catalog-images.mjs.

Run from the repo root:  python scripts/parse-functional-images.py
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

ECO_PDF = RAW / "ECO 25-26 (V 1.5).pdf"
ARCH_PDF = RAW / "Architectural Product list -Dec'25.pdf"

# Captures the whole label after "ITEM NO-" ("GCL-131 STICK", "GCL-205 - [Mini
# Set of 9]"), which is how the catalogue rows name their variants.
ECO_ITEM_RE = re.compile(r"ITEM\s*NO\s*[-:]\s*(.+)$", re.I)
ECO_BASE_RE = re.compile(r"^[A-Z]+\s*-?\s*[A-Z]?\d+", re.I)


def norm(code) -> str:
    return re.sub(r"[\s\-]+", "", str(code or "")).upper()


def save_image(region, name, seen):
    """Save once per photo (the same photo can serve several items)."""
    if region.key in seen:
        return seen[region.key]
    region.save(OUT_IMG / name)
    seen[region.key] = name
    return name


def regions_of(page, clean_page, icons, keep=None, min_h=25):
    return photo_regions(page, clean_page, 25, min_h, keep=keep, icons=icons)


def lines_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for l in b["lines"]:
            text = "".join(s["text"] for s in l["spans"]).strip()
            if text:
                out.append((l["bbox"][0], l["bbox"][1], text))
    return out


def eco_images():
    """code -> [image names]"""
    doc = pymupdf.open(ECO_PDF)
    clean, icons = textless(doc), icon_xrefs(doc)
    seen, result = {}, {}
    for pno, page in enumerate(doc, start=1):
        items = []
        for x, y, text in lines_of(page):
            m = ECO_ITEM_RE.search(text)
            if m:
                items.append({"x": x, "y": y, "code": m.group(1)})
        if not items:
            continue
        imgs = regions_of(page, clean[pno - 1], icons)
        for it in items:
            below = [o["y"] for o in items if abs(o["x"] - it["x"]) < 40 and o["y"] > it["y"]]
            y_end = min(below, default=it["y"] + 110)
            for info in imgs:
                x0, y0, x1, y1 = info.bbox
                cy = (y0 + y1) / 2
                # photo is left of the text block, in the same row band
                if x1 <= it["x"] + 5 and x0 >= it["x"] - 140 and it["y"] - 20 <= cy <= y_end:
                    name = save_image(info, f"eco_p{pno:03d}_r{info.key[0]}.webp", seen)
                    for key in {norm(it["code"]), norm((ECO_BASE_RE.match(it["code"]) or [it["code"]])[0])}:
                        result.setdefault(key, [])
                        if name not in result[key]:
                            result[key].append(name)
    return result


def arch_images():
    """ordering code -> [image names]"""
    doc = pymupdf.open(ARCH_PDF)
    clean, icons = textless(doc), icon_xrefs(doc)
    seen, result = {}, {}
    for pno, page in enumerate(doc, start=1):
        lines = lines_of(page)
        headers = sorted(y for x, y, t in lines if t.startswith("Ordering Code"))
        if not headers:
            continue
        # A family block starts a little above its "Ordering Code" header (the
        # family name and photo sit there) and runs to the next block.
        starts = [h - 45 for h in headers] + [page.rect.height + 1]
        imgs = regions_of(
            page, clean[pno - 1], icons,
            keep=lambda i: i["bbox"][1] > 45,  # skip the TISVA logo in the header
            min_h=20,
        )
        for k in range(len(headers)):
            top, bottom = starts[k], starts[k + 1]
            block_imgs = [i for i in imgs if top <= (i.bbox[1] + i.bbox[3]) / 2 < bottom]
            names = [save_image(i, f"arch_p{pno:03d}_r{i.key[0]}.webp", seen) for i in block_imgs]
            if not names:
                continue
            for x, y, text in lines:
                m = re.match(r"^([0-9A-Z]{8,14})\b", text)
                if m and top <= y < bottom:
                    result.setdefault(m.group(1).upper(), [])
                    result[m.group(1).upper()] += [n for n in names if n not in result[m.group(1).upper()]]
    return result


def main():
    OUT_IMG.mkdir(exist_ok=True)
    for old in list(OUT_IMG.glob("eco_*.webp")) + list(OUT_IMG.glob("arch_*.webp")):
        old.unlink()
    eco, arch = eco_images(), arch_images()

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    stats = {"eco": [0, 0], "arch": [0, 0]}
    for c in catalog:
        if c["kind"] != "functional":
            continue
        if c["source"].startswith("ECO"):
            base = ECO_BASE_RE.match(c["sourceCode"])
            c["images"] = eco.get(norm(c["sourceCode"])) or (
                eco.get(norm(base.group(0)), []) if base else []
            )
            stats["eco"][0] += 1
            stats["eco"][1] += bool(c["images"])
        elif c["source"].startswith("Architectural"):
            c["images"] = arch.get(c["sourceCode"].upper(), [])
            stats["arch"][0] += 1
            stats["arch"][1] += bool(c["images"])
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    print({k: f"{v[1]} of {v[0]} have photos" for k, v in stats.items()},
          "files:", len(list(OUT_IMG.glob("eco_*.webp"))) + len(list(OUT_IMG.glob("arch_*.webp"))))


if __name__ == "__main__":
    main()
