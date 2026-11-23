"use client";

import { useEffect, useId, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  extractContentPath,
  publicHrefForLocale,
} from "../locale-href.util";

type CountryEntry = {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 for flagcdn */
  flag: string;
  /** Sitecore locale when this country/site is available in the demo */
  locale?: string;
  /** External URL on live DOM (informational only when unavailable) */
  externalHref?: string;
};

type CountrySection = {
  title: string;
  countries: CountryEntry[];
};

/** Countries shown on live DOM “Choose your country”. Only locales we host are active. */
const COUNTRY_SECTIONS: CountrySection[] = [
  {
    title: "Europe",
    countries: [
      { id: "at", name: "Austria", flag: "at", externalHref: "http://www.dom.at/" },
      {
        id: "be",
        name: "België",
        flag: "be",
        locale: "en",
        externalHref: "https://www.dom-security.com/be",
      },
      {
        id: "cz",
        name: "Czech Republic",
        flag: "cz",
        externalHref: "http://www.dom-czech.cz/",
      },
      {
        id: "de",
        name: "Deutschland",
        flag: "de",
        externalHref: "https://www.dom-security.com/de/de",
      },
      {
        id: "fr",
        name: "France",
        flag: "fr",
        externalHref: "https://www.dom-security.com/fr/fr",
      },
      {
        id: "hu",
        name: "Hungary",
        flag: "hu",
        externalHref: "https://www.dom-security.com/hu/hu",
      },
      {
        id: "it",
        name: "Italy",
        flag: "it",
        externalHref: "https://www.dom-security.com/it/it",
      },
      {
        id: "nl",
        name: "Nederland",
        flag: "nl",
        externalHref: "https://www.dom-security.com/nl/nl",
      },
      {
        id: "pl",
        name: "Poland",
        flag: "pl",
        externalHref: "https://www.dom-security.com/pl/pl/",
      },
      {
        id: "ro",
        name: "Romania",
        flag: "ro",
        externalHref: "https://www.dom-security.com/ro",
      },
      {
        id: "ch",
        name: "Schweiz",
        flag: "ch",
        externalHref: "https://www.dom-security.com/ch",
      },
      {
        id: "si",
        name: "Slovenija",
        flag: "si",
        externalHref: "https://www.dom-security.com/si",
      },
      {
        id: "es",
        name: "Spain",
        flag: "es",
        externalHref: "https://www.dom-security.com/es/es",
      },
      {
        id: "uk",
        name: "United Kingdom",
        flag: "gb",
        externalHref: "https://www.dom-security.com/uk",
      },
    ],
  },
  {
    title: "Rest of the World",
    countries: [
      {
        id: "global-en",
        name: "Global English Site",
        // Demo treats `en` as US English
        flag: "us",
        locale: "en",
        externalHref: "https://www.dom-security.com/fr/en",
      },
      {
        id: "global-fr",
        name: "Site mondial français",
        flag: "fr",
        // No standalone FR global site in this demo — greyed out.
        externalHref: "https://www.dom-security.com/fr/fr",
      },
    ],
  },
  {
    title: "Investor Relations",
    countries: [
      {
        id: "ir-en",
        name: "Global English Site",
        flag: "us",
        externalHref: "https://www.dom-security.com/global/en",
      },
      {
        id: "ir-fr",
        name: "Site mondial français",
        flag: "fr",
        externalHref: "https://www.dom-security.com/global/fr",
      },
    ],
  },
];

/** Locales present on this XM Cloud demo site. */
const AVAILABLE_LOCALES = new Set(["en", "nl-BE", "fr-BE"]);

function FlagCircle({
  code,
  name,
  disabled,
  size = "lg",
}: {
  code: string;
  name: string;
  disabled?: boolean;
  size?: "sm" | "lg";
}) {
  const dim = size === "sm" ? "h-5 w-5" : "h-14 w-14";
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center overflow-hidden rounded-full bg-[#f0f0f0] ring-1 ring-[#e5e5e5] ${
        disabled ? "grayscale opacity-60" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://flagcdn.com/w80/${code}.png`}
        alt=""
        width={size === "sm" ? 20 : 56}
        height={size === "sm" ? 20 : 56}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <span className="sr-only">{name}</span>
    </span>
  );
}

function CountryCard({
  country,
  href,
  available,
  onNavigate,
}: {
  country: CountryEntry;
  href?: string;
  available: boolean;
  onNavigate?: () => void;
}) {
  const className = [
    "flex flex-col items-center gap-3 bg-white px-3 pb-4 pt-5 text-center no-underline transition-opacity",
    available
      ? "cursor-pointer hover:opacity-90"
      : "cursor-not-allowed opacity-40",
  ].join(" ");

  const body = (
    <>
      <FlagCircle code={country.flag} name={country.name} disabled={!available} />
      <span
        className={`text-[0.95rem] font-normal leading-tight text-[#333] ${
          available ? "" : "text-[#888]"
        }`}
      >
        {country.name}
      </span>
      <span
        aria-hidden="true"
        className={`mt-1 h-[2px] w-8 ${available ? "bg-[#d51130]" : "bg-[#c8c8c8]"}`}
      />
    </>
  );

  if (available && href) {
    return (
      <Link href={href} className={className} onClick={onNavigate}>
        {body}
      </Link>
    );
  }

  return (
    <div className={className} aria-disabled="true" title="Not available in this demo">
      {body}
    </div>
  );
}

export function CountrySwitchButton({ label = "BE" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const params = useParams();
  const pathname = usePathname() || "";
  const site = String(params?.site || "domsecurity-com");
  const currentLocale = String(params?.locale || "en");
  const contentPath = extractContentPath(pathname, site);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hrefFor = (country: CountryEntry): string | undefined => {
    if (!country.locale || !AVAILABLE_LOCALES.has(country.locale)) return undefined;
    // Belgium → same public path at current culture (site is proxy-resolved)
    if (country.id === "be") return publicHrefForLocale(currentLocale, contentPath);
    return publicHrefForLocale(country.locale, contentPath);
  };

  const isAvailable = (country: CountryEntry) =>
    Boolean(country.locale && AVAILABLE_LOCALES.has(country.locale));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block min-w-[9rem] rounded-[3px] bg-black px-2 py-1.5 pr-12 text-left text-base font-normal text-white no-underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white lg:my-[0.55rem]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-[18px] w-[18px] align-[-3px] bg-[linear-gradient(90deg,#000_0_33%,#f7d117_33%_66%,#ed2939_66%)]"
        />
        {label}
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-full w-9 items-center justify-center border-l border-[#4a4a4a] text-2xl font-light leading-none"
        >
          →
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[100] overflow-y-auto bg-white font-[Source_Sans_Pro] text-[#333]"
        >
          <div className="mx-auto w-full max-w-[1170px] px-[15px] py-8 lg:py-12">
            <div className="mb-8 flex items-start justify-between gap-4">
              <h2
                id={titleId}
                className="m-0 text-[1.8rem] font-light leading-tight text-[#333] lg:text-[2.4rem]"
              >
                Choose your country
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-3xl font-light leading-none text-[#333] hover:text-[#d51130]"
                aria-label="Close country selector"
              >
                ×
              </button>
            </div>

            <div className="mb-6 flex justify-end">
              <span className="inline-flex items-center gap-2 rounded border border-[#cac9c9] px-2.5 py-1.5 text-sm text-[#333]">
                <FlagCircle code="us" name="US English" size="sm" />
                <span className="text-xs font-semibold uppercase tracking-wide">EN</span>
              </span>
            </div>

            {COUNTRY_SECTIONS.map((section) => (
              <section key={section.title} className="mb-10">
                <h3 className="mb-4 flex items-center gap-3 text-[1.25rem] font-normal text-[#333]">
                  <span aria-hidden="true" className="inline-block h-6 w-1.5 bg-[#d51130]" />
                  {section.title}
                </h3>
                <div className="bg-[#f0f0f0] p-4 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {section.countries.map((country) => {
                      const available = isAvailable(country);
                      return (
                        <CountryCard
                          key={country.id}
                          country={country}
                          available={available}
                          href={hrefFor(country)}
                          onNavigate={() => setOpen(false)}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}

            {/* Belgium language shortcuts when on this demo */}
            <section className="mb-6">
              <h3 className="mb-4 flex items-center gap-3 text-[1.25rem] font-normal text-[#333]">
                <span aria-hidden="true" className="inline-block h-6 w-1.5 bg-[#d51130]" />
                Belgium languages
              </h3>
              <div className="flex flex-wrap gap-3 bg-[#f0f0f0] p-4">
                {[
                  { locale: "en", label: "EN — US English", flag: "us" },
                  { locale: "nl-BE", label: "NL — België", flag: "be" },
                  { locale: "fr-BE", label: "FR — Belgique", flag: "be" },
                ].map((lang) => (
                  <Link
                    key={lang.locale}
                    href={publicHrefForLocale(lang.locale, contentPath)}
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm text-[#333] no-underline hover:opacity-90"
                    aria-current={
                      lang.locale === currentLocale ? "true" : undefined
                    }
                  >
                    <FlagCircle code={lang.flag} name={lang.label} size="sm" />
                    {lang.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
