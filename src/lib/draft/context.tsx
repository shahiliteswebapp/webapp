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
import {
  MAX_OPTIONS,
  MAX_WARRANTY_YEARS,
  cleanLeadTime,
  type ClientDetails,
  type Discount,
  type DraftBlueprint,
  type LeadTime,
  type QuoteDraft,
  type RoomLine,
} from "@/lib/types";
import { idbClear, idbGet, idbSet } from "./idb";

interface DraftContextValue {
  loaded: boolean;
  draft: QuoteDraft | null;
  blueprintUrl: string | null;
  setBlueprint: (bp: DraftBlueprint) => Promise<void>;
  /** start a quotation with no blueprint */
  skipBlueprint: () => void;
  /** drop the blueprint, keeping every room and light */
  removeBlueprint: () => void;
  setApplyGst: (v: boolean) => void;
  setRoomDiscount: (id: string, d: Discount | undefined) => void;
  setQuoteDiscount: (d: Discount | undefined) => void;
  /** how many options (1 to 3) the quotation offers */
  setOptionCount: (n: number) => void;
  /** adds a room; returns its id, or null for an empty name */
  addRoom: (name: string) => string | null;
  addRooms: (names: string[]) => void;
  renameRoom: (id: string, name: string) => void;
  removeRoom: (id: string) => void;
  moveRoom: (id: string, dir: -1 | 1) => void;
  setRoomLines: (id: string, lines: RoomLine[]) => void;
  setClient: (c: ClientDetails) => void;
  /** YYYY-MM-DD, or undefined for the default 60 days */
  setValidUntil: (v: string | undefined) => void;
  /** warranty in years for one light (system id); undefined clears it */
  setWarranty: (systemId: string, years: number | undefined) => void;
  /** delivery lead time for one light (system id); undefined clears it */
  setLeadTime: (systemId: string, t: LeadTime | undefined) => void;
  /** replace the whole draft (reopening a saved quotation to edit it) */
  loadDraft: (d: QuoteDraft) => Promise<void>;
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

  // Object URL for the blueprint blob, recreated (and the old one revoked)
  // when the blob changes.
  const blob = draft?.blueprint?.blob ?? null;
  const blueprintUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  useEffect(() => {
    return () => {
      if (blueprintUrl) URL.revokeObjectURL(blueprintUrl);
    };
  }, [blueprintUrl]);

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
      const next: QuoteDraft = { ...base, blueprint: bp, noBlueprint: false };
      commit(next);
    },
    [draft, commit],
  );

  const skipBlueprint = useCallback(() => {
    mutate((d) => {
      d.noBlueprint = true;
      return d;
    });
  }, [mutate]);

  const removeBlueprint = useCallback(() => {
    mutate((d) => {
      d.blueprint = undefined;
      d.noBlueprint = true;
      return d;
    });
  }, [mutate]);

  const setApplyGst = useCallback(
    (v: boolean) => {
      mutate((d) => {
        d.applyGst = v;
        return d;
      });
    },
    [mutate],
  );

  const setRoomDiscount = useCallback(
    (id: string, d: Discount | undefined) => {
      mutate((draft) => {
        const room = draft.rooms.find((r) => r.id === id);
        if (room) room.discount = d;
        return draft;
      });
    },
    [mutate],
  );

  const setQuoteDiscount = useCallback(
    (d: Discount | undefined) => {
      mutate((draft) => {
        draft.discount = d;
        return draft;
      });
    },
    [mutate],
  );

  const setOptionCount = useCallback(
    (n: number) => {
      mutate((draft) => {
        // Alternatives on lines are kept, so going 3 -> 1 -> 3 loses nothing.
        draft.optionCount = Math.min(Math.max(Math.round(n), 1), MAX_OPTIONS);
        return draft;
      });
    },
    [mutate],
  );

  const addRoom = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = uid();
      mutate((d) => {
        d.rooms.push({ id, name: trimmed, lines: [] });
        return d;
      });
      return id;
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

  const setClient = useCallback(
    (c: ClientDetails) => {
      mutate((d) => {
        d.client = c;
        return d;
      });
    },
    [mutate],
  );

  const setValidUntil = useCallback(
    (v: string | undefined) => {
      mutate((d) => {
        d.validUntil = v;
        return d;
      });
    },
    [mutate],
  );

  const setWarranty = useCallback(
    (systemId: string, years: number | undefined) => {
      mutate((d) => {
        const w = { ...d.warranty };
        const n = Math.round(Number(years));
        if (n >= 1) w[systemId] = Math.min(n, MAX_WARRANTY_YEARS);
        else delete w[systemId];
        d.warranty = Object.keys(w).length ? w : undefined;
        return d;
      });
    },
    [mutate],
  );

  const setLeadTime = useCallback(
    (systemId: string, t: LeadTime | undefined) => {
      mutate((d) => {
        const all = { ...d.leadTime };
        if (t) all[systemId] = t;
        else delete all[systemId];
        // Out-of-range values drop out here, like on the server.
        d.leadTime = cleanLeadTime(all);
        return d;
      });
    },
    [mutate],
  );

  const loadDraft = useCallback(async (d: QuoteDraft) => {
    d.updatedAt = new Date().toISOString();
    setDraft(d);
    try {
      await idbSet(d);
    } catch {
      /* best-effort persistence */
    }
  }, []);

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
      skipBlueprint,
      removeBlueprint,
      setApplyGst,
      setRoomDiscount,
      setQuoteDiscount,
      setOptionCount,
      addRoom,
      addRooms,
      renameRoom,
      removeRoom,
      moveRoom,
      setRoomLines,
      setClient,
      setValidUntil,
      setWarranty,
      setLeadTime,
      loadDraft,
      discard,
    }),
    [
      loaded,
      draft,
      blueprintUrl,
      setBlueprint,
      skipBlueprint,
      removeBlueprint,
      setApplyGst,
      setRoomDiscount,
      setQuoteDiscount,
      setOptionCount,
      addRoom,
      addRooms,
      renameRoom,
      removeRoom,
      moveRoom,
      setRoomLines,
      setClient,
      setValidUntil,
      setWarranty,
      setLeadTime,
      loadDraft,
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
