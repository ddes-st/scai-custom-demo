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

const SODEXO_FOOTER_COLUMNS: { title: string; links: string[] }[] = [
  {
    title: 'Clients',
    links: ['Food Services and Brands', 'Facility Management Services', 'Business insights', 'Contact Us'],
  },
  {
    title: 'Investors',
    links: [
      'Financial Results',
      'Financial Calendar',
      'Integrated Report Fiscal 2025',
      'The benefits of being a registered shareholder',
      'Contact Us',
    ],
  },
  {
    title: 'Career seekers',
    links: ['Working at Sodexo', 'Find a job', 'Career Stories', 'Contact Us'],
  },
  {
    title: 'Press & media',
    links: ['Newsroom', 'Business insights', 'Contact Us'],
  },
];

const SODEXO_LEGAL_LINKS = [
  'Terms & Conditions',
  'Cookie Policy',
  'Cookie Settings',
  'Online Privacy Policy',
  'Data Protection Policy',
  'Vulnerability Disclosure Policy',
];

const SODEXO_SOCIAL_ICONS = [
  {
    label: 'X',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'LinkedIn',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM7.119 20.452H3.555V9h3.564v11.452z',
  },
  {
    label: 'Instagram',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    label: 'YouTube',
    path: 'M23.498 6.186a2.966 2.966 0 00-2.088-2.088C19.692 3.5 12 3.5 12 3.5s-7.692 0-9.41.598A2.966 2.966 0 00.502 6.186 30.909 30.909 0 000 12a30.909 30.909 0 00.502 5.814 2.966 2.966 0 002.088 2.088C4.308 20.5 12 20.5 12 20.5s7.692 0 9.41-.598a2.966 2.966 0 002.088-2.088A30.909 30.909 0 0024 12a30.909 30.909 0 00-.502-5.814zM9.75 15.568V8.432L15.818 12 9.75 15.568z',
  },
];

const SodexoLogo = ({ brandLogo }: { brandLogo?: ImageField }) => {
  const hasImage = brandLogo?.value?.src;
  return (
    <Link href="/" className="flex items-center gap-1" aria-label="Sodexo">
      {hasImage ? (
        <ContentSdkImage field={brandLogo} className="h-7 w-auto object-contain sm:h-8" />
      ) : (
        <span className="flex items-center text-2xl font-bold italic text-white">
          sodexo
          <svg width="14" height="14" viewBox="0 0 24 24" className="mb-3 -ml-0.5">
            <path
              d="M12 0l1.8 6.6L18 2.4l-2.4 6L22 6l-4.2 4.8L24 12l-6.2 1.2L22 18l-6-1.6L18 22.4 13.5 18l-1.5 6-1.5-6L6 22.4l2.4-6.2L2 18l4.5-4.8L0 12l6.2-.8L2 6l6 1.8L6 6.6l4.2 4.2L12 0z"
              fill="var(--brand-accent, #da2020)"
            />
          </svg>
        </span>
      )}
    </Link>
  );
};

const SodexoSharePrice = () => (
  <div className="flex flex-col gap-1.5">
    <span
      className="text-[11px] font-semibold uppercase tracking-wider text-white/70"
      style={{ fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
    >
      Share price
    </span>
    <div className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5">
      <span className="text-sm font-semibold" style={{ color: 'var(--brand-fg, #2a295c)' }}>
        52.70€
      </span>
      <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: 'var(--brand-accent, #da2020)' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="4 8 12 16 20 8" />
        </svg>
        -0.47%
      </span>
    </div>
  </div>
);

const SodexoSocialIcons = () => (
  <div className="flex items-center gap-5">
    {SODEXO_SOCIAL_ICONS.map((icon) => (
      <a
        key={icon.label}
        href="#"
        className="flex items-center justify-center text-white opacity-90 transition-opacity hover:opacity-100"
        aria-label={icon.label}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d={icon.path} />
        </svg>
      </a>
    ))}
  </div>
);

/* ────────────────────────────────────────────
   Sodexo — dark navy bg, share price widget, 4-column links, legal bar
   ──────────────────────────────────────────── */
export const Sodexo = (props: SiteFooterProps): JSX.Element => {
  const { params } = props;
  const { styles, RenderingIdentifier } = params;
  const brandLogo = getBrandLogo(props);

  if (!params) return <SiteFooterDefaultComponent />;

  return (
    <div className={cn('component site-footer', styles)} id={RenderingIdentifier}>
      <footer
        className="w-full"
        style={{ backgroundColor: 'var(--brand-footer-bg, #2a295c)' }}
      >
        {/* Top bar: logo, share price, social icons */}
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <SodexoLogo brandLogo={brandLogo} />
          <SodexoSharePrice />
          <SodexoSocialIcons />
        </div>

        <div className="mx-auto max-w-7xl border-t px-4 sm:px-6" style={{ borderColor: 'rgba(255,255,255,0.15)' }} />

        {/* Link columns */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {SODEXO_FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3
                  className="mb-4 text-base font-bold text-white"
                  style={{ fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
                >
                  {col.title}
                </h3>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-white/70 transition-opacity hover:text-white"
                        style={{ fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom legal bar */}
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-5 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
            <p
              className="text-xs text-white/60"
              style={{ fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
            >
              &copy; {new Date().getFullYear()} Sodexo. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
              {SODEXO_LEGAL_LINKS.map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-xs text-white/60 transition-opacity hover:text-white"
                  style={{ fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}
                >
                  {link}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

