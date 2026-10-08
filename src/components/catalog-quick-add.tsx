"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { uploadPhoto } from "@/components/catalog-uploader";
import {
  DECOR_STYLES,
  DECOR_TYPES,
  LAYER_LABEL,
  catalogImageUrl,
  type DecorativeSystem,
  type FunctionalSystem,
  type InterfaceOption,
  type Layer,
  type LightingSystem,
  type Unit,
} from "@/lib/catalog";
import { cx } from "@/lib/cx";

/*
 * Add one product at a time, from a phone or a laptop: type the details,
 * take or pick a few photos, save. The Excel upload stays available for
 * big batches. Employees use it to add new arrivals; the superadmin also
 * uses it to edit or duplicate an existing product (`initial` + `mode`).
 */

const MAX_PHOTOS = 6;
const INTERFACES = ["RF", "DALI", "BLE", "PRO", "TRIAC"];

const inputClass =
  "w-full rounded-md border border-hairline bg-paper px-3 py-2 text-base text-ink outline-none focus:border-gold sm:text-sm";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

interface Form {
  kind: "functional" | "decorative";
  name: string;
  code: string;
  company: string;
  price: string;
  unit: Unit;
  size: string;
  watts: string;
  finish: string;
  // functional
  category: string;
  layer: string;
  glare: "" | "no-glare" | "some-glare";
  automatic: boolean;
  control: "dimmable" | "tunable";
  interfaces: string[];
  cutout: string;
  colour: string;
  ip: string;
  // decorative
  decorType: string;
  mounting: string;
  styles: string[];
  material: string;
}

const EMPTY: Form = {
  kind: "functional",
  name: "",
  code: "",
  company: "",
  price: "",
  unit: "nos",
  size: "",
  watts: "",
  finish: "",
  category: "",
  layer: "",
  glare: "",
  automatic: false,
  control: "dimmable",
  interfaces: [],
  cutout: "",
  colour: "",
  ip: "",
  decorType: DECOR_TYPES[0],
  mounting: "",
  styles: [],
  material: "",
};

/** The form, filled in from an existing product (to edit or duplicate it). */
function formFromItem(s: LightingSystem): Form {
  const common = {
    ...EMPTY,
    kind: s.kind,
    name: s.name,
    code: s.sourceCode === s.name ? "" : s.sourceCode,
    company: s.company ?? "",
    price: s.unitCost > 0 ? String(s.unitCost) : "",
    unit: s.unit,
    size: s.size ?? "",
    finish: s.finish ?? "",
  };
  if (s.kind === "functional") {
    const controls = new Set(s.interfaceOptions.map((io) => io.control));
    return {
      ...common,
      watts: s.wattNum ? String(s.wattNum) : (s.watt ?? ""),
      category: s.category === "Functional" ? "" : s.category,
      layer: s.layer ? String(s.layer) : "",
      glare: s.glare ?? "",
      automatic: s.automatic,
      control: controls.has("tunable") && !controls.has("dimmable") ? "tunable" : "dimmable",
      interfaces: [
        ...new Set(
          s.interfaceOptions
            .map((io) => io.interface)
            .filter((i) => i !== "DIMMABLE" && i !== "TUNABLE"),
        ),
      ],
      cutout: s.cutout ?? "",
      colour: s.colour ?? "",
      ip: s.ipRating ?? "",
    };
  }
  return {
    ...common,
    watts: s.lamp ?? "",
    code: s.sku ?? common.code,
    decorType: s.decorType || DECOR_TYPES[0],
    mounting: (s.mountingTags ?? []).join(", ") || (s.mounting ?? ""),
    styles: s.styleTags ?? [],
    material: s.material ?? "",
  };
}

/** Same automation choices as the product had, so its variant prices are kept. */
function sameAutomation(f: Form, s: LightingSystem): boolean {
  const before = formFromItem(s);
  return (
    f.kind === s.kind &&
    f.automatic === before.automatic &&
    f.control === before.control &&
    [...f.interfaces].sort().join() === [...before.interfaces].sort().join()
  );
}

/** An edited product: the form's fields over everything the form does not show. */
function mergeEdit(initial: LightingSystem, f: Form, built: LightingSystem): LightingSystem {
  const merged = {
    ...initial,
    ...built,
    id: initial.id,
    source: initial.source,
    rules: initial.rules,
    // Variant prices (from the catalogue) stay unless the automation changed.
    interfaceOptions: sameAutomation(f, initial) ? initial.interfaceOptions : built.interfaceOptions,
  } as LightingSystem;
  if (initial.kind === "decorative" && merged.kind === "decorative") {
    merged.indoorOutdoor = initial.indoorOutdoor;
    merged.catalogPage = initial.catalogPage;
    // A typed price replaces the catalogue's list number.
    merged.listNumber = merged.unitCost > 0 ? null : initial.listNumber;
  }
  if (initial.kind === "functional" && merged.kind === "functional") {
    merged.finishOptions = initial.finishOptions;
    merged.ledSource = initial.ledSource;
  }
  return merged;
}

function buildItem(f: Form, images: string[]): LightingSystem {
  const price = parseFloat(f.price);
  const wattNum = parseFloat(f.watts);
  const code = f.code.trim();
  const base = {
    id: `up-${f.kind[0]}-${slug(f.name || code || "item")}-${randomId()}`,
    sourceCode: code || f.name.trim(),
    name: f.name.trim(),
    unit: f.unit,
    unitCost: Number.isFinite(price) && price > 0 ? price : 0,
    rules: [],
    source: "Added in the app",
    images,
    uploaded: true,
    company: f.company.trim() || null,
  };
  const watt = Number.isFinite(wattNum) && wattNum > 0 ? `${wattNum}W` : f.watts.trim() || null;
  const size = f.size.trim() || null;

  if (f.kind === "functional") {
    const interfaceOptions: InterfaceOption[] = f.automatic
      ? (f.interfaces.length ? f.interfaces : [f.control === "tunable" ? "TUNABLE" : "DIMMABLE"]).map(
          (i) => ({ interface: i, control: f.control, price: null }),
        )
      : [];
    const item: FunctionalSystem = {
      ...base,
      kind: "functional",
      category: f.category.trim() || "Functional",
      layer: f.layer ? (Number(f.layer) as Layer) : null,
      glare: f.glare || null,
      automatic: f.automatic,
      interfaceOptions,
      finishOptions: [],
      size,
      cutout: f.cutout.trim() || null,
      finish: f.finish.trim() || null,
      watt,
      wattNum: Number.isFinite(wattNum) && wattNum > 0 ? wattNum : null,
      ledSource: null,
      ipRating: f.ip.trim() || null,
      colour: f.colour.trim() || null,
    };
    return item;
  }
  const mountings = f.mounting
    .split(/[,/]+/)
    .map((m) => m.trim())
    .filter(Boolean);
  const item: DecorativeSystem = {
    ...base,
    kind: "decorative",
    automatic: false,
    interfaceOptions: [],
    decorType: f.decorType,
    mounting: mountings.join(" / ") || null,
    mountingTags: mountings,
    style: f.styles.join(" / ") || null,
    styleTags: f.styles,
    indoorOutdoor: null,
    size,
    finish: f.finish.trim() || null,
    material: f.material.trim() || null,
    lamp: watt,
    sku: f.code.trim() || null,
    listNumber: null,
  };
  return item;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "rounded-full border px-3 py-1.5 text-xs font-medium capitalize",
        on ? "border-gold bg-gold text-paper" : "border-hairline bg-paper text-muted hover:border-gold",
      )}
    >
      {children}
    </button>
  );
}

export type QuickAddMode = "add" | "edit" | "duplicate";

export function CatalogQuickAdd({
  initial,
  mode = "add",
  onDone,
  onCancel,
}: {
  /** product to edit or duplicate */
  initial?: LightingSystem;
  mode?: QuickAddMode;
  /** called after a save instead of clearing the form for the next product */
  onDone?: (message: string) => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() =>
    initial
      ? {
          ...formFromItem(initial),
          name: mode === "duplicate" ? `${initial.name} (copy)` : initial.name,
        }
      : EMPTY,
  );
  // Photos the product already has (stored file names or URLs), kept unless removed.
  const [kept, setKept] = useState<string[]>(() => initial?.images ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const toggle = (k: "interfaces" | "styles", v: string) =>
    setF((prev) => ({
      ...prev,
      [k]: prev[k].includes(v) ? prev[k].filter((x) => x !== v) : [...prev[k], v],
    }));

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const files = [...list].filter((x) => x.type.startsWith("image/"));
    setPhotos((prev) => [...prev, ...files].slice(0, Math.max(0, MAX_PHOTOS - kept.length)));
  };
  const photoCount = kept.length + photos.length;

  const save = async () => {
    setError(null);
    setDone(null);
    if (!f.name.trim()) {
      setError("Enter the product name.");
      return;
    }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const p of photos) urls.push(await uploadPhoto(p));
      const built = buildItem(f, [...kept, ...urls]);
      const editing = mode === "edit" && initial ? initial : null;
      const item = editing
        ? mergeEdit(editing, f, built)
        : mode === "duplicate" && initial
          ? // A copy keeps what the form does not show too, as a new product.
            ({
              ...mergeEdit(initial, f, built),
              id: built.id,
              source: built.source,
              slSku: null,
              uploaded: true,
              edited: undefined,
              addedBy: undefined,
              addedAt: undefined,
            } as LightingSystem)
          : built;
      const res = await fetch("/api/admin/catalog", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { item } : { items: [item] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      const message = editing
        ? `Saved changes to "${item.name}".`
        : `Added "${item.name}"${
            urls.length ? ` with ${urls.length} photo${urls.length === 1 ? "" : "s"}` : ""
          }.`;
      router.refresh();
      if (onDone) {
        onDone(message);
        return;
      }
      setDone(message);
      // Keep the branch and brand: the next product is often from the same set.
      setF({ ...EMPTY, kind: f.kind, company: f.company });
      setKept([]);
      setPhotos([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const functional = f.kind === "functional";
  const heading =
    mode === "edit" ? "Edit product" : mode === "duplicate" ? "Duplicate product" : "Add a product";

  return (
    <section className="space-y-4">
      <div>
        <Eyebrow>{heading}</Eyebrow>
        <p className="text-sm text-muted">
          {mode === "edit"
            ? "Change any detail or photo. Quotations already made keep their prices."
            : mode === "duplicate"
              ? "A new product, filled in from the one you copied. Change what differs, such as the size or finish, then save."
              : "One product at a time. Take photos with the phone camera or pick them from the gallery. Only the name is required."}
        </p>
      </div>

      {/* An existing product keeps its branch. */}
      <div
        aria-disabled={mode === "edit"}
        className={cx(
          "flex overflow-hidden rounded-md border border-hairline text-sm font-medium",
          mode === "edit" && "pointer-events-none opacity-60",
        )}
      >
        {(["functional", "decorative"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => set("kind", k)}
            className={cx(
              "flex-1 px-3 py-2 capitalize",
              f.kind === k ? "bg-gold text-paper" : "bg-paper text-muted hover:bg-panel",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product name *">
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Supplier code" hint="Shown in the app. The client's PDF shows a Shahi Lites SKU instead.">
          <input value={f.code} onChange={(e) => set("code", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Brand">
          <input value={f.company} onChange={(e) => set("company", e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Price ₹" hint="Blank = employees type the rate.">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={f.price}
              onChange={(e) => set("price", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Per">
            <select value={f.unit} onChange={(e) => set("unit", e.target.value as Unit)} className={inputClass}>
              <option value="nos">piece</option>
              <option value="mtr">metre</option>
            </select>
          </Field>
        </div>
        <Field label="Size / dimensions" hint="e.g. D90MM X H70MM">
          <input value={f.size} onChange={(e) => set("size", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Watts">
          <input
            inputMode="decimal"
            value={f.watts}
            onChange={(e) => set("watts", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Finish">
          <input value={f.finish} onChange={(e) => set("finish", e.target.value)} className={inputClass} />
        </Field>

        {functional ? (
          <>
            <Field label="Product type" hint="e.g. Spotlight, Profile light">
              <input value={f.category} onChange={(e) => set("category", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Layer">
              <select value={f.layer} onChange={(e) => set("layer", e.target.value)} className={inputClass}>
                <option value="">Not set</option>
                {Object.entries(LAYER_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k}. {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Glare">
              <select
                value={f.glare}
                onChange={(e) => set("glare", e.target.value as Form["glare"])}
                className={inputClass}
              >
                <option value="">Not set</option>
                <option value="no-glare">No glare</option>
                <option value="some-glare">Some glare</option>
              </select>
            </Field>
            <Field label="Cut-out">
              <input value={f.cutout} onChange={(e) => set("cutout", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Colour / CCT">
              <input value={f.colour} onChange={(e) => set("colour", e.target.value)} className={inputClass} />
            </Field>
            <Field label="IP rating">
              <input value={f.ip} onChange={(e) => set("ip", e.target.value)} className={inputClass} />
            </Field>
            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={f.automatic}
                  onChange={(e) => set("automatic", e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-gold)]"
                />
                Automated (smart control)
              </label>
              {f.automatic && (
                <div className="flex flex-wrap items-center gap-2">
                  <Chip on={f.control === "dimmable"} onClick={() => set("control", "dimmable")}>
                    Dimmable
                  </Chip>
                  <Chip on={f.control === "tunable"} onClick={() => set("control", "tunable")}>
                    Dimmable + Tunable
                  </Chip>
                  <span className="mx-1 h-5 w-px bg-hairline" />
                  {INTERFACES.map((i) => (
                    <Chip key={i} on={f.interfaces.includes(i)} onClick={() => toggle("interfaces", i)}>
                      {i}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Field label="Decor type">
              <select value={f.decorType} onChange={(e) => set("decorType", e.target.value)} className={inputClass}>
                {DECOR_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Mounting" hint="e.g. Hanging, Staircase">
              <input value={f.mounting} onChange={(e) => set("mounting", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Material">
              <input value={f.material} onChange={(e) => set("material", e.target.value)} className={inputClass} />
            </Field>
            <div className="space-y-1">
              <span className="text-xs text-muted">Style</span>
              <div className="flex flex-wrap gap-2">
                {DECOR_STYLES.map((st) => (
                  <Chip key={st} on={f.styles.includes(st)} onClick={() => toggle("styles", st)}>
                    {st}
                  </Chip>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs text-muted">
          Photos ({photoCount}/{MAX_PHOTOS})
        </span>
        <div className="flex flex-wrap gap-2">
          {kept.map((file) => (
            <div key={file} className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={catalogImageUrl(file)} alt="" className="h-full w-full object-contain" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setKept((prev) => prev.filter((x) => x !== file))}
                className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink-deep/80 text-xs text-paper"
              >
                ×
              </button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline bg-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-contain" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink-deep/80 text-xs text-paper"
              >
                ×
              </button>
            </div>
          ))}
          {photoCount < MAX_PHOTOS && (
            <>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-md border-2 border-dashed border-hairline text-xs text-muted hover:border-gold"
              >
                Camera
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="grid h-20 w-20 place-items-center rounded-md border-2 border-dashed border-hairline text-xs text-muted hover:border-gold"
              >
                Gallery
              </button>
            </>
          )}
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="rounded-md border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>
      )}
      {done && (
        <p className="rounded-md border border-gold/40 bg-gold-tint px-3 py-2 text-sm text-ink-deep">{done}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} disabled={busy} className="sm:min-w-48">
          {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add product"}
        </Button>
        {onCancel ? (
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setF({ ...EMPTY, kind: f.kind });
              setKept([]);
              setPhotos([]);
              setError(null);
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </section>
  );
}
