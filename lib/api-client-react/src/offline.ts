const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function notifyOfflineMutationQueued(method: string): void {
  if (typeof navigator === "undefined" || navigator.onLine) return;
  if (!MUTATION_METHODS.has(method.toUpperCase())) return;

  navigator.serviceWorker?.controller?.postMessage({ type: "MUTATION_QUEUED" });
}
