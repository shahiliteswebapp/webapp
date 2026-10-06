"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { uploadPhoto } from "@/components/catalog-uploader";
import {
  DECOR_STYLES,
  DECOR_TYPES,
  LAYER_LABEL,
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
 * big batches.
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

export function CatalogQuickAdd() {
  const router = useRouter();
  const [f, setF] = useState<Form>(EMPTY);
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
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_PHOTOS));
  };

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
      const item = buildItem(f, urls);
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      const sku = (data.skus as { slSku?: string }[] | undefined)?.[0]?.slSku;
      setDone(
        `Added "${item.name}"${sku ? ` as ${sku}` : ""}${
          urls.length ? ` with ${urls.length} photo${urls.length === 1 ? "" : "s"}` : ""
        }.`,
      );
      // Keep the branch and brand: the next product is often from the same set.
      setF({ ...EMPTY, kind: f.kind, company: f.company });
      setPhotos([]);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const functional = f.kind === "functional";

  return (
    <section className="space-y-4">
      <div>
        <Eyebrow>Add a product</Eyebrow>
        <p className="text-sm text-muted">
          One product at a time. Take photos with the phone camera or pick them from the
          gallery. Only the name is required.
        </p>
      </div>

      <div className="flex overflow-hidden rounded-md border border-hairline text-sm font-medium">
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
        <Field label="Supplier code" hint="Internal only. Clients see the Shahi Lites SKU, assigned automatically.">
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
          Photos ({photos.length}/{MAX_PHOTOS})
        </span>
        <div className="flex flex-wrap gap-2">
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
          {photos.length < MAX_PHOTOS && (
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
          {busy ? "Saving…" : "Add product"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setF({ ...EMPTY, kind: f.kind });
            setPhotos([]);
            setError(null);
          }}
        >
          Clear
        </Button>
      </div>
    </section>
  );
}
