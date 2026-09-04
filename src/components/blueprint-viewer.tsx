"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cx } from "@/lib/cx";

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export function BlueprintViewer({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const fitScaleRef = useRef(1);
  const touchedRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !nat) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / nat.w, ch / nat.h);
    fitScaleRef.current = scale;
    setT({
      scale,
      tx: (cw - nat.w * scale) / 2,
      ty: (ch - nat.h * scale) / 2,
    });
    touchedRef.current = false;
  }, [nat]);

  // Load natural size.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive) setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  useLayoutEffect(() => {
    if (nat) fit();
  }, [nat, fit]);

  // Refit on container resize (only if the user hasn't zoomed/panned).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!touchedRef.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const zoomTo = useCallback(
    (nextScale: number, cx0: number, cy0: number) => {
      setT((prev) => {
        const minS = fitScaleRef.current * 0.4;
        const maxS = fitScaleRef.current * 16;
        const scale = clamp(nextScale, minS, maxS);
        const k = scale / prev.scale;
        return {
          scale,
          tx: cx0 - (cx0 - prev.tx) * k,
          ty: cy0 - (cy0 - prev.ty) * k,
        };
      });
      touchedRef.current = true;
    },
    [],
  );

  // Native non-passive wheel listener so preventDefault() actually works.
  // Plain wheel scrolls the page; Ctrl/⌘ + wheel (and trackpad pinch, which the
  // browser reports as ctrlKey) zooms the blueprint.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setT((prev) => {
        const minS = fitScaleRef.current * 0.4;
        const maxS = fitScaleRef.current * 16;
        const scale = clamp(prev.scale * factor, minS, maxS);
        const k = scale / prev.scale;
        return {
          scale,
          tx: px - (px - prev.tx) * k,
          ty: py - (py - prev.ty) * k,
        };
      });
      touchedRef.current = true;
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: t.tx, ty: t.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setT((prev) => ({
      ...prev,
      tx: d.tx + (e.clientX - d.x),
      ty: d.ty + (e.clientY - d.y),
    }));
    touchedRef.current = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const btnZoom = (dir: 1 | -1) => {
    const el = containerRef.current;
    if (!el) return;
    zoomTo(t.scale * (dir === 1 ? 1.3 : 1 / 1.3), el.clientWidth / 2, el.clientHeight / 2);
  };

  const pct = fitScaleRef.current
    ? Math.round((t.scale / fitScaleRef.current) * 100)
    : 100;

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-panel",
        className,
      )}
    >
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => fit()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Blueprint"
          draggable={false}
          style={{
            transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`,
            transformOrigin: "0 0",
            width: nat?.w,
            height: nat?.h,
            maxWidth: "none",
          }}
          className="select-none will-change-transform"
        />
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-hairline bg-paper/95 px-1.5 py-1 text-sm shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => btnZoom(-1)}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-panel"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          type="button"
          onClick={() => fit()}
          className="min-w-14 rounded-full px-2 text-xs text-muted hover:bg-panel"
        >
          {pct}%
        </button>
        <button
          type="button"
          onClick={() => btnZoom(1)}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-panel"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}
