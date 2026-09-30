import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { registerUploadedSystems, type LightingSystem } from "./catalog";

/*
 * Superadmin-uploaded catalogue items and their photos.
 *
 * R2 mode (R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY set):
 * photos go into the same "shahi-lites-catalog" bucket as the built-in
 * catalogue (served from its public URL) and the item list is one JSON object
 * in that bucket, written and read over R2's S3 API.
 *
 * Local mode (no R2 keys): photos land in ./data/catalog-uploads/ and are
 * served by /api/catalog-image/[file]; the item list is
 * ./data/catalog-uploads.json. Local dev only; Vercel's disk is read-only.
 */

const BUCKET = process.env.R2_BUCKET || "shahi-lites-catalog";
const PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_CATALOG_IMAGE_BASE ||
  "https://pub-76400aed69e24fb282d2f078fbf133f2.r2.dev"
).replace(/\/+$/, "");
const LIST_KEY = "uploads-catalog.json";

const LOCAL_DIR = path.join(process.cwd(), "data", "catalog-uploads");
const LOCAL_LIST = path.join(process.cwd(), "data", "catalog-uploads.json");

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  );
}

let r2: AwsClient | null = null;
function client(): AwsClient {
  r2 ??= new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    service: "s3",
    region: "auto",
  });
  return r2;
}

function objectUrl(key: string): string {
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${encodeURIComponent(key)}`;
}

/** Store one (already webp-converted) photo; returns the URL to save on the item. */
export async function putCatalogImage(bytes: Uint8Array, contentType: string): Promise<string> {
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const name = `up-${hash}.${ext}`;

  if (r2Configured()) {
    const res = await client().fetch(objectUrl(name), {
      method: "PUT",
      body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }),
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${await res.text()}`);
    return `${PUBLIC_BASE}/${name}`;
  }

  if (process.env.VERCEL) {
    throw new Error("Photo storage is not configured. Set the R2_* environment variables.");
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, name), bytes);
  return `/api/catalog-image/${name}`;
}

/** Local mode only: read a stored photo back for /api/catalog-image. */
export async function readLocalCatalogImage(name: string): Promise<Buffer | null> {
  if (!/^up-[a-f0-9]{16}\.(webp|png|jpg)$/.test(name)) return null;
  try {
    return await fs.readFile(path.join(LOCAL_DIR, name));
  } catch {
    return null;
  }
}

/* ------------------------------ the item list ------------------------------ */

const TTL_MS = 15_000;
let cache: { at: number; items: LightingSystem[] } | null = null;

async function readList(): Promise<LightingSystem[]> {
  if (r2Configured()) {
    const res = await client().fetch(objectUrl(LIST_KEY), { cache: "no-store" });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
    return (await res.json()) as LightingSystem[];
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL_LIST, "utf8")) as LightingSystem[];
  } catch {
    return [];
  }
}

async function writeList(items: LightingSystem[]): Promise<void> {
  const body = JSON.stringify(items);
  if (r2Configured()) {
    const res = await client().fetch(objectUrl(LIST_KEY), {
      method: "PUT",
      body,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
    if (!res.ok) throw new Error(`R2 write failed (${res.status}): ${await res.text()}`);
  } else {
    if (process.env.VERCEL) {
      throw new Error("Catalogue storage is not configured. Set the R2_* environment variables.");
    }
    await fs.mkdir(path.dirname(LOCAL_LIST), { recursive: true });
    const tmp = `${LOCAL_LIST}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, LOCAL_LIST);
  }
  cache = { at: Date.now(), items };
  registerUploadedSystems(items);
}

/**
 * Uploaded items, also merged into the in-memory catalogue so getSystem()
 * and the pricing engine see them. Never throws: on a storage error the app
 * keeps working with the built-in catalogue.
 */
export async function loadUploadedCatalog(
  opts: { fresh?: boolean } = {},
): Promise<LightingSystem[]> {
  // The cache is per server instance, so pricing and the admin list read fresh.
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.items;
  try {
    const items = await readList();
    cache = { at: Date.now(), items };
    registerUploadedSystems(items);
    return items;
  } catch (err) {
    console.error("Could not load uploaded catalogue", err);
    return cache?.items ?? [];
  }
}

/** Add or replace items (matched by id). */
export async function upsertUploadedItems(items: LightingSystem[]): Promise<number> {
  cache = null;
  const current = await readList();
  const byId = new Map(current.map((i) => [i.id, i]));
  for (const item of items) byId.set(item.id, { ...item, uploaded: true } as LightingSystem);
  const next = [...byId.values()];
  await writeList(next);
  return next.length;
}

export async function deleteUploadedItems(ids: string[] | "all"): Promise<number> {
  cache = null;
  const current = await readList();
  const drop = ids === "all" ? null : new Set(ids);
  const next = drop ? current.filter((i) => !drop.has(i.id)) : [];
  await writeList(next);
  return next.length;
}
