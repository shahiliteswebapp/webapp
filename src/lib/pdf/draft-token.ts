import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SavedDraft } from "@/lib/quote-files";

/*
 * Every quotation PDF carries its own editable contents (rooms, lights,
 * options, discounts, client), so an old PDF can be uploaded and reopened
 * exactly. The contents are gzipped and encrypted (AES-256-GCM) with a key
 * derived from AUTH_SECRET, then stored in the PDF's Keywords field: a client
 * opening the PDF's properties sees only random-looking text, never the
 * vendor product ids inside.
 */

const PREFIX = "sl-draft:v1:";

export interface DraftToken {
  number: string;
  draft: Omit<SavedDraft, "blueprint" | "savedAt">;
}

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || "shahi-lites-local-dev-only";
  return createHash("sha256").update(`shahi-lites-pdf-draft|${secret}`).digest();
}

export function encodeDraftToken(t: DraftToken): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(gzipSync(JSON.stringify(t))), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The contents inside a PDF's Keywords, or null (not ours, or tampered). */
export function decodeDraftToken(keywords: string | null | undefined): DraftToken | null {
  const at = keywords?.indexOf(PREFIX) ?? -1;
  if (!keywords || at < 0) return null;
  try {
    const raw = Buffer.from(keywords.slice(at + PREFIX.length).trim().split(/\s/)[0], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = gunzipSync(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]));
    const t = JSON.parse(json.toString("utf8")) as DraftToken;
    return t && typeof t.number === "string" && Array.isArray(t.draft?.rooms) ? t : null;
  } catch {
    return null;
  }
}
