import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly, CacheFirst } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const INDEX_URL = `${BASE}index.html`.replace(/\/{2,}/g, "/");
const OFFLINE_URL = `${BASE}offline.html`.replace(/\/{2,}/g, "/");

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

let pendingQueueCount = 0;

function broadcast(type: string, extra: Record<string, unknown> = {}) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type, ...extra }));
  });
}

const bgSyncPlugin = new BackgroundSyncPlugin("stockbtp-mutations-queue", {
  maxRetentionTime: 7 * 24 * 60,
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        pendingQueueCount = Math.max(0, pendingQueueCount - 1);
        broadcast("SYNC_SUCCESS", { count: pendingQueueCount });
      } catch {
        await queue.unshiftRequest(entry);
        broadcast("SYNC_RETRY", { count: pendingQueueCount });
        throw new Error("Sync failed, will retry");
      }
    }
    broadcast("SYNC_COMPLETE", { count: pendingQueueCount });
  },
});

function normalizePath(pathname: string): string {
  if (BASE !== "/" && pathname.startsWith(BASE)) {
    const stripped = pathname.slice(BASE.length - 1);
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  return pathname;
}

function isApiRoute({ url }: { url: URL }): boolean {
  if (url.protocol === "chrome-extension:") return false;
  const path = normalizePath(url.pathname);
  return path.startsWith("/api/");
}

function isMutation({ request }: { request: Request }): boolean {
  return ["POST", "PATCH", "DELETE", "PUT"].includes(request.method);
}

function isStaticAsset({ url, request }: { url: URL; request: Request }): boolean {
  const path = normalizePath(url.pathname);
  return (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script" ||
    path.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?|css|js)$/) !== null
  );
}

const mutationHandler = new NetworkOnly({ plugins: [bgSyncPlugin] });

for (const method of ["POST", "PATCH", "DELETE", "PUT"] as const) {
  registerRoute(
    (ctx) => isApiRoute(ctx) && isMutation(ctx),
    mutationHandler,
    method,
  );
}

registerRoute(
  isApiRoute,
  new NetworkFirst({
    cacheName: "stockbtp-api-cache-v2",
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
  "GET",
);

registerRoute(
  isStaticAsset,
  new CacheFirst({
    cacheName: "stockbtp-assets-cache-v2",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

const spaHandler = createHandlerBoundToURL(INDEX_URL);

registerRoute(
  new NavigationRoute(async (options) => {
    try {
      const networkResponse = await fetch(options.request);
      if (networkResponse.ok) return networkResponse;
    } catch {
      // fallback cache
    }

    const cachedApp = await spaHandler(options);
    if (cachedApp) return cachedApp;

    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return Response.error();
  }),
);

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_QUEUE_COUNT") {
    const source = event.source;
    if (source && "postMessage" in source) {
      source.postMessage({ type: "QUEUE_COUNT", count: pendingQueueCount });
    }
  }
  if (event.data?.type === "MUTATION_QUEUED") {
    pendingQueueCount += 1;
    broadcast("MUTATION_QUEUED", { count: pendingQueueCount });
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "stockbtp-mutations-queue") {
    event.waitUntil(Promise.resolve());
  }
});
