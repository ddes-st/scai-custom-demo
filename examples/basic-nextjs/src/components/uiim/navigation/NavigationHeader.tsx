'use client';

import React, { JSX, useState, useEffect, useRef } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  Text,
} from '@sitecore-content-sdk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface NavigationLinkFields {
  id: string;
  linkText: { jsonValue: Field<string> };
  linkUrl: { jsonValue: LinkField };
}

interface NavigationHeaderDatasource {
  brandLogo: { jsonValue: ImageField };
  ctaLabel: { jsonValue: Field<string> };
  ctaLink: { jsonValue: LinkField };
  children: {
    results: NavigationLinkFields[];
  };
}

interface NavigationHeaderFields {
  data: {
    datasource: NavigationHeaderDatasource;
  };
}

type NavigationHeaderProps = ComponentProps & {
  fields: NavigationHeaderFields;
};

const NavigationHeaderDefaultComponent = (): JSX.Element => (
  <div className="component navigation-header">
    <div className="component-content">
      <span className="is-empty-hint">NavigationHeader</span>
    </div>
  </div>
);

const Logo = ({
  className,
  brandLogo,
}: {
  className?: string;
  brandLogo?: ImageField;
}) => {
  const hasImage = brandLogo?.value?.src;
  return (
    <Link
      href="/"
      className={cn('flex items-center text-xl font-bold tracking-tight', className)}
      style={{ color: 'var(--brand-header-fg, inherit)' }}
    >
      {hasImage ? (
        <ContentSdkImage
          field={brandLogo}
          className="h-8 w-auto object-contain sm:h-10"
        />
      ) : (
        <>
          <span style={{ color: 'var(--brand-primary)' }}>Brand</span>Logo
        </>
      )}
    </Link>
  );
};

const NavLinks = ({
  className,
  items,
}: {
  className?: string;
  items: NavigationLinkFields[];
}) => (
  <nav className={cn('hidden md:flex items-center gap-6', className)}>
    {items.map((item) => (
      <ContentSdkLink
        key={item.id}
        field={item.linkUrl?.jsonValue}
        className="text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--brand-header-fg, inherit)' }}
      >
        {item.linkText?.jsonValue?.value && (
          <Text field={item.linkText?.jsonValue} />
        )}
      </ContentSdkLink>
    ))}
  </nav>
);

const MobileMenu = ({
  items,
  open,
  onClose,
}: {
  items: NavigationLinkFields[];
  open: boolean;
  onClose: () => void;
}) => {
  if (!open) return null;
  return (
    <div
      className="md:hidden border-t"
      style={{ borderColor: 'var(--brand-border, #e5e7eb)' }}
    >
      <div className="px-4 py-4 flex flex-col gap-4">
        {items.map((item) => (
          <ContentSdkLink
            key={item.id}
            field={item.linkUrl?.jsonValue}
            className="text-sm font-medium"
            style={{ color: 'var(--brand-header-fg, inherit)' }}
            onClick={onClose}
          >
            {item.linkText?.jsonValue?.value && (
              <Text field={item.linkText?.jsonValue} />
            )}
          </ContentSdkLink>
        ))}
      </div>
    </div>
  );
};

const CtaButton = ({
  className,
  label,
  link,
  isEditing,
}: {
  className?: string;
  label?: Field<string>;
  link?: LinkField;
  isEditing?: boolean;
}) => {
  if (!link?.value?.href && !isEditing) return null;

  const ctaClassName = cn(
    'hidden md:inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90',
    className
  );
  const ctaStyle = {
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--brand-primary-foreground)',
  };

  if (!link) {
    return (
      <span className={ctaClassName} style={ctaStyle}>
        {label?.value && <Text field={label} />}
      </span>
    );
  }

  return (
    <ContentSdkLink field={link} className={ctaClassName} style={ctaStyle}>
      {label?.value && <Text field={label} />}
    </ContentSdkLink>
  );
};

const MenuButton = ({ open, onClick }: { open: boolean; onClick: () => void }) => (
  <button
    className="md:hidden p-2"
    onClick={onClick}
    aria-label="Toggle menu"
    style={{ color: 'var(--brand-header-fg, inherit)' }}
  >
    {open ? (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ) : (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    )}
  </button>
);

export const Default = ({ fields, params, page }: NavigationHeaderProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const [menuOpen, setMenuOpen] = useState(false);

  const datasource = fields?.data?.datasource;
  if (!datasource) return <NavigationHeaderDefaultComponent />;

  const links = datasource.children?.results || [];
  const brandLogo = datasource.brandLogo?.jsonValue;

  return (
    <div className={cn('component navigation-header', styles)} id={RenderingIdentifier}>
      <header
        className="w-full border-b"
        style={{
          backgroundColor: 'var(--brand-header-bg, #ffffff)',
          borderColor: 'var(--brand-border, #e5e7eb)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo brandLogo={brandLogo} />
          <NavLinks items={links} />
          <div className="flex items-center gap-2">
            <CtaButton
              label={datasource.ctaLabel?.jsonValue}
              link={datasource.ctaLink?.jsonValue}
              isEditing={isEditing}
            />
            <MenuButton open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          </div>
        </div>
        <MobileMenu items={links} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>
    </div>
  );
};

export const Transparent = ({ fields, params, page }: NavigationHeaderProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const datasource = fields?.data?.datasource;

  useEffect(() => {
    if (!datasource) return;
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [datasource]);

  if (!datasource) return <NavigationHeaderDefaultComponent />;

  const links = datasource.children?.results || [];
  const brandLogo = datasource.brandLogo?.jsonValue;

  return (
    <div className={cn('component navigation-header', styles)} id={RenderingIdentifier}>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300',
          scrolled ? 'border-b shadow-sm' : ''
        )}
        style={{
          backgroundColor: scrolled
            ? 'var(--brand-header-bg, #ffffff)'
            : 'transparent',
          borderColor: scrolled
            ? 'var(--brand-border, #e5e7eb)'
            : 'transparent',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo
            brandLogo={brandLogo}
            className={cn(
              'transition-colors duration-300',
              !scrolled && 'drop-shadow-sm'
            )}
          />
          <NavLinks
            items={links}
            className={cn(
              'transition-colors duration-300',
              !scrolled && '[&_a]:!text-white [&_a]:drop-shadow-sm'
            )}
          />
          <div className="flex items-center gap-2">
            <CtaButton
              label={datasource.ctaLabel?.jsonValue}
              link={datasource.ctaLink?.jsonValue}
              isEditing={isEditing}
            />
            <MenuButton open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          </div>
        </div>
        <MobileMenu items={links} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — utility bar, primary nav with mega-menus, uppercase utility links, search icon
   ──────────────────────────────────────────── */
const SODEXO_PRIMARY_ORDER = ['What we do', 'Sustainability', 'Insights', 'Careers', 'About Us'];
const SODEXO_UTILITY_ORDER = ['Investors', 'Newsroom'];

interface SodexoMegaMenuContent {
  description: string;
  links: string[];
  image: string;
  secondaryCta?: { heading: string; subtext: string; ctaLabel: string };
}

const SODEXO_MEGA_MENU_CONTENT: Record<string, SodexoMegaMenuContent> = {
  'What we do': {
    description:
      'Taking a strategic approach to delivering industry-leading services for clients across sectors worldwide — from food, hospitality and facilities management to procurement services.',
    links: ['Where we operate', 'Services', 'Food brands'],
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106413-section3-img1?v=d480f54d',
  },
  Sustainability: {
    description:
      'Embedded into operations, driving measurable, meaningful results for clients, consumers and communities – this is how we define business sustainability. Explore our reports, roadmaps, partnerships, and results.',
    links: ['Our commitment to sustainability', 'For our people', 'For our clients', 'For the planet and society'],
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106461-section4-img6?v=b0b2d3d8',
    secondaryCta: {
      heading: 'Stop Hunger 2024 Impact Report',
      subtext: "Inspiring stories, lasting impact. Discover Stop Hunger's 2024 Impact Report",
      ctaLabel: 'Read the report',
    },
  },
  Insights: {
    description:
      'The latest research-led reports, analysis and expert opinion from around the world – helping business leaders make informed decisions across industries. From future-facing digital solutions transforming the workplace to sector-specific deep dives into the trends and challenges ahead.',
    links: [
      'View all latest insights',
      'Research & reports',
      'Food and culinary trends',
      'Workplace experience',
      'Innovation',
      'Sustainability',
      'Career stories',
    ],
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106439-section3-img4?v=b3ec3d50',
    secondaryCta: {
      heading: 'Watch the replay of Cook for Change! 2026',
      subtext: "Find out the winners of this year's competition in the replay of the YouTube Live.",
      ctaLabel: 'Watch now',
    },
  },
  Careers: {
    description:
      'Finding a career which is more than a job and becoming part of something greater with Sodexo. Learn more about our jobs, benefits, culture and employee career stories.',
    links: ['More than a job', 'Find a job', 'Culture & belonging', 'Employee career stories', 'Global employee benefits program (Vita)'],
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106479-section6-img8?v=81b54824',
  },
  'About Us': {
    description:
      'Serving clients all over the world with industry-leading food and facilities management services. Get to know Sodexo – from our leadership team and history to awards and accolades.',
    links: [
      'Sodexo in Brief',
      'Our mission and ambition',
      'Sodexo Global Executive Team',
      'Board of Directors',
      'Our Innovation Approach',
      'Our History',
      'Our Awards',
    ],
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106449-section3-img5?v=409a0f3e',
    secondaryCta: {
      heading: 'Integrated Report Fiscal 2025',
      subtext: 'Discover how we are creating a better everyday in our report.',
      ctaLabel: 'Download the report',
    },
  },
};

const SodexoLogo = () => (
  <Link href="/" className="flex items-center gap-1" aria-label="Sodexo">
    <span className="flex items-center text-2xl font-bold italic" style={{ color: 'var(--brand-primary, #283897)' }}>
      sodexo
      <svg width="12" height="12" viewBox="0 0 24 24" className="mb-3 -ml-0.5">
        <path
          d="M12 0l1.8 6.6L18 2.4l-2.4 6L22 6l-4.2 4.8L24 12l-6.2 1.2L22 18l-6-1.6L18 22.4 13.5 18l-1.5 6-1.5-6L6 22.4l2.4-6.2L2 18l4.5-4.8L0 12l6.2-.8L2 6l6 1.8L6 6.6l4.2 4.2L12 0z"
          fill="var(--brand-accent, #da2020)"
        />
      </svg>
    </span>
  </Link>
);

const SodexoUtilityBar = () => (
  <div className="hidden border-b lg:block" style={{ backgroundColor: 'var(--brand-muted, #f0eef8)', borderColor: 'var(--brand-border, #e0dff0)' }}>
    <div className="mx-auto flex max-w-7xl items-center justify-end gap-5 px-6 py-1.5 text-xs">
      <a href="#" className="font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand-fg, #2a295c)' }}>
        Contact Us
      </a>
      <a href="#" className="flex items-center gap-1 font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand-fg, #2a295c)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        Location
      </a>
      <div className="flex items-center gap-1.5 font-semibold">
        <button type="button" className="opacity-40 transition-opacity hover:opacity-70" style={{ color: 'var(--brand-fg, #2a295c)' }}>
          FR
        </button>
        <span className="opacity-30" style={{ color: 'var(--brand-fg, #2a295c)' }}>
          /
        </span>
        <button type="button" style={{ color: 'var(--brand-fg, #2a295c)' }}>
          EN
        </button>
      </div>
    </div>
  </div>
);

const SodexoMegaMenuLink = ({ link }: { link: string }) => (
  <a
    href="#"
    className="flex items-start justify-between gap-3 text-sm font-semibold transition-opacity hover:opacity-70"
    style={{ color: 'var(--brand-fg, #2a295c)' }}
  >
    <span>{link}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent, #da2020)" strokeWidth="2.5" className="mt-0.5 shrink-0">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  </a>
);

const SodexoMegaMenu = ({
  label,
  animateIn,
  onClose,
}: {
  label: string;
  animateIn: boolean;
  onClose: () => void;
}) => {
  const content = SODEXO_MEGA_MENU_CONTENT[label];
  if (!content) return null;
  return (
    <div className="absolute inset-x-0 top-full z-40 hidden justify-center px-6 lg:flex">
      <div
        className={cn(
          'w-full max-w-6xl origin-top rounded-b-2xl shadow-2xl transition-all duration-300 ease-in-out',
          animateIn ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
        )}
        style={{ backgroundColor: 'var(--brand-muted, #f0eef8)' }}
      >
        <div className="relative px-12 py-16">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-8 top-8 flex h-6 w-6 items-center justify-center transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand-fg, #2a295c)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="grid grid-cols-3 gap-16">
            <div>
              <h3 className="mb-5 text-3xl font-bold" style={{ color: 'var(--brand-accent, #da2020)', fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}>
                {label}
              </h3>
              <p className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}>
                {content.description}
              </p>
            </div>
            <div className="flex flex-col gap-7 pr-10">
              {content.links.map((link) => (
                <SodexoMegaMenuLink key={link} link={link} />
              ))}
            </div>
            <div>
              <div className="relative overflow-hidden" style={{ borderRadius: '32px 3px 3px 3px', minHeight: '220px' }}>
                <Image src={content.image} alt={label} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
              </div>
              {content.secondaryCta && (
                <div className="mt-6">
                  <p
                    className="text-sm font-bold"
                    style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)' }}
                  >
                    {content.secondaryCta.heading}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed opacity-70" style={{ color: 'var(--brand-fg, #2a295c)', fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)' }}>
                    {content.secondaryCta.subtext}
                  </p>
                  <a
                    href="#"
                    className="mt-4 inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold transition-opacity hover:opacity-70"
                    style={{ borderColor: 'var(--brand-border, #d8d6e8)', color: 'var(--brand-fg, #2a295c)', borderRadius: '4px' }}
                  >
                    {content.secondaryCta.ctaLabel}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="19" x2="19" y2="5" />
                      <polyline points="9 5 19 5 19 15" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Sodexo = ({ fields, params }: NavigationHeaderProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  // Mega-menu mount/animation is decoupled from `activeMenu` so the closing
  // (down-top) transition can play out before the panel unmounts.
  const [renderedMenu, setRenderedMenu] = useState<string | null>(null);
  const [menuAnimateIn, setMenuAnimateIn] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeMenu) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setRenderedMenu(activeMenu);
      const raf = requestAnimationFrame(() => setMenuAnimateIn(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuAnimateIn(false);
    closeTimeoutRef.current = setTimeout(() => setRenderedMenu(null), 300);
    return undefined;
  }, [activeMenu]);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeMenu]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const datasource = fields?.data?.datasource;
  if (!datasource) return <NavigationHeaderDefaultComponent />;

  const links = datasource.children?.results || [];
  const byName = (name: string) => links.find((l) => l.linkText?.jsonValue?.value === name);
  const primaryLinks = SODEXO_PRIMARY_ORDER.map(byName).filter(Boolean) as NavigationLinkFields[];
  const utilityLinks = SODEXO_UTILITY_ORDER.map(byName).filter(Boolean) as NavigationLinkFields[];

  return (
    <div className={cn('component navigation-header', styles)} id={RenderingIdentifier}>
      <header className="relative z-50 w-full" style={{ backgroundColor: '#ffffff' }}>
        <SodexoUtilityBar />
        <div
          className="border-b"
          style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <SodexoLogo />

            {/* Primary nav */}
            <nav className="hidden items-center gap-5 lg:flex">
              {primaryLinks.map((item) => {
                const label = item.linkText?.jsonValue?.value || '';
                const isActive = activeMenu === label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveMenu(isActive ? null : label)}
                    className="relative flex items-center gap-1 pb-0.5 text-sm font-medium transition-opacity hover:opacity-70"
                    style={{
                      color: 'var(--brand-fg, #2a295c)',
                      fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                      borderBottom: isActive ? '2px solid var(--brand-accent, #da2020)' : '2px solid transparent',
                    }}
                  >
                    <Text field={item.linkText?.jsonValue} />
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={cn('transition-transform', isActive && 'rotate-180')}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                );
              })}
            </nav>

            {/* Utility links + search */}
            <div className="hidden items-center gap-4 lg:flex">
              {utilityLinks.map((item) => (
                <ContentSdkLink
                  key={item.id}
                  field={item.linkUrl?.jsonValue}
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
                  style={{
                    color: 'var(--brand-primary, #283897)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  {item.linkText?.jsonValue?.value && <Text field={item.linkText?.jsonValue} />}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </ContentSdkLink>
              ))}
              {/* Search icon */}
              <button
                type="button"
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                aria-label="Search"
                style={{ color: 'var(--brand-fg, #2a295c)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            </div>

            {/* Mobile hamburger */}
            <MenuButton open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
          </div>
          {renderedMenu && (
            <SodexoMegaMenu
              label={renderedMenu}
              animateIn={menuAnimateIn}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>
        <MobileMenu items={[...primaryLinks, ...utilityLinks]} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>
      {/* Dark-blue overlay between the mega-menu panel and the rest of the page.
          Sits below the header (z-40 < header's z-50) so it never covers the nav
          itself, and closes the panel when clicked. */}
      {renderedMenu && (
        <div
          className={cn(
            'fixed inset-0 z-40 transition-opacity duration-300 ease-in-out',
            menuAnimateIn ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          style={{ backgroundColor: 'rgba(29, 28, 71, 0.55)' }}
          onClick={() => setActiveMenu(null)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export const Minimal = ({ fields, params }: NavigationHeaderProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;

  const datasource = fields?.data?.datasource;
  if (!datasource) return <NavigationHeaderDefaultComponent />;

  const brandLogo = datasource.brandLogo?.jsonValue;

  return (
    <div className={cn('component navigation-header', styles)} id={RenderingIdentifier}>
      <header
        className="w-full"
        style={{
          backgroundColor: 'var(--brand-header-bg, #ffffff)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-4 sm:px-6">
          <Logo brandLogo={brandLogo} />
        </div>
      </header>
    </div>
  );
};
