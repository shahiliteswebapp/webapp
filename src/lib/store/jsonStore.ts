import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { QUOTE } from "../config";
import type {
  AccessEntry,
  CreateQuotationInput,
  QuotationEvent,
  QuotationFilter,
  QuotationRecord,
  QuotationStatus,
} from "../types";

/*
 * Local JSON-file store — the default "no database" implementation, selected by
 * src/lib/store/index.ts whenever Supabase isn't configured.
 *
 * Concurrency: a single-process promise chain serialises writes, and each write
 * is atomic (temp file + rename). Fine for local dev and a one-machine demo;
 * not for serverless / multi-instance — that's what supabaseStore.ts is for.
 */

interface DB {
  quotations: QuotationRecord[];
  events: QuotationEvent[];
  sequences: Record<string, number>; // calendar year -> last number used
  access: AccessEntry[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "quotations.json");

const EMPTY: DB = { quotations: [], events: [], sequences: {}, access: [] };

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
      access: parsed.access ?? [],
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

function matches(r: QuotationRecord, f: QuotationFilter): boolean {
  if (
    f.employeeEmail &&
    r.employeeEmail.toLowerCase() !== f.employeeEmail.toLowerCase()
  ) {
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

export async function createQuotation(
  input: CreateQuotationInput,
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
      employeeEmail: input.employeeEmail.toLowerCase(),
      status: input.status,
      totalAmount: input.totalAmount,
      createdAt: now.toISOString(),
    };
    db.quotations.push(record);
    db.events.push({
      id: randomUUID(),
      quotationId: record.id,
      at: now.toISOString(),
      actorEmail: record.employeeEmail,
      to: record.status,
    });

    await write(db);
    return record;
  });
}

export async function setStatus(
  id: string,
  to: Exclude<QuotationStatus, "submitted_for_review" | "downloaded">,
  actorEmail: string,
  note?: string,
): Promise<QuotationRecord | null> {
  return serialize(async () => {
    const db = await read();
    const record = db.quotations.find((r) => r.id === id || r.number === id);
    if (!record) return null;
    if (record.status !== "submitted_for_review") return null;

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

/* ---- access control ---- */

export async function isAllowed(email: string): Promise<boolean> {
  const db = await read();
  const entry = db.access.find(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  return entry?.status === "active";
}

export async function touchSignIn(email: string, name: string): Promise<void> {
  return serialize(async () => {
    const db = await read();
    const e = email.toLowerCase();
    const now = new Date().toISOString();
    const entry = db.access.find((a) => a.email.toLowerCase() === e);
    if (entry) {
      entry.lastSignInAt = now;
      entry.signInCount = (entry.signInCount ?? 0) + 1;
      if (name) entry.name = name;
    } else {
      db.access.push({
        email: e,
        name,
        status: "active",
        addedBy: e,
        addedAt: now,
        lastSignInAt: now,
        signInCount: 1,
      });
    }
    await write(db);
  });
}

export async function listAccess(): Promise<AccessEntry[]> {
  const db = await read();
  return [...db.access].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

export async function addAccess(
  email: string,
  name: string | undefined,
  byEmail: string,
): Promise<AccessEntry> {
  return serialize(async () => {
    const db = await read();
    const e = email.trim().toLowerCase();
    const now = new Date().toISOString();
    let entry = db.access.find((a) => a.email.toLowerCase() === e);
    if (entry) {
      entry.status = "active";
      entry.removedAt = undefined;
      entry.removedBy = undefined;
      if (name) entry.name = name;
    } else {
      entry = {
        email: e,
        name,
        status: "active",
        addedBy: byEmail.toLowerCase(),
        addedAt: now,
        signInCount: 0,
      };
      db.access.push(entry);
    }
    await write(db);
    return entry;
  });
}

export async function removeAccess(
  email: string,
  byEmail: string,
): Promise<AccessEntry | null> {
  return serialize(async () => {
    const db = await read();
    const e = email.trim().toLowerCase();
    const entry = db.access.find((a) => a.email.toLowerCase() === e);
    if (!entry) return null;
    entry.status = "removed";
    entry.removedAt = new Date().toISOString();
    entry.removedBy = byEmail.toLowerCase();
    await write(db);
    return entry;
  });
}

export async function restoreAccess(
  email: string,
  byEmail: string,
): Promise<AccessEntry | null> {
  return serialize(async () => {
    const db = await read();
    const e = email.trim().toLowerCase();
    const entry = db.access.find((a) => a.email.toLowerCase() === e);
    if (!entry) return null;
    entry.status = "active";
    entry.removedAt = undefined;
    entry.removedBy = undefined;
    void byEmail;
    await write(db);
    return entry;
  });
}
