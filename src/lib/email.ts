import { reviewerEmail } from "./auth-config";
import { EMAIL } from "./config";
import { money } from "./format";
import type { QuotationStatus } from "./types";

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
    cc?: string;
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
 * QUOTE_RECIPIENT if set) when an employee sends it for review, and CCs the
 * employee who generated it so both copies land automatically. Stubbed until
 * GMAIL_APP_PASSWORD is set.
 */
export async function sendQuotationEmail(args: {
  number: string;
  pdf: Buffer;
  /** grand total of each option (one entry for a single-option quotation) */
  optionTotals: number[];
  applyGst?: boolean;
  employeeName: string;
  employeeEmail: string;
  /** made by editing this quotation (the email goes to the superadmin) */
  editedFrom?: string;
}): Promise<SendResult> {
  const { from, pass } = senderPass();
  const to = reviewerEmail();
  if (!to) {
    throw new Error(
      "No reviewer configured (set SUPERADMIN_EMAILS or QUOTE_RECIPIENT).",
    );
  }
  const cc =
    args.employeeEmail.toLowerCase() !== to.toLowerCase()
      ? args.employeeEmail
      : undefined;
  if (!pass) return { transport: "stub", to };

  return send(to, from, pass, {
    subject: `Shahi Lites: Quotation ${args.number}${args.editedFrom ? ` (edited from ${args.editedFrom})` : ""} for review`,
    cc,
    text: [
      `Quotation ${args.number}`,
      `Prepared by: ${args.employeeName}`,
      ...(args.optionTotals.length > 1
        ? args.optionTotals.map(
            (t, i) =>
              `Option ${i + 1} total: ${money(t)} (${args.applyGst === false ? "GST not included" : "incl. GST"})`,
          )
        : [
            `Grand total: ${money(args.optionTotals[0] ?? 0)} (${args.applyGst === false ? "GST not included" : "incl. GST"})`,
          ]),
      "",
      "The quotation is also saved in the Shahi Lites app, where it can be",
      "opened, reviewed and edited.",
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

  const accepted = args.decision === "approved";
  return send(to, from, pass, {
    subject: `Shahi Lites: Quotation ${args.number} ${accepted ? "accepted" : "rejected"}`,
    text: [
      `Hi ${args.employeeName},`,
      "",
      accepted
        ? `Congratulations! Your Quotation ${args.number} has been accepted successfully by Shahi Lites.`
        : `Your Quotation ${args.number} has been rejected by Shahi Lites.`,
      ...(args.note ? [`Note: ${args.note}`] : []),
      "",
      "Shahi Lites",
    ].join("\n"),
  });
}
