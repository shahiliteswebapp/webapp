"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BlueprintViewer } from "@/components/blueprint-viewer";
import { WizardSteps } from "@/components/wizard-steps";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";
import { COMMON_ROOM_NAMES } from "@/lib/config";
import { useDraft } from "@/lib/draft/context";
import { cx } from "@/lib/cx";

export default function RoomListPage() {
  const router = useRouter();
  const {
    loaded,
    draft,
    addRoom,
    addRooms,
    renameRoom,
    removeRoom,
    moveRoom,
  } = useDraft();
  const [name, setName] = useState("");

  useEffect(() => {
    if (loaded && !draft?.blueprint) router.replace("/new");
  }, [loaded, draft?.blueprint, router]);

  if (!loaded || !draft?.blueprint) {
    return (
      <div className="h-[60vh] animate-pulse rounded-[var(--radius-card)] bg-panel" />
    );
  }

  const rooms = draft.rooms;
  const taken = new Set(rooms.map((r) => r.name.trim().toLowerCase()));

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addRoom(name);
    setName("");
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <Eyebrow>Start New</Eyebrow>
        <h1 className="font-display text-4xl text-ink-deep">Rooms</h1>
        <div className="mt-4">
          <WizardSteps current={2} />
        </div>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Blueprint */}
        <div className="h-[55vh] min-w-0 lg:sticky lg:top-24 lg:h-[calc(100dvh-14rem)]">
          <BlueprintViewer
            src={draft.blueprint.previewDataUrl}
            className="h-full w-full"
          />
        </div>

        {/* Room editor */}
        <div className="flex min-w-0 flex-col gap-4">
          <form onSubmit={submitAdd} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a room…"
              className="w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <Button type="submit" variant="secondary" disabled={!name.trim()}>
              Add
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {COMMON_ROOM_NAMES.map((c) => {
              const used = taken.has(c.toLowerCase());
              return (
                <button
                  key={c}
                  type="button"
                  disabled={used}
                  onClick={() => addRooms([c])}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    used
                      ? "border-hairline text-faint line-through"
                      : "border-hairline text-muted hover:border-gold hover:bg-gold-tint hover:text-ink",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-hairline bg-panel/50 p-6 text-center text-sm text-muted">
              No rooms yet. Add them above, or tap the suggestions.
            </div>
          ) : (
            <ul className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline">
              {rooms.map((room, i) => (
                <li key={room.id} className="flex items-center gap-2 p-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveRoom(room.id, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="grid h-4 w-5 place-items-center text-muted disabled:opacity-30 hover:text-ink"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRoom(room.id, 1)}
                      disabled={i === rooms.length - 1}
                      aria-label="Move down"
                      className="grid h-4 w-5 place-items-center text-muted disabled:opacity-30 hover:text-ink"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="w-5 text-center text-xs text-faint">
                    {i + 1}
                  </span>
                  <input
                    value={room.name}
                    onChange={(e) => renameRoom(room.id, e.target.value)}
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none hover:border-hairline focus:border-gold focus:bg-paper"
                  />
                  <button
                    type="button"
                    onClick={() => removeRoom(room.id)}
                    aria-label={`Delete ${room.name}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-rejected/5 hover:text-rejected"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-3 border-t border-hairline bg-paper/95 py-3 backdrop-blur">
            <span className="text-sm text-muted">
              {rooms.length} room{rooms.length === 1 ? "" : "s"}
            </span>
            {rooms.length === 0 ? (
              <Button disabled>Continue to lighting</Button>
            ) : (
              <ButtonLink href={`/new/rooms/${rooms[0].id}`}>
                Continue to lighting
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
