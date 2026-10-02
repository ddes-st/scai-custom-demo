import React, { JSX } from 'react';
import {
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  RichText as ContentSdkRichText,
  Text,
  Field,
} from '@sitecore-content-sdk/nextjs';
import { MR } from '@/lib/modern-recipe-page';

export function mrLayout(value?: string): string {
  return String(value || '');
}

const shell = (children: React.ReactNode, id?: string): JSX.Element => (
  <div className="component modern-recipe" id={id} style={{ fontFamily: MR.body, color: MR.ink }}>
    {children}
  </div>
);

const TextLink = ({ field, light }: { field?: LinkField; light?: boolean }) => {
  if (!field?.value?.href && !field?.value?.text) return null;
  return (
    <ContentSdkLink
      field={field}
      className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
      style={{ color: light ? '#ffffff' : MR.deep }}
    />
  );
};

export function ModernRecipeHeroView({
  title,
  subtitle,
  image,
  id,
  band,
}: {
  title?: Field<string>;
  subtitle?: Field<string>;
  image?: ImageField;
  id?: string;
  band?: boolean;
}): JSX.Element {
  if (band) {
    return shell(
      <section className="px-6 py-16 md:px-16 md:py-24" style={{ backgroundColor: MR.deep, color: '#fff' }}>
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-end">
          <Text field={title} tag="h1" className="text-4xl leading-tight md:text-6xl" style={{ fontFamily: MR.heading, fontWeight: 400 }} />
          <ContentSdkRichText field={subtitle} className="text-sm leading-7 md:text-base" />
        </div>
      </section>,
      id
    );
  }

  return shell(
    <section className="relative min-h-[520px] overflow-hidden md:min-h-[640px]">
      {image?.value?.src && (
        <ContentSdkImage field={image} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative mx-auto flex min-h-[520px] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center text-white md:min-h-[640px]">
        <Text field={title} tag="h1" className="text-5xl leading-tight md:text-7xl" style={{ fontFamily: MR.heading, fontWeight: 400 }} />
        <ContentSdkRichText field={subtitle} className="mt-6 max-w-2xl text-sm leading-7 md:text-base" />
      </div>
    </section>,
    id
  );
}

export function ModernRecipeFeatureView({
  eyebrow,
  title,
  description,
  image,
  link,
  id,
}: {
  eyebrow?: string;
  title?: Field<string>;
  description?: Field<string>;
  image?: ImageField;
  link?: LinkField;
  id?: string;
}): JSX.Element {
  const layout = mrLayout(eyebrow);
  const heading = (
    <Text field={title} tag="h2" className="text-4xl leading-tight md:text-5xl" style={{ fontFamily: MR.heading, fontWeight: 400 }} />
  );
  const copy = <ContentSdkRichText field={description} className="mt-4 space-y-4 text-sm leading-7" style={{ color: MR.muted }} />;

  if (layout === 'mr-split' || layout === 'mr-about-copy') {
    return shell(
      <section className="bg-white px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          {heading}
          <div>
            {copy}
            <TextLink field={link} />
          </div>
        </div>
      </section>,
      id
    );
  }

  if (layout === 'mr-local' || layout === 'mr-chef') {
    return shell(
      <section className="bg-white px-6 py-8 md:px-16">
        <div className="mx-auto grid max-w-6xl overflow-hidden md:grid-cols-2">
          <div className="flex flex-col justify-center px-8 py-12 text-white md:px-12" style={{ backgroundColor: MR.deep }}>
            {layout === 'mr-local' && <p className="mb-6 text-3xl" style={{ fontFamily: MR.heading }}>Local flavors</p>}
            {heading}
            <div className="text-white/90">{copy}</div>
            <TextLink field={link} light />
          </div>
          {image?.value?.src && <ContentSdkImage field={image} className="h-full min-h-[320px] w-full object-cover" />}
        </div>
      </section>,
      id
    );
  }

  if (layout === 'mr-pink' || layout === 'mr-earth') {
    const imageFirst = layout === 'mr-earth';
    const photo = image?.value?.src ? <ContentSdkImage field={image} className="h-full w-full object-cover" /> : null;
    const text = (
      <div className="flex flex-col justify-center px-2 py-8 md:px-10">
        {heading}
        {copy}
      </div>
    );
    return shell(
      <section className="px-6 py-16 md:px-16" style={{ backgroundColor: layout === 'mr-pink' ? MR.blush : MR.paper }}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
          {imageFirst ? photo : text}
          {imageFirst ? text : photo}
        </div>
      </section>,
      id
    );
  }

  if (layout === 'mr-feed') {
    return shell(
      <section className="bg-white px-6 py-16 md:px-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
          {image?.value?.src && <ContentSdkImage field={image} className="w-full object-cover" />}
          <div>
            {heading}
            {copy}
            {link && (
              <ContentSdkLink field={link} className="mt-8 inline-flex border px-5 py-2 text-sm" style={{ borderColor: MR.ink, color: MR.ink }} />
            )}
          </div>
        </div>
      </section>,
      id
    );
  }

  return shell(
    <section className="px-6 py-16 md:px-16" style={{ backgroundColor: layout === 'mr-together' ? MR.mint : MR.paper }}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
        <div>
          {heading}
          {copy}
        </div>
        <div className="relative">
          {image?.value?.src && <ContentSdkImage field={image} className="w-full object-cover" />}
          {link?.value?.href && (
            <div className="absolute bottom-6 left-6 right-6 bg-[#0e4b45]/90 p-6 text-white">
              <p className="text-xs uppercase tracking-wide">Modern Recipe</p>
              <p className="mt-2 text-3xl" style={{ fontFamily: MR.heading }}>Explore</p>
              <TextLink field={link} light />
            </div>
          )}
        </div>
      </div>
    </section>,
    id
  );
}

export function ModernRecipePillarsView({
  title,
  items,
  id,
}: {
  title?: Field<string>;
  items: { title?: Field<string>; description?: Field<string> }[];
  id?: string;
}): JSX.Element {
  return shell(
    <section className="bg-white px-6 py-16 md:px-16">
      <Text field={title} tag="h2" className="mb-12 text-center text-4xl md:text-5xl" style={{ fontFamily: MR.heading, fontWeight: 400, color: MR.ink }} />
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        {items.map((item, index) => (
          <article key={index}>
            <Text field={item.title} tag="h3" className="text-lg font-semibold" />
            <ContentSdkRichText field={item.description} className="mt-3 text-sm leading-7" style={{ color: MR.muted }} />
          </article>
        ))}
      </div>
    </section>,
    id
  );
}

export function ModernRecipeCardsView({
  title,
  cards,
  id,
}: {
  title?: string;
  cards: { title?: Field<string>; description?: Field<string>; image?: ImageField; link?: LinkField }[];
  id?: string;
}): JSX.Element {
  if (title === 'Stories') {
    return shell(
      <section className="bg-white px-6 py-8 md:px-16">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {cards.map((card, index) => (
            <article key={index} className="relative min-h-[280px] overflow-hidden text-white">
              {card.image?.value?.src && <ContentSdkImage field={card.image} className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative flex min-h-[280px] flex-col justify-end p-6">
                <Text field={card.title} tag="h3" className="text-2xl leading-snug" style={{ fontFamily: MR.heading }} />
                <ContentSdkRichText field={card.description} className="mt-2 text-sm" />
                <TextLink field={card.link} light />
              </div>
            </article>
          ))}
        </div>
      </section>,
      id
    );
  }

  if (title === 'Get started with Modern Recipe') {
    return shell(
      <section className="px-6 py-14" style={{ backgroundColor: MR.mint }}>
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          <h2 className="text-3xl" style={{ fontFamily: MR.heading, fontWeight: 400 }}>{title}</h2>
          {cards.map((card, index) => (
            <article key={index}>
              <Text field={card.title} tag="h3" className="text-3xl" style={{ fontFamily: MR.heading, fontWeight: 400 }} />
              <ContentSdkRichText field={card.description} className="mt-4 text-sm leading-7" />
              <TextLink field={card.link} />
            </article>
          ))}
        </div>
      </section>,
      id
    );
  }

  return shell(
    <section className="bg-white px-6 py-16 md:px-16">
      <h2 className="mb-8 text-4xl" style={{ fontFamily: MR.heading, fontWeight: 400 }}>{title}</h2>
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {cards.map((card, index) => (
          <article key={index} className="border" style={{ borderColor: '#d7e4df' }}>
            {card.image?.value?.src && <ContentSdkImage field={card.image} className="aspect-[4/3] w-full object-cover" />}
            <div className="p-5">
              <Text field={card.title} tag="h3" className="text-xl leading-snug" style={{ fontFamily: MR.heading }} />
              <TextLink field={card.link} />
            </div>
          </article>
        ))}
      </div>
    </section>,
    id
  );
}

export function ModernRecipeTabsView({
  tabs,
  id,
}: {
  tabs: { label?: Field<string>; link?: LinkField }[];
  id?: string;
}): JSX.Element {
  return shell(
    <nav className="border-y bg-white px-6 py-4" style={{ borderColor: '#d7e4df' }} id={id}>
      <ul className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-3 text-sm">
        {tabs.map((tab, index) => (
          <li key={index}>
            {tab.link?.value?.href ? (
              <ContentSdkLink field={tab.link} className="hover:underline" style={{ color: MR.ink }} />
            ) : (
              <Text field={tab.label} tag="span" />
            )}
          </li>
        ))}
      </ul>
    </nav>,
    id
  );
}

export function ModernRecipeGalleryView({
  caption,
  image,
  id,
}: {
  caption?: Field<string>;
  image?: ImageField;
  id?: string;
}): JSX.Element {
  return shell(
    <section className="bg-white px-6 py-16 md:px-16">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Text field={caption} tag="h2" className="text-4xl" style={{ fontFamily: MR.heading, fontWeight: 400 }} />
        <a href="https://www.instagram.com/" className="border px-4 py-2 text-sm" style={{ borderColor: MR.ink }}>
          Follow us
        </a>
      </div>
      {image?.value?.src && (
        <div className="mx-auto mt-8 max-w-6xl">
          <ContentSdkImage field={image} className="max-h-[420px] w-auto object-cover" />
        </div>
      )}
    </section>,
    id
  );
}

export function ModernRecipeHeaderView({
  logo,
  links,
  ctaLabel,
  ctaLink,
  id,
}: {
  logo?: ImageField;
  links: { text?: Field<string>; link?: LinkField }[];
  ctaLabel?: Field<string>;
  ctaLink?: LinkField;
  id?: string;
}): JSX.Element {
  return shell(
    <header className="border-b bg-white" style={{ borderColor: '#e6eeeb' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <a href="/" aria-label="Modern Recipe">
          {logo?.value?.src ? (
            <ContentSdkImage field={logo} className="h-8 w-auto" />
          ) : (
            <span className="text-sm tracking-wide" style={{ color: MR.deep }}>modern recipe</span>
          )}
        </a>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((item, index) => (
            <ContentSdkLink key={index} field={item.link || { value: { href: '#', text: '' } }} style={{ color: MR.ink }} />
          ))}
        </nav>
        <ContentSdkLink
          field={ctaLink || { value: { href: '#', text: ctaLabel?.value || 'Contact us' } }}
          className="hidden border px-3 py-1.5 text-sm md:inline-flex"
          style={{ borderColor: MR.ink, color: MR.ink }}
        />
      </div>
    </header>,
    id
  );
}

export function ModernRecipeFooterView({ logo, id }: { logo?: ImageField; id?: string }): JSX.Element {
  return shell(
    <footer style={{ backgroundColor: MR.deep, color: '#fff' }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          {logo?.value?.src ? (
            <ContentSdkImage field={logo} className="h-8 w-auto brightness-0 invert" />
          ) : (
            <p className="text-sm tracking-wide">modern recipe</p>
          )}
        </div>
        <div className="text-sm leading-7">
          <p className="font-semibold">About us</p>
          <p>Who we are</p>
          <p>Our solutions</p>
          <p>Blog</p>
          <p>Recipes</p>
        </div>
        <div className="text-sm leading-7">
          <p className="font-semibold">Let&apos;s talk</p>
          <p>Contact us</p>
        </div>
      </div>
      <div className="border-t border-white/20 px-6 py-4 text-xs text-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
          <span>© {new Date().getFullYear()} Sodexo. All rights reserved.</span>
          <span>Terms & conditions</span>
          <span>Privacy policy</span>
        </div>
      </div>
    </footer>,
    id
  );
}
