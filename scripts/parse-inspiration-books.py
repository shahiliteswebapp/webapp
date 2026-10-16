"""
Import the four "Lighting Inspiration Book" decorative catalogues (DT 10-08-2025).

    python scripts/parse-inspiration-books.py

Reads from ../rawdata:
    CHANDELIERS DT=10-08-2025_tbu.pdf
    RECTANGLE CHANDELIERS DT=10-08-2025_tbu.pdf
    WALL LIGHTS DT=10-08-2025_tbu.pdf
    MIRROR LIGHTS DT-10-08-2025_tbu.pdf

Every item is a model code (e.g. "BL-09-001") with Color / Dimension /
Lamp Type / Barcode No. fields. Pages come in three layouts:
  * a photo with the code under it and a field block beside or below it;
  * a photo with a "Model No. | Color | ..." table under it (one row per size);
  * a photo with "Model No: ... Color: ..." rows under it.
Each field label's value is the text printed right under it in the same column.

The catalogues print no price (client's call: the barcode is NOT a price), so
unitCost is 0 and employees type a rate. The barcode is kept as `barcode`.
Photos are the light window of each product's dark frame, rendered from
the text-free page (scripts/pdf_photos.py), to
../rawdata/catalog-images-web as ib<book>_p<page>_<n>.webp.

Re-running replaces these rows and keeps the SKUs already handed out.
"""

import json
import re
from pathlib import Path

import pymupdf

from pdf_photos import MAX_PX, _render, _trim, textless

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT.parent / "rawdata"
OUT_IMG = RAW / "catalog-images-web"
CATALOG = ROOT / "src" / "lib" / "catalog-data.json"

BOOKS = [
    # (file, short tag for photo names, decorType)
    ("CHANDELIERS DT=10-08-2025_tbu.pdf", "ch", "Chandelier"),
    ("RECTANGLE CHANDELIERS DT=10-08-2025_tbu.pdf", "rc", "Chandelier"),
    ("WALL LIGHTS DT=10-08-2025_tbu.pdf", "wl", "Wall light"),
    ("MIRROR LIGHTS DT-10-08-2025_tbu.pdf", "mr", "Mirror light"),
]
SOURCES = {f: f"Lighting Inspiration Book: {f.split(' DT')[0].title()}" for f, _, _ in BOOKS}

CODE_RE = re.compile(r"^[A-Z]{2,3}-\d{2,3}(?:-\d{2,4})?$")
TITLE_RE = re.compile(r"^([A-Z]{2,3}-\d{2,3}(?:-\d{2,4})?)((?:\s*,\s*\d{2,4})*)$")
LABELS = {
    "model": re.compile(r"^model\s*no\.?:?$", re.I),
    "color": re.compile(r"^colou?r\s*:?$", re.I),
    "size": re.compile(r"^dime(n)?sion\s*:?$", re.I),
    "lamp": re.compile(r"^lamp\s*type\s*:?$", re.I),
    "barcode": re.compile(r"^barcode\s*no\.?\s*:?$", re.I),
}


def label_of(text):
    t = text.strip().lstrip("•").strip()
    for k, rx in LABELS.items():
        if rx.match(t):
            return k
    return None


def lines_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = " ".join(s["text"] for s in ln["spans"]).replace("”", '"').replace("“", '"')
            t = re.sub(r"\s+", " ", t).strip().lstrip("•").strip()
            if not t:
                continue
            size = max(s["size"] for s in ln["spans"])
            out.append({"t": t, "r": pymupdf.Rect(ln["bbox"]), "size": size})
    return out


def parse_page(page):
    """Items on one page: dicts with code, fields, and the rect used to place the photo."""
    lines = lines_of(page)
    labels = [dict(l, k=label_of(l["t"])) for l in lines if label_of(l["t"])]
    titles = []
    for l in lines:
        m = TITLE_RE.match(l["t"])
        if m and l["size"] >= 15 and not label_of(l["t"]):
            titles.append(dict(l, m=m))
    title_ids = {id(t) for t in titles}
    values = [l for l in lines if not label_of(l["t"]) and l["r"].y0 < page.rect.height - 30]
    values = [v for v in values if not any(v["t"] == t["t"] and v["r"] == t["r"] for t in titles)]

    # Each value line belongs to the nearest label above it in the same column.
    owned = {id(lb): [] for lb in labels}
    for v in values:
        best, bd = None, 1e9
        for lb in labels:
            dy = v["r"].y0 - lb["r"].y0
            if dy < 4 or dy > 200:
                continue
            if abs(v["r"].x0 - lb["r"].x0) > 16:
                continue
            if dy < bd:
                best, bd = lb, dy
        if best is not None:
            owned[id(best)].append(v)

    items = []
    models = [lb for lb in labels if lb["k"] == "model"]
    if models:
        # Table / row layouts: every value under "Model No." is an item; the
        # other fields are the values on the same row.
        rows = []
        for lb in models:
            for v in owned[id(lb)]:
                if CODE_RE.match(v["t"]):
                    rows.append(v)
        for row in rows:
            f = {"code": row["t"], "anchor": row["r"]}
            for lb in labels:
                if lb["k"] == "model":
                    continue
                # A model cell can wrap ("BL-09-019 / (5 Glass)"): match on overlap.
                same = [v for v in owned[id(lb)] if v["r"].y0 < row["r"].y1 + 8 and v["r"].y1 > row["r"].y0 - 8]
                if same:
                    f.setdefault(lb["k"], " ".join(v["t"] for v in same))
            items.append(f)
        return items, titles

    # Code under a photo, with a field block next to it.
    def value_of(lb):
        vs = sorted(owned[id(lb)], key=lambda v: v["r"].y0)
        out, last = [], lb["r"].y1
        for v in vs:
            if v["r"].y0 - last > 14:
                break
            out.append(v["t"])
            last = v["r"].y1
        return " ".join(out)

    colors = [lb for lb in labels if lb["k"] == "color"]
    groups = [{"rect": pymupdf.Rect(c["r"]), "f": {"color": value_of(c)}} for c in colors]
    for lb in labels:
        if lb["k"] in ("color", "model") or not groups:
            continue
        g = min(groups, key=lambda g: _dist(g["rect"], lb["r"]))
        g["f"].setdefault(lb["k"], value_of(lb))
        g["rect"] |= lb["r"]
    # Pair code titles with field groups, closest pairs first.
    pairs = sorted(
        ((_dist(t["r"], g["rect"]), ti, gi) for ti, t in enumerate(titles) for gi, g in enumerate(groups)),
    )
    used_t, used_g, match = set(), set(), {}
    for _, ti, gi in pairs:
        if ti in used_t or gi in used_g:
            continue
        used_t.add(ti)
        used_g.add(gi)
        match[ti] = gi
    for ti, t in enumerate(titles):
        f = dict(groups[match[ti]]["f"]) if ti in match else {}
        for code in expand(t["m"]):
            items.append(dict(f, code=code, anchor=t["r"]))
    return items, titles


def expand(m):
    """"BL-09-001, 003, 005" -> the three codes."""
    first = m.group(1)
    codes = [first]
    head = first.rsplit("-", 1)[0]
    for n in re.findall(r"\d{2,4}", m.group(2) or ""):
        codes.append(f"{head}-{n}")
    return codes


def _dist(a, b):
    dx = max(0, b.x0 - a.x1, a.x0 - b.x1)
    dy = max(0, b.y0 - a.y1, a.y0 - b.y1)
    return (dx * dx + dy * dy) ** 0.5


def frames(page):
    """(dark frame, filled rects inside it) for every product frame on the page.
    The photo window is one of those rects (white, or dark behind a dark photo)."""
    filled = []
    for dr in page.get_drawings():
        r, fill = dr["rect"], dr.get("fill")
        if fill and r.width >= 80 and r.height >= 50:
            filled.append((r, max(fill) <= 0.35))
    area = lambda r: r.width * r.height  # noqa: E731
    return [
        (f, [w for w, _ in filled if f.contains(w) and area(w) < 0.97 * area(f)])
        for f, dark in filled
        if dark
    ]


def photo_rect(anchor, page_frames):
    """The photo window of the frame the code is printed in (the code sits in
    a light strip at the bottom of a dark frame, under the photo)."""
    c = pymupdf.Point((anchor.x0 + anchor.x1) / 2, (anchor.y0 + anchor.y1) / 2)
    # The code strip has a dark outline of its own: only frames with a photo
    # window above the code count.
    mine = []
    for f, ws in page_frames:
        if not f.contains(c):
            continue
        ws = [w for w in ws if not w.contains(c) and w.y1 <= anchor.y0 + 2 and w.height > 60]
        if ws:
            mine.append((f, ws))
    if not mine:
        return None
    f, ws = min(mine, key=lambda fw: fw[0].width * fw[0].height)
    return max(ws, key=lambda w: w.width * w.height)


def photo_for(anchor, page_frames, titles):
    """Photo window for an item: its own frame, else the frame of the title
    above a table / row layout, else the biggest frame on the page."""
    r = photo_rect(anchor, page_frames)
    if r:
        return r
    for t in sorted(titles, key=lambda t: -t["r"].y0):
        if t["r"].y1 <= anchor.y0:
            r = photo_rect(t["r"], page_frames)
            if r:
                return r
    wins = [w for _, ws in page_frames for w in ws if w.y1 <= anchor.y0 + 2]
    return max(wins, key=lambda w: w.width * w.height) if wins else None


def save_photo(clean_page, rect, path):
    zoom = MAX_PX / max(rect.width, rect.height)
    im = _trim(_render(clean_page, rect & clean_page.rect, zoom))
    im.thumbnail((MAX_PX, MAX_PX))
    im.save(path, "WEBP", quality=82, method=6)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def watt_of(lamp):
    m = re.search(r"(\d+(?:\.\d+)?)\s*W\b", lamp or "", re.I)
    return float(m.group(1)) if m else None


def main():
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    items, seen = [], set()
    photos = 0
    for fname, tag, dtype in BOOKS:
        doc = pymupdf.open(RAW / fname)
        clean = textless(doc)
        n_book = 0
        for pi, page in enumerate(doc):
            found, titles = parse_page(page)
            if not found:
                continue
            page_frames = frames(page)
            names = {}
            for it in found:
                code = it["code"]
                iid = f"ib-{slug(code)}"
                if iid in seen:
                    continue  # printed in two books: keep the first
                seen.add(iid)
                rect = photo_for(it["anchor"], page_frames, titles)
                images = []
                if rect is not None:
                    key = tuple(round(v) for v in rect)
                    if key not in names:
                        name = f"ib{tag}_p{pi + 1:03d}_{len(names) + 1}.webp"
                        save_photo(clean[pi], rect, OUT_IMG / name)
                        names[key] = name
                        photos += 1
                    images = [names[key]]
                lamp = it.get("lamp") or None
                w = watt_of(lamp)
                barcode = re.sub(r"\D", "", it.get("barcode") or "")
                items.append({
                    "id": iid,
                    "sourceCode": code,
                    "name": f"{dtype} {code}",
                    "kind": "decorative",
                    "decorType": dtype,
                    "mounting": None,
                    "style": None,
                    "indoorOutdoor": None,
                    "unit": "nos",
                    "unitCost": 0,
                    "size": it.get("size") or None,
                    "finish": it.get("color") or None,
                    "material": None,
                    "lamp": lamp,
                    "sku": None,
                    "barcode": barcode or None,
                    "watt": f"{w:g}W" if w else None,
                    "automatic": False,
                    "interfaceOptions": [],
                    "rules": [],
                    "source": SOURCES[fname],
                    "catalogPage": f"{fname.split(' DT')[0].title()} p.{pi + 1}",
                    "images": images,
                    "styleTags": [],
                    "mountingTags": [],
                })
                n_book += 1
        print(f"{fname}: {n_book} items")

    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    mine = set(SOURCES.values())
    old = {s["id"]: s.get("slSku") for s in data if s.get("source") in mine}
    data = [s for s in data if s.get("source") not in mine]
    used = [int(m.group(1)) for s in data if (m := re.match(r"SL-D(\d+)$", s.get("slSku") or ""))]
    used += [int(m.group(1)) for v in old.values() if v and (m := re.match(r"SL-D(\d+)$", v))]
    nxt = max(used, default=0) + 1
    for it in items:
        it["slSku"] = old.get(it["id"]) or f"SL-D{nxt:04d}"
        if not old.get(it["id"]):
            nxt += 1
    data.extend(items)
    CATALOG.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    missing = {k: sum(1 for i in items if not i[k]) for k in ("size", "finish", "lamp", "barcode", "images")}
    print(f"{len(items)} items, {photos} photos; missing: {missing}")


if __name__ == "__main__":
    main()
