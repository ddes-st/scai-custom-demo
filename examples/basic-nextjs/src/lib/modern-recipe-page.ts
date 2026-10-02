import type { Page } from '@sitecore-content-sdk/nextjs';

type SitecoreLayout = {
  context?: { site?: { name?: string } };
};

export function isModernRecipeSite(page?: Page): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sitecore = (page as any)?.layout?.sitecore as SitecoreLayout | undefined;
  return String(sitecore?.context?.site?.name || '').toLowerCase() === 'modern-recipe';
}

export const MR = {
  ink: '#123c38',
  deep: '#0e4b45',
  mint: '#e8f3ee',
  blush: '#f7e7e3',
  paper: '#ffffff',
  muted: '#4d6864',
  heading: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  body: '"Avenir Next", "Segoe UI", sans-serif',
} as const;
