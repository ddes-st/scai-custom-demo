/**
 * Unified data layer for SitecoreAI customer profiles.
 * Custom events land on the browser timeline. IDENTITY writes the external
 * attributes in profile-schema.ts onto the same guest (logged-in userId, or
 * the stable anonymous id). Postal code is a profile field, not a new identifier.
 */

import { getClientId } from '@sitecore-content-sdk/analytics-core';
import { event, identity } from '@sitecore-content-sdk/events';
import { DEMO_PROFILE, type DemoAudience, type DemoProfile } from 'components/dom-security-com/_demo/demo-account';
import { getDemoSession } from 'components/dom-security-com/_demo/demo-session';
import {
  AFFINITY_CLICK_WEIGHT,
  AFFINITY_DETAIL_WEIGHT,
  type AffinityMap,
  bumpAffinity,
  topAffinity,
} from './affinity';
import {
  DEFAULT_PRIMARY_AUDIENCE,
  PROFILE_ATTRIBUTES,
  UDL_EVENTS,
  type PrimaryAudience,
} from './profile-schema';

const CHANNEL = 'WEB';
const CURRENCY = 'EUR';
const IDENTITY_PROVIDER = 'userId';
const DEMO_PROVIDER = 'DOM_DEMO';
const CLIENT_ID_WAIT_MS = 8000;
const CLIENT_ID_POLL_MS = 150;
const ANON_GUEST_KEY = 'dom-security-demo-anon-guest-id';
const AFFINITY_KEY = 'dom-security-affinity-v1';
const POSTAL_KEY = 'dom-security-primary-postal';
const SEEDED_KEY = 'dom-security-profile-seeded';

type ExtValue = string | number | boolean;
type ExtensionData = Record<string, ExtValue>;

type StoredAffinities = {
  product: AffinityMap;
  dealer: AffinityMap;
};

function cleanExt(data?: Record<string, ExtValue | null | undefined>): ExtensionData {
  const out: ExtensionData = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

function getAnonymousGuestId(): string {
  if (typeof window === 'undefined') return 'anon-ssr';
  const existing = storageGet(ANON_GUEST_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storageSet(ANON_GUEST_KEY, next);
  return next;
}

function readAffinities(): StoredAffinities {
  const raw = storageGet(AFFINITY_KEY);
  if (!raw) return { product: {}, dealer: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAffinities>;
    return {
      product: parsed.product && typeof parsed.product === 'object' ? parsed.product : {},
      dealer: parsed.dealer && typeof parsed.dealer === 'object' ? parsed.dealer : {},
    };
  } catch {
    return { product: {}, dealer: {} };
  }
}

function writeAffinities(next: StoredAffinities): void {
  storageSet(AFFINITY_KEY, JSON.stringify(next));
}

function readPostal(): string {
  return storageGet(POSTAL_KEY)?.trim() || '';
}

function writePostal(postalCode: string): void {
  storageSet(POSTAL_KEY, postalCode);
}

function currentAudience(): PrimaryAudience {
  const audience = getDemoSession().audience;
  return audience === 'professional' ? 'professional' : DEFAULT_PRIMARY_AUDIENCE;
}

/** Snapshot of the external attributes, including stored affinities and location. */
export function buildProfileExtension(
  overrides?: Record<string, ExtValue | null | undefined>,
): ExtensionData {
  const affinities = readAffinities();
  const productTop = topAffinity(affinities.product);
  const dealerTop = topAffinity(affinities.dealer);
  const postal = readPostal();
  return cleanExt({
    [PROFILE_ATTRIBUTES.primaryAudience]: currentAudience(),
    [PROFILE_ATTRIBUTES.primaryPostalCode]: postal,
    [PROFILE_ATTRIBUTES.productAffinityScores]: JSON.stringify(affinities.product),
    [PROFILE_ATTRIBUTES.dealerAffinityScores]: JSON.stringify(affinities.dealer),
    [PROFILE_ATTRIBUTES.topProductId]: productTop?.id,
    [PROFILE_ATTRIBUTES.topProductScore]: productTop?.score,
    [PROFILE_ATTRIBUTES.topDealerId]: dealerTop?.id,
    [PROFILE_ATTRIBUTES.topDealerScore]: dealerTop?.score,
    ...overrides,
  });
}

async function waitForClientId(): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < CLIENT_ID_WAIT_MS) {
    try {
      const id = getClientId();
      if (id) return id;
    } catch {
      /* SDK not initialized yet */
    }
    await sleep(CLIENT_ID_POLL_MS);
  }
  throw new Error(
    'Sitecore browser ID cookie (sc_cid) was not set. Check Events SDK init and that cookies are allowed.',
  );
}

async function safeIdentity(data: Parameters<typeof identity>[0]): Promise<boolean> {
  try {
    await waitForClientId();
    const result = await identity(data);
    if (result == null) {
      console.warn('[udl] identity returned null (Edge 4xx/5xx)');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[udl] identity failed', error);
    return false;
  }
}

/**
 * Identity calls share one queue. The page-load seed must not be built early
 * and land after a later audience switch, or CDP keeps primaryAudience=customer.
 */
let identityQueue: Promise<void> = Promise.resolve();

function enqueueIdentity(build: () => Parameters<typeof identity>[0]): Promise<boolean> {
  const run = identityQueue.then(() => safeIdentity(build()));
  identityQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
      console.warn(`[udl] event "${type}" returned null (Edge 4xx/5xx)`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[udl] event "${type}" failed`, error);
    return false;
  }
}

function pagePath(): string {
  return typeof window !== 'undefined' ? window.location.pathname || 'home' : 'home';
}

function loginIdentityPayload(
  profile: DemoProfile,
  extensionData: ExtensionData,
): Parameters<typeof identity>[0] {
  const email = profile.email.trim().toLowerCase();
  const postal = readPostal();
  return {
    channel: CHANNEL,
    currency: CURRENCY,
    language: 'EN',
    page: pagePath(),
    email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    ...(postal ? { postalCode: postal, country: 'BE' } : {}),
    identifiers: [{ id: email, provider: IDENTITY_PROVIDER }],
    extensionData,
  };
}

function anonymousIdentityPayload(extensionData: ExtensionData): Parameters<typeof identity>[0] {
  const postal = readPostal();
  return {
    channel: CHANNEL,
    currency: CURRENCY,
    language: 'EN',
    page: pagePath(),
    ...(postal ? { postalCode: postal, country: 'BE' } : {}),
    identifiers: [{ id: getAnonymousGuestId(), provider: DEMO_PROVIDER }],
    extensionData,
  };
}

function identityForSession(
  extensionData: ExtensionData,
  profile: DemoProfile = DEMO_PROFILE,
): Parameters<typeof identity>[0] {
  if (getDemoSession().isLoggedIn) return loginIdentityPayload(profile, extensionData);
  return anonymousIdentityPayload(extensionData);
}

/** Write the current external-attribute snapshot onto the active guest. */
export function pushProfileSnapshot(profile: DemoProfile = DEMO_PROFILE): void {
  void enqueueIdentity(() => identityForSession(buildProfileExtension(), profile));
}

/**
 * Once per browser session, publish the audience already stored for this
 * browser. The payload is built when the queued call runs, so a Professional
 * switch made before the seed is sent is not overwritten with customer.
 */
export function seedCustomerProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(SEEDED_KEY)) return;
    window.sessionStorage.setItem(SEEDED_KEY, '1');
  } catch {
    return;
  }
  pushProfileSnapshot();
}

let loginIdentitySentThisLoad = false;
let loginIdentityInFlight: Promise<boolean> | null = null;

function sendLoginIdentity(audience: DemoAudience, profile: DemoProfile): void {
  if (loginIdentitySentThisLoad || loginIdentityInFlight) return;
  loginIdentityInFlight = enqueueIdentity(() =>
    loginIdentityPayload(
      profile,
      buildProfileExtension({
        [PROFILE_ATTRIBUTES.primaryAudience]: audience,
        accountStatus: 'logged_in',
      }),
    ),
  )
    .then((ok) => {
      if (ok) loginIdentitySentThisLoad = true;
      return ok;
    })
    .finally(() => {
      loginIdentityInFlight = null;
    });
}

/** Header Log in button. The form submit sends DOMSECURITY:LOGIN separately. */
export function pushLoginOpen(): void {
  void safeEvent(UDL_EVENTS.loginOpen, {
    [PROFILE_ATTRIBUTES.primaryAudience]: currentAudience(),
  });
}

export function pushLoginToProfile(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  void safeEvent(UDL_EVENTS.login, {
    accountStatus: 'logged_in',
    [PROFILE_ATTRIBUTES.primaryAudience]: audience,
    email: profile.email.trim().toLowerCase(),
    customerNumber: profile.customerNumber,
  });
  sendLoginIdentity(audience, profile);
}

export function ensureLoginIdentityFromSession(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  sendLoginIdentity(audience, profile);
}

export function clearLoginIdentityGuard(): void {
  loginIdentitySentThisLoad = false;
  loginIdentityInFlight = null;
}

export function pushLogoutToProfile(
  audience: DemoAudience,
  profile: DemoProfile = DEMO_PROFILE,
): void {
  void enqueueIdentity(() =>
    loginIdentityPayload(
      profile,
      buildProfileExtension({
        [PROFILE_ATTRIBUTES.primaryAudience]: audience,
        accountStatus: 'logged_out',
      }),
    ),
  );
  void safeEvent(UDL_EVENTS.logout, {
    accountStatus: 'logged_out',
    [PROFILE_ATTRIBUTES.primaryAudience]: audience,
  });
}

export function pushAudienceToProfile(
  audience: DemoAudience,
  options?: { isLoggedIn?: boolean },
): Promise<boolean> {
  const isLoggedIn = options?.isLoggedIn ?? getDemoSession().isLoggedIn;
  void safeEvent(UDL_EVENTS.audience, {
    [PROFILE_ATTRIBUTES.primaryAudience]: audience,
    audienceType: audience,
    accountStatus: isLoggedIn ? 'logged_in' : 'anonymous',
  });
  return enqueueIdentity(() => {
    const extension = buildProfileExtension({
      [PROFILE_ATTRIBUTES.primaryAudience]: audience,
      accountStatus: isLoggedIn ? 'logged_in' : 'anonymous',
    });
    return isLoggedIn
      ? loginIdentityPayload(DEMO_PROFILE, extension)
      : anonymousIdentityPayload(extension);
  });
}

/** Primary location. Stays on the current guest; does not mint a postal identifier. */
export function pushPrimaryLocation(postalCode: string): void {
  const trimmed = postalCode.trim();
  if (!trimmed) return;
  writePostal(trimmed);
  void safeEvent(UDL_EVENTS.primaryLocation, {
    [PROFILE_ATTRIBUTES.primaryPostalCode]: trimmed,
    dealerPostalCode: trimmed,
  });
  void enqueueIdentity(() => {
    const nextExtension = buildProfileExtension({
      [PROFILE_ATTRIBUTES.primaryPostalCode]: trimmed,
    });
    return {
      ...identityForSession(nextExtension),
      postalCode: trimmed,
      country: 'BE',
      extensionData: nextExtension,
    };
  });
}

/** @deprecated Use pushPrimaryLocation. Kept so existing dealer search imports keep working. */
export function pushDealerPostalToProfile(postalCode: string): void {
  pushPrimaryLocation(postalCode);
}

export function pushProductSearch(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  void safeEvent(UDL_EVENTS.productSearch, {
    query: trimmed,
    [PROFILE_ATTRIBUTES.primaryAudience]: currentAudience(),
  });
}

function recordAffinity(
  kind: 'product' | 'dealer',
  id: string,
  name: string,
  weight: number,
  eventType: string,
): void {
  const key = id.trim();
  if (!key) return;
  const current = readAffinities();
  const map = kind === 'product' ? current.product : current.dealer;
  const nextMap = bumpAffinity(map, key, name, weight);
  if (nextMap === map) return;
  const next: StoredAffinities =
    kind === 'product' ? { ...current, product: nextMap } : { ...current, dealer: nextMap };
  writeAffinities(next);
  const entry = nextMap[key];
  void safeEvent(eventType, {
    itemId: key,
    itemName: entry?.name || name,
    affinityKind: kind,
    affinityScore: entry?.score ?? weight,
    [PROFILE_ATTRIBUTES.primaryAudience]: currentAudience(),
  });
  pushProfileSnapshot();
}

export function trackProductClick(id: string, name: string): void {
  recordAffinity('product', id, name, AFFINITY_CLICK_WEIGHT, UDL_EVENTS.productClick);
}

export function trackProductDetailView(id: string, name: string): void {
  recordAffinity('product', id, name, AFFINITY_DETAIL_WEIGHT, UDL_EVENTS.productDetail);
}

export function trackDealerClick(id: string, name: string): void {
  recordAffinity('dealer', id, name, AFFINITY_CLICK_WEIGHT, UDL_EVENTS.dealerClick);
}

export function trackDealerDetailView(id: string, name: string): void {
  recordAffinity('dealer', id, name, AFFINITY_DETAIL_WEIGHT, UDL_EVENTS.dealerDetail);
}

export function pushDealerCallbackRequest(args: {
  dealerId: string;
  dealerName: string;
  postalCode?: string;
  phone?: string;
}): void {
  void safeEvent(UDL_EVENTS.dealerCallback, {
    dealerId: args.dealerId,
    dealerName: args.dealerName,
    [PROFILE_ATTRIBUTES.primaryPostalCode]: args.postalCode || readPostal(),
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
  void safeEvent(UDL_EVENTS.serviceRequest, {
    productId: args.productId,
    productName: args.productName,
    requestType: args.requestType,
    email: args.email,
    preferredTime: args.preferredTime || '',
    newsletter: Boolean(args.newsletter),
  });
}
