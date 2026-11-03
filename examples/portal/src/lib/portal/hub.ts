/**
 * Hub mode (NEXT_PUBLIC_PORTAL_HUB=1): one Marketplace app per SitecoreAI environment serves every
 * portal site. The app pages (picker, theme / Content Hub panel, setup wizard) find the site the
 * author is on, read that site's portal deployment ("head") from its Portal Settings (PortalHead,
 * written by the setup; fallback the site's TargetHostName) and send their API calls to it through
 * the hub's own forwarding route (/api/hub/…, which adds the tools key server-side). The hub holds
 * no Content Hub credentials. Outside hub mode everything stays same-origin. Client-safe.
 */
export const HUB = process.env.NEXT_PUBLIC_PORTAL_HUB === "1";

let head = "";
let release: (() => void) | null = null;
const ready: Promise<void> = HUB ? new Promise((r) => { release = r; }) : Promise.resolve();

/** "brightwater-…vercel.app" or a URL → "https://brightwater-…vercel.app" ("" when not usable). */
export function normalizeHead(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "https:" || u.hostname === "localhost" ? u.origin : "";
  } catch { return ""; }
}

/** Sets the head for this frame's API calls; true when the value was usable. */
export function setHead(value: string): boolean {
  const origin = normalizeHead(value);
  if (!origin) return false;
  head = origin;
  if (release) { release(); release = null; }
  return true;
}

export const getHead = () => head;

/** Resolves once the head is known (immediately outside hub mode); rejects after `ms`. */
export function headReady(ms = 20_000): Promise<void> {
  if (!HUB || head) return Promise.resolve();
  return Promise.race([ready, new Promise<void>((_, reject) => setTimeout(() => reject(new Error("This site has no portal deployment registered yet — run the Portal setup on it, or enter its URL in the setup.")), ms))]);
}

/** A head-relative URL (/api/asset/…) as an absolute one in hub mode (images load straight from the head). */
export const headAsset = (src: string) => (HUB && head && src.startsWith("/") ? `${head}${src}` : src);

/** "/sitecore/content/<collection>/<site>/Home/…" → "/sitecore/content/<collection>/<site>". */
export function siteRootOf(itemPath: string): string {
  return /^\/sitecore\/content\/[^/]+\/[^/]+/i.exec(String(itemPath ?? ""))?.[0] ?? "";
}

type Gql = (query: string, variables?: Record<string, unknown>) => Promise<any>;

/** The site's head: Portal Settings → PortalHead, else the site definition's TargetHostName. */
export async function headForSite(gql: Gql, siteRoot: string): Promise<string> {
  if (!siteRoot) return "";
  const site = siteRoot.split("/").pop() ?? "";
  const d = await gql(`query($s:String!,$g:String!){ s: item(where:{path:$s, language:"en"}){ field(name:"PortalHead"){ value } } g: item(where:{path:$g, language:"en"}){ field(name:"TargetHostName"){ value } } }`, { s: `${siteRoot}/Settings/Portal Settings`, g: `${siteRoot}/Settings/Site Grouping/${site}` }).catch(() => null);
  return normalizeHead(d?.s?.field?.value ?? "") || normalizeHead(d?.g?.field?.value ?? "");
}

const unwrap = (res: any) => (res && typeof res === "object" && "data" in res ? res.data : res);

/**
 * In hub mode: find the head from the Page builder context (the open page's site) and set it.
 * `fallback` (e.g. the picker field value's "src") is used when the context gives no site.
 * Returns the head ("" when none was found).
 */
export async function resolveHeadFromHost(client: any, fallback = ""): Promise<string> {
  if (!HUB || head) return head;
  try {
    const ctx: any = unwrap(await client.query("application.context"));
    const access = ctx?.resourceAccess?.[0] ?? ctx?.resources?.[0];
    const contextId = String(access?.context?.preview || access?.context?.live || "");
    const page: any = unwrap(await Promise.race([client.query("pages.context"), new Promise((r) => setTimeout(() => r(null), 3000))]));
    const root = siteRootOf(String(page?.pageInfo?.path ?? ""));
    if (contextId && root) {
      const gql: Gql = async (query, variables = {}) => {
        const body = unwrap(await client.mutate("xmc.authoring.graphql", { params: { query: { sitecoreContextId: contextId }, body: { query, variables } } }));
        if (body?.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
        return body?.data;
      };
      const found = await headForSite(gql, root);
      if (found && setHead(found)) return head;
    }
  } catch { /* fall through */ }
  if (fallback && setHead(fallback)) return head;
  return "";
}
