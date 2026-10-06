import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteQuotations } from "@/lib/store";
import { deleteQuoteFiles } from "@/lib/quote-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NUMBER_RE = /^[A-Z]{1,6}-\d{4}-\d{4,}$/;

/*
 * Superadmin only. PERMANENTLY deletes quotations: the saved PDF, rooms and
 * lights, client details, blueprint, and the History record with its events.
 * There is no backup. Body: { numbers: [...], confirm: "DELETE" }.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "superadmin") {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let body: { numbers?: unknown; confirm?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  const numbers = Array.isArray(body.numbers)
    ? [...new Set(body.numbers.filter((n): n is string => typeof n === "string" && NUMBER_RE.test(n)))]
    : [];
  if (numbers.length === 0) {
    return NextResponse.json({ error: "Nothing selected." }, { status: 400 });
  }

  // Files first: if a file delete fails, the record stays and can be retried.
  const failed: string[] = [];
  const done: string[] = [];
  for (const n of numbers) {
    try {
      await deleteQuoteFiles(n);
      done.push(n);
    } catch (err) {
      console.error("Delete files failed", n, err);
      failed.push(n);
    }
  }
  const deleted = await deleteQuotations(done);
  console.warn(`${session.email} permanently deleted ${deleted} quotation(s): ${done.join(", ")}`);
  return NextResponse.json({ deleted, failed });
}
