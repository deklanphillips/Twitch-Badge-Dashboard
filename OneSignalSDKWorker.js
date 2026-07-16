// OneSignal web-push service worker (handles the "badge is live" pushes).
// Loaded and registered by the OneSignal SDK when push is configured.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// --- Offline caching (kept here so we run a single service worker) ---
const CACHE = "badgedrops-v1";
const CORE = ["/", "/styles.css", "/api-client.js", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Don't intercept OneSignal's own traffic.
  if (req.url.includes("onesignal.com")) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});
