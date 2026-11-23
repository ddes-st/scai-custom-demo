'use client';

import { useState } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Logo: ImageField;
  'Logo Link': LinkField;
  'Audience Segments': RichTextField;
  'Utility Links': RichTextField;
  'Insurance Tab': TextField;
  'Claims Tab': TextField;
  'Category Navigation': RichTextField;
  'All Insurance Link': LinkField;
  Search: TextField;
  'Search Results Link': LinkField;
  'Login Link': LinkField;
}

type GlobalNavigationProps = ComponentProps & { fields: Fields };

export const Default = (props: GlobalNavigationProps) => {
  const { fields } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'insurance' | 'claims'>('insurance');

  const logoAlt =
    typeof fields.Logo?.value?.alt === 'string' ? fields.Logo.value.alt : undefined;
  const searchLabel =
    typeof fields.Search?.value === 'string' ? fields.Search.value : undefined;
  const searchSubmitLabel =
    typeof fields['Search Results Link']?.value?.text === 'string'
      ? fields['Search Results Link'].value.text
      : undefined;

  const categories = (
    <RichText
      field={fields['Category Navigation']}
      className="flex flex-col text-[14px] font-semibold text-[#00008f] lg:flex-row lg:items-center lg:gap-11 [&_details]:relative [&_details]:border-b [&_details]:border-slate-200 lg:[&_details]:border-0 [&_summary]:flex [&_summary]:min-h-12 [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:items-center [&_summary]:justify-between lg:[&_summary]:min-h-12 lg:[&_summary]:gap-2 [&_summary::-webkit-details-marker]:hidden [&_details[open]>summary]:text-[#00008f] [&_.nav-panel]:bg-white [&_.nav-panel]:text-[#20212c] lg:[&_.nav-panel]:absolute lg:[&_.nav-panel]:top-full lg:[&_.nav-panel]:left-0 lg:[&_.nav-panel]:z-50 lg:[&_.nav-panel]:w-[min(1050px,calc(100vw-80px))] lg:[&_.nav-panel]:border lg:[&_.nav-panel]:border-slate-200 lg:[&_.nav-panel]:p-6 [&_.nav-panel]:py-4 [&_.nav-panel]:font-normal [&_.nav-panel]:xl:shadow-sm [&_.nav-panel-grid]:grid [&_.nav-panel-grid]:gap-6 lg:[&_.nav-panel-grid]:grid-cols-3 [&_.nav-panel_a]:block [&_.nav-panel_a]:py-1.5 [&_.nav-panel_a]:text-[#00008f] [&_.nav-panel_h3]:mb-3 [&_.nav-panel_h3]:font-semibold [&_.nav-panel_h3]:text-[#20212c] [&_.nav-feature]:relative [&_.nav-feature]:overflow-hidden [&_.nav-feature]:rounded-sm [&_.nav-feature_img]:h-40 [&_.nav-feature_img]:w-full [&_.nav-feature_img]:object-cover [&_.nav-feature_a]:bg-[#20212c]/80 [&_.nav-feature_a]:p-3 [&_.nav-feature_a]:text-white"
    />
  );

  return (
    <div key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined} className="relative z-40 font-['Source_Sans_Pro',sans-serif] text-[#00008f] lg:bg-[#eaf3ff] lg:px-5 lg:pb-0">
      <div className="hidden h-[50px] items-center justify-between gap-6 px-1 text-[12px] text-[#20212c] lg:flex">
        <RichText field={fields['Audience Segments']} className="[&_ul]:flex [&_ul]:items-center [&_ul]:gap-6 [&_a]:inline-flex [&_a]:h-[41px] [&_a]:items-center [&_a.active]:border-b-2 [&_a.active]:border-[#00008f] [&_a.active]:text-[#00008f]" />
        <RichText field={fields['Utility Links']} className="[&_ul]:flex [&_ul]:items-center [&_ul]:gap-6 [&_a.urgent]:text-[#d60019]" />
      </div>

      <div className="bg-white lg:rounded-t-xl lg:shadow-[0_0_8px_rgba(0,0,0,0.1)]">
        <div className="flex h-14 items-center gap-5 border-b border-slate-200 px-5 lg:h-[57px] lg:gap-7 lg:px-4">
          <Link field={fields['Logo Link']} editable={false} className="shrink-0" aria-label={logoAlt}>
            <Image field={fields.Logo} className="h-9 w-9 object-contain lg:h-10 lg:w-10" />
          </Link>

          <nav className="hidden h-full items-center gap-6 text-[14px] font-semibold lg:flex" aria-label="Main navigation">
            <button type="button" aria-expanded={activeTab === 'insurance'} onClick={() => setActiveTab('insurance')} className={`h-full border-b-2 px-1 ${activeTab === 'insurance' ? 'border-[#00008f]' : 'border-transparent'}`}><Text field={fields['Insurance Tab']} /></button>
            <button type="button" aria-expanded={activeTab === 'claims'} onClick={() => setActiveTab('claims')} className={`h-full border-b-2 px-1 ${activeTab === 'claims' ? 'border-[#00008f]' : 'border-transparent'}`}><Text field={fields['Claims Tab']} /></button>
          </nav>

          <div className="flex-1" />
          <Link field={fields['Login Link']} className="order-1 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#00008f] px-5 text-[13px] font-semibold text-white lg:order-2">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="3.5" /><path d="M4 21v-2c0-4 3-6 8-6s8 2 8 6v2Z" /></svg>
            <span>{fields['Login Link']?.value?.text}</span>
          </Link>
          <button type="button" onClick={() => setSearchOpen(!searchOpen)} aria-label={searchLabel} aria-expanded={searchOpen} className="order-2 flex h-10 w-9 items-center justify-center lg:order-1">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 5 5" /></svg>
          </button>
          <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen} className="order-3 flex h-10 w-9 items-center justify-center lg:hidden">
            <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{mobileOpen ? <path d="M5 5 19 19M19 5 5 19" /> : <path d="M3 6h18M3 12h18M3 18h18" />}</svg>
          </button>
        </div>

        {searchOpen && <form method="get" action={fields['Search Results Link']?.value?.href} className="flex gap-2 border-b border-slate-200 bg-white px-5 py-3"><input type="search" name="q" placeholder={searchLabel} aria-label={searchLabel} className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-[#20212c]" /><button type="submit" className="bg-[#00008f] px-4 text-white" aria-label={searchSubmitLabel}>⌕</button></form>}

        {activeTab === 'insurance' && <nav className="hidden min-h-12 items-center justify-between border-b border-slate-200 px-8 lg:flex lg:rounded-b-xl" aria-label="Insurance categories">{categories}<Link field={fields['All Insurance Link']} className="whitespace-nowrap text-[13px] font-semibold underline underline-offset-4" /></nav>}
      </div>

      {mobileOpen && <nav className="absolute inset-x-0 top-full max-h-[calc(100dvh-56px)] overflow-y-auto border-t border-slate-200 bg-white px-5 pb-8 shadow-md lg:hidden" aria-label="Mobile navigation"><RichText field={fields['Audience Segments']} className="border-b border-slate-200 py-4 text-sm [&_li]:py-2" /><div className="flex gap-6 border-b border-slate-200 py-4 font-semibold"><button type="button" onClick={() => setActiveTab('insurance')}><Text field={fields['Insurance Tab']} /></button><button type="button" onClick={() => setActiveTab('claims')}><Text field={fields['Claims Tab']} /></button></div>{activeTab === 'insurance' && <>{categories}<Link field={fields['All Insurance Link']} className="mt-5 block text-sm font-semibold underline" /></>}<RichText field={fields['Utility Links']} className="mt-6 border-t border-slate-200 pt-4 text-sm [&_li]:py-2" /></nav>}
    </div>
  );
};
