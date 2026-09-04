import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { STATUS_LABEL, type QuotationStatus } from "@/lib/types";

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 h-10 text-sm font-medium " +
  "transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

// Gold is the only call-to-action color in this product; red is reserved for
// destructive actions and rejections; everything else stays black, white, or grey.
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-gold text-ink-deep hover:opacity-90",
  secondary:
    "border border-hairline bg-paper text-ink hover:border-gold hover:bg-gold-tint",
  ghost: "text-ink hover:bg-panel",
  danger: "border border-rejected/40 text-rejected hover:bg-rejected/5",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(buttonBase, buttonVariants[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      className={cx(buttonBase, buttonVariants[variant], className)}
      {...props}
    />
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-hairline bg-paper p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display text-4xl text-ink-deep">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------- StatusBadge ------------------------------- */

// Only gold (pending), neutral ink (resolved, positive), or red (rejected) --
// never a status color outside black / white / gold / red.
const statusStyles: Record<QuotationStatus, string> = {
  downloaded: "bg-panel text-muted border-hairline",
  submitted_for_review: "bg-gold-tint text-gold-deep border-gold/40",
  approved: "bg-ink-deep/5 text-ink-deep border-ink-deep/20",
  rejected: "bg-rejected/10 text-rejected border-rejected/30",
};

export function StatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/* --------------------------------- Empty --------------------------------- */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-6 text-center">
      <p className="font-display text-2xl text-ink-deep">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
