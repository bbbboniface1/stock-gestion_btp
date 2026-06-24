declare module "workbox-precaching" {
  export function precacheAndRoute(manifest: unknown): void;
  export function cleanupOutdatedCaches(): void;
  export function createHandlerBoundToURL(url: string): unknown;
}

declare module "workbox-routing" {
  export class NavigationRoute {
    constructor(handler: unknown);
  }
  export function registerRoute(
    match: unknown,
    handler?: unknown,
    method?: string,
  ): void;
}

declare module "workbox-strategies" {
  export class NetworkFirst {
    constructor(options?: unknown);
  }
  export class NetworkOnly {
    constructor(options?: unknown);
  }
  export class CacheFirst {
    constructor(options?: unknown);
  }
}

declare module "workbox-background-sync" {
  export class BackgroundSyncPlugin {
    constructor(name: string, options?: unknown);
  }
}

declare module "workbox-expiration" {
  export class ExpirationPlugin {
    constructor(options?: unknown);
  }
}
