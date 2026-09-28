"use client";

import { useEffect } from "react";

/*
 * Root error boundary. Sits inside the root layout, so it also catches
 * failures in the (app) layout's session / access check (e.g. the database
 * being unreachable), not just in individual pages.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="eyebrow">Shahi Lites</p>
      <h1 className="font-display text-3xl text-ink-deep">
        This page could not load
      </h1>
      <p className="text-sm text-muted">
        The server hit a problem, usually a brief database or network hiccup.
        Your in-progress quotation is saved on this device and is not lost.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-10 items-center rounded-full bg-gold px-5 text-sm font-medium text-paper hover:opacity-90"
        >
          Try again
        </button>
        <a
          href="/sign-in"
          className="inline-flex h-10 items-center rounded-full border border-hairline px-5 text-sm text-ink hover:border-gold"
        >
          Sign in again
        </a>
      </div>
      {error.digest && (
        <p className="font-mono text-[11px] text-faint">Ref {error.digest}</p>
      )}
    </main>
  );
}
