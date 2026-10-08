"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

/*
 * Share a quotation with a teammate: gets its share link from the server, then
 * opens the phone's share sheet (WhatsApp, Gmail...) or, on a laptop, copies
 * the link. The teammate opens it signed in and edits it like their own, with
 * every room and light already filled in.
 */
export function ShareQuoteButton({
  number,
  className,
  label = "Share",
}: {
  number: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");

  const share = async () => {
    setState("busy");
    try {
      const res = await fetch(`/api/quotations/${encodeURIComponent(number)}/share`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) throw new Error(data.error ?? "Could not make a link.");
      const url = new URL(data.path, window.location.origin).toString();
      const text = `Quotation ${number}: open it to edit (Shahi Lites team only).`;
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `Quotation ${number}`, text, url });
          setState("idle");
          return;
        } catch (e) {
          // Closed the share sheet: nothing to do.
          if ((e as Error).name === "AbortError") {
            setState("idle");
            return;
          }
        }
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={state === "busy"}
      title="Send a teammate a link to open and edit this quotation"
      aria-live="polite"
      className={cx(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium disabled:opacity-60",
        state === "error"
          ? "border-rejected/40 text-rejected"
          : "border-hairline text-ink hover:border-gold hover:bg-gold-tint",
        className,
      )}
    >
      {state === "busy"
        ? "…"
        : state === "copied"
          ? "Link copied"
          : state === "error"
            ? "Try again"
            : label}
    </button>
  );
}
