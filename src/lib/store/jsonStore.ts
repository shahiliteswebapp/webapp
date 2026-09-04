import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { QUOTE } from "../config";
import type {
  QuotationEvent,
  QuotationRecord,
  QuotationStatus,
} from "../types";

/*
 * Local JSON-file store. This is the "no database yet" implementation.
 *
 * Everything goes through this module. To move to Supabase / Postgres later,
 * write another file with the same exported functions and swap the re-export in
 * ./index.ts — no callers change.
 *
 * Concurrency: a single-process promise chain serialises writes, and each write
 * is atomic (temp file + rename). Fine for local dev and a one-machine demo;
 * not for serverless / multi-instance — which is exactly when you switch to a
 * real database.
 */

interface DB {
  quotations: QuotationRecord[];
  events: QuotationEvent[];
  sequences: Record<string, number>; // calendar year -> last number used
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "quotations.json");

const EMPTY: DB = { quotations: [], events: [], sequences: {} };

let writeChain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => undefined);
  return next;
}

async function read(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      quotations: parsed.quotations ?? [],
      events: parsed.events ?? [],
      sequences: parsed.sequences ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(EMPTY);
    }
    throw err;
  }
}

async function write(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

function formatNumber(year: number, seq: number): string {
  return `${QUOTE.numberPrefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export interface QuotationFilter {
  employeeEmail?: string;
  status?: QuotationStatus;
  /** inclusive lower bound, ISO date or datetime */
  fromISO?: string;
  /** inclusive upper bound, ISO date or datetime */
  toISO?: string;
}

function matches(r: QuotationRecord, f: QuotationFilter): boolean {
  if (f.employeeEmail && r.employeeEmail.toLowerCase() !== f.employeeEmail.toLowerCase()) {
    return false;
  }
  if (f.status && r.status !== f.status) return false;
  if (f.fromISO && r.createdAt < f.fromISO) return false;
  if (f.toISO && r.createdAt > f.toISO) return false;
  return true;
}

export async function listQuotations(
  filter: QuotationFilter = {},
): Promise<QuotationRecord[]> {
  const db = await read();
  return db.quotations
    .filter((r) => matches(r, filter))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getQuotation(
  numberOrId: string,
): Promise<QuotationRecord | null> {
  const db = await read();
  return (
    db.quotations.find(
      (r) => r.id === numberOrId || r.number === numberOrId,
    ) ?? null
  );
}

export async function listEvents(quotationId: string): Promise<QuotationEvent[]> {
  const db = await read();
  return db.events
    .filter((e) => e.quotationId === quotationId)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

export interface CreateInput {
  employeeName: string;
  employeeEmail: string;
  totalAmount: number;
}

export async function createQuotation(
  input: CreateInput,
): Promise<QuotationRecord> {
  return serialize(async () => {
    const db = await read();
    const now = new Date();
    const year = now.getFullYear();
    const seq = (db.sequences[year] ?? 0) + 1;
    db.sequences[year] = seq;

    const record: QuotationRecord = {
      id: randomUUID(),
      number: formatNumber(year, seq),
      employeeName: input.employeeName,
      employeeEmail: input.employeeEmail,
      status: "submitted_for_review",
      totalAmount: input.totalAmount,
      createdAt: now.toISOString(),
    };
    db.quotations.push(record);
    db.events.push({
      id: randomUUID(),
      quotationId: record.id,
      at: now.toISOString(),
      actorEmail: input.employeeEmail,
      to: "submitted_for_review",
    });

    await write(db);
    return record;
  });
}

export async function setStatus(
  id: string,
  to: Exclude<QuotationStatus, "submitted_for_review">,
  actorEmail: string,
  note?: string,
): Promise<QuotationRecord | null> {
  return serialize(async () => {
    const db = await read();
    const record = db.quotations.find((r) => r.id === id || r.number === id);
    if (!record) return null;

    const from = record.status;
    const now = new Date().toISOString();
    record.status = to;
    record.reviewedBy = actorEmail;
    record.reviewedAt = now;
    if (note) record.reviewNote = note;

    db.events.push({
      id: randomUUID(),
      quotationId: record.id,
      at: now,
      actorEmail,
      from,
      to,
      note,
    });

    await write(db);
    return record;
  });
}
