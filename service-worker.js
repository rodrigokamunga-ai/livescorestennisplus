const CACHE_NAME = "tennispro-v8";

const ASSETS_TO_CACHE = [
  "./",
  "./login.html",
  "./register.html",
  "./reset-password.html",
  "./menu.html",
  "./admin.html",
  "./player.html",
  "./carreira.html",
  "./dashboard.html",
  "./perfil.html",
  "./public.html",
  "./users-admin.html",
  "./confronto.html",
  "./manifest.json",

  "./css/style.css",
  "./css/menu.css",
  "./css/perfil.css",
  "./css/player.css",
  "./css/carreira.css",
  "./css/admin.css",
  "./css/users-admin.css",
  "./css/confronto.css",

  "./js/firebase.js",
  "./js/login.js",
  "./js/register.js",
  "./js/reset-password.js",
  "./js/menu.js",
  "./js/perfil.js",
  "./js/player.js",
  "./js/tennisRules.js",
  "./js/carreira.js",
  "./js/admin.js",
  "./js/users-admin.js",
  "./js/dashboard.js",
  "./js/public.js",
  "./js/confronto.js",

  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/logo.png",
  "./img/avatar-default.png",
  "./img/perfil-padrao.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of ASSETS_TO_CACHE) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (response && response.ok) {
            await cache.put(url, response.clone());
          }
        } catch (error) {
          console.warn("Erro ao cachear:", url, error);
        }
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // Ignora terceiros
  if (
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.includes("/firebase") ||
    requestUrl.pathname.includes("/googleapis") ||
    requestUrl.pathname.includes("/gstatic")
  ) {
    return;
  }

  // HTML / navegação: rede primeiro, fallback cache
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request, { cache: "no-store" });

          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request.url, networkResponse.clone());
          }

          return networkResponse;
        } catch (error) {
          const cached = await caches.match(event.request.url);
          if (cached) return cached;

          const fallback = await caches.match("./login.html");
          if (fallback) return fallback;

          return new Response("Offline", {
            status: 503,
            statusText: "Offline"
          });
        }
      })()
    );
    return;
  }

  // CSS / JS / imagens: cache first, update in background
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request.url);

      const networkFetch = fetch(event.request, { cache: "no-store" })
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            await cache.put(event.request.url, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkFetch);
        return cachedResponse;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      return new Response("", {
        status: 503,
        statusText: "Offline"
      });
    })()
  );
});
