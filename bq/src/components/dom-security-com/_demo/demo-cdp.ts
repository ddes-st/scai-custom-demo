/**
 * SitecoreAI / CDP helpers for the DOM Security demo.
 * Calls are fire-and-forget and never throw to the UI.
 *
 * Login IDENTITY uses identifiers.provider = "userId" (matches tenant identity rule
 * Unified-Data-Layer-ID) plus firstName/lastName for an identified contact.
 *
 * Custom event `type` values are UPPERCASE — Edge rejects lowercase types (500).
 * IDENTITY payloads stay slim; phone/address fields were causing Edge 400s.
 */

import { getClientId } from '@sitecore-content-sdk/analytics-core';
import { event, identity } from '@sitecore-content-sdk/events';
import { DEMO_PROFILE, type DemoAudience, type DemoProfile } from './demo-account';

const CHANNEL = 'WEB';
const CURRENCY = 'EUR';
/**
 * Must match SitecoreAI Identity rules → Identifier provider exactly.
 * This tenant uses rule "Unified-Data-Layer-ID" with provider `userId`.
 */
const IDENTITY_PROVIDER = 'userId';
/** Demo-only provider for anonymous traits (no identity-rule match expected). */
const DEMO_PROVIDER = 'DOM_DEMO';

/** Edge custom event types must be uppercase (see CDP Stream API docs). */
const EVENT_AUDIENCE_SWITCH = 'DOMSECURITY:AUDIENCE_SWITCH';
const EVENT_LOGIN = 'DOMSECURITY:LOGIN';
const EVENT_LOGOUT = 'DOMSECURITY:LOGOUT';
const EVENT_DEALER_POSTAL = 'DOMSECURITY:DEALER_POSTAL_SEARCH';
const EVENT_DEALER_CALLBACK = 'DOMSECURITY:DEALER_CALLBACK_REQUEST';
const EVENT_SERVICE_REQUEST = 'DOMSECURITY:SERVICE_REQUEST';

const CLIENT_ID_WAIT_MS = 8000;
const CLIENT_ID_POLL_MS = 150;
const ANON_GUEST_KEY = 'dom-security-demo-anon-guest-id';

type ExtValue = string | number | boolean;
type ExtensionData = Record<string, ExtValue>;

function cleanExt(data?: Record<string, ExtValue | null | undefined>): ExtensionData {
  const out: ExtensionData = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Stable per-browser id so anonymous IDENTITY does not merge unrelated guests. */
function getAnonymousGuestId(): string {
  if (typeof window === 'undefined') return 'anon-ssr';
  try {
    const existing = window.localStorage.getItem(ANON_GUEST_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(ANON_GUEST_KEY, next);
    return next;
  } catch {
    return `anon-${Date.now()}`;
  }
}

/**
 * Wait until Bootstrap has created the browser ID cookie (sc_cid).
 */
async function waitForClientId(): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < CLIENT_ID_WAIT_MS) {
    try {
      const id = getClientId();
      if (id) return id;
    } catch {
      // SDK not initialized yet — keep polling.
    }
    await sleep(CLIENT_ID_POLL_MS);
  }
  throw new Error(
    'Sitecore browser ID cookie (sc_cid) was not set. Check Events SDK init and that cookies are allowed.',
  );
}

async function safeIdentity(
  data: Parameters<typeof identity>[0],
): Promise<boolean> {
  try {
    await waitForClientId();
    const result = await identity(data);
    if (result == null) {
      console.warn('[DOM demo CDP] identity returned null (Edge 4xx/5xx — check Network tab body)');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[DOM demo CDP] identity failed', error);
    return false;
  }
}

async function safeEvent(
  type: string,
  extensionData?: Record<string, ExtValue | null | undefined>,
): Promise<boolean> {
  try {
    await waitForClientId();
    const result = await event({
      type,
      channel: CHANNEL,
      currency: CURRENCY,
      language: 'EN',
      page: typeof window !== 'undefined' ? window.location.pathname || 'home' : 'home',
      extensionData: cleanExt(extensionData),
    });
    if (result == null) {
      console.warn(
        `[DOM demo CDP] event "${type}" returned null (Edge 4xx/5xx — check Network tab body)`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[DOM demo CDP] event "${type}" failed`, error);
    return false;
  }
}

/**
 * Slim IDENTITY for an identified contact.
 * Provider must be `userId` (tenant identity rule). Id is the demo email.
 * Avoid phone/address — those were returning Edge 400 against this tenant.
 */
function loginIdentityPayload(
  profile: DemoProfile,
  extensionData: Record<string, ExtValue | null | undefined>,
): Parameters<typeof identity>[0] {
  const email = profile.email.trim().toLowerCase();
  return {
    channel: CHANNEL,
    currency: CURRENCY,
    language: 'EN',
    page: typeof window !== 'undefined' ? window.location.pathname || 'home' : 'home',
    email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    identifiers: [{ id: email, provider: IDENTITY_PROVIDER }],
    extensionData: cleanExt(extensionData),
  };
}

/**
 * Minimal IDENTITY used for audience switch (this shape previously registered successfully).
 */
function audienceIdentityPayload(
  audience: DemoAudience,
  isLoggedIn: boolean,
): Parameters<typeof identity>[0] {
  if (isLoggedIn) {
    return loginIdentityPayload(DEMO_PROFILE, {
      accountStatus: 'logged_in',
      audienceType: audience,
    });
  }
  return {
    channel: CHANNEL,
    currency: CURRENCY,
    language: 'EN',
    page: typeof window !== 'undefined' ? window.location.pathname || 'home' : 'home',
    identifiers: [{ id: getAnonymousGuestId(), provider: DEMO_PROVIDER }],
    extensionData: cleanExt({
      accountStatus: 'anonymous',
      audienceType: audience,
    }),
  };
}

/** Dedupes successful IDENTITY across multiple DemoAccountChrome mounts. */
let loginIdentitySentThisLoad = false;
let loginIdentityInFlight: Promise<boolean> | null = null;

/**
 * Send IDENTITY + login custom event so SitecoreAI resolves an identified contact.
 * Event is fired even if IDENTITY fails (so login still shows on the timeline).
 */
export function pushLoginToProfile(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  void safeEvent(EVENT_LOGIN, {
    accountStatus: 'logged_in',
    audienceType: audience,
    email: profile.email.trim().toLowerCase(),
    customerNumber: profile.customerNumber,
  });

  if (loginIdentitySentThisLoad || loginIdentityInFlight) return;

  loginIdentityInFlight = (async () => {
    const ok = await safeIdentity(
      loginIdentityPayload(profile, {
        accountStatus: 'logged_in',
        audienceType: audience,
      }),
    );
    if (ok) loginIdentitySentThisLoad = true;
    return ok;
  })().finally(() => {
    loginIdentityInFlight = null;
  });
}

/**
 * Re-identify after session restore. No-op if login IDENTITY already succeeded this page load.
 */
export function ensureLoginIdentityFromSession(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  if (loginIdentitySentThisLoad || loginIdentityInFlight) return;

  loginIdentityInFlight = (async () => {
    const ok = await safeIdentity(
      loginIdentityPayload(profile, {
        accountStatus: 'logged_in',
        audienceType: audience,
      }),
    );
    if (ok) loginIdentitySentThisLoad = true;
    return ok;
  })().finally(() => {
    loginIdentityInFlight = null;
  });
}

export function clearLoginIdentityGuard(): void {
  loginIdentitySentThisLoad = false;
  loginIdentityInFlight = null;
}

export function pushLogoutToProfile(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  void safeIdentity(
    loginIdentityPayload(profile, {
      accountStatus: 'logged_out',
      audienceType: audience,
    }),
  );
  void safeEvent(EVENT_LOGOUT, {
    accountStatus: 'logged_out',
    audienceType: audience,
  });
}

/**
 * Customer ↔ Professional toggle.
 * - Custom event (uppercase type) for the event timeline
 * - IDENTITY (slim) so audienceType lands — this is what previously registered
 *
 * SitecoreAI: Profile schema extension `audienceType` (string), then Publish Schema.
 * Keep identity rule on provider `userId` only (not DOM_DEMO).
 */
export function pushAudienceToProfile(
  audience: DemoAudience,
  options?: { isLoggedIn?: boolean },
): void {
  const isLoggedIn = Boolean(options?.isLoggedIn);
  void safeEvent(EVENT_AUDIENCE_SWITCH, {
    audienceType: audience,
    accountStatus: isLoggedIn ? 'logged_in' : 'anonymous',
  });
  void safeIdentity(audienceIdentityPayload(audience, isLoggedIn));
}

export function pushDealerPostalToProfile(postalCode: string): void {
  const trimmed = postalCode.trim();
  if (!trimmed) return;
  void safeIdentity({
    channel: CHANNEL,
    currency: CURRENCY,
    postalCode: trimmed,
    country: 'BE',
    identifiers: [{ id: `postal:${trimmed}`, provider: DEMO_PROVIDER }],
    extensionData: cleanExt({
      dealerPostalCode: trimmed,
    }),
  });
  void safeEvent(EVENT_DEALER_POSTAL, {
    dealerPostalCode: trimmed,
  });
}

export function pushDealerCallbackRequest(args: {
  dealerId: string;
  dealerName: string;
  postalCode?: string;
  phone?: string;
}): void {
  void safeEvent(EVENT_DEALER_CALLBACK, {
    dealerId: args.dealerId,
    dealerName: args.dealerName,
    dealerPostalCode: args.postalCode || '',
    phone: args.phone || '',
  });
}

export function pushServiceRequest(args: {
  productId: string;
  productName: string;
  requestType: string;
  email: string;
  preferredTime?: string;
  newsletter?: boolean;
}): void {
  void safeEvent(EVENT_SERVICE_REQUEST, {
    productId: args.productId,
    productName: args.productName,
    requestType: args.requestType,
    email: args.email,
    preferredTime: args.preferredTime || '',
    newsletter: Boolean(args.newsletter),
  });
}
