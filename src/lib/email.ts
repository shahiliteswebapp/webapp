import { EMAIL } from "./config";
import { money } from "./format";
import { STATUS_LABEL, type QuotationStatus } from "./types";

export interface SendResult {
  transport: "smtp" | "stub";
  to: string;
  messageId?: string;
}

function config(employeeEmail?: string) {
  return {
    pass: process.env.GMAIL_APP_PASSWORD,
    from: process.env.GMAIL_SENDER || EMAIL.senderEmail,
    // Everything goes to the single fixed recipient for now; drop
    // recipientOverride later to reach the actual employee.
    to:
      process.env.QUOTE_RECIPIENT ||
      EMAIL.recipientOverride ||
      employeeEmail ||
      EMAIL.senderEmail,
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

/* Emails the quotation PDF (stub until GMAIL_APP_PASSWORD is set). */
export async function sendQuotationEmail(args: {
  number: string;
  pdf: Buffer;
  grandTotal: number;
  employeeName: string;
}): Promise<SendResult> {
  const { pass, from, to } = config();
  if (!pass) return { transport: "stub", to };

  return send(to, from, pass, {
    subject: `Shahi Lites — Quotation ${args.number}`,
    text: [
      `Quotation ${args.number}`,
      `Prepared by: ${args.employeeName}`,
      `Grand total: ${money(args.grandTotal)} (incl. GST)`,
      "",
      "The attached PDF is the only copy of this quotation. Shahi Lites does",
      "not retain a copy of the document or its line items — please keep it safe.",
    ].join("\n"),
    attachments: [{ filename: `${args.number}.pdf`, content: args.pdf }],
  });
}

/* Notifies the employee that a manager approved or rejected their quotation. */
export async function sendDecisionEmail(args: {
  number: string;
  decision: Exclude<QuotationStatus, "submitted_for_review">;
  note?: string;
  managerName: string;
  employeeName: string;
  employeeEmail: string;
}): Promise<SendResult> {
  const { pass, from, to } = config(args.employeeEmail);
  if (!pass) return { transport: "stub", to };

  return send(to, from, pass, {
    subject: `Shahi Lites — Quotation ${args.number} ${
      args.decision === "approved" ? "approved" : "rejected"
    }`,
    text: [
      `Hi ${args.employeeName},`,
      "",
      `Quotation ${args.number} has been ${STATUS_LABEL[
        args.decision
      ].toLowerCase()} by ${args.managerName}.`,
      ...(args.note ? ["", `Note: ${args.note}`] : []),
      "",
      "— Shahi Lites",
    ].join("\n"),
  });
}
