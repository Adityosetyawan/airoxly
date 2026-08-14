/**
 * Online / offline detector.
 *
 * Web: listens to `window.online` / `window.offline` events (already correct
 * inside a PWA / mobile browser). Native (Expo Go / dev build): falls back to
 * `AppState` foreground refreshes + a lightweight fetch probe.
 *
 * We intentionally avoid `@react-native-community/netinfo` to keep the bundle
 * lean — the fetch probe is Good Enough for our field-sales use case (the
 * transaction submit itself is the ultimate source of truth anyway).
 */
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { API_BASE } from "@/src/api";

async function probe(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store" as RequestCache,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function initialOnline(): boolean {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    return navigator.onLine !== false;
  }
  return true; // native: assume online, will be validated via probe
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(initialOnline());

  useEffect(() => {
    let cancelled = false;

    // Web: fast reactive listeners.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      // Also probe once so we correct false positives (connected LAN, no WAN).
      probe().then((ok) => !cancelled && setOnline(ok || navigator.onLine));
      return () => {
        cancelled = true;
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }

    // Native: probe on mount + on foreground.
    const runProbe = async () => {
      const ok = await probe();
      if (!cancelled) setOnline(ok);
    };
    runProbe();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") runProbe();
    });
    // Periodic re-check every 30s while mounted.
    const iv = setInterval(runProbe, 30000);
    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(iv);
    };
  }, []);

  return online;
}
