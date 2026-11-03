/* FocusKept service worker: offline timer + web push. Hand-written, no build step. */
const VERSION = "fk-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const LOCALE = /^\/([a-z]{2}(?:-[A-Z]{2})?)(?=\/|$)/;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(["/icon.svg", "/icons/icon-192.png"]).catch(() => {}),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Public pages that may be cached for offline use. App pages are never cached. */
function cacheablePage(url) {
  const path = url.pathname.replace(LOCALE, "");
  return path === "" || path === "/focus" || path.startsWith("/techniques");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Worker scripts share one bootstrap URL and differ only in the #params
  // fragment, which a cache key ignores: serving one from the cache would
  // start the wrong worker (e.g. the timer instead of the sound renderer).
  if (
    request.destination === "worker" ||
    request.destination === "sharedworker"
  )
    return;

  // Immutable build assets: cache first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && cacheablePage(url)) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          const hit = await cache.match(request);
          if (hit) return hit;
          // Offline in the app: fall back to the anonymous timer, which keeps
          // the session on this device until it can be synced.
          const locale = (url.pathname.match(LOCALE) || [])[1] || "en";
          for (const fallback of [`/${locale}/focus`, "/en/focus"])
            if (url.pathname !== fallback && (await cache.match(fallback)))
              return Response.redirect(fallback, 302);
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || "FocusKept";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "focuskept",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (
          new URL(client.url).pathname === target.pathname &&
          "focus" in client
        )
          return client.focus();
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
