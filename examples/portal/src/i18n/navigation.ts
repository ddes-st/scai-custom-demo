import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation: `Link` keeps the visitor in the current language (no prefix for
 * the default language, `/de-DE/...` for the others) and `locale="de-DE"` switches language
 * for the same path. Every portal link to a page of this site goes through here.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
