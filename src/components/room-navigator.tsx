"use client";

import Link from "next/link";
import { useState } from "react";
import { getSystem, systemImages } from "@/lib/catalog";
import { cx } from "@/lib/cx";
import { money0 } from "@/lib/format";
import { computeRoom } from "@/lib/quote";
import type { DraftRoom } from "@/lib/types";

/*
 * Rooms, each opening to the lights in it. Sits beside the lighting editor
 * (a sticky column on wide screens, a fold-out on phones) so any light in any
 * room is one click away instead of a long scroll.
 */

function Thumb({ systemId }: { systemId: string }) {
  const sys = systemId ? getSystem(systemId) : undefined;
  const src = sys ? systemImages(sys)[0] : undefined;
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded border border-hairline bg-paper">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : null}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cx("shrink-0 transition-transform", open && "rotate-90")}
    >
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RoomNavigator({
  rooms,
  currentRoomId,
  activeLineId,
  onSelectLine,
  onAddLine,
}: {
  rooms: DraftRoom[];
  currentRoomId: string;
  activeLineId: string | null;
  /** jump to a light; `roomId` may be another room */
  onSelectLine: (roomId: string, lineId: string) => void;
  onAddLine: () => void;
}) {
  // Other rooms the employee opened to peek at; the current room is always open.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav aria-label="Rooms and lights" className="space-y-1">
      <ul className="space-y-1">
        {rooms.map((room, i) => {
          const current = room.id === currentRoomId;
          const expanded = current || open.has(room.id);
          const lines = room.lines;
          const subtotal = computeRoom(room).subtotal;
          return (
            <li
              key={room.id}
              className={cx(
                "rounded-lg border",
                current ? "border-gold/50 bg-gold-tint/40" : "border-transparent",
              )}
            >
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => toggle(room.id)}
                  disabled={current}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Collapse ${room.name}` : `Show lights in ${room.name}`}
                  className="grid h-8 w-7 shrink-0 place-items-center text-muted hover:text-ink disabled:hover:text-muted"
                >
                  <Chevron open={expanded} />
                </button>
                <Link
                  href={`/new/rooms/${room.id}`}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "flex min-w-0 flex-1 items-baseline justify-between gap-2 py-1.5 text-sm",
                    current ? "font-medium text-ink-deep" : "text-ink hover:text-gold-deep",
                  )}
                >
                  <span className="truncate">
                    {i + 1}. {room.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">
                    {lines.length > 0 ? `${lines.length} · ${money0(subtotal)}` : "empty"}
                  </span>
                </Link>
              </div>

              {expanded && (
                <ul className="space-y-0.5 pb-1.5 pl-2 pr-1.5">
                  {lines.map((line, j) => {
                    const sys = getSystem(line.systemId);
                    const active = current && line.id === activeLineId;
                    return (
                      <li key={line.id}>
                        <button
                          type="button"
                          onClick={() => onSelectLine(room.id, line.id)}
                          aria-current={active ? "true" : undefined}
                          className={cx(
                            "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                            active ? "bg-paper shadow-sm ring-1 ring-gold" : "hover:bg-paper",
                          )}
                        >
                          <Thumb systemId={line.systemId} />
                          <span className="min-w-0 flex-1">
                            <span className={cx("block truncate", sys ? "text-ink" : "italic text-faint")}>
                              {sys ? sys.name : "Choose a light"}
                            </span>
                            <span className="block text-[11px] text-faint">
                              Light {j + 1}
                              {line.qty > 0 && ` · qty ${line.qty}`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {current && (
                    <li>
                      <button
                        type="button"
                        onClick={onAddLine}
                        className="w-full rounded-md px-1.5 py-1.5 text-left text-xs font-medium text-gold-deep hover:bg-paper"
                      >
                        + Add light
                      </button>
                    </li>
                  )}
                  {!current && lines.length === 0 && (
                    <li className="px-1.5 py-1 text-[11px] text-faint">No lights yet.</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <Link
        href="/new/rooms"
        className="block px-2 pt-1 text-xs text-muted hover:text-ink"
      >
        Edit room list
      </Link>
    </nav>
  );
}
