"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { useDraft } from "@/lib/draft/context";
import { money } from "@/lib/format";
import { computeOptions, optionLabel, quotedLights } from "@/lib/quote";
import { WarrantyList } from "@/components/warranty-list";
import { DiscountInput } from "@/components/discount-input";
import { OptionCountControl } from "@/components/option-count";
import { cx } from "@/lib/cx";
import { draftStarted } from "@/lib/types";

export default function SummaryPage() {
  const router = useRouter();
  const {
    loaded,
    draft,
    addRoom,
    removeRoom,
    setApplyGst,
    setQuoteDiscount,
    setOptionCount,
    setWarranty,
  } = useDraft();
  const [newRoom, setNewRoom] = useState("");

  useEffect(() => {
    if (!loaded) return;
    if (!draftStarted(draft)) router.replace("/new");
    else if (draft.rooms.length === 0) router.replace("/new/rooms");
  }, [loaded, draft, router]);

  if (!loaded || !draftStarted(draft) || draft.rooms.length === 0) {
    return (
      <div className="h-[60vh] animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const options = computeOptions(draft);
  const quote = options[0];
  const multi = options.length > 1;

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

      <div
        className={cx(
          "grid min-w-0 gap-5",
          draft.blueprint ? "lg:grid-cols-[minmax(0,1fr)_440px]" : "mx-auto max-w-xl",
        )}
      >
        {/* Blueprint */}
        {draft.blueprint && (
          <div className="h-[45vh] min-w-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-14rem)]">
            <BlueprintViewer
              src={draft.blueprint.previewDataUrl}
              className="h-full w-full"
            />
          </div>
        )}

        {/* Room cards + totals */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {multi
                ? `${options.length} options, each priced in full.`
                : "Offer the client up to 3 options."}
            </p>
            <OptionCountControl value={options.length} onChange={setOptionCount} />
          </div>
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

                {multi && (
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-faint">
                    Option 1 lights
                  </p>
                )}
                {room.systems.length === 0 ? (
                  <p className="mt-2 text-sm text-faint">
                    No lighting added yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {room.systems.map((s) => (
                      <li
                        key={s.key}
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

                {room.discount > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Room discount{room.discountLabel.endsWith("%") ? ` (${room.discountLabel})` : ""} −{money(room.discount)}
                  </p>
                )}
                {multi ? (
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-2">
                    {options.map((o, k) => (
                      <div key={k}>
                        <dt className="text-[11px] uppercase tracking-wider text-faint">
                          {optionLabel(k)}
                        </dt>
                        <dd className="font-display text-lg tabular-nums text-ink-deep">
                          {money(o.rooms[i].subtotal)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
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
                )}
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

          <WarrantyList
            lights={quotedLights(draft)}
            warranty={draft.warranty}
            onChange={setWarranty}
          />

          {/* Totals */}
          <div className="rounded-[var(--radius-card)] border border-gold/40 bg-gold-tint/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <DiscountInput
                label={multi ? "Quotation discount (all options)" : "Quotation discount"}
                value={draft.discount}
                onChange={setQuoteDiscount}
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={quote.applyGst}
                  onChange={(e) => setApplyGst(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-gold)]"
                />
                Charge GST @ {quote.gstRatePct}%
              </label>
            </div>
            <table className="w-full text-sm">
              {multi && (
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-faint">
                    <th className="pb-1 text-left font-normal" />
                    {options.map((_, k) => (
                      <th key={k} className="pb-1 text-right font-normal">
                        {optionLabel(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(
                  [
                    ["Rooms total", (q) => money(q.roomsTotal)],
                    ["Quotation discount", (q) => (q.discount > 0 ? `−${money(q.discount)}` : "-")],
                    ["Subtotal", (q) => money(q.subtotal)],
                    [
                      `GST @ ${quote.gstRatePct}%`,
                      (q) => (q.applyGst ? money(q.gstAmount) : "Not included"),
                    ],
                  ] as [string, (q: (typeof options)[number]) => string][]
                ).map(([label, cell]) => (
                  <tr key={label}>
                    <td className="py-0.5 text-muted">{label}</td>
                    {options.map((q, k) => (
                      <td
                        key={k}
                        className={cx(
                          "py-0.5 text-right tabular-nums",
                          !q.applyGst && label.startsWith("GST") ? "text-faint" : "text-ink",
                        )}
                      >
                        {cell(q)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-gold/30">
                  <td className="pt-2 font-display text-xl text-ink-deep">Grand total</td>
                  {options.map((q, k) => (
                    <td key={k} className="pt-2 text-right font-display text-xl tabular-nums text-ink-deep">
                      {money(q.grandTotal)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
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
