const CACHE_NAME = "blockscape-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./styles.css",
  "./js/app.js",
  "./js/builder.js",
  "./js/controls.js",
  "./js/palette.js",
  "./js/renderer.js",
  "./js/save-system.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(APP_SHELL);
    const request = new Request("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js", { mode: "cors" });
    const response = await fetch(request);
    if (!response.ok || response.type === "opaque") throw new Error("Could not cache the 3D engine for offline use.");
    await cache.put(request, response);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("blockscape-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })));
    return;
  }
  if (request.destination === "script" || request.destination === "style" || request.destination === "font") {
    event.respondWith(caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response.ok && response.type !== "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }));
  }
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
