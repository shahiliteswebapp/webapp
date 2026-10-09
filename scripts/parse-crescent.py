"""
Import the Crescent general price list into the catalogue.

    python scripts/parse-crescent.py

Reads rawdata/Crescent Gen PL RLP V25 2026-1.pdf (a text PDF of bordered
tables), adds one functional product per price row to src/lib/catalog-data.json
and renders each section's product photo to rawdata/catalog-images-web as
crescent_p<page>_<n>_r1.webp (upload them with upload-catalog-images.mjs).

Price = the MRP column (client's choice). Rows with no MRP ("-", "On Request",
"Coming Soon") get unitCost 0, so employees type a rate. Re-running replaces
the Crescent rows and keeps the SKUs already handed out (matched by id).
"""

import json
import re
import sys
from pathlib import Path

import pymupdf
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pdf_photos import _render, _trim, textless  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT.parent / "rawdata" / "Crescent Gen PL RLP V25 2026-1.pdf"
DATA = ROOT / "src" / "lib" / "catalog-data.json"
IMG_DIR = ROOT.parent / "rawdata" / "catalog-images-web"
SOURCE = "Crescent Gen PL RLP V25 2026.pdf"
COMPANY = "Crescent"

# Category heading -> lighting layer (1 ambient, 2 indirect, 3 accent, 4 task, 5 outdoor, 6 facade).
LAYERS = {
    "Panel & Down Lights": 1,
    "Junction Box Lights": 1,
    "COB Spot Lights": 3,
    "Track & Wall Lights": 3,
    "Office & Bulkhead Lights": 1,
    "Flood Lights": 5,
    "Street Lights": 5,
    "Industrial Lights": 1,
    "Picture & Mirror Lights": 4,
    "Façade Lights": 6,
    "Foot Lights": 5,
    "Post Top Lights": 5,
    "Drivers, Controllers & Accessories": None,
    "SMD Rope Lights": 2,
    "Suspended Profile Lights": 1,
    "Aluminium Profile": None,
    "LED Strip Lights & SMPS": 2,
    "Smart Sensors & Accessories": None,
}

NO_PRICE = {"", "-", "on request", "coming soon", "ind. packing"}


def clean(v):
    # Option lists wrap inside a cell ("3K | 4K\n5K | 6K"); keep the separator.
    v = re.sub(r"\b([0-9A-Z]{2})\n(?=[0-9A-Z]{2}\b)", r"\1 | ", v or "")
    return re.sub(r"\s+", " ", v.replace("\n", " ")).strip()


def num(v):
    v = clean(v).replace(",", "")
    return float(v) if re.fullmatch(r"\d+(\.\d+)?", v) else None


def headings(doc):
    """(page, y, category) for every big category heading, in reading order."""
    out = []
    for i, page in enumerate(doc):
        for b in page.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                for s in ln["spans"]:
                    if s["size"] > 13 and s["text"].strip():
                        t = s["text"].strip()
                        t = "Suspended Profile Lights" if t.isupper() and "PROFILE" in t else t
                        t = "SMD Rope Lights" if t.upper() == "SMD ROPE LIGHTS" else t
                        out.append((i + 1, s["bbox"][1], t))
    return sorted(out)


def category_at(heads, page, y):
    cat = heads[0][2]
    for p, hy, t in heads:
        if (p, hy) <= (page, y):
            cat = t
    return cat


def is_header(cells):
    return any(c and ("MRP" in c or c.strip() == "Model") for c in cells)


def fit(cells, header):
    """Line a row up with the header: continuation tables can drop a column
    (an unnamed one, or Rate + MRP merged into one "Coming Soon" cell)."""
    n = len(header)
    if len(cells) == n:
        return cells
    named = [i for i, h in enumerate(header) if h]
    if len(cells) == len(named):
        out = [None] * n
        for i, c in zip(named, cells):
            out[i] = c
        return out
    out = [None] * n
    if len(cells) == 3:  # name, rate, MRP
        out[0], out[-2], out[-1] = cells
        return out
    for i, c in enumerate(cells[:-1]):
        out[i] = c
    out[-1] = cells[-1]
    return out


def photos(page):
    """Product photos on the left edge of a page: (rect, xref), small icons dropped."""
    out = []
    for info in page.get_image_info(xrefs=True):
        r = pymupdf.Rect(info["bbox"])
        if r.x0 > 60 or r.width < 30 or r.height < 25 or r.y0 < 62 or r.y0 > 800:
            continue
        out.append(r)
    return out


def section_photo(rects, top, bottom, near):
    inside = [r for r in rects if top - 12 <= (r.y0 + r.y1) / 2 < bottom]
    if inside:
        return min(inside, key=lambda r: abs((r.y0 + r.y1) / 2 - near))
    if not rects:
        return None
    return min(rects, key=lambda r: abs((r.y0 + r.y1) / 2 - top))


def main():
    doc = pymupdf.open(PDF)
    clean_doc = textless(doc)
    heads = headings(doc)
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    rows = []  # dicts with page, y, title, header, cells
    header = None
    title = None
    for pn in range(2, doc.page_count + 1):
        page = doc[pn - 1]
        for t in page.find_tables().tables:
            cells_rows = t.extract()
            ys = [r.bbox[1] if r.bbox else t.bbox[1] for r in t.rows]
            block = {}  # column -> last value, for merged cells
            for cells, y in zip(cells_rows, ys):
                filled = [c for c in cells if c not in (None, "")]
                if not filled:
                    continue
                if is_header(cells):
                    header = [clean(c) if c else "" for c in cells]
                    block = {}
                    continue
                if all(clean(c).startswith("Rate") for c in filled):
                    continue  # upper line of a two-line header
                if len(filled) == 1:
                    title = clean(filled[0])
                    block = {}
                    rows.append({"title_mark": True, "page": pn, "y": y, "title": title})
                    continue
                if header is None:
                    continue
                # Tables with a leading icon column put "Model" one cell right.
                off = len(cells) - len(header)
                cells = cells[off:] if off > 0 else cells
                cells = fit(cells, header)
                vals = {}
                for i, h in enumerate(header):
                    c = cells[i]
                    if c is None:
                        c = block.get(i)
                    else:
                        block[i] = c
                    vals[i] = c
                rows.append({"page": pn, "y": y, "table": t.bbox, "title": title, "header": header, "vals": vals})

    # Section bounds per page, for photos.
    marks = [r for r in rows if r.get("title_mark")]
    photo_files = {}

    def photo_for(pn, y, table):
        page_marks = [m for m in marks if m["page"] == pn]
        top = max([m["y"] for m in page_marks if m["y"] <= y + 1], default=None)
        if top is None:
            # Section began on an earlier page; use the photo nearest the table.
            top = y
        bottom = min([m["y"] for m in page_marks if m["y"] > top], default=820)
        rects = photos(doc[pn - 1])
        r = section_photo(rects, top, bottom, (table[1] + table[3]) / 2)
        if r is None:
            return None
        key = (pn, round(r.x0), round(r.y0))
        if key not in photo_files:
            n = len([k for k in photo_files if k[0] == pn]) + 1
            name = f"crescent_p{pn:02d}_{n}_r1.webp"
            im = _trim(_render(clean_doc[pn - 1], r, 4))
            im.thumbnail((1200, 1200), Image.LANCZOS)
            im.save(IMG_DIR / name, "WEBP", quality=82, method=6)
            photo_files[key] = name
        return photo_files[key]

    items = []
    for r in rows:
        if r.get("title_mark"):
            continue
        h, v = r["header"], r["vals"]
        col = {name: i for i, name in enumerate(h)}

        def get(*names):
            for n in names:
                for hn, i in col.items():
                    if hn.lower().startswith(n.lower()):
                        val = clean(v.get(i))
                        if val:
                            return val
            return None

        model = clean(v.get(col.get("Model", col.get("Accessories", 0))))
        if not model or model in ("Model", "Accessories"):
            continue
        model = model.replace("/(", " (").replace(" / (", " (")
        extra = model[len(model.split(" (")[0]):].strip()
        mrp_i = next((i for hn, i in col.items() if hn.startswith("MRP")), None)
        mrp_text = clean(v.get(mrp_i)) if mrp_i is not None else ""
        # "800 / 1500": plain and RGB prices in one cell (header "MRP ... 3K, 4K, 6K / RGB").
        prices = [num(x) for x in mrp_text.split("/")]
        mrp = prices[0]
        finish_opts = []
        if len(prices) == 2 and prices[1] and "/" in h[mrp_i]:
            finish_opts = [{"label": h[mrp_i].split("/")[-1].strip(), "price": prices[1]}]
        per_mtr = any("Mtr" in hn for hn in h if hn.startswith(("Rate", "MRP")))
        title = r["title"] or ""
        cat = category_at(heads, r["page"], r["y"])
        code = model.split(" (")[0].strip()
        desc = get("Description", "Type", "Category")
        if not re.search(r"\d", code) and not desc:  # "Toggle", "Connecting Wire": parts of the series above
            desc, code, extra = f"{model} for", "", ""
        watt_text = get("Watts", "Power Con", "Output Wattage", "Watt Per") or ""
        watt = re.search(r"(\d+(?:\.\d+)?)\s*W\b", model) or re.search(r"(\d+(?:\.\d+)?)\s*W\b", watt_text)
        # "CRD150 - Galaxy+ - Deep Recess Down Light" -> "Galaxy+ Deep Recess Down Light"
        parts = [p.strip() for p in title.split(" - ")]
        series = re.sub(r"\s+", " ", " ".join(parts[1:]) if len(parts) > 1 and re.match(r"^[A-Z]{1,5}\d", parts[0]) else title)
        series = series.strip() or cat
        ip = re.search(r"IP\s?\d{2}", title)
        items.append({
            "_page": r["page"],
            "_y": r["y"],
            "_variant": [title, get("Shape"), get("Body Color"), get("CCT"), get("Variant"), get("Length")],
            "id": "",
            "sourceCode": code or model,
            "name": (f"{desc} {series}" if not code else f"{desc or series} {code} {extra}").strip(),
            "kind": "functional",
            "category": cat,
            "layer": LAYERS.get(cat),
            "automatic": False,
            "interfaceOptions": [],
            "finishOptions": finish_opts,
            "unit": "mtr" if per_mtr else "nos",
            "unitCost": mrp or 0,
            "size": get("Size", "Dimension", "Dim", "Outer"),
            "cutout": get("Cutout"),
            "finish": get("Body Color"),
            "watt": f"{float(watt.group(1)):g}W" if watt else None,
            "wattNum": float(watt.group(1)) if watt else None,
            "ledSource": None,
            "ipRating": ip.group(0).replace(" ", "") if ip else None,
            "colour": get("CCT", "Variant"),
            "rules": [],
            "source": SOURCE,
            "company": COMPANY,
            "images": [],
        })
        img = photo_for(r["page"], r["y"], r["table"])
        if img:
            items[-1]["images"] = [img]

    # Stable, unique ids; tell same-code rows apart by their variant.
    def slug(s):
        return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

    by_code = {}
    for it in items:
        by_code.setdefault(it["sourceCode"], []).append(it)
    seen = set()
    for code, group in by_code.items():
        for it in group:
            base = f"crs-{slug(code)}"
            # Only the fields that differ inside the group tell its rows apart;
            # for the section title that is its "(Wi-Fi)" / "(Bluetooth)" tag.
            var = it["_variant"]
            diff = [i for i in range(1, len(var)) if len({g["_variant"][i] for g in group}) > 1]
            label = " / ".join(var[i] for i in diff if var[i])
            if not label and len({g["_variant"][0] for g in group}) > 1:
                tag = re.search(r"\((Wi-Fi|Bluetooth)\)", var[0])
                label = tag.group(1) if tag else var[0]
            if len(group) > 1 and label:
                it["name"] = f"{it['name']} ({label})"
                base = f"{base}-{slug(label)}"
            iid, n = base, 2
            while iid in seen:
                iid, n = f"{base}-{n}", n + 1
            seen.add(iid)
            it["id"] = iid

    data = json.loads(DATA.read_text(encoding="utf-8"))
    old = {s["id"]: s.get("slSku") for s in data if s.get("source") == SOURCE}
    data = [s for s in data if s.get("source") != SOURCE]
    used = [int(m.group(1)) for s in data if (m := re.match(r"SL-F(\d+)$", s.get("slSku") or ""))]
    used += [int(m.group(1)) for v in old.values() if v and (m := re.match(r"SL-F(\d+)$", v))]
    nxt = max(used, default=0) + 1
    for it in items:
        for k in ("_page", "_y", "_variant"):
            it.pop(k)
        it["slSku"] = old.get(it["id"]) or f"SL-F{nxt:04d}"
        if not old.get(it["id"]):
            nxt += 1
    data.extend(items)
    DATA.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    priced = sum(1 for i in items if i["unitCost"] > 0)
    print(f"{len(items)} Crescent products ({priced} priced), {len(photo_files)} photos")


if __name__ == "__main__":
    main()
