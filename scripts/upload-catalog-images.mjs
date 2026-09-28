/*
 * Upload the catalog product photos to Cloudflare R2.
 *
 *   1. python scripts/merge-decorative.py         (records photo names on the catalog)
 *   2. python scripts/convert-catalog-images.py  (webp, max 1200px, into ../rawdata/catalog-images-web)
 *   3. npx wrangler login                          (once per machine)
 *   4. node scripts/upload-catalog-images.mjs [dir]
 *
 * Then set NEXT_PUBLIC_CATALOG_IMAGE_BASE to the bucket's public URL
 * (r2.dev URL or custom domain) in Vercel / Cloudflare env vars.
 *
 * Re-running overwrites objects with the same name (safe, idempotent).
 */

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const BUCKET = process.env.R2_BUCKET || "shahi-lites-catalog";
const dir = path.resolve(process.argv[2] || "../rawdata/catalog-images-web");
const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

const wrangler = (args) =>
  execFileSync("npx", ["-y", "wrangler@4", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

let done = 0;
for (const f of files) {
  const file = path.join(dir, f);
  wrangler([
    "r2",
    "object",
    "put",
    `${BUCKET}/${f}`,
    "--file",
    file,
    "--content-type",
    "image/webp",
    "--cache-control",
    "public, max-age=31536000, immutable",
    "--remote",
  ]);
  done++;
  if (done % 25 === 0 || done === files.length) {
    console.log(`${done}/${files.length} uploaded (${statSync(file).size} B last)`);
  }
}
