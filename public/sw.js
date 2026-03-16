// BUILD_VERSION is replaced at build time by vite.config.ts
const CACHE_VERSION = "__BUILD_VERSION__";
const CACHE_NAME = `agent-pomodoro-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete all old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Convex WebSocket and API calls
  if (url.hostname.includes("convex")) return;

  // Navigation: network-only (no caching HTML — Convex provides realtime data)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/") || new Response("Offline", { status: 503 }))
    );
    return;
  }

  // Hashed assets (/assets/*): cache-first (immutable, hash in filename)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
  }
});
