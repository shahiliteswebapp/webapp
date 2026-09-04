import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { COMPANY, DISCLAIMER, QUOTE } from "@/lib/config";
import { addDays, fmtDate, fmtDateTime } from "@/lib/format";
import type { ComputedQuote, ComputedRoom } from "@/lib/quote";
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
  roomIndex: { fontSize: 7.5, letterSpacing: 2, color: GOLD, marginBottom: 3 },
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
  cDesc: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  cQty: { width: 46, textAlign: "right" },
  cUnit: { width: 34, textAlign: "right", color: MUTED },
  cRate: { width: 78, textAlign: "right" },
  cAmt: { width: 88, textAlign: "right" },
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

function Watermark() {
  return (
    <Text style={s.watermark} fixed>
      SHAHI LITES
    </Text>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>
        {COMPANY.legalName} · This PDF is the recipient&apos;s only copy — no copy
        is retained.
      </Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

function SlimHead({ number }: { number: string }) {
  return (
    <View style={s.slimHead} fixed>
      <Text style={s.slimBrand}>SHAHI LITES</Text>
      <Text style={{ fontSize: 8, color: MUTED }}>Quotation {number}</Text>
    </View>
  );
}

function LineTable({ room }: { room: ComputedRoom }) {
  return (
    <View>
      <View style={s.tHead}>
        <Text style={[s.tHeadCell, s.cDesc]}>Item</Text>
        <Text style={[s.tHeadCell, s.cQty]}>Qty</Text>
        <Text style={[s.tHeadCell, s.cUnit]}>Unit</Text>
        <Text style={[s.tHeadCell, s.cRate]}>Rate</Text>
        <Text style={[s.tHeadCell, s.cAmt]}>Amount</Text>
      </View>

      {room.systems.map((l) => (
        <View style={s.tRow} key={`sys-${l.systemId}`} wrap={false}>
          <Text style={s.cDesc}>{l.name}</Text>
          <Text style={s.cQty}>{l.qty}</Text>
          <Text style={s.cUnit}>{l.unitLabel}</Text>
          <Text style={s.cRate}>{rs(l.unitCost)}</Text>
          <Text style={s.cAmt}>{rs(l.total)}</Text>
        </View>
      ))}

      {room.accessories.map((a) => (
        <View style={s.tRow} key={`acc-${a.accessoryId}`} wrap={false}>
          <Text style={s.cDesc}>
            {a.name}
            <Text style={{ color: MUTED }}> — connector / driver</Text>
          </Text>
          <Text style={s.cQty}>{a.qty}</Text>
          <Text style={s.cUnit}>nos</Text>
          <Text style={s.cRate}>{rs(a.unitCost)}</Text>
          <Text style={s.cAmt}>{rs(a.total)}</Text>
        </View>
      ))}

      {room.systems.length === 0 && room.accessories.length === 0 && (
        <View style={s.tRow}>
          <Text style={[s.cDesc, { color: MUTED }]}>No lighting specified.</Text>
        </View>
      )}

      <View style={s.subRow}>
        <Text style={s.subLabel}>Room subtotal</Text>
        <Text style={s.subValue}>{rs(room.subtotal)}</Text>
      </View>
    </View>
  );
}

interface RenderArgs {
  number: string;
  createdAtISO: string;
  employeeName: string;
  quote: ComputedQuote;
  blueprintDataUrl?: string;
  blueprintName?: string;
}

function QuotationDoc({
  number,
  createdAtISO,
  employeeName,
  quote,
  blueprintDataUrl,
  blueprintName,
}: RenderArgs) {
  const validUntil = fmtDate(addDays(createdAtISO, QUOTE.validityDays));
  const roomsWithLighting = quote.rooms.filter(
    (r) => r.systems.length > 0,
  ).length;

  return (
    <Document
      title={`Shahi Lites Quotation ${number}`}
      author={COMPANY.legalName}
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
            <Text>GSTIN {COMPANY.gstin}</Text>
          </View>
        </View>

        <Text style={s.eyebrow}>Lighting Quotation</Text>
        <Text style={s.h1}>Cost Estimate</Text>

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
              {validUntil} ({QUOTE.validityDays} days)
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Rooms</Text>
            <Text style={s.metaValue}>
              {quote.rooms.length} ({roomsWithLighting} with lighting)
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Blueprint</Text>
            <Text style={s.metaValue}>{blueprintName ?? "—"}</Text>
          </View>
        </View>

        {blueprintDataUrl ? (
          <Image src={blueprintDataUrl} style={[s.thumb, { width: 320 }]} />
        ) : null}

        <View style={s.disclaimer}>
          <Text>{DISCLAIMER}</Text>
        </View>

        <Footer />
      </Page>

      {/* One page per room */}
      {quote.rooms.map((room, i) => (
        <Page size="A4" style={s.page} key={room.roomId}>
          <Watermark />
          <SlimHead number={number} />
          <Text style={s.roomIndex}>
            Room {i + 1} of {quote.rooms.length}
          </Text>
          <Text style={s.roomTitle}>{room.name}</Text>

          {blueprintDataUrl ? (
            <Image src={blueprintDataUrl} style={[s.thumb, { width: 240 }]} />
          ) : null}

          <LineTable room={room} />
          <Footer />
        </Page>
      ))}

      {/* Totals */}
      <Page size="A4" style={s.page}>
        <Watermark />
        <SlimHead number={number} />
        <Text style={s.eyebrow}>Summary</Text>
        <Text style={s.h1}>Total Cost Estimate</Text>

        <View style={{ marginTop: 14 }}>
          <View style={s.tHead}>
            <Text style={[s.tHeadCell, s.cDesc]}>Room</Text>
            <Text style={[s.tHeadCell, s.cAmt]}>Subtotal</Text>
          </View>
          {quote.rooms.map((room, i) => (
            <View style={s.tRow} key={room.roomId}>
              <Text style={s.cDesc}>
                {i + 1}. {room.name}
              </Text>
              <Text style={s.cAmt}>{rs(room.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsBox}>
          <View style={s.totalsLine}>
            <Text style={{ color: MUTED }}>Subtotal</Text>
            <Text>{rs(quote.subtotal)}</Text>
          </View>
          <View style={s.totalsLine}>
            <Text style={{ color: MUTED }}>GST @ {quote.gstRatePct}%</Text>
            <Text>{rs(quote.gstAmount)}</Text>
          </View>
          <View style={s.totalsGrand}>
            <Text style={s.grandLabel}>Grand Total</Text>
            <Text style={s.grandValue}>{rs(quote.grandTotal)}</Text>
          </View>
        </View>

        <View style={s.disclaimer}>
          <Text>{DISCLAIMER}</Text>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(args: RenderArgs): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<QuotationDoc {...args} />);
}
