import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

// Valeurs par défaut — compatibles Vercel et local
const port = Number(process.env.PORT ?? "5173");
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    // runtimeErrorOverlay uniquement hors production
    ...(process.env.NODE_ENV !== "production"
      ? [runtimeErrorOverlay()]
      : []),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
      includeAssets: [
        "favicon.svg",
        "offline.html",
        "icons/icon.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "robots.txt",
      ],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        additionalManifestEntries: [{ url: "offline.html", revision: null }],
      },
      manifest: {
        name: "Gestion Stock BTP",
        short_name: "Stock BTP",
        description: "Application de gestion de stock pour le BTP",
        start_url: basePath,
        scope: basePath,
        display: "standalone",
        orientation: "portrait-primary",
        lang: "fr",
        theme_color: "#ea580c",
        background_color: "#1c1917",
        icons: [
          {
            src: `${basePath}icons/icon-192.png`.replace(/\/+/g, "/"),
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${basePath}icons/icon-512.png`.replace(/\/+/g, "/"),
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any",
          },
          {
            src: `${basePath}icons/icon.svg`.replace(/\/+/g, "/"),
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: `${basePath}favicon.svg`.replace(/\/+/g, "/"),
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
        shortcuts: [
          {
            name: "Tableau de bord",
            url: `${basePath}`.replace(/\/+/g, "/") || "/",
            icons: [
              {
                src: `${basePath}icons/icon.svg`.replace(/\/+/g, "/"),
                sizes: "192x192",
              },
            ],
          },
          {
            name: "Scan rapide",
            url: `${basePath}scan`.replace(/\/+/g, "/"),
          },
        ],
      },
    }),
    // Plugins Replit uniquement en dev sur Replit
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      }
    }
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});