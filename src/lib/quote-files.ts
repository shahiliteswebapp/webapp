import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabase, supabaseConfigured } from "./supabase";
import type { ClientDetails, Discount, DraftRoom } from "./types";

/*
 * Saved quotations: the generated PDF plus everything needed to reopen it in
 * the wizard and edit it (rooms, lights, options, discounts, client details,
 * blueprint preview). One folder per quotation number:
 *
 *   SL-2026-0001/quotation.pdf
 *   SL-2026-0001/draft.json
 *   SL-2026-0001/blueprint        (only when a blueprint was used)
 *
 * Supabase mode (Supabase keys set): a PRIVATE Supabase Storage bucket
 * ("quotations"), read and written only by the server with the secret key.
 * These files hold client details, so they never go in the public R2
 * catalogue bucket.
 *
 * Local mode: ./data/quotes/ on this computer (local development).
 */

const BUCKET = process.env.SUPABASE_QUOTES_BUCKET || "quotations";
const ROOT = path.join(process.cwd(), "data", "quotes");
const NUMBER_RE = /^[A-Z]{1,6}-\d{4}-\d{4,}$/;

export interface SavedBlueprint {
  name: string;
  kind: "pdf" | "png";
  width: number;
  height: number;
  pageCount: number;
  /** image type of the saved preview ("image/png" or "image/jpeg") */
  mime?: string;
}

/** The editable contents of a quotation, as saved beside its PDF. */
export interface SavedDraft {
  rooms: DraftRoom[];
  applyGst: boolean;
  discount?: Discount;
  optionCount: number;
  client?: ClientDetails;
  /** YYYY-MM-DD, IST */
  validUntil?: string;
  noBlueprint: boolean;
  blueprint?: SavedBlueprint;
  savedAt: string;
}

function inSupabase(): boolean {
  return supabaseConfigured();
}

export function quoteFilesAvailable(): boolean {
  return inSupabase() || !process.env.VERCEL;
}

function checkNumber(number: string): string {
  if (!NUMBER_RE.test(number)) throw new Error(`Bad quotation number: ${number}`);
  return number;
}

/** "data:image/png;base64,..." -> bytes + type, or null for anything else. */
function imageFromDataUrl(dataUrl: string | undefined): { bytes: Buffer; mime: string } | null {
  const m = dataUrl?.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  return m ? { mime: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}

/* ------------------------------ storage backends ------------------------------ */

let bucketReady: Promise<void> | null = null;

/** Create the private bucket on first use (also created by supabase/schema.sql). */
function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const storage = getSupabase().storage;
    const { data } = await storage.getBucket(BUCKET);
    if (data) {
      if (data.public) console.error(`Storage bucket "${BUCKET}" is public. Make it private.`);
      return;
    }
    const { error } = await storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Supabase storage: ${error.message}`);
  })().catch((err) => {
    bucketReady = null; // retry next time
    throw err;
  });
  return bucketReady;
}

async function putFile(key: string, bytes: Buffer, contentType: string): Promise<void> {
  if (inSupabase()) {
    await ensureBucket();
    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .upload(key, bytes, { contentType, upsert: true, cacheControl: "0" });
    if (error) throw new Error(`Supabase storage upload ${key}: ${error.message}`);
    return;
  }
  const file = path.join(ROOT, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

async function getFile(key: string): Promise<Buffer | null> {
  if (inSupabase()) {
    const { data, error } = await getSupabase().storage.from(BUCKET).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(ROOT, key));
  } catch {
    return null;
  }
}

async function removeFile(key: string): Promise<void> {
  if (inSupabase()) {
    await getSupabase().storage.from(BUCKET).remove([key]);
    return;
  }
  await fs.rm(path.join(ROOT, key), { force: true });
}

/* ---------------------------------- public API ---------------------------------- */

export async function saveQuoteFiles(
  number: string,
  files: { pdf: Buffer; draft: SavedDraft; blueprintDataUrl?: string },
): Promise<boolean> {
  if (!quoteFilesAvailable()) return false;
  const dir = checkNumber(number);
  const image = files.draft.blueprint ? imageFromDataUrl(files.blueprintDataUrl) : null;
  const draft: SavedDraft = image
    ? { ...files.draft, blueprint: { ...files.draft.blueprint!, mime: image.mime } }
    : { ...files.draft, blueprint: undefined };

  await putFile(`${dir}/quotation.pdf`, files.pdf, "application/pdf");
  await putFile(`${dir}/draft.json`, Buffer.from(JSON.stringify(draft), "utf8"), "application/json");
  if (image) await putFile(`${dir}/blueprint`, image.bytes, image.mime);
  else await removeFile(`${dir}/blueprint`).catch(() => {});
  return true;
}

export async function readQuotePdf(number: string): Promise<Buffer | null> {
  return getFile(`${checkNumber(number)}/quotation.pdf`);
}

export async function readQuoteDraft(
  number: string,
): Promise<{ draft: SavedDraft; blueprintDataUrl?: string } | null> {
  const dir = checkNumber(number);
  const raw = await getFile(`${dir}/draft.json`);
  if (!raw) return null;
  let draft: SavedDraft;
  try {
    draft = JSON.parse(raw.toString("utf8")) as SavedDraft;
  } catch {
    return null;
  }
  let blueprintDataUrl: string | undefined;
  if (draft.blueprint) {
    // Older local saves named the file blueprint.png.
    const img = (await getFile(`${dir}/blueprint`)) ?? (await getFile(`${dir}/blueprint.png`));
    if (img) {
      blueprintDataUrl = `data:${draft.blueprint.mime ?? "image/png"};base64,${img.toString("base64")}`;
    } else {
      draft.blueprint = undefined; // image missing: reopen without it
    }
  }
  return { draft, blueprintDataUrl };
}

/** Numbers that have a saved, editable copy (for the history list). */
export async function savedQuoteNumbers(): Promise<Set<string>> {
  if (inSupabase()) {
    const out = new Set<string>();
    try {
      await ensureBucket();
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await getSupabase()
          .storage.from(BUCKET)
          .list("", { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
        if (error || !data) break;
        for (const entry of data) if (NUMBER_RE.test(entry.name)) out.add(entry.name);
        if (data.length < 1000) break;
      }
    } catch (err) {
      console.error("Could not list saved quotations", err);
    }
    return out;
  }
  try {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  } catch {
    return new Set();
  }
}
