import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import {
  BUILTIN_SYSTEMS,
  applyCatalogChanges,
  formatSku,
  skuNumber,
  type LightingSystem,
} from "./catalog";

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

/* ------------------------- uploaded items + removals ------------------------- */

/** Everything a superadmin changed: uploaded items, and ids removed from the picker. */
export interface CatalogChanges {
  items: LightingSystem[];
  removed: string[];
  /** last Shahi Lites SKU number handed out per kind, so numbers are never reused */
  skuSeq?: { functional: number; decorative: number };
}

const EMPTY: CatalogChanges = { items: [], removed: [] };
const TTL_MS = 15_000;
let cache: { at: number; state: CatalogChanges } | null = null;

// Older saves were a bare array of items.
function normalise(raw: unknown): CatalogChanges {
  if (Array.isArray(raw)) return { items: raw as LightingSystem[], removed: [] };
  const o = (raw ?? {}) as Partial<CatalogChanges>;
  return {
    items: Array.isArray(o.items) ? o.items : [],
    removed: Array.isArray(o.removed) ? o.removed.filter((x) => typeof x === "string") : [],
    skuSeq: o.skuSeq,
  };
}

async function readState(): Promise<CatalogChanges> {
  if (r2Configured()) {
    const res = await client().fetch(objectUrl(LIST_KEY), { cache: "no-store" });
    if (res.status === 404) return EMPTY;
    if (!res.ok) throw new Error(`R2 read failed (${res.status})`);
    return normalise(await res.json());
  }
  try {
    return normalise(JSON.parse(await fs.readFile(LOCAL_LIST, "utf8")));
  } catch {
    return EMPTY;
  }
}

async function writeState(state: CatalogChanges): Promise<void> {
  const body = JSON.stringify(state);
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
  cache = { at: Date.now(), state };
  applyCatalogChanges(state.items, state.removed);
}

/**
 * The superadmin's catalogue changes, also applied to the in-memory catalogue
 * so getSystem() and the pricing engine see them. Never throws: on a storage
 * error the app keeps working with the built-in catalogue.
 */
export async function loadCatalogChanges(
  opts: { fresh?: boolean } = {},
): Promise<CatalogChanges> {
  // The cache is per server instance, so pricing and the admin page read fresh.
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.state;
  try {
    const state = await readState();
    cache = { at: Date.now(), state };
    applyCatalogChanges(state.items, state.removed);
    return state;
  } catch (err) {
    console.error("Could not load catalogue changes", err);
    return cache?.state ?? EMPTY;
  }
}

/** Highest SKU number of a kind in use or ever handed out. */
function lastSku(kind: LightingSystem["kind"], state: CatalogChanges): number {
  let max = state.skuSeq?.[kind] ?? 0;
  for (const s of [...BUILTIN_SYSTEMS, ...state.items]) {
    if (s.kind !== kind) continue;
    const n = skuNumber(kind, s.slSku);
    if (n !== null && n > max) max = n;
  }
  return max;
}

/**
 * Add or replace uploaded items (matched by id). Re-uploading an item
 * un-removes it. Every new item gets the next Shahi Lites SKU of its kind;
 * an item being replaced keeps the SKU it already has.
 */
export async function upsertUploadedItems(items: LightingSystem[]): Promise<LightingSystem[]> {
  cache = null;
  const current = await readState();
  const byId = new Map(current.items.map((i) => [i.id, i]));
  const seq = {
    functional: lastSku("functional", current),
    decorative: lastSku("decorative", current),
  };
  const saved: LightingSystem[] = [];
  for (const item of items) {
    const kept = byId.get(item.id)?.slSku;
    const slSku = kept ?? formatSku(item.kind, ++seq[item.kind]);
    const next = { ...item, slSku, uploaded: true } as LightingSystem;
    byId.set(item.id, next);
    saved.push(next);
  }
  const ids = new Set(items.map((i) => i.id));
  await writeState({
    items: [...byId.values()],
    removed: current.removed.filter((id) => !ids.has(id)),
    skuSeq: seq,
  });
  return saved;
}

export async function deleteUploadedItems(ids: string[] | "all"): Promise<number> {
  cache = null;
  const current = await readState();
  const drop = ids === "all" ? null : new Set(ids);
  const next = drop ? current.items.filter((i) => !drop.has(i.id)) : [];
  await writeState({ ...current, items: next });
  return next.length;
}

/** Hide built-in items from the picker (remove: true) or bring them back. */
export async function setRemoved(ids: string[], remove: boolean): Promise<number> {
  cache = null;
  const current = await readState();
  const set = new Set(current.removed);
  for (const id of ids) {
    if (remove) set.add(id);
    else set.delete(id);
  }
  await writeState({ ...current, removed: [...set] });
  return set.size;
}
