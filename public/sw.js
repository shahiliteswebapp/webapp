/*
 * Minimal service worker: lets Chrome offer "Install app" for Shahi Lites.
 * It caches nothing; every request goes to the network as normal, so prices,
 * catalogue and quotations are always live.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  /* network only: let the browser handle every request */
});
