import { FaIcon } from "components/icons/fa-icon";

/** Demo fallback when Edge omits `footer-social-*` or Icon Link List children. */
const FALLBACK_SOCIAL = [
  {
    name: "facebook",
    href: "https://www.facebook.com/DOMHOBERG",
    label: "Facebook",
  },
  {
    name: "linkedin",
    href: "https://www.linkedin.com/company/313033",
    label: "LinkedIn",
  },
  {
    name: "youtube",
    href: "https://www.youtube.com/channel/UCZ3HaprkiEoBFQFosMCAoGQ/videos",
    label: "YouTube",
  },
] as const;

export function FooterSocialFallback() {
  return (
    <section className="font-[Source_Sans_Pro]" aria-label="social links">
      <ul className="m-0 flex list-none items-center gap-6 p-0 text-white lg:gap-8">
        {FALLBACK_SOCIAL.map((item) => (
          <li key={item.name} className="m-0 p-0">
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center text-white no-underline transition-colors hover:text-[#cac9c9] focus:text-[#cac9c9]"
              aria-label={item.label}
            >
              <FaIcon
                name={item.name}
                faStyle="brands"
                className="!static !inset-auto !m-0 inline-block h-[1.5rem] w-[1.5rem]"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** True when the dynamic footer-social placeholder has at least one rendering. */
export function hasFooterSocialPlaceholders(
  rendering: { placeholders?: Record<string, unknown> } | undefined,
  socialPh: string,
): boolean {
  const slot = rendering?.placeholders?.[socialPh];
  return Array.isArray(slot) && slot.length > 0;
}
