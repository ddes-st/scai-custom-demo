/**
 * Points a SitecoreAI rendering-host item at an externally hosted editing host (e.g. Vercel):
 *   node tools/register-editing-host.mjs https://portal-scai.vercel.app [hostItemName]
 * Writes ServerSideRenderingEngineEndpointUrl/ConfigUrl/ApplicationUrl on
 * /sitecore/system/Settings/Services/Rendering Hosts/<hostItemName> (default "portal"; created
 * from the "Default" item's template if missing). Auth as in sitecoreai-setup.mjs.
 */
import { readFileSync } from "node:fs";

const [, , baseUrl, hostName = "portal"] = process.argv;
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error("Usage: node tools/register-editing-host.mjs https://<host> [hostItemName]");
const base = baseUrl.replace(/\/$/, "");
const user = JSON.parse(readFileSync(new URL("../.sitecore/user.json", import.meta.url), "utf8"));
const token = user.endpoints?.xmCloud?.accessToken;
// XMC_ENV picks the connected environment by name when several are connected (default: the first).
const envEntry = Object.entries(user.endpoints ?? {}).filter(([k, v]) => k !== "xmCloud" && /sitecorecloud\.io/.test(v.host ?? "")).find(([k]) => !process.env.XMC_ENV || k === process.env.XMC_ENV);
if (!token || !envEntry) throw new Error("Run `dotnet sitecore cloud login` and `cloud environment connect` first.");
const API = envEntry[1].host.replace(/\/$/, "") + "/sitecore/api/authoring/graphql/v1";
async function gql(query, variables = {}) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) });
  const body = await r.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}
const ROOT = "/sitecore/system/Settings/Services/Rendering Hosts";
const fields = [
  { name: "ServerSideRenderingEngineEndpointUrl", value: `${base}/api/editing/render` },
  { name: "ServerSideRenderingEngineConfigUrl", value: `${base}/api/editing/config` },
  { name: "ServerSideRenderingEngineApplicationUrl", value: base },
  { name: "AppName", value: hostName },
];
const existing = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: `${ROOT}/${hostName}` })).item;
if (existing) {
  await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: existing.itemId, language: "en", fields } });
  console.log(`updated ${ROOT}/${hostName} -> ${base}`);
} else {
  const def = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ template { templateId } parent { itemId } } }`, { p: `${ROOT}/Default` })).item;
  await gql(`mutation($i:CreateItemInput!){ createItem(input:$i){ item { itemId } } }`, { i: { name: hostName, parent: def.parent.itemId, templateId: `{${def.template.templateId.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, "$1-$2-$3-$4-$5").toUpperCase()}}`, language: "en", fields } });
  console.log(`created ${ROOT}/${hostName} -> ${base}`);
}
console.log("Now pick this editing host in Channels → Portal → Settings → Site hosts.");
