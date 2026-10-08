import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  ExistingProductError,
  deleteUploadedItems,
  saveProductEdit,
  setPopular,
  setRemoved,
  upsertUploadedItems,
} from "@/lib/catalog-store";
import type { LightingSystem } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function superadmin() {
  const session = await getSession();
  return session?.role === "superadmin" ? session : null;
}

function isItem(v: unknown, anyId = false): v is LightingSystem {
  const o = v as Partial<LightingSystem> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    o.id.length <= 200 &&
    (anyId || o.id.startsWith("up-")) &&
    typeof o.name === "string" &&
    (o.kind === "functional" || o.kind === "decorative") &&
    typeof o.unitCost === "number"
  );
}

/**
 * Add catalogue items, one or a whole Excel sheet. The superadmin can also
 * replace uploaded items by re-uploading them; for employees, rows that
 * already exist are skipped and only new products are added.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const isSuperadmin = session.role === "superadmin";
  let items: unknown;
  try {
    items = ((await req.json()) as { items?: unknown }).items;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0 || !items.every((i) => isItem(i))) {
    return NextResponse.json({ error: "No valid items to save." }, { status: 400 });
  }
  if (items.length > 2000) {
    return NextResponse.json({ error: "Up to 2,000 products at a time." }, { status: 400 });
  }
  try {
    const { saved, skipped } = await upsertUploadedItems(items, {
      newOnly: !isSuperadmin,
      addedBy: session.email,
    });
    return NextResponse.json({
      saved: saved.length,
      skipped: skipped.length,
      skippedNames: skipped.slice(0, 10).map((i) => i.name),
      skus: saved.map((i) => ({ id: i.id, name: i.name, slSku: i.slSku })),
    });
  } catch (err) {
    console.error("Catalogue save failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** Superadmin: edit any product, built-in or uploaded: { item }. */
export async function PUT(req: Request) {
  if (!(await superadmin())) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let item: unknown;
  try {
    item = ((await req.json()) as { item?: unknown }).item;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isItem(item, true)) {
    return NextResponse.json({ error: "Not a valid product." }, { status: 400 });
  }
  try {
    const saved = await saveProductEdit(item);
    return NextResponse.json({ saved: { id: saved.id, name: saved.name, slSku: saved.slSku } });
  } catch (err) {
    if (err instanceof ExistingProductError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Catalogue edit failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** Remove uploaded items: { ids: [...] } or { all: true }. */
export async function DELETE(req: Request) {
  if (!(await superadmin())) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let body: { ids?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const target =
    body.all === true
      ? "all"
      : Array.isArray(body.ids) && body.ids.every((i) => typeof i === "string")
        ? (body.ids as string[])
        : null;
  if (!target) return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
  try {
    const total = await deleteUploadedItems(target);
    return NextResponse.json({ total });
  } catch (err) {
    console.error("Catalogue delete failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * Remove built-in items from the picker, or bring them back:
 * { remove: [...ids] } or { restore: [...ids] }.
 * Mark products popular, or clear the mark: { popular: [...ids] } or { unpopular: [...ids] }.
 */
export async function PATCH(req: Request) {
  if (!(await superadmin())) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let body: { remove?: unknown; restore?: unknown; popular?: unknown; unpopular?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const isIds = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.every((i) => typeof i === "string");
  if (isIds(body.popular) || isIds(body.unpopular)) {
    const on = isIds(body.popular);
    try {
      const popular = await setPopular((on ? body.popular : body.unpopular) as string[], on);
      return NextResponse.json({ popular });
    } catch (err) {
      console.error("Catalogue popular mark failed", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }
  const remove = isIds(body.remove);
  const ids = remove ? (body.remove as string[]) : isIds(body.restore) ? body.restore : null;
  if (!ids) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const removed = await setRemoved(ids, remove);
    return NextResponse.json({ removed });
  } catch (err) {
    console.error("Catalogue remove/restore failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
