'use client';

import { FaIcon } from 'components/icons/fa-icon';

export type FooterSocialFallbackItem = {
  name: string;
  href: string;
  label: string;
  /** Font Awesome style; defaults to brands (use solid for envelope/email). */
  faStyle?: 'brands' | 'solid' | 'regular';
};

export type FooterSocialIconFallbackProps = {
  items: ReadonlyArray<FooterSocialFallbackItem>;
  className?: string;
  listClassName?: string;
  iconClassName?: string;
  ariaLabel?: string;
};

/**
 * Visible social/icon strip when Edge omits Image/Icon Link List `children.results`.
 * Pass seed-derived items from the package (never leave the band empty when seeds exist).
 */
export function FooterSocialIconFallback({
  items,
  className,
  listClassName = 'm-0 flex list-none flex-wrap items-center gap-2 p-0 sm:gap-3 xl:gap-2',
  iconClassName = '!static !inset-auto !m-0 inline-block h-6 w-6 brightness-0 invert',
  ariaLabel = 'social links',
}: FooterSocialIconFallbackProps) {
  if (!items?.length) return null;
  return (
    <section className={className} aria-label={ariaLabel}>
      <ul className={listClassName}>
        {items.map((item) => (
          <li key={item.name} className="m-0 p-0">
            <a
              href={item.href}
              target={item.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={
                item.href.startsWith('mailto:')
                  ? undefined
                  : 'noopener noreferrer'
              }
              className="flex items-center p-2 text-white no-underline transition-transform duration-300 hover:scale-110"
              aria-label={item.label}
            >
              <FaIcon
                name={item.name}
                faStyle={item.faStyle || 'brands'}
                className={iconClassName}
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
