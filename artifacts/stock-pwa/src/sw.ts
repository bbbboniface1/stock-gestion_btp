import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly, CacheFirst } from "workbox-strategies";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { ExpirationPlugin } from "workbox-expiration";
import { createHandlerBoundToURL } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

let pendingQueueCount = 0;

const bgSyncPlugin = new BackgroundSyncPlugin("stockbtp-mutations-queue", {
  maxRetentionTime: 7 * 24 * 60,
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        pendingQueueCount = Math.max(0, pendingQueueCount - 1);
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SYNC_SUCCESS" })
          );
        });
      } catch {
        await queue.unshiftRequest(entry);
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SYNC_RETRY" })
          );
        });
        throw new Error("Sync failed, will retry");
      }
    }
  },
});

const isMutation = ({ request }: { request: Request }) =>
  ["POST", "PATCH", "DELETE", "PUT"].includes(request.method);

const isApiRoute = ({ url }: { url: URL }) =>
  url.pathname.startsWith("/api/");

registerRoute(
  (ctx) => isApiRoute(ctx) && isMutation(ctx),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  "POST"
);

registerRoute(
  (ctx) => isApiRoute(ctx) && isMutation(ctx),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  "PATCH"
);

registerRoute(
  (ctx) => isApiRoute(ctx) && isMutation(ctx),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  "DELETE"
);

registerRoute(
  (ctx) => isApiRoute(ctx) && isMutation(ctx),
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  "PUT"
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "GET_QUEUE_COUNT") {
    (event.source as any)?.postMessage({ type: "QUEUE_COUNT", count: pendingQueueCount });
  }
  if (event.data?.type === "MUTATION_QUEUED") {
    pendingQueueCount = Math.max(0, pendingQueueCount + 1);
  }
});
