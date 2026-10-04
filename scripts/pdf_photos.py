"""
Product photos as they appear on a catalogue page.

Saving a PDF's raw embedded images (what the import scripts used to do) gives
distorted results: the catalogues stretch, flip, rotate and clip images when
placing them, and the Geo Liting pages build one product shot out of several
stretched slices. So instead each photo is *rendered* from the page, over the
area it occupies, from a copy of the page with all text removed (the
item code / size / SKU lines printed over the photos never end up in them).

    regions = photo_regions(doc_page, textless_page)   # list of Region
    region.save(path)                                    # webp, max 1200px

Neighbouring pieces are merged into one photo when one of them is a slice
(stretched) or a plain fill; blank regions are dropped.
"""

import io
import math

import pymupdf
from PIL import Image, ImageChops, ImageStat

MAX_PX = 1200
# A piece whose drawn aspect differs from its pixel aspect by more than this
# is a stretched slice / filler strip, not a photo on its own.
STRETCH_TOL = 0.04
# A render is a plain fill when this share of its pixels sits within
# FLAT_TOL (0-255, per channel) of its median colour.
FLAT_SHARE = 0.95
FLAT_TOL = 20
# A finished photo is blank (nothing but backdrop) when this share of it is.
BLANK_SHARE = 0.995
# An image placed on this many pages or more is a badge / logo ("DIMMABLE").
ICON_PAGES = 3
# Merged regions never grow past this share of the page (keeps full-page
# backgrounds from swallowing every photo on the page).
MAX_REGION_SHARE = 0.56


def textless(doc):
    """A copy of `doc` with every piece of text removed (images and vector art kept)."""
    out = pymupdf.open()
    out.insert_pdf(doc)
    for page in out:
        page.add_redact_annot(page.rect)
        page.apply_redactions(
            images=pymupdf.PDF_REDACT_IMAGE_NONE,
            graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
            text=pymupdf.PDF_REDACT_TEXT_REMOVE,
        )
    return out


def _scales(info):
    t = info["transform"]
    return math.hypot(t[0], t[1]), math.hypot(t[2], t[3])


def _stretched(info):
    sx, sy = _scales(info)
    if not (sx > 0 and sy > 0 and info["width"] > 0 and info["height"] > 0):
        return False
    drawn = sx / sy
    native = info["width"] / info["height"]
    return abs(drawn / native - 1) > STRETCH_TOL


def _native_zoom(infos, rect):
    """Pixels per point that keeps the sharpest piece at its own resolution."""
    z = 1.0
    for info in infos:
        sx, sy = _scales(info)
        if sx > 0 and sy > 0:
            z = max(z, info["width"] / sx, info["height"] / sy)
    longest = max(rect.width, rect.height)
    return max(1.0, min(z, MAX_PX / longest if longest else 1.0))


def _render(page, rect, zoom):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=rect, alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def _flat(im, share=FLAT_SHARE):
    small = im.copy()
    small.thumbnail((96, 96))
    med = tuple(int(v) for v in ImageStat.Stat(small).median)
    diff = ImageChops.difference(small, Image.new("RGB", small.size, med))
    near = sum(1 for px in diff.getdata() if max(px) <= FLAT_TOL)
    return near >= share * small.width * small.height


def icon_xrefs(doc):
    """Images repeated across pages: badges and logos, never product photos."""
    pages = {}
    for page in doc:
        for x in {i["xref"] for i in page.get_image_info(xrefs=True) if i["xref"]}:
            pages[x] = pages.get(x, 0) + 1
    return {x for x, n in pages.items() if n >= ICON_PAGES}


def _trim(im):
    """Crop away plain borders (filler strips around a product shot)."""
    w, h = im.size
    edge = Image.new("RGB", (1, 1), im.getpixel((0, 0)))
    bg = edge.resize(im.size)
    diff = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 22 else 0)
    box = diff.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    if x0 < w * 0.03 and y0 < h * 0.03 and x1 > w * 0.97 and y1 > h * 0.97:
        return im
    pad = round(max(x1 - x0, y1 - y0) * 0.04)
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))


class Region:
    def __init__(self, rect, infos, page):
        self.rect = rect
        self.infos = infos
        self.page = page
        self.bbox = tuple(rect)
        self._im = None

    @property
    def key(self):
        """Stable identity of the pieces (the same photo can be reused on several pages)."""
        return tuple(sorted(i["xref"] for i in self.infos))

    def image(self):
        if self._im is None:
            self._im = _trim(_render(self.page, self.rect, _native_zoom(self.infos, self.rect)))
        return self._im

    def blank(self):
        return _flat(self.image(), BLANK_SHARE)

    def save(self, path):
        im = self.image()
        im.thumbnail((MAX_PX, MAX_PX))
        im.save(path, "WEBP", quality=82, method=6)


def photo_regions(page, clean_page, min_w=0, min_h=0, keep=None, icons=frozenset()):
    """
    Photos on `page`, rendered from `clean_page` (the same page from textless()).
    `keep(info)` can veto pieces up front (e.g. a header logo); `icons` is
    icon_xrefs(doc).
    """
    area = page.rect.width * page.rect.height
    pieces = []
    for info in page.get_image_info(xrefs=True):
        r = pymupdf.Rect(info["bbox"]) & page.rect
        if r.is_empty or r.width < 4 or r.height < 4 or not info["xref"]:
            continue
        if info["xref"] in icons or (keep and not keep(info)):
            continue
        pieces.append({"info": info, "rect": r, "full": r.width * r.height > 0.8 * area})
    # A full-page image under other photos is a background; on its own (or
    # with just a small logo on it) it is the photo (some Geo pages are a
    # single full-bleed spread).
    rest = sum(p["rect"].width * p["rect"].height for p in pieces if not p["full"])
    if rest > 0.3 * area:
        pieces = [p for p in pieces if not p["full"]]

    for p in pieces:
        p["filler"] = _stretched(p["info"]) or _flat(_render(clean_page, p["rect"], 0.5))

    # Union-find: merge pieces that overlap a lot (a composed shot), and touching
    # pieces when either one is a slice / plain fill.
    parent = list(range(len(pieces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    changed = True
    while changed:
        changed = False
        for i in range(len(pieces)):
            for j in range(i + 1, len(pieces)):
                a, b = find(i), find(j)
                if a == b:
                    continue
                ri, rj = pieces[i]["rect"], pieces[j]["rect"]
                grown = pymupdf.Rect(ri.x0 - 2, ri.y0 - 2, ri.x1 + 2, ri.y1 + 2)
                if not grown.intersects(rj):
                    continue
                inter = ri & rj
                overlap = 0 if inter.is_empty else inter.width * inter.height
                smaller = min(ri.width * ri.height, rj.width * rj.height)
                if overlap <= 0.25 * smaller and not (pieces[i]["filler"] or pieces[j]["filler"]):
                    continue
                members = [k for k in range(len(pieces)) if find(k) in (a, b)]
                u = pymupdf.Rect(pieces[members[0]]["rect"])
                for k in members[1:]:
                    u |= pieces[k]["rect"]
                if u.width * u.height > MAX_REGION_SHARE * area:
                    continue
                parent[b] = a
                changed = True

    groups = {}
    for k in range(len(pieces)):
        groups.setdefault(find(k), []).append(pieces[k])

    regions = []
    for members in groups.values():
        rect = pymupdf.Rect(members[0]["rect"])
        for m in members[1:]:
            rect |= m["rect"]
        if rect.width < min_w or rect.height < min_h:
            continue
        region = Region(rect, [m["info"] for m in members], clean_page)
        if region.blank():
            continue
        regions.append(region)
    regions.sort(key=lambda r: (round(r.rect.y0), r.rect.x0))
    return regions
