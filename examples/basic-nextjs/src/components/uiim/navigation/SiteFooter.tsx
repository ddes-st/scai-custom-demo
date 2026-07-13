import React, { JSX } from 'react';
import {
  ImageField,
  NextImage as ContentSdkImage,
} from '@sitecore-content-sdk/nextjs';
import Link from 'next/link';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

type SiteFooterProps = ComponentProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: any;
};

function getBrandLogo(props: SiteFooterProps): ImageField | undefined {
  const fields = props.fields;
  // Path 1: ComponentQuery → fields.data.datasource
  const fromFields = fields?.data?.datasource?.brandLogo?.jsonValue;
  if (fromFields) return fromFields;
  // Path 2: rendering.fields.data.datasource
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendering = props.rendering as any;
  const fromRendering = rendering?.fields?.data?.datasource?.brandLogo?.jsonValue;
  if (fromRendering) return fromRendering;
  // Path 3: Direct datasource field access
  const fromDirect = rendering?.fields?.BrandLogo;
  if (fromDirect?.value?.src) return fromDirect;
  return undefined;
}

const SiteFooterDefaultComponent = (): JSX.Element => (
  <div className="component site-footer">
    <div className="component-content">
      <span className="is-empty-hint">SiteFooter</span>
    </div>
  </div>
);

const LINK_COLUMNS = [
  {
    title: 'Products',
    links: ['Overview', 'Features', 'Pricing', 'Integrations'],
  },
  {
    title: 'Company',
    links: ['About', 'Careers', 'Blog', 'Press'],
  },
  {
    title: 'Support',
    links: ['Help Center', 'Contact', 'Documentation', 'Status'],
  },
];

const Logo = ({ brandLogo }: { brandLogo?: ImageField }) => {
  const hasImage = brandLogo?.value?.src;
  return (
    <Link
      href="/"
      className="flex items-center text-xl font-bold tracking-tight"
      style={{ color: 'var(--brand-footer-fg, #ffffff)' }}
    >
      {hasImage ? (
        <ContentSdkImage
          field={brandLogo}
          className="h-8 w-auto object-contain brightness-0 invert sm:h-10"
        />
      ) : (
        <>
          <span style={{ color: 'var(--brand-primary)' }}>Brand</span>Logo
        </>
      )}
    </Link>
  );
};

const SocialIcons = () => (
  <div className="flex items-center gap-4">
    {['X', 'Li', 'Fb', 'Ig'].map((label) => (
      <a
        key={label}
        href="#"
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-opacity hover:opacity-70"
        style={{
          backgroundColor: 'var(--brand-footer-fg, #ffffff)',
          color: 'var(--brand-footer-bg, #111111)',
          opacity: 0.2,
        }}
        aria-label={label}
      >
        {label}
      </a>
    ))}
  </div>
);

const Copyright = () => (
  <p
    className="text-sm opacity-50 font-[var(--brand-body-font,inherit)]"
    style={{ color: 'var(--brand-footer-fg, #ffffff)' }}
  >
    &copy; {new Date().getFullYear()} BrandName. All rights reserved.
  </p>
);

/* ────────────────────────────────────────────
   Default — multi-column layout
   ──────────────────────────────────────────── */
export const Default = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  if (!params) return <SiteFooterDefaultComponent />;

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer
        className="w-full"
        style={{
          backgroundColor: 'var(--brand-footer-bg, #111111)',
          color: 'var(--brand-footer-fg, #ffffff)',
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
          <div className="grid gap-8 md:grid-cols-5">
            {/* Logo + description */}
            <div className="md:col-span-2 space-y-4">
              <Logo brandLogo={brandLogo} />
              <p
                className="max-w-xs text-sm opacity-60 font-[var(--brand-body-font,inherit)]"
              >
                Building the future of digital experiences. Trusted by teams worldwide.
              </p>
              <SocialIcons />
            </div>

            {/* Link columns */}
            {LINK_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3
                  className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-70 font-[var(--brand-heading-font,inherit)]"
                >
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm opacity-60 transition-opacity hover:opacity-100 font-[var(--brand-body-font,inherit)]"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Copyright />
            <div className="flex gap-6 text-sm opacity-50">
              <a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ────────────────────────────────────────────
   Minimal — single row
   ──────────────────────────────────────────── */
export const Minimal = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  if (!params) return <SiteFooterDefaultComponent />;

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer
        className="w-full"
        style={{
          backgroundColor: 'var(--brand-footer-bg, #111111)',
          color: 'var(--brand-footer-fg, #ffffff)',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
          <Logo brandLogo={brandLogo} />
          <nav className="flex flex-wrap items-center gap-6 text-sm opacity-60">
            {['About', 'Products', 'Blog', 'Contact', 'Privacy'].map((link) => (
              <a
                key={link}
                href="#"
                className="transition-opacity hover:opacity-100 font-[var(--brand-body-font,inherit)]"
              >
                {link}
              </a>
            ))}
          </nav>
          <Copyright />
        </div>
      </footer>
    </div>
  );
};

/* ────────────────────────────────────────────
   MegaFooter — expanded with newsletter
   ──────────────────────────────────────────── */
export const MegaFooter = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  if (!params) return <SiteFooterDefaultComponent />;

  const extraColumns = [
    {
      title: 'Resources',
      links: ['Webinars', 'Case Studies', 'White Papers', 'API Docs'],
    },
    {
      title: 'Legal',
      links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'],
    },
  ];

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer
        className="w-full"
        style={{
          backgroundColor: 'var(--brand-footer-bg, #111111)',
          color: 'var(--brand-footer-fg, #ffffff)',
        }}
      >
        {/* Newsletter bar */}
        <div
          className="border-b"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
            <div>
              <h3 className="text-lg font-semibold font-[var(--brand-heading-font,inherit)]">
                Subscribe to our newsletter
              </h3>
              <p className="mt-1 text-sm opacity-60 font-[var(--brand-body-font,inherit)]">
                Get the latest updates delivered to your inbox.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 rounded-[var(--brand-button-radius,0.375rem)] border px-4 py-2 text-sm"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(255,255,255,0.2)',
                  color: 'var(--brand-footer-fg, #ffffff)',
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-[var(--brand-button-radius,0.375rem)] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: 'var(--brand-primary-foreground)',
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Main footer content */}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 md:grid-cols-6">
            <div className="md:col-span-2 space-y-4">
              <Logo brandLogo={brandLogo} />
              <p className="max-w-xs text-sm opacity-60 font-[var(--brand-body-font,inherit)]">
                Building the future of digital experiences. Trusted by teams worldwide.
              </p>
              <SocialIcons />
            </div>

            {LINK_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-70 font-[var(--brand-heading-font,inherit)]">
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm opacity-60 transition-opacity hover:opacity-100 font-[var(--brand-body-font,inherit)]">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {extraColumns.map((col) => (
              <div key={col.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-70 font-[var(--brand-heading-font,inherit)]">
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm opacity-60 transition-opacity hover:opacity-100 font-[var(--brand-body-font,inherit)]">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Copyright />
            <div className="flex gap-6 text-sm opacity-50">
              <a href="#" className="hover:opacity-100 transition-opacity">Privacy Policy</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Terms of Service</a>
              <a href="#" className="hover:opacity-100 transition-opacity">Cookie Settings</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — white background, logo left, utility links, thin top border
   ──────────────────────────────────────────── */
export const Sodexo = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  if (!params) return <SiteFooterDefaultComponent />;

  const hasImage = brandLogo?.value?.src;

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer className="w-full bg-white">
        <div
          className="border-t"
          style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
        />
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center text-xl font-bold tracking-tight"
            style={{ color: 'var(--brand-primary, #283897)' }}
          >
            {hasImage ? (
              <ContentSdkImage
                field={brandLogo}
                className="h-7 w-auto object-contain sm:h-9"
              />
            ) : (
              <span style={{ color: 'var(--brand-primary, #283897)' }}>Sodexo</span>
            )}
          </Link>
          {/* Utility links */}
          <nav className="flex flex-wrap items-center gap-5 text-xs" style={{ color: 'var(--brand-fg, #2a295c)' }}>
            {['Accessibility', 'Privacy', 'Terms of use', 'Cookies'].map((link) => (
              <a
                key={link}
                href="#"
                className="opacity-60 transition-opacity hover:opacity-100"
                style={{ fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
              >
                {link}
              </a>
            ))}
          </nav>
          {/* Social icons */}
          <div className="flex items-center gap-3">
            {[
              { label: 'Li', path: 'M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zM.02 24h4.96V7.99H.02V24zM8.06 7.99h4.75v2.19h.07c.66-1.25 2.27-2.57 4.68-2.57 5 0 5.93 3.29 5.93 7.57V24h-4.96v-7.82c0-1.87-.03-4.27-2.6-4.27-2.6 0-3 2.03-3 4.13V24H8.06V7.99z' },
              { label: 'Fb', path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
              { label: 'Ig', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
              { label: 'Tw', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
            ].map((icon) => (
              <a
                key={icon.label}
                href="#"
                className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                style={{ backgroundColor: 'var(--brand-primary, #283897)' }}
                aria-label={icon.label}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff">
                  <path d={icon.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
        {/* Copyright line */}
        <div
          className="border-t px-4 py-3 text-center"
          style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
        >
          <p
            className="text-xs opacity-50"
            style={{
              color: 'var(--brand-fg, #2a295c)',
              fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
            }}
          >
            &copy; {new Date().getFullYear()} Sodexo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — white bg, minimal footer with border
   ──────────────────────────────────────────── */
export const Sodexo = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer
        className="w-full border-t px-4 py-8"
        style={{
          backgroundColor: '#ffffff',
          borderColor: 'var(--brand-border, #e0dff0)',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo brandLogo={brandLogo} />
          <div className="flex flex-wrap items-center gap-6">
            {['Privacy', 'Terms', 'Cookies', 'Contact'].map((label) => (
              <a
                key={label}
                href="#"
                className="text-sm transition-opacity hover:opacity-70"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, inherit)',
                }}
              >
                {label}
              </a>
            ))}
          </div>
          <SocialIcons />
        </div>
        <div className="mx-auto mt-6 max-w-7xl text-center">
          <p
            className="text-xs"
            style={{ color: 'var(--brand-fg, #2a295c)', opacity: 0.6 }}
          >
            &copy; {new Date().getFullYear()} Sodexo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
