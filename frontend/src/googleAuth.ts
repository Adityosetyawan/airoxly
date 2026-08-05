import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { api } from "./api";
import type { User } from "./api";

// Ensure any leftover auth session is completed (safe no-op on web)
WebBrowser.maybeCompleteAuthSession();

const EMERGENT_AUTH_URL = "https://auth.emergentagent.com/";

/**
 * Extract `session_id` from a raw URL string. Emergent returns it in the URL
 * hash fragment (`myapp://#session_id=…`) or occasionally as a query param.
 * Never use `Linking.parse().queryParams` — that helper cannot see the hash
 * fragment and would silently return undefined.
 */
export function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Guard against processing the same `session_id` twice (a hot deep link and
 * `openAuthSessionAsync` result can both surface the same value; a re-mount
 * on web can too).
 */
const usedSessionIds = new Set<string>();

/**
 * Start the Google Sign-in flow.
 *
 * Web: navigates directly to the Emergent auth URL. When the user returns,
 * the AuthContext bootstrap picks up `session_id` from `window.location`.
 *
 * Native: uses `WebBrowser.openAuthSessionAsync` (ASWebAuthenticationSession
 * on iOS, Chrome Custom Tabs on Android). Reads the callback URL from three
 * co-equal sources — `result.url`, the pre-registered Linking listener, and
 * `Linking.getInitialURL()` — and picks the first that yields a `session_id`.
 */
export async function startGoogleSignIn(): Promise<{ user: User } | null> {
  if (Platform.OS === "web") {
    const redirect = typeof window !== "undefined" ? window.location.origin + "/" : "/";
    const url = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirect)}`;
    if (typeof window !== "undefined") window.location.href = url;
    // Navigation kicks in; the promise will not resolve here.
    return null;
  }

  const redirect = Linking.createURL("");
  const authUrl = `${EMERGENT_AUTH_URL}?redirect=${encodeURIComponent(redirect)}`;

  // Register listener BEFORE opening the session — Android often relaunches
  // the app fresh and delivers the URL via the listener, not via result.url.
  let listenerUrl: string | null = null;
  const sub = Linking.addEventListener("url", (ev) => {
    if (ev?.url) listenerUrl = ev.url;
  });

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);

    // Try three sources in order: direct result.url → listener capture →
    // Linking.getInitialURL (covers app-was-killed case).
    let raw: string | null = null;
    if (result.type === "success" && (result as any).url) {
      raw = (result as any).url as string;
    }
    if (!raw && listenerUrl) raw = listenerUrl;
    if (!raw) {
      try {
        raw = await Linking.getInitialURL();
      } catch {
        raw = null;
      }
    }

    const sid = extractSessionId(raw);
    if (!sid) {
      // Not necessarily an error — user may have truly cancelled. Return null
      // so the caller can decide.
      return null;
    }
    if (usedSessionIds.has(sid)) return null;
    usedSessionIds.add(sid);

    const exchanged = await api.googleSession(sid);
    return { user: exchanged.user };
  } finally {
    try { sub?.remove?.(); } catch {}
  }
}

/**
 * Consume any `session_id` sitting in `window.location` (web only) — called
 * on app bootstrap. Cleans the URL only after a successful exchange.
 * Returns the authenticated user, or null when no session_id / on failure.
 */
export async function consumeWebSessionIdIfAny(): Promise<{ user: User } | null> {
  if (Platform.OS !== "web") return null;
  if (typeof window === "undefined") return null;
  const raw = window.location.href;
  const sid = extractSessionId(raw);
  if (!sid) return null;
  if (usedSessionIds.has(sid)) return null;
  usedSessionIds.add(sid);
  try {
    const exchanged = await api.googleSession(sid);
    // Clean the URL — remove only the session_id fragment/param while
    // preserving anything else.
    try {
      const u = new URL(window.location.href);
      u.hash = u.hash.replace(/[#&]?session_id=[^&]*/g, "").replace(/^#$/, "");
      u.searchParams.delete("session_id");
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {}
    return { user: exchanged.user };
  } catch (e) {
    // Failure: cleanup URL and let AuthContext show login state.
    try {
      const u = new URL(window.location.href);
      u.hash = u.hash.replace(/[#&]?session_id=[^&]*/g, "").replace(/^#$/, "");
      u.searchParams.delete("session_id");
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {}
    throw e;
  }
}
