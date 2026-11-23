type SameSite = "Lax" | "Strict" | "None";

export type SetCookieOptions = {
  maxAge?: number;
  path?: string;
  sameSite?: SameSite;
  secure?: boolean;
};

/** Read a cookie value by name; returns null if absent or during SSR. */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escapeRegExp(name)}=([^;]*)`),
  );
  if (!match) return null;
  return decodeURIComponent(match[1] ?? "");
}

/** Write a cookie. No-op during SSR. */
export function setCookie(
  name: string,
  value: string,
  opts: SetCookieOptions = {},
): void {
  if (typeof document === "undefined") return;
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (opts.path !== undefined) cookie += `; path=${opts.path}`;
  if (opts.maxAge !== undefined) cookie += `; max-age=${opts.maxAge}`;
  if (opts.sameSite !== undefined) {
    cookie += `; samesite=${opts.sameSite.toLowerCase()}`;
  }
  if (opts.secure) cookie += "; secure";
  // biome-ignore lint/suspicious/noDocumentCookie: centralized synchronous cookie access — CookieStore is async and unavailable in SSR/jsdom; this is the one sanctioned document.cookie site
  document.cookie = cookie;
}

/** Expire a cookie (max-age=0). No-op during SSR. */
export function deleteCookie(name: string, opts: { path?: string } = {}): void {
  setCookie(name, "", { maxAge: 0, path: opts.path });
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
