'use client';

import React, { JSX, useState, useEffect } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  Text,
} from '@sitecore-content-sdk/nextjs';
import Link from 'next/link';
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
   Sodexo — white bg, primary nav with chevrons, utility links uppercase, search icon
   ──────────────────────────────────────────── */
export const Sodexo = ({ fields, params, page }: NavigationHeaderProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const [menuOpen, setMenuOpen] = useState(false);

  const datasource = fields?.data?.datasource;
  if (!datasource) return <NavigationHeaderDefaultComponent />;

  const links = datasource.children?.results || [];
  const brandLogo = datasource.brandLogo?.jsonValue;
  const primaryLinks = links.slice(0, 5);
  const utilityLinks = links.slice(5);

  return (
    <div className={cn('component navigation-header', styles)} id={RenderingIdentifier}>
      <header
        className="w-full border-b"
        style={{
          backgroundColor: '#ffffff',
          borderColor: 'var(--brand-border, #e0dff0)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo */}
          <Logo brandLogo={brandLogo} />

          {/* Primary nav */}
          <nav className="hidden items-center gap-5 lg:flex">
            {primaryLinks.map((item, index) => (
              <ContentSdkLink
                key={item.id}
                field={item.linkUrl?.jsonValue}
                className={cn(
                  'relative flex items-center gap-1 pb-0.5 text-sm font-medium transition-opacity hover:opacity-70',
                  index === 0 && 'border-b-2'
                )}
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  ...(index === 0 ? { borderColor: 'var(--brand-accent, #da2020)' } : {}),
                }}
              >
                {item.linkText?.jsonValue?.value && <Text field={item.linkText?.jsonValue} />}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </ContentSdkLink>
            ))}
          </nav>

          {/* Utility links + search */}
          <div className="hidden items-center gap-4 lg:flex">
            {utilityLinks.map((item) => (
              <ContentSdkLink
                key={item.id}
                field={item.linkUrl?.jsonValue}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-70"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
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
        <MobileMenu items={links} open={menuOpen} onClose={() => setMenuOpen(false)} />
      </header>
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
