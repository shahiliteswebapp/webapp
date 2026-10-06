import { promises as fs } from "node:fs";
import path from "node:path";
import type { ClientDetails, Discount, DraftRoom } from "./types";

/*
 * Saved quotations: the generated PDF plus everything needed to reopen it in
 * the wizard and edit it (rooms, lights, options, discounts, client details,
 * blueprint preview). One folder per quotation number:
 *
 *   data/quotes/SL-2026-0001/quotation.pdf
 *   data/quotes/SL-2026-0001/draft.json
 *   data/quotes/SL-2026-0001/blueprint.png   (only when a blueprint was used)
 *
 * Local disk for now. On serverless hosting (read-only disk) saving is
 * skipped and reported, so a later step can move this to R2.
 */

const ROOT = path.join(process.cwd(), "data", "quotes");
const NUMBER_RE = /^[A-Z]{1,6}-\d{4}-\d{4,}$/;

export interface SavedBlueprint {
  name: string;
  kind: "pdf" | "png";
  width: number;
  height: number;
  pageCount: number;
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

export function quoteFilesAvailable(): boolean {
  return !process.env.VERCEL;
}

function dirFor(number: string): string {
  if (!NUMBER_RE.test(number)) throw new Error(`Bad quotation number: ${number}`);
  return path.join(ROOT, number);
}

/** "data:image/png;base64,..." -> bytes, or null for anything else. */
function pngFromDataUrl(dataUrl: string | undefined): Buffer | null {
  const m = dataUrl?.match(/^data:image\/png;base64,(.+)$/);
  return m ? Buffer.from(m[1], "base64") : null;
}

export async function saveQuoteFiles(
  number: string,
  files: { pdf: Buffer; draft: SavedDraft; blueprintDataUrl?: string },
): Promise<boolean> {
  if (!quoteFilesAvailable()) return false;
  const dir = dirFor(number);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "quotation.pdf"), files.pdf);
  await fs.writeFile(path.join(dir, "draft.json"), JSON.stringify(files.draft), "utf8");
  const png = pngFromDataUrl(files.blueprintDataUrl);
  if (png) await fs.writeFile(path.join(dir, "blueprint.png"), png);
  else if (!files.draft.blueprint) await fs.rm(path.join(dir, "blueprint.png"), { force: true });
  return true;
}

export async function readQuotePdf(number: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(dirFor(number), "quotation.pdf"));
  } catch {
    return null;
  }
}

export async function readQuoteDraft(
  number: string,
): Promise<{ draft: SavedDraft; blueprintDataUrl?: string } | null> {
  try {
    const dir = dirFor(number);
    const draft = JSON.parse(await fs.readFile(path.join(dir, "draft.json"), "utf8")) as SavedDraft;
    let blueprintDataUrl: string | undefined;
    if (draft.blueprint) {
      try {
        const png = await fs.readFile(path.join(dir, "blueprint.png"));
        blueprintDataUrl = `data:image/png;base64,${png.toString("base64")}`;
      } catch {
        draft.blueprint = undefined; // image missing: reopen without it
      }
    }
    return { draft, blueprintDataUrl };
  } catch {
    return null;
  }
}

/** Numbers that have a saved, editable copy (for the history list). */
export async function savedQuoteNumbers(): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  } catch {
    return new Set();
  }
}
