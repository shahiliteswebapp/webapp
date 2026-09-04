import { EMAIL } from "./config";
import { money } from "./format";

export interface SendResult {
  transport: "smtp" | "stub";
  to: string;
  messageId?: string;
}

interface SendArgs {
  number: string;
  pdf: Buffer;
  grandTotal: number;
  employeeName: string;
}

/*
 * Emails the quotation PDF. Until GMAIL_APP_PASSWORD is set this is a no-op
 * ("stub") — the caller has already written the PDF to ./output. When the app
 * password is present it sends via Gmail SMTP from a single account to a single
 * fixed recipient (see src/lib/config.ts / .env.local).
 */
export async function sendQuotationEmail(args: SendArgs): Promise<SendResult> {
  const pass = process.env.GMAIL_APP_PASSWORD;
  const from = process.env.GMAIL_SENDER || EMAIL.senderEmail;
  const to = process.env.QUOTE_RECIPIENT || EMAIL.recipientOverride;

  if (!pass) {
    return { transport: "stub", to };
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: from, pass },
  });

  const info = await transporter.sendMail({
    from: `"${EMAIL.senderName}" <${from}>`,
    to,
    subject: `Shahi Lites — Quotation ${args.number}`,
    text: [
      `Quotation ${args.number}`,
      `Prepared by: ${args.employeeName}`,
      `Grand total: ${money(args.grandTotal)} (incl. GST)`,
      "",
      "The attached PDF is the only copy of this quotation. Shahi Lites does",
      "not retain a copy of the document or its line items — please keep it safe.",
    ].join("\n"),
    attachments: [
      { filename: `${args.number}.pdf`, content: args.pdf },
    ],
  });

  return { transport: "smtp", to, messageId: info.messageId };
}
