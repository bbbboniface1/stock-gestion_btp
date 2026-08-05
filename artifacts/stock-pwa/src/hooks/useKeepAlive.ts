import { useEffect } from "react";
import { appPath } from "@/lib/paths";

// Ping the API every 14 minutes to prevent Render free-tier from sleeping.
// Render spins down after 15 minutes of inactivity; this keeps the instance warm
// as long as at least one authenticated user has the app open.
const PING_INTERVAL_MS = 14 * 60 * 1000;

export function useKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(appPath("/api/healthz"), { method: "GET" }).catch(() => {
        // Silent failure — this is best-effort, not critical
      });
    };

    ping(); // Immediate ping on mount (also wakes the instance if it was sleeping)
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
