import type { CSSProperties } from 'react';
import type { Page } from '@sitecore-content-sdk/nextjs';

export type BrandStyleId = 'modern-recipe' | 'good-eating' | 'kitchen-works';

/**
 * Dual-surface brand system (Modern Recipe is the reference):
 * - primary: filled CTA / chrome
 * - fg: headings and body
 * - muted: light brand wash (MR mint) for closing CTA and FAQ chips
 * - accent: second brand wash (MR blush/pink) for the story / case-study band
 */
type BrandTokens = {
  id: BrandStyleId;
  label: string;
  primary: string;
  fg: string;
  muted: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  buttonRadius: string;
  ctaText: string;
  accentFg: string;
};

export const BRAND_STYLE_TOKENS: Record<BrandStyleId, BrandTokens> = {
  'modern-recipe': {
    id: 'modern-recipe',
    label: 'Modern Recipe',
    primary: '#004c4e',
    fg: '#063434',
    muted: '#c6e9e8',
    accent: '#f4d8d3',
    headingFont: '"Sansa Pro", "DM Sans", sans-serif',
    bodyFont: '"Open Sans", sans-serif',
    buttonRadius: '3px 3px 16px',
    ctaText: '#ffffff',
    accentFg: '#063434',
  },
  'good-eating': {
    id: 'good-eating',
    label: 'The Good Eating Company',
    primary: '#cde14c',
    fg: '#293826',
    muted: '#ece7e1',
    accent: '#cde14c',
    headingFont: '"Sansa Pro", "DM Sans", sans-serif',
    bodyFont: '"Open Sans", sans-serif',
    buttonRadius: '3px 3px 16px',
    ctaText: '#293826',
    accentFg: '#293826',
  },
  'kitchen-works': {
    id: 'kitchen-works',
    label: 'Kitchen Works',
    primary: '#0a0efa',
    fg: '#000000',
    muted: '#fed167',
    accent: '#0a0efa',
    headingFont: '"Sansa Pro", "DM Sans", sans-serif',
    bodyFont: '"Open Sans", sans-serif',
    buttonRadius: '3px 3px 16px',
    ctaText: '#ffffff',
    accentFg: '#ffffff',
  },
};

function normalizeStyle(value?: string): BrandStyleId | undefined {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('modern')) return 'modern-recipe';
  if (raw.includes('good eating') || raw.includes('good-eating')) return 'good-eating';
  if (raw.includes('kitchen')) return 'kitchen-works';
  if (raw === 'modern-recipe' || raw === 'good-eating' || raw === 'kitchen-works') return raw;
  return undefined;
}

export function resolveBrandStyle(pageStyle?: string, paramStyle?: string): BrandStyleId {
  return normalizeStyle(paramStyle) || normalizeStyle(pageStyle) || 'modern-recipe';
}

export function getPageBrandStyle(page?: Page): string | undefined {
  const fields = page?.layout?.sitecore?.route?.fields as
    | { brandStyle?: { value?: string } }
    | undefined;
  return fields?.brandStyle?.value;
}

export function brandStyleVars(style: BrandStyleId): CSSProperties {
  const tokens = BRAND_STYLE_TOKENS[style];
  return {
    ['--brand-primary' as string]: tokens.primary,
    ['--brand-fg' as string]: tokens.fg,
    ['--brand-muted' as string]: tokens.muted,
    ['--brand-accent' as string]: tokens.accent,
    ['--brand-heading-font' as string]: tokens.headingFont,
    ['--brand-body-font' as string]: tokens.bodyFont,
    ['--brand-button-radius' as string]: tokens.buttonRadius,
    ['--brand-cta-text' as string]: tokens.ctaText,
    ['--brand-accent-fg' as string]: tokens.accentFg,
  };
}
