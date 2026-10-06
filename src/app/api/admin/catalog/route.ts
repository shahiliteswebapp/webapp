import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteUploadedItems, setRemoved, upsertUploadedItems } from "@/lib/catalog-store";
import type { LightingSystem } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function superadmin() {
  const session = await getSession();
  return session?.role === "superadmin" ? session : null;
}

function isItem(v: unknown): v is LightingSystem {
  const o = v as Partial<LightingSystem> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    o.id.startsWith("up-") &&
    typeof o.name === "string" &&
    (o.kind === "functional" || o.kind === "decorative") &&
    typeof o.unitCost === "number"
  );
}

/** Add or replace uploaded catalogue items. */
export async function POST(req: Request) {
  if (!(await superadmin())) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let items: unknown;
  try {
    items = ((await req.json()) as { items?: unknown }).items;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0 || !items.every(isItem)) {
    return NextResponse.json({ error: "No valid items to save." }, { status: 400 });
  }
  try {
    const saved = await upsertUploadedItems(items);
    return NextResponse.json({
      saved: saved.length,
      skus: saved.map((i) => ({ id: i.id, name: i.name, slSku: i.slSku })),
    });
  } catch (err) {
    console.error("Catalogue save failed", err);
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
 */
export async function PATCH(req: Request) {
  if (!(await superadmin())) {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }
  let body: { remove?: unknown; restore?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const isIds = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.every((i) => typeof i === "string");
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
