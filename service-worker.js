const CACHE_NAME = "tennispro-v41";

const ASSETS_TO_CACHE = [
  "./",

  // =========================================================
  // PÁGINAS PRINCIPAIS
  // =========================================================

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
  "./aovivo.html",
  "./users-admin.html",
  "./confronto.html",

  // Torneios
  "./torneio.html",
  "./chave-torneio.html",

  "./manifest.json",

  // =========================================================
  // CSS
  // =========================================================

  "./css/style.css",
  "./css/theme.css",
  "./css/menu.css",
  "./css/perfil.css",
  "./css/player.css",
  "./css/carreira.css",
  "./css/admin.css",
  "./css/users-admin.css",
  "./css/dashboard.css",
  "./css/confronto.css",
  "./css/public.css?v=10",
  "./css/public-modern.css",
  "./css/aovivo.css",

  // CSS dos torneios
  "./css/torneio.css",
  "./css/chave-torneio.css",

  // =========================================================
  // JAVASCRIPT
  // =========================================================

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
  "./js/public.js?v=10",
  "./js/aovivo.js",
  "./js/confronto.js",
  "./js/gemini.js",

  // JavaScript dos torneios
  "./js/torneio.js?v=20260730-5",
  "./js/chave-torneio.js?v=20260730-7",

  // =========================================================
  // IMAGENS
  // =========================================================

  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/logo.png",
  "./img/avatar-default.png",
  "./img/perfil-padrao.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache =
        await caches.open(CACHE_NAME);

      for (const asset of ASSETS_TO_CACHE) {
        try {
          const response =
            await fetch(asset, {
              cache: "no-store"
            });

          if (response.ok) {
            await cache.put(
              asset,
              response.clone()
            );
          }
        } catch (error) {
          console.warn(
            "[SW] Erro ao cachear:",
            asset,
            error
          );
        }
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames =
        await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            name =>
              name !== CACHE_NAME
          )
          .map(name =>
            caches.delete(name)
          )
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request =
    event.request;

  if (request.method !== "GET") {
    return;
  }

  const url =
    new URL(request.url);

  /* * Arquivos externos continuam sendo * carregados diretamente pela rede. */
  if (
    url.origin !==
    self.location.origin
  ) {
    return;
  }

  /* * Firebase e APIs externas não devem * ser interceptados pelo cache local. */
  if (
    url.pathname.includes("/firebase") ||
    url.pathname.includes("/googleapis") ||
    url.pathname.includes("/gstatic")
  ) {
    return;
  }

  /* * Páginas HTML: * tenta rede primeiro e usa cache * somente se estiver offline. */
  if (
    request.mode === "navigate" ||
    request.destination === "document"
  ) {
    event.respondWith(
      (async () => {
        try {
          const response =
            await fetch(request, {
              cache: "no-store"
            });

          if (response.ok) {
            const cache =
              await caches.open(
                CACHE_NAME
              );

            await cache.put(
              request,
              response.clone()
            );
          }

          return response;
        } catch (error) {
          const cached =
            await caches.match(request);

          if (cached) {
            return cached;
          }

          const tournament =
            await caches.match(
              "./torneio.html"
            );

          if (tournament) {
            return tournament;
          }

          const bracket =
            await caches.match(
              "./chave-torneio.html"
            );

          if (bracket) {
            return bracket;
          }

          const dashboard =
            await caches.match(
              "./dashboard.html"
            );

          if (dashboard) {
            return dashboard;
          }

          const login =
            await caches.match(
              "./login.html"
            );

          if (login) {
            return login;
          }

          return new Response(
            "Página indisponível offline.",
            {
              status: 503,
              statusText: "Offline"
            }
          );
        }
      })()
    );

    return;
  }

  /* * CSS, JavaScript e imagens: * usa cache primeiro e atualiza * em segundo plano. */
  event.respondWith(
    (async () => {
      const cache =
        await caches.open(
          CACHE_NAME
        );

      const cached =
        await cache.match(request);

      const updateCache =
        fetch(request, {
          cache: "no-store"
        })
          .then(async response => {
            if (response.ok) {
              await cache.put(
                request,
                response.clone()
              );
            }

            return response;
          })
          .catch(() => null);

      if (cached) {
        event.waitUntil(
          updateCache
        );

        return cached;
      }

      const networkResponse =
        await updateCache;

      if (networkResponse) {
        return networkResponse;
      }

      return new Response(
        "",
        {
          status: 503,
          statusText:
            "Recurso indisponível offline"
        }
      );
    })()
  );
});

self.addEventListener("message", (event) => {
  if (
    event.data?.type ===
    "SKIP_WAITING"
  ) {
    self.skipWaiting();
  }
});
