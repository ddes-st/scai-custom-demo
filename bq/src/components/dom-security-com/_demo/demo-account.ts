/**
 * Hardcoded demo account for the DOM Security SitecoreAI showcase.
 * Not real authentication — credentials are intentional demo fixtures.
 */

export type DemoAudience = 'customer' | 'professional';

export type DemoProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  company: string;
  customerNumber: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  preferredLanguage: string;
};

/** Accepted login emails (same mimicked account). */
export const DEMO_LOGIN_EMAILS = [
  'damien.despas@sitecore.com',
  'ddes@sitecore.net',
] as const;

export const DEMO_PASSWORD = 'S!t3c0r3';

export const DEMO_PROFILE: DemoProfile = {
  firstName: 'Damien',
  lastName: 'Despas',
  email: 'damien.despas@sitecore.com',
  phone: '+32 2 555 01 23',
  mobile: '+32 475 12 34 56',
  company: 'Sitecore Belgium',
  customerNumber: 'DOM-BE-10482',
  street: 'Avenue Louise 235',
  postalCode: '1050',
  city: 'Brussels',
  country: 'BE',
  preferredLanguage: 'en',
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidDemoLogin(email: string, password: string): boolean {
  const normalized = normalizeEmail(email);
  const allowed = DEMO_LOGIN_EMAILS.map((e) => e.toLowerCase());
  return allowed.includes(normalized) && password === DEMO_PASSWORD;
}

export function displayName(profile: DemoProfile = DEMO_PROFILE): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}
