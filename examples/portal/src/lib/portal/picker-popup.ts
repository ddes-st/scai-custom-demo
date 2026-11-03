/**
 * "Open larger" for the Content Hub picker: the Page builder sizes the custom-field modal and the
 * SDK has no option for it, so the modal opens the same picker in a window of ~90% of the screen
 * (/ch-picker?popup=1, the hub's origin) and stays the one that writes the field (SDK setValue).
 *
 * The window's storage is not the modal's (the modal's is partitioned under the Page builder), so
 * nothing goes through storage: the window asks its opener for the field's current draft, the
 * site's portal, the access key and the Sitecore token by postMessage, asks again for a fresh
 * token when it needs one, and sends the picks back on save. Messages are accepted only from the
 * same origin and only from the other window of the pair.
 */
const CHANNEL = "portal-picker-popup";
export interface PopupInit { value: string; head: string; key: string; token: string }
type Msg =
  | { channel: typeof CHANNEL; type: "ready" | "token?" }
  | { channel: typeof CHANNEL; type: "init"; init: PopupInit }
  | { channel: typeof CHANNEL; type: "token"; token: string }
  | { channel: typeof CHANNEL; type: "save"; json: string }
  | { channel: typeof CHANNEL; type: "saved"; ok: boolean; error?: string };

const isMsg = (d: unknown): d is Msg => !!d && typeof d === "object" && (d as { channel?: unknown }).channel === CHANNEL;

/** True in the larger window (opened by the modal). */
export const isPickerPopup = () => typeof window !== "undefined" && !!window.opener && new URLSearchParams(window.location.search).get("popup") === "1";

// ---------- the modal (opener) ----------

export interface PopupHandlers {
  init: () => Promise<PopupInit>;
  token: () => Promise<string>;
  /** Writes the picks to the field; throws when it can't. */
  save: (json: string) => Promise<void>;
  /** After the window has the confirmation (e.g. close the modal). */
  afterSave: () => void;
  closed: () => void;
}

/** Opens the larger window; null when the browser blocked it. Returns a handle to focus or close it. */
export function openPickerPopup(h: PopupHandlers): { focus: () => void; close: () => void } | null {
  const w = Math.round(window.screen.availWidth * 0.9), hgt = Math.round(window.screen.availHeight * 0.9);
  const left = Math.round((window.screen.availWidth - w) / 2), top = Math.round((window.screen.availHeight - hgt) / 2);
  const win = window.open(`/ch-picker?popup=1`, "portal-ch-picker-large", `popup=yes,width=${w},height=${hgt},left=${left},top=${top}`);
  if (!win) return null;
  const post = (m: Msg) => win.postMessage(m, window.location.origin);
  const onMessage = async (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== win || !isMsg(e.data)) return;
    const m = e.data;
    if (m.type === "ready") post({ channel: CHANNEL, type: "init", init: await h.init() });
    else if (m.type === "token?") post({ channel: CHANNEL, type: "token", token: await h.token().catch(() => "") });
    else if (m.type === "save") {
      try { await h.save(m.json); post({ channel: CHANNEL, type: "saved", ok: true }); stop(); h.afterSave(); }
      catch (err: any) { post({ channel: CHANNEL, type: "saved", ok: false, error: String(err?.message ?? err) }); }
    }
  };
  const timer = window.setInterval(() => { if (win.closed) { stop(); h.closed(); } }, 500);
  const stop = () => { window.removeEventListener("message", onMessage); window.clearInterval(timer); };
  window.addEventListener("message", onMessage);
  return { focus: () => win.focus(), close: () => { stop(); win.close(); } };
}

// ---------- the larger window ----------

function ask<T>(send: Msg, want: Msg["type"], ms: number): Promise<T | null> {
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (v: T | null) => { window.removeEventListener("message", on); window.clearTimeout(t); resolve(v); };
    const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.source === opener && isMsg(e.data) && e.data.type === want) done(e.data as T); };
    const t = window.setTimeout(() => done(null), ms);
    window.addEventListener("message", on);
    opener.postMessage(send, window.location.origin);
  });
}

/** The field's draft, portal, key and token from the modal; null when the modal is gone. */
export const initFromOpener = () => ask<{ init: PopupInit }>({ channel: CHANNEL, type: "ready" }, "init", 8000).then((m) => m?.init ?? null);
/** A current Sitecore token from the modal ("" without one). */
export const tokenFromOpener = () => ask<{ token: string }>({ channel: CHANNEL, type: "token?" }, "token", 15000).then((m) => m?.token ?? "");
/** Hands the picks to the modal, which writes the field; false with the reason when it couldn't. */
export async function saveToOpener(json: string): Promise<{ ok: boolean; error?: string }> {
  const m = await ask<{ ok: boolean; error?: string }>({ channel: CHANNEL, type: "save", json }, "saved", 20000);
  return m ?? { ok: false, error: "The field's dialog in the Page builder is closed — open the field again and pick there." };
}
/** True while the modal that opened this window is still there. */
export const openerAlive = () => !!window.opener && !(window.opener as Window).closed;
