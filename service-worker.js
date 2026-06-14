const CACHE_NAME = "tennispro-v2";

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
  "./manifest.json",
  "./css/style.css",
  "./css/menu.css",
  "./css/perfil.css",
  "./css/player.css",
  "./css/carreira.css",
  "./css/admin.css",
  "./css/users-admin.css",
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
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/logo.png",
  "./img/avatar-default.png",
  "./img/perfil-padrao.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./login.html");
        }
        return new Response("", {
          status: 503,
          statusText: "Offline"
        });
      });
    })
  );
});
