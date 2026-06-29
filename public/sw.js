// Minimal service worker for Alpha Bakery PWA (installability + offline-aware).
// Intentionally lightweight: this app is dynamic and auth-protected, so we use
// network-first and do NOT aggressively cache pages to avoid serving stale data.

// Bump this on any sw.js change so already-installed clients (incl. installed
// PWAs) replace their old worker — old copies that intercepted /_next/ broke
// Turbopack dev chunks (ChunkLoadError).
const CACHE = "alpha-bakery-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon.svg"]).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never intercept build/runtime assets or cross-origin requests. Touching
  // /_next/ chunks breaks Turbopack/Next chunk loading (ChunkLoadError) when
  // hashes change; let the browser load these directly.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/")) return;

  // Only handle page navigations, network-first, so the app stays installable
  // and offline-aware without ever sitting in front of script/asset requests.
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || Response.error()))
  );
});
