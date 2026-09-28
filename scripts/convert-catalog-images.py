"""
Convert the extracted catalogue photos to web-sized webp (max 1200px, q80).

  ../rawdata/Geo Liting Part 2 - Images/*  ->  ../rawdata/catalog-images-web/*.webp

Transparent PNG cut-outs keep their alpha. Output names match the ones
scripts/merge-decorative.py writes into catalog-data.json.

Run from the repo root:  python scripts/convert-catalog-images.py
"""

import os
from pathlib import Path

from PIL import Image

RAW = Path(__file__).resolve().parent.parent.parent / "rawdata"
SRC = RAW / "Geo Liting Part 2 - Images"
DST = RAW / "catalog-images-web"


def main():
    DST.mkdir(exist_ok=True)
    n = 0
    for f in sorted(os.listdir(SRC)):
        im = Image.open(SRC / f)
        im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
        im.thumbnail((1200, 1200))
        im.save(DST / (Path(f).stem + ".webp"), "WEBP", quality=80, method=6)
        n += 1
    print(f"converted {n} images into {DST}")


if __name__ == "__main__":
    main()
