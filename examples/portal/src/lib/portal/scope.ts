import "server-only";
import { env } from "../ch/env";
import { getPortalSettings } from "./settings";

/**
 * The brand scope every Content Hub loader filters by: the Portal Settings item's CH brand
 * identifiers (SitecoreAI), else the PORTAL_BRANDS env fallback. Empty = every brand.
 */
export async function brandScope(): Promise<Set<string>> {
  const settings = await getPortalSettings();
  return settings.brandScope.size ? settings.brandScope : env.portalBrands;
}
