const CACHE_VERSION = "gf-pwa-v1";
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (["script", "style", "worker", "image", "font"].includes(request.destination)) {
    event.respondWith(handleStaticAsset(request));
  }
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const freshResponse = await fetch(request);
    if (freshResponse.ok) {
      cache.put(request, freshResponse.clone());
    }
    return freshResponse;
  } catch (error) {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      (await cache.match("/offline.html"))
    );
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    return cachedResponse;
  }

  return networkPromise.then((response) => response || Response.error());
}
