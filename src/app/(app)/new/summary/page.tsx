"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeQuote } from "@/lib/quote";
import { cx } from "@/lib/cx";

export default function SummaryPage() {
  const router = useRouter();
  const { loaded, draft, addRoom, removeRoom } = useDraft();
  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    if (!loaded) return;
    if (!draft?.blueprint) router.replace("/new");
    else if (draft.rooms.length === 0) router.replace("/new/rooms");
  }, [loaded, draft, router]);

  if (!loaded || !draft?.blueprint || draft.rooms.length === 0) {
    return (
      <div className="h-[60vh] animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const quote = computeQuote(draft.rooms);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addRoom(newRoom);
    setNewRoom("");
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Summary</h1>
        <div className="mt-4">
          <WizardSteps current={4} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Blueprint */}
        <div className="h-[45vh] min-w-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-14rem)]">
          <BlueprintViewer
            src={draft.blueprint.previewDataUrl}
            className="h-full w-full"
          />
        </div>

        {/* Room cards + totals */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-3">
            {quote.rooms.map((room, i) => (
              <div
                key={room.roomId}
                className="rounded-[var(--radius-card)] border border-hairline p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-faint">Room {i + 1}</span>
                    <h3 className="font-display text-xl text-ink-deep">
                      {room.name}
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/new/rooms/${room.roomId}`)}
                      className="rounded-full border border-hairline px-3 py-1 text-xs text-muted hover:border-gold hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(`Delete "${room.name}" and its lighting?`)
                        ) {
                          removeRoom(room.roomId);
                        }
                      }}
                      aria-label={`Delete ${room.name}`}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-rejected/5 hover:text-rejected"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {room.systems.length === 0 ? (
                  <p className="mt-2 text-sm text-faint">
                    No lighting added yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {room.systems.map((s) => (
                      <li
                        key={s.systemId}
                        className="flex justify-between gap-3 text-muted"
                      >
                        <span className="min-w-0 truncate">
                          {s.name}
                          <span className="text-faint">
                            {" "}
                            × {s.qty} {s.unitLabel}
                          </span>
                        </span>
                      </li>
                    ))}
                    {room.accessories.length > 0 && (
                      <li className="text-xs text-faint">
                        + {room.accessories.length} connector/driver line
                        {room.accessories.length === 1 ? "" : "s"}
                      </li>
                    )}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2">
                  <span className="text-xs uppercase tracking-wider text-faint">
                    Room total
                  </span>
                  <span
                    className={cx(
                      "font-display text-lg tabular-nums",
                      room.subtotal > 0 ? "text-ink-deep" : "text-faint",
                    )}
                  >
                    {money(room.subtotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add room */}
          <form onSubmit={submitAdd} className="flex gap-2">
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="Add another room…"
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <Button type="submit" variant="secondary" disabled={!newRoom.trim()}>
              Add
            </Button>
          </form>

          {/* Totals */}
          <div className="rounded-[var(--radius-card)] border border-gold/40 bg-gold-tint/50 p-4">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums text-ink">
                  {money(quote.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">GST @ {quote.gstRatePct}%</dt>
                <dd className="tabular-nums text-ink">
                  {money(quote.gstAmount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gold/30 pt-2">
                <dt className="font-display text-xl text-ink-deep">
                  Grand total
                </dt>
                <dd className="font-display text-xl tabular-nums text-ink-deep">
                  {money(quote.grandTotal)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <ButtonLink href={`/new/rooms/${draft.rooms[0].id}`} variant="ghost">
              Back to rooms
            </ButtonLink>
            <ButtonLink href="/new/send">Continue</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
