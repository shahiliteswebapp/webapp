"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DraftBlueprint, DraftRoom, QuoteDraft, RoomLine } from "@/lib/types";
import { idbClear, idbGet, idbSet } from "./idb";

interface DraftContextValue {
  loaded: boolean;
  draft: QuoteDraft | null;
  blueprintUrl: string | null;
  setBlueprint: (bp: DraftBlueprint) => Promise<void>;
  addRoom: (name: string) => void;
  addRooms: (names: string[]) => void;
  renameRoom: (id: string, name: string) => void;
  removeRoom: (id: string) => void;
  moveRoom: (id: string, dir: -1 | 1) => void;
  setRoomLines: (id: string, lines: RoomLine[]) => void;
  discard: () => Promise<void>;
}

const DraftContext = createContext<DraftContextValue | null>(null);

function emptyDraft(): QuoteDraft {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now, rooms: [] };
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function DraftProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null);

  // Load once from IndexedDB.
  useEffect(() => {
    let cancelled = false;
    idbGet<QuoteDraft>()
      .then((stored) => {
        if (!cancelled) setDraft(stored ?? null);
      })
      .catch(() => {
        /* private mode / blocked storage — start fresh */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Object URL for the blueprint blob, recreated when the blob changes.
  const blob = draft?.blueprint?.blob ?? null;
  useEffect(() => {
    if (!blob) {
      setBlueprintUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlueprintUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const commit = useCallback((next: QuoteDraft) => {
    next.updatedAt = new Date().toISOString();
    setDraft(next);
    void idbSet(next).catch(() => {
      /* best-effort persistence */
    });
  }, []);

  const mutate = useCallback(
    (fn: (d: QuoteDraft) => QuoteDraft) => {
      setDraft((prev) => {
        const base = prev ?? emptyDraft();
        const next = fn(structuredCloneSafe(base));
        next.updatedAt = new Date().toISOString();
        void idbSet(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  const setBlueprint = useCallback(
    async (bp: DraftBlueprint) => {
      const base = draft ?? emptyDraft();
      const next: QuoteDraft = { ...base, blueprint: bp };
      commit(next);
    },
    [draft, commit],
  );

  const addRoom = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      mutate((d) => {
        d.rooms.push({ id: uid(), name: trimmed, lines: [] });
        return d;
      });
    },
    [mutate],
  );

  const addRooms = useCallback(
    (names: string[]) => {
      mutate((d) => {
        const existing = new Set(d.rooms.map((r) => r.name.toLowerCase()));
        for (const raw of names) {
          const name = raw.trim();
          if (!name || existing.has(name.toLowerCase())) continue;
          existing.add(name.toLowerCase());
          d.rooms.push({ id: uid(), name, lines: [] });
        }
        return d;
      });
    },
    [mutate],
  );

  const renameRoom = useCallback(
    (id: string, name: string) => {
      mutate((d) => {
        const room = d.rooms.find((r) => r.id === id);
        if (room) room.name = name;
        return d;
      });
    },
    [mutate],
  );

  const removeRoom = useCallback(
    (id: string) => {
      mutate((d) => {
        d.rooms = d.rooms.filter((r) => r.id !== id);
        return d;
      });
    },
    [mutate],
  );

  const moveRoom = useCallback(
    (id: string, dir: -1 | 1) => {
      mutate((d) => {
        const i = d.rooms.findIndex((r) => r.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.rooms.length) return d;
        [d.rooms[i], d.rooms[j]] = [d.rooms[j], d.rooms[i]];
        return d;
      });
    },
    [mutate],
  );

  const setRoomLines = useCallback(
    (id: string, lines: RoomLine[]) => {
      mutate((d) => {
        const room = d.rooms.find((r) => r.id === id);
        if (room) room.lines = lines;
        return d;
      });
    },
    [mutate],
  );

  const discard = useCallback(async () => {
    setDraft(null);
    try {
      await idbClear();
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<DraftContextValue>(
    () => ({
      loaded,
      draft,
      blueprintUrl,
      setBlueprint,
      addRoom,
      addRooms,
      renameRoom,
      removeRoom,
      moveRoom,
      setRoomLines,
      discard,
    }),
    [
      loaded,
      draft,
      blueprintUrl,
      setBlueprint,
      addRoom,
      addRooms,
      renameRoom,
      removeRoom,
      moveRoom,
      setRoomLines,
      discard,
    ],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within <DraftProvider>");
  return ctx;
}

/** structuredClone but tolerant of a Blob (which clones fine) and old engines. */
function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v);
  } catch {
    // Blob is not JSON-serialisable; clone shallowly enough for our mutations.
    const anyV = v as unknown as QuoteDraft;
    return {
      ...anyV,
      rooms: anyV.rooms.map((r) => ({ ...r, lines: [...r.lines] })),
    } as unknown as T;
  }
}
