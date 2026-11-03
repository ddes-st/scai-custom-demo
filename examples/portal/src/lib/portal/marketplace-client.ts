"use client";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { startSitecoreAuth } from "./sitecore-auth";
import { MARKETPLACE_REQUEST_TIMEOUT } from "./marketplace-timeout";

/**
 * One Marketplace SDK connection per frame (client + XMC module), shared by the apps a single
 * extension point hosts — the Page context panel shows the Portal theme and the Content Hub info
 * apps as tabs, and a second handshake with the host from the same frame isn't something the
 * SDK promises to handle. Resolves to null outside an iframe; rejects when no host answers.
 */
let pending: Promise<ClientSDK | null> | null = null;

export function marketplaceClient(): Promise<ClientSDK | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.parent === window) return Promise.resolve(null);
  if (!pending) {
    pending = (async () => {
      const [{ ClientSDK }, { XMC }] = await Promise.all([import("@sitecore-marketplace-sdk/client"), import("@sitecore-marketplace-sdk/xmc")]);
      const c = await ClientSDK.init({ target: window.parent, modules: [XMC], timeout: MARKETPLACE_REQUEST_TIMEOUT });
      // Phase B: the hub's Sitecore sign-in starts with the panel's host connection
      void startSitecoreAuth(c);
      return c;
    })();
    pending.catch(() => { pending = null; });
  }
  return pending;
}
