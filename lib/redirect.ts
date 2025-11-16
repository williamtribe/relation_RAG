const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const LOCAL_DEV_FALLBACK = "http://localhost:5173";
const extraRedirects = (process.env.KAKAO_ADDITIONAL_REDIRECTS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([DEFAULT_BASE_URL, LOCAL_DEV_FALLBACK, ...extraRedirects].filter(Boolean))
);

export function resolveRedirectTarget(target: string | null | undefined) {
  if (!target) return null;
  if (target.startsWith("/")) return target;
  try {
    const parsed = new URL(target);
    const isAllowed = allowedOrigins.some((origin) => {
      try {
        return parsed.origin === new URL(origin).origin;
      } catch {
        return false;
      }
    });
    return isAllowed ? target : null;
  } catch {
    return null;
  }
}

export function encodeState(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeState<T = Record<string, unknown>>(state: string | null): T | null {
  if (!state) return null;
  try {
    const json = Buffer.from(state, "base64url").toString("utf-8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
