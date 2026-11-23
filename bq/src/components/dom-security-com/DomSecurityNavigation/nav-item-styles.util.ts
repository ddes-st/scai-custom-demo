/**
 * L1 link chrome (capture `.navbar .nav > li > a`):
 * block layout so `::after` red underline sits *under* the label (never a flex sibling).
 * Desktop: padding-top + short centered #d51130 bar on hover/open.
 */
export const navItemClassName =
  "relative block px-[15px] pt-2.5 pb-0 font-[Source_Sans_Pro] text-[15px] font-light leading-normal no-underline transition-[color,font-weight,letter-spacing] after:mx-auto after:mt-2.5 after:block after:h-[2px] after:w-0 after:bg-[#d51130] after:content-[''] after:transition-[width] after:duration-300 after:delay-0 hover:font-semibold hover:tracking-[-0.35px] hover:after:w-4 hover:after:delay-200 max-lg:py-3 lg:pb-0";
