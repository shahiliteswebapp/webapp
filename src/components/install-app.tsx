"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/*
 * "Add Shahi Lites to your home screen". Chrome's own install banner hides
 * itself after a few seconds, so the app keeps its own: a slim banner on
 * phones until the app is installed or the banner is closed, and an
 * "Add to home screen" item in the phone menu that brings it back.
 *
 *  - Android / Chrome: the Install button opens the browser's install dialog.
 *  - iPhone / Safari: there is no install dialog, so it shows the two taps.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sl-install-dismissed";
export const SHOW_INSTALL_EVENT = "sl-show-install";

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own button
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function installed(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallApp() {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const [state, setState] = useState<{ ready: boolean; installed: boolean; ios: boolean; hidden: boolean }>({
    ready: false,
    installed: true,
    ios: false,
    hidden: true,
  });
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    // Register the service worker that makes the app installable.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Browser-only facts, read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ready: true, installed: installed(), ios: isIos(), hidden: readDismissed() });
    const show = () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* storage blocked */
      }
      setState((s) => ({ ...s, hidden: false }));
      setShowSteps(true);
    };
    window.addEventListener(SHOW_INSTALL_EVENT, show);
    return () => window.removeEventListener(SHOW_INSTALL_EVENT, show);
  }, []);

  if (!state.ready || state.installed || state.hidden) return null;
  // Nothing to offer: not iPhone and the browser has not said it can install.
  if (!state.ios && !canPrompt && !showSteps) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked */
    }
    setState((s) => ({ ...s, hidden: true }));
  };

  const install = async () => {
    if (!deferred) {
      setShowSteps(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    if (outcome === "accepted") setState((s) => ({ ...s, installed: true }));
  };

  return (
    <div className="border-b border-gold/40 bg-gold-tint sm:hidden">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-ink-deep">Add Shahi Lites to your home screen</p>
          {state.ios ? (
            <p className="text-xs text-muted">
              In Safari, tap Share <span aria-hidden>⎋</span> then &ldquo;Add to Home Screen&rdquo;.
            </p>
          ) : showSteps && !canPrompt ? (
            <p className="text-xs text-muted">
              In Chrome, tap ⋮ (top right) then &ldquo;Add to Home screen&rdquo; or &ldquo;Install app&rdquo;.
            </p>
          ) : (
            <p className="text-xs text-muted">Opens full screen, like an app.</p>
          )}
        </div>
        {!state.ios && canPrompt && (
          <button
            type="button"
            onClick={() => void install()}
            className="shrink-0 rounded-full bg-gold px-3 py-1.5 text-xs font-medium text-paper"
          >
            Install
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-paper"
        >
          ×
        </button>
      </div>
    </div>
  );
}
