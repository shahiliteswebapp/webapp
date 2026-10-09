/*
 * Upload the catalog product photos to Cloudflare R2.
 *
 *   1. python scripts/convert-catalog-images.py   (Part 2 photos -> webp)
 *   2. python scripts/parse-geo-catalogs.py       (Part 1 / Mix 1 items + photos)
 *   3. python scripts/merge-decorative.py         (Part 2 rows + client chart tags)
 *   4. python scripts/add-architectural-missing.py (price-list rows the first import skipped)
 *   4b. python scripts/parse-crescent.py, python scripts/add-arya.py (Crescent + Arya price lists)
 *   5. python scripts/parse-functional-images.py  (ECO / Architectural photos)
 *   6. npx wrangler login                          (once per machine)
 *   7. node scripts/upload-catalog-images.mjs [dir]
 *
 * Photos are served from the bucket's public URL (CATALOG_IMAGE_BASE in
 * src/lib/catalog.ts). Files already public at that URL are skipped, so
 * re-runs only upload what's new. Uploads run 8 at a time.
 */

import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const BUCKET = process.env.R2_BUCKET || "shahi-lites-catalog";
const PUBLIC_BASE =
  process.env.NEXT_PUBLIC_CATALOG_IMAGE_BASE ||
  "https://pub-76400aed69e24fb282d2f078fbf133f2.r2.dev";
const CONCURRENCY = 8;
const dir = path.resolve(process.argv[2] || "../rawdata/catalog-images-web");
const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

// Windows needs a shell to run npx.cmd, and the shell splits on spaces, so
// quote every argument there.
const isWin = process.platform === "win32";
const q = (a) => (isWin ? `"${a}"` : a);

async function exists(f) {
  try {
    const res = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(f)}`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function upload(f) {
  const args = [
    "-y",
    "wrangler@4",
    "r2",
    "object",
    "put",
    `${BUCKET}/${f}`,
    "--file",
    path.join(dir, f),
    "--content-type",
    "image/webp",
    "--cache-control",
    "public, max-age=31536000, immutable",
    "--remote",
  ];
  await run("npx", args.map(q), { shell: isWin });
}

let done = 0;
let skipped = 0;
const failed = [];
const queue = [...files];

async function worker() {
  for (let f = queue.shift(); f; f = queue.shift()) {
    if (await exists(f)) {
      skipped++;
      continue;
    }
    try {
      await upload(f);
      done++;
    } catch (err) {
      failed.push(f);
      console.error(`failed ${f}: ${String(err.stderr || err).split("\n")[0]}`);
    }
    if ((done + failed.length) % 50 === 0) {
      console.log(`uploaded ${done}, skipped ${skipped}, failed ${failed.length}, left ${queue.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done: uploaded ${done}, already there ${skipped}, failed ${failed.length}`);
if (failed.length) {
  console.log(failed.join("\n"));
  process.exitCode = 1;
}
