import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { COMPANY, QUOTE, disclaimer } from "@/lib/config";
import { addDays, daysUntil, fmtDateTime, fmtYmd, ymd } from "@/lib/format";
import type { ComputedLine, ComputedQuote, ComputedRoom } from "@/lib/quote";
import type { ClientDetails } from "@/lib/types";
import { registerPdfFonts } from "./fonts";

const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const rs = (n: number) => `₹${inr.format(Number.isFinite(n) ? n : 0)}`;

const GOLD = "#8a6a2b";
const GOLD_LINE = "#d9c9a3";
const INK = "#141414";
const MUTED = "#6b6b6b";
const HAIRLINE = "#e2ddd0";
// A4 width minus the page's horizontal padding.
const CONTENT_W = 595.28 - 2 * 46;

// @react-pdf/textkit drops the letter after fi/ffi/fl ligatures ("Office" ->
// "Ofce"). Disabling the ligature features fixes it. Not an inherited style
// prop, so it goes on every text style.
const NO_LIGA = {
  fontFeatureSettings: { liga: false, clig: false, dlig: false, rlig: false },
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 58,
    paddingHorizontal: 46,
    fontFamily: "Montserrat",
    fontSize: 9,
    color: INK,
    lineHeight: 1.45,
    ...NO_LIGA,
  },
  watermark: {
    position: "absolute",
    top: 300,
    left: -40,
    right: -40,
    textAlign: "center",
    fontFamily: "Cormorant Garamond",
    fontSize: 96,
    letterSpacing: 12,
    color: "#000000",
    opacity: 0.045,
    transform: "rotate(-24deg)",
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: GOLD_LINE,
    paddingBottom: 10,
    marginBottom: 18,
  },
  brand: {
    fontFamily: "Cormorant Garamond",
    fontSize: 21,
    letterSpacing: 3,
    color: "#0b0b0b",
    lineHeight: 1.1,
    marginBottom: 5,
    ...NO_LIGA,
  },
  brandSub: {
    fontSize: 7,
    letterSpacing: 2,
    color: GOLD,
    lineHeight: 1.2,
    ...NO_LIGA,
  },
  companyBlock: {
    textAlign: "right",
    fontSize: 7.5,
    color: MUTED,
    maxWidth: 220,
    ...NO_LIGA,
  },
  h1: {
    fontFamily: "Cormorant Garamond",
    fontSize: 28,
    color: "#0b0b0b",
    lineHeight: 1.15,
    marginBottom: 12,
    ...NO_LIGA,
  },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 2.5,
    color: GOLD,
    textTransform: "uppercase",
    marginBottom: 6,
    ...NO_LIGA,
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  metaCell: { width: "50%", marginBottom: 8 },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 1.5,
    color: MUTED,
    textTransform: "uppercase",
  },
  metaValue: { fontSize: 10, color: INK, marginTop: 2 },
  disclaimer: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: GOLD_LINE,
    backgroundColor: "#faf6ec",
    padding: 12,
    fontSize: 8,
    color: "#5b4a28",
    lineHeight: 1.5,
  },
  roomTitle: {
    fontFamily: "Cormorant Garamond",
    fontSize: 19,
    color: "#0b0b0b",
    lineHeight: 1.15,
    ...NO_LIGA,
  },
  roomIndex: { fontSize: 7.5, letterSpacing: 2, color: GOLD, marginBottom: 3, ...NO_LIGA },
  thumb: {
    marginTop: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    alignSelf: "flex-start",
  },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginTop: 6,
  },
  tHeadCell: {
    fontSize: 7,
    letterSpacing: 1,
    color: MUTED,
    textTransform: "uppercase",
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 5,
  },
  roomBlueprint: {
    width: 150,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  photoBox: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  lightRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 10,
  },
  lightIndex: { fontSize: 6.5, letterSpacing: 1.5, color: GOLD, marginBottom: 2, ...NO_LIGA },
  lightName: {
    fontFamily: "Cormorant Garamond",
    fontSize: 14,
    color: "#0b0b0b",
    lineHeight: 1.15,
    marginBottom: 3,
    ...NO_LIGA,
  },
  lightMeta: { fontSize: 8, color: MUTED, ...NO_LIGA },
  lightSpec: { fontSize: 7.5, color: INK, marginBottom: 2, ...NO_LIGA },
  clientBox: {
    marginTop: 14,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    paddingLeft: 10,
    paddingVertical: 2,
  },
  clientName: {
    fontFamily: "Cormorant Garamond",
    fontSize: 16,
    color: "#0b0b0b",
    lineHeight: 1.15,
    marginBottom: 2,
    ...NO_LIGA,
  },
  lightAmt: { width: 90, textAlign: "right", fontSize: 10, ...NO_LIGA },
  optRow: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 10,
  },
  optLabel: { fontSize: 6.5, letterSpacing: 1.5, color: MUTED, marginBottom: 4, ...NO_LIGA },
  optName: { fontSize: 8.5, color: INK, marginTop: 5, marginBottom: 1, ...NO_LIGA },
  optNote: { fontSize: 7, color: GOLD, marginBottom: 1, ...NO_LIGA },
  optAmt: { fontSize: 10, color: INK, marginTop: 3, ...NO_LIGA },
  optEmpty: { backgroundColor: "#faf8f3" },
  optTotals: {
    marginTop: 12,
  },
  totalsCell: { width: 110, textAlign: "right" },
  cDesc: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  cQty: { width: 46, textAlign: "right" },
  cUnit: { width: 34, textAlign: "right", color: MUTED },
  cRate: { width: 78, textAlign: "right" },
  cAmt: { width: 88, textAlign: "right" },
  cDisc: { width: 62, textAlign: "right", color: MUTED },
  discLine: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    fontSize: 8.5,
    color: MUTED,
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GOLD_LINE,
  },
  subLabel: {
    fontFamily: "Cormorant Garamond",
    fontSize: 14,
    color: "#0b0b0b",
    marginRight: 18,
    lineHeight: 1.1,
    ...NO_LIGA,
  },
  subValue: {
    fontFamily: "Cormorant Garamond",
    fontSize: 14,
    color: "#0b0b0b",
    lineHeight: 1.1,
    ...NO_LIGA,
  },
  totalsBox: {
    marginTop: 18,
    marginLeft: "auto",
    width: 260,
  },
  totalsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 6,
    paddingTop: 8,
  },
  grandLabel: {
    fontFamily: "Cormorant Garamond",
    fontSize: 18,
    color: "#0b0b0b",
    lineHeight: 1.1,
    ...NO_LIGA,
  },
  grandValue: {
    fontFamily: "Cormorant Garamond",
    fontSize: 18,
    color: "#0b0b0b",
    lineHeight: 1.1,
    ...NO_LIGA,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 46,
    right: 46,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
  },
  slimHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: GOLD_LINE,
    paddingBottom: 8,
    marginBottom: 16,
  },
  slimBrand: {
    fontFamily: "Cormorant Garamond",
    fontSize: 13,
    letterSpacing: 3,
    color: "#0b0b0b",
    lineHeight: 1.1,
    ...NO_LIGA,
  },
});

/** " (10%)" for a percentage discount; nothing for a rupee one (the amount is shown). */
const pctNote = (label: string) => (label.endsWith("%") ? ` (${label})` : "");

function Watermark() {
  return (
    <Text style={s.watermark} fixed>
      SHAHI LITES
    </Text>
  );
}

function Footer({ number }: { number: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {COMPANY.legalName} · Quotation {number} · {COMPANY.phones.join(" · ")}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

function SlimHead({ number, validUntil }: { number: string; validUntil: string }) {
  return (
    <View style={s.slimHead} fixed>
      <Text style={s.slimBrand}>SHAHI LITES</Text>
      <Text style={{ fontSize: 8, color: MUTED }}>
        Quotation {number} · Valid until {validUntil}
      </Text>
    </View>
  );
}

/** "SKU GCL-110 · Size D90MM X H70MM" */
function Spec({ line }: { line: Pick<ComputedLine, "sku" | "dimensions"> }) {
  const parts = [line.sku ? `SKU ${line.sku}` : "", line.dimensions ? `Size ${line.dimensions}` : ""].filter(Boolean);
  return parts.length ? <Text style={s.lightSpec}>{parts.join("  ·  ")}</Text> : null;
}

/* ------------------------------ room lights ------------------------------ */

const OPT_GAP = 10;

/** Lights in a room across every option, in entry order. */
function lightPositions(rooms: ComputedRoom[]): { lineId: string; cells: (ComputedLine | undefined)[] }[] {
  const order: string[] = [];
  for (const r of rooms) for (const l of r.lines) if (!order.includes(l.lineId)) order.push(l.lineId);
  return order.map((lineId) => ({
    lineId,
    cells: rooms.map((r) => r.lines.find((l) => l.lineId === lineId)),
  }));
}

function Photo({ src, size }: { src?: string; size: number }) {
  return (
    <View style={[s.photoBox, { width: size, height: size }]}>
      {src ? <Image src={src} style={{ width: size - 2, height: size - 2, objectFit: "contain" }} /> : null}
    </View>
  );
}

/** One option: a big photo per light, beside its name, quantity and amount. */
function SingleOptionLights({ room, photos }: { room: ComputedRoom; photos: Record<string, string> }) {
  return (
    <View style={{ marginTop: 4 }}>
      {room.lines.map((l, i) => (
        <View key={l.lineId} style={s.lightRow} wrap={false}>
          <Photo src={l.image ? photos[l.image] : undefined} size={104} />
          <View style={{ flexGrow: 1, flexShrink: 1, paddingLeft: 14 }}>
            <Text style={s.lightIndex}>LIGHT {i + 1}</Text>
            <Text style={s.lightName}>{l.clientName}</Text>
            <Spec line={l} />
            <Text style={s.lightMeta}>
              {l.qty} {l.unitLabel} × {rs(l.unitCost)}
              {l.discount > 0 ? `  ·  Discount ${l.discountLabel} (−${rs(l.discount)})` : ""}
            </Text>
          </View>
          <Text style={s.lightAmt}>{rs(l.total)}</Text>
        </View>
      ))}
      {room.lines.length === 0 && (
        <Text style={{ color: MUTED, paddingVertical: 8 }}>No lighting specified.</Text>
      )}
    </View>
  );
}

/** Several options: each light gets a row with one column per option. */
function MultiOptionLights({ rooms, photos }: { rooms: ComputedRoom[]; photos: Record<string, string> }) {
  const n = rooms.length;
  const colW = (CONTENT_W - OPT_GAP * (n - 1)) / n;
  const photoSize = Math.min(150, colW - 4);
  const positions = lightPositions(rooms);
  return (
    <View style={{ marginTop: 4 }}>
      {positions.map((p, i) => {
        const any = p.cells.find(Boolean)!;
        return (
          <View key={p.lineId} style={s.optRow} wrap={false}>
            <Text style={s.lightIndex}>
              LIGHT {i + 1}  ·  QTY {any.qty} {any.unitLabel.toUpperCase()}
            </Text>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              {p.cells.map((c, o) => (
                <View
                  key={o}
                  style={{ width: colW, marginLeft: o === 0 ? 0 : OPT_GAP }}
                >
                  <Text style={s.optLabel}>OPTION {o + 1}</Text>
                  {c ? (
                    <>
                      <Photo src={c.image ? photos[c.image] : undefined} size={photoSize} />
                      <Text style={s.optName}>{c.clientName}</Text>
                      {c.inherited && <Text style={s.optNote}>Same as Option 1</Text>}
                      <Spec line={c} />
                      <Text style={s.lightMeta}>
                        {c.qty} {c.unitLabel} × {rs(c.unitCost)}
                      </Text>
                      {c.discount > 0 && (
                        <Text style={s.lightMeta}>
                          Discount {c.discountLabel} (−{rs(c.discount)})
                        </Text>
                      )}
                      <Text style={s.optAmt}>{rs(c.total)}</Text>
                    </>
                  ) : (
                    <View style={[s.photoBox, s.optEmpty, { width: photoSize, height: photoSize }]}>
                      <Text style={{ color: MUTED, fontSize: 8 }}>Not included</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
      {positions.length === 0 && (
        <Text style={{ color: MUTED, paddingVertical: 8 }}>No lighting specified.</Text>
      )}
    </View>
  );
}

/** Connectors / drivers, one amount column per option. */
function Accessories({ rooms }: { rooms: ComputedRoom[] }) {
  const names = new Map<string, string>();
  for (const r of rooms) for (const a of r.accessories) names.set(a.accessoryId, a.name);
  if (names.size === 0) return null;
  const multi = rooms.length > 1;
  return (
    <View style={{ marginTop: 12 }} wrap={false}>
      <View style={s.tHead}>
        <Text style={[s.tHeadCell, s.cDesc]}>Connectors / drivers</Text>
        {rooms.map((_, o) => (
          <Text key={o} style={[s.tHeadCell, s.cAmt]}>
            {multi ? `Option ${o + 1}` : "Amount"}
          </Text>
        ))}
      </View>
      {[...names].map(([id, name]) => (
        <View style={s.tRow} key={id}>
          <Text style={s.cDesc}>{name}</Text>
          {rooms.map((r, o) => {
            const a = r.accessories.find((x) => x.accessoryId === id);
            return (
              <Text key={o} style={s.cAmt}>
                {a ? `${a.qty} × ${rs(a.unitCost)} = ${rs(a.total)}` : "-"}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Room discount + subtotal, per option. */
function RoomTotals({ rooms }: { rooms: ComputedRoom[] }) {
  const multi = rooms.length > 1;
  const first = rooms[0];
  if (!multi) {
    return (
      <View wrap={false}>
        {first.discount > 0 && (
          <View style={s.discLine}>
            <Text style={{ marginRight: 18 }}>
              Total {rs(first.beforeDiscount)} · Room discount{pctNote(first.discountLabel)}
            </Text>
            <Text>−{rs(first.discount)}</Text>
          </View>
        )}
        <View style={s.subRow}>
          <Text style={s.subLabel}>Room subtotal</Text>
          <Text style={s.subValue}>{rs(first.subtotal)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.optTotals} wrap={false}>
      <Text style={s.subLabel}>Room subtotal</Text>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {rooms.map((r, o) => (
          <View key={o} style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={s.optLabel}>OPTION {o + 1}</Text>
            {r.discount > 0 && (
              <Text style={s.lightMeta}>
                Room discount{pctNote(r.discountLabel)} −{rs(r.discount)}
              </Text>
            )}
            <Text style={s.subValue}>{rs(r.subtotal)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface RenderArgs {
  number: string;
  createdAtISO: string;
  employeeName: string;
  /** one priced quote per option (a single entry when there are no options) */
  options: ComputedQuote[];
  blueprintDataUrl?: string;
  blueprintName?: string;
  /** product photo URL -> JPEG data URI (see product-images.ts) */
  photos?: Record<string, string>;
  /** who the quotation is for */
  client?: ClientDetails;
  /** last valid day, YYYY-MM-DD (IST); unset = 60 days from generation */
  validUntil?: string;
  /** encrypted editable contents, stored in the PDF's Keywords (draft-token.ts) */
  embedded?: string;
}

function QuotationDoc({
  number,
  createdAtISO,
  employeeName,
  options,
  blueprintDataUrl,
  blueprintName,
  photos = {},
  client,
  validUntil: validUntilYmd,
  embedded,
}: RenderArgs) {
  const quote = options[0];
  const multi = options.length > 1;
  const untilYmd = validUntilYmd ?? ymd(addDays(createdAtISO, QUOTE.validityDays));
  const validUntil = fmtYmd(untilYmd);
  const validDays = daysUntil(untilYmd, new Date(createdAtISO));
  const roomsWithLighting = quote.rooms.filter((_, i) =>
    options.some((q) => q.rooms[i].lines.length > 0),
  ).length;

  return (
    <Document
      title={`Shahi Lites Quotation ${number}`}
      author={COMPANY.legalName}
      keywords={embedded}
    >
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <Watermark />
        <View style={s.brandRow}>
          <View>
            <Text style={s.brand}>SHAHI LITES</Text>
            <Text style={s.brandSub}>
              {COMPANY.tagline.toUpperCase()}
            </Text>
          </View>
          <View style={s.companyBlock}>
            {COMPANY.addressLines.map((l) => (
              <Text key={l}>{l}</Text>
            ))}
            <Text>{COMPANY.phones.join(" · ")}</Text>
            <Text>{COMPANY.email}</Text>
          </View>
        </View>

        <Text style={s.eyebrow}>Lighting Quotation</Text>
        <Text style={s.h1}>Cost Estimate</Text>

        {client?.name ? (
          <View style={s.clientBox}>
            <Text style={s.metaLabel}>Prepared for</Text>
            <Text style={s.clientName}>{client.name}</Text>
            {client.address ? <Text style={s.lightMeta}>{client.address}</Text> : null}
            {client.phone || client.email ? (
              <Text style={s.lightMeta}>
                {[client.phone, client.email].filter(Boolean).join("  ·  ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={s.metaGrid}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Quotation No.</Text>
            <Text style={s.metaValue}>{number}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Generated</Text>
            <Text style={s.metaValue}>{fmtDateTime(createdAtISO)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Prepared by</Text>
            <Text style={s.metaValue}>{employeeName}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Valid until</Text>
            <Text style={s.metaValue}>
              {validUntil} ({validDays} day{validDays === 1 ? "" : "s"})
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Rooms</Text>
            <Text style={s.metaValue}>
              {quote.rooms.length} ({roomsWithLighting} with lighting)
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>{multi ? "Options" : "Blueprint"}</Text>
            <Text style={s.metaValue}>
              {multi
                ? `${options.length} options, priced side by side`
                : (blueprintName ?? "Not provided")}
            </Text>
          </View>
        </View>

        {blueprintDataUrl ? (
          <Image src={blueprintDataUrl} style={[s.thumb, { width: 320 }]} />
        ) : null}

        <View style={s.disclaimer}>
          <Text>{disclaimer(quote.applyGst, validUntil)}</Text>
        </View>

        <Footer number={number} />
      </Page>

      {/* One page (or more) per room */}
      {quote.rooms.map((room, i) => {
        const perOption = options.map((q) => q.rooms[i]);
        return (
          <Page size="A4" style={s.page} key={room.roomId}>
            <Watermark />
            <SlimHead number={number} validUntil={validUntil} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flexShrink: 1, paddingRight: 12 }}>
                <Text style={s.roomIndex}>
                  ROOM {i + 1} OF {quote.rooms.length}
                </Text>
                <Text style={s.roomTitle}>{room.name}</Text>
              </View>
              {blueprintDataUrl ? (
                <Image src={blueprintDataUrl} style={[s.roomBlueprint]} />
              ) : null}
            </View>

            {multi ? (
              <MultiOptionLights rooms={perOption} photos={photos} />
            ) : (
              <SingleOptionLights room={room} photos={photos} />
            )}
            <Accessories rooms={perOption} />
            <RoomTotals rooms={perOption} />
            <Footer number={number} />
          </Page>
        );
      })}

      {/* Totals */}
      <Page size="A4" style={s.page}>
        <Watermark />
        <SlimHead number={number} validUntil={validUntil} />
        <Text style={s.eyebrow}>Summary</Text>
        <Text style={s.h1}>Total Cost Estimate</Text>

        <View style={{ marginTop: 14 }}>
          <View style={s.tHead}>
            <Text style={[s.tHeadCell, s.cDesc]}>Room</Text>
            {options.map((_, o) => (
              <Text key={o} style={[s.tHeadCell, s.cAmt]}>
                {multi ? `Option ${o + 1}` : "Subtotal"}
              </Text>
            ))}
          </View>
          {quote.rooms.map((room, i) => (
            <View style={s.tRow} key={room.roomId}>
              <Text style={s.cDesc}>
                {i + 1}. {room.name}
              </Text>
              {options.map((q, o) => (
                <Text key={o} style={s.cAmt}>
                  {rs(q.rooms[i].subtotal)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={[s.totalsBox, multi ? { width: "100%" } : {}]}>
          {multi && (
            <View style={s.totalsLine}>
              <Text style={{ color: MUTED, flexGrow: 1 }} />
              {options.map((_, o) => (
                <Text key={o} style={[s.totalsCell, s.tHeadCell]}>
                  Option {o + 1}
                </Text>
              ))}
            </View>
          )}
          {options.some((q) => q.discount > 0) && (
            <>
              <TotalsRow label="Rooms total" values={options.map((q) => rs(q.roomsTotal))} />
              <TotalsRow
                label={`Discount${pctNote(quote.discountLabel)}`}
                values={options.map((q) => `−${rs(q.discount)}`)}
              />
            </>
          )}
          <TotalsRow label="Subtotal" values={options.map((q) => rs(q.subtotal))} />
          {quote.applyGst ? (
            <TotalsRow
              label={`GST @ ${quote.gstRatePct}%`}
              values={options.map((q) => rs(q.gstAmount))}
            />
          ) : (
            <TotalsRow label="GST" values={options.map(() => "Not included")} muted />
          )}
          <View style={s.totalsGrand}>
            <Text style={[s.grandLabel, { flexGrow: 1 }]}>Grand Total</Text>
            {options.map((q, o) => (
              <Text key={o} style={[s.grandValue, multi ? s.totalsCell : {}]}>
                {rs(q.grandTotal)}
              </Text>
            ))}
          </View>
          {options.some((q) => q.totalSavings > 0) && (
            <View style={[s.totalsLine, { marginTop: 4 }]}>
              <Text style={{ color: GOLD, flexGrow: 1 }}>Total discount (before GST)</Text>
              {options.map((q, o) => (
                <Text key={o} style={[{ color: GOLD }, multi ? s.totalsCell : {}]}>
                  {rs(q.totalSavings)}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={s.disclaimer}>
          <Text>{disclaimer(quote.applyGst, validUntil)}</Text>
        </View>

        <Footer number={number} />
      </Page>
    </Document>
  );
}

function TotalsRow({ label, values, muted }: { label: string; values: string[]; muted?: boolean }) {
  const multi = values.length > 1;
  return (
    <View style={s.totalsLine}>
      <Text style={{ color: MUTED, flexGrow: 1 }}>{label}</Text>
      {values.map((v, o) => (
        <Text key={o} style={[muted ? { color: MUTED } : {}, multi ? s.totalsCell : {}]}>
          {v}
        </Text>
      ))}
    </View>
  );
}

export async function renderQuotationPdf(args: RenderArgs): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<QuotationDoc {...args} />);
}
