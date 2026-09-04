import { reviewerEmail } from "./auth-config";
import { EMAIL } from "./config";
import { money } from "./format";
import { STATUS_LABEL, type QuotationStatus } from "./types";

export interface SendResult {
  transport: "smtp" | "stub";
  to: string;
  messageId?: string;
}

function senderPass(): { from: string; pass: string | undefined } {
  return {
    from: process.env.GMAIL_SENDER || EMAIL.senderEmail,
    pass: process.env.GMAIL_APP_PASSWORD,
  };
}

async function send(
  to: string,
  from: string,
  pass: string,
  message: {
    subject: string;
    text: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  },
): Promise<SendResult> {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: from, pass },
  });
  const info = await transporter.sendMail({
    from: `"${EMAIL.senderName}" <${from}>`,
    to,
    ...message,
  });
  return { transport: "smtp", to, messageId: info.messageId };
}

/*
 * Emails the quotation PDF to the reviewer (the superadmin's real Gmail, or
 * QUOTE_RECIPIENT if set) when an employee sends it for review. Stubbed until
 * GMAIL_APP_PASSWORD is set.
 */
export async function sendQuotationEmail(args: {
  number: string;
  pdf: Buffer;
  grandTotal: number;
  employeeName: string;
}): Promise<SendResult> {
  const { from, pass } = senderPass();
  const to = reviewerEmail();
  if (!to) {
    throw new Error(
      "No reviewer configured (set SUPERADMIN_EMAILS or QUOTE_RECIPIENT).",
    );
  }
  if (!pass) return { transport: "stub", to };

  return send(to, from, pass, {
    subject: `Shahi Lites: Quotation ${args.number} for review`,
    text: [
      `Quotation ${args.number}`,
      `Prepared by: ${args.employeeName}`,
      `Grand total: ${money(args.grandTotal)} (incl. GST)`,
      "",
      "The attached PDF is the only copy of this quotation. Shahi Lites does",
      "not retain a copy of the document or its line items. Please keep it safe.",
    ].join("\n"),
    attachments: [{ filename: `${args.number}.pdf`, content: args.pdf }],
  });
}

/* Notifies the employee directly that their quotation was approved or rejected. */
export async function sendDecisionEmail(args: {
  number: string;
  decision: Exclude<QuotationStatus, "submitted_for_review" | "downloaded">;
  note?: string;
  reviewerName: string;
  employeeName: string;
  employeeEmail: string;
}): Promise<SendResult> {
  const { from, pass } = senderPass();
  const to = args.employeeEmail;
  if (!pass) return { transport: "stub", to };

  return send(to, from, pass, {
    subject: `Shahi Lites: Quotation ${args.number} ${
      args.decision === "approved" ? "approved" : "rejected"
    }`,
    text: [
      `Hi ${args.employeeName},`,
      "",
      `Quotation ${args.number} has been ${STATUS_LABEL[
        args.decision
      ].toLowerCase()} by ${args.reviewerName}.`,
      ...(args.note ? ["", `Note: ${args.note}`] : []),
      "",
      "Shahi Lites",
    ].join("\n"),
  });
}
