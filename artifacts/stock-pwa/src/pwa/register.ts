import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onRegistered(registration) {
      console.log("[SW] Enregistré avec succès:", registration?.scope);
    },
    onRegisterError(error) {
      console.error("[SW] Erreur enregistrement:", error);
    },
    onOfflineReady() {
      console.log("[SW] Application prête pour le mode hors ligne");
    },
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SYNC_COMPLETE") {
      window.dispatchEvent(new CustomEvent("sw-sync-complete"));
    }
  });
}
