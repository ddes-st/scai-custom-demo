/**
 * An in-memory stand-in for the SitecoreAI Authoring GraphQL API, just enough for the portal setup
 * core (src/lib/portal/setup/core.mjs): items by path / id with versioned fields per language,
 * children, createItem / updateItem / createItemTemplate / addItemVersion / deleteItem /
 * publishItem. It answers by pattern, not by parsing GraphQL — a superset of what each query asks.
 * Counts every call, for the setup's cost per run.
 */
import { randomUUID } from "node:crypto";

interface Item { id: string; name: string; parent: string | null; template: string; shared: Map<string, string>; langs: Map<string, Map<string, string>> }

// "{A1B2…}", "a1b2-…" and the API's own dashless "a1b2…" are the same id
const norm = (id: string) => { const h = id.replace(/[{}-]/g, "").toUpperCase(); return /^[0-9A-F]{32}$/.test(h) ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : id.replace(/[{}]/g, "").toUpperCase(); };
const SHARED_FIELDS = /^(__Renderings|__Masters|__Display name|__Sortorder|Type|Title|Source|Shared|componentName|Datasource Template|Datasource Location|Parameters Template|__Base template|__Long description|Key|SetupState|PortalHead|StartItem|TargetHostName)$/;

export function fakeXmc(collection: string, site: string) {
  const items = new Map<string, Item>();
  const calls: Record<string, number> = {};
  const count = (k: string) => { calls[k] = (calls[k] ?? 0) + 1; };

  const add = (name: string, parentId: string | null, template = "{1930BBEB-7805-471A-A3BE-4858AC7CF696}", fields: Record<string, string> = {}, lang = "en") => {
    const id = norm(randomUUID());
    const it: Item = { id, name, parent: parentId, template, shared: new Map(), langs: new Map([[lang, new Map()]]) };
    for (const [k, v] of Object.entries(fields)) (SHARED_FIELDS.test(k) ? it.shared : it.langs.get(lang)!).set(k, v);
    items.set(id, it);
    return it;
  };
  const children = (id: string) => [...items.values()].filter((i) => i.parent === id);
  const pathOf = (it: Item): string => (it.parent ? `${pathOf(items.get(it.parent)!)}/${it.name}` : `/${it.name}`);
  const byPath = (path: string): Item | null => {
    const parts = path.split("/").filter(Boolean);
    let cur = [...items.values()].find((i) => i.parent === null && i.name.toLowerCase() === parts[0]?.toLowerCase()) ?? null;
    for (const p of parts.slice(1)) { if (!cur) return null; cur = children(cur.id).find((c) => c.name.toLowerCase() === p.toLowerCase()) ?? null; }
    return cur;
  };
  const ensurePath = (path: string, template?: string, fields?: Record<string, string>) => {
    const parts = path.split("/").filter(Boolean);
    let cur = null as Item | null;
    for (let i = 0; i < parts.length; i++) {
      const found: Item | undefined = cur ? children(cur.id).find((c) => c.name === parts[i]) : [...items.values()].find((x) => x.parent === null && x.name === parts[i]);
      cur = found ?? add(parts[i], cur?.id ?? null, i === parts.length - 1 ? template : undefined, i === parts.length - 1 ? fields : {});
    }
    return cur!;
  };

  // the environment the setup expects to find
  ensurePath("sitecore/system/Languages");
  ensurePath("sitecore/templates/System/Dictionary/Dictionary folder");
  ensurePath("sitecore/templates/System/Dictionary/Dictionary entry");
  ensurePath(`sitecore/templates/Project/${collection}/Page/__Standard Values`, undefined, { __Renderings: '<r><d id="{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}" l="{96E5F4BA-A2CF-4A4C-A4E7-64DA88226362}" /></r>' });
  ensurePath(`sitecore/layout/Renderings/Project/${collection}`);
  const addSite = (name: string) => {
    for (const p of ["Home", "Settings", `Settings/Site Grouping/${name}`, "Data", "Presentation/Available Renderings", "Dictionary"]) ensurePath(`sitecore/content/${collection}/${name}/${p}`);
    // a Home made by the site template: the setup recreates it as a Portal Home Page
  };
  addSite(site);

  const fieldsFor = (it: Item, lang: string, standard: boolean) => {
    const out = new Map<string, string>(it.shared);
    for (const [k, v] of it.langs.get(lang) ?? []) out.set(k, v);
    return [...out.entries()].filter(([k]) => standard || !k.startsWith("__")).map(([name, value]) => ({ name, value }));
  };
  const view = (it: Item | null, lang: string, q: string) => {
    if (!it) return null;
    const has = it.langs.has(lang);
    return {
      itemId: it.id.toLowerCase().replace(/-/g, ""), name: it.name, path: pathOf(it), version: has ? 1 : 0,
      template: { templateId: it.template }, parent: it.parent ? { itemId: it.parent } : null,
      fields: has || it.shared.size ? { nodes: fieldsFor(it, lang, !/excludeStandardFields:true/.test(q)) } : null,
      children: { nodes: children(it.id).map((c) => ({ name: c.name, path: pathOf(c), itemId: c.id.toLowerCase().replace(/-/g, ""), fields: { nodes: fieldsFor(c, lang, false) } })) },
    };
  };
  const setFields = (it: Item, lang: string, fields: Array<{ name: string; value: string }>) => {
    if (!it.langs.has(lang)) it.langs.set(lang, new Map());
    for (const f of fields) (SHARED_FIELDS.test(f.name) ? it.shared : it.langs.get(lang)!).set(f.name, String(f.value));
  };

  const gql = async (query: string, variables: Record<string, any> = {}) => {
    if (/^\s*mutation/.test(query)) {
      const i = variables.i ?? {};
      if (/createItemTemplate/.test(query)) {
        count("createItemTemplate");
        const parent = items.get(norm(i.parent))!;
        const tpl = add(i.name, parent.id, "{AB86861A-6030-46C5-B394-E8F99E8B87DB}", { "__Base template": (i.baseTemplates ?? []).join("|") });
        for (const sec of i.sections ?? []) {
          const s = add(sec.name, tpl.id, "{E269FBB5-3750-427A-9149-7AA950B49301}");
          for (const f of sec.fields ?? []) add(f.name, s.id, "{455A3E98-A627-4B40-8035-E683A0331AC7}", { Type: f.type ?? "", Title: f.title ?? "", ...(f.source ? { Source: f.source } : {}) });
        }
        if (i.createStandardValuesItem) add("__Standard Values", tpl.id, tpl.id);
        return { createItemTemplate: { itemTemplate: { templateId: tpl.id } } };
      }
      if (/createItem\(/.test(query)) {
        count("createItem");
        const parent = items.get(norm(i.parent));
        if (!parent) throw new Error(`parent ${i.parent} missing`);
        const it = add(i.name, parent.id, i.templateId ?? "", {}, i.language ?? "en");
        setFields(it, i.language ?? "en", i.fields ?? []);
        return { createItem: { item: { itemId: it.id } } };
      }
      if (/updateItem/.test(query)) { count("updateItem"); const it = items.get(norm(i.itemId)); if (it) setFields(it, i.language ?? "en", i.fields ?? []); return { updateItem: { item: { itemId: i.itemId } } }; }
      if (/addItemVersion/.test(query)) { count("addItemVersion"); const it = items.get(norm(i.itemId)); if (it && !it.langs.has(i.language)) it.langs.set(i.language, new Map()); return { addItemVersion: { item: { version: 1 } } }; }
      if (/deleteItem/.test(query)) { count("deleteItem"); items.delete(norm(i.itemId)); return { deleteItem: { successful: true } }; }
      if (/publishItem/.test(query)) { count("publishItem"); return { publishItem: { operationId: "op" } }; }
      throw new Error(`unhandled mutation: ${query.slice(0, 80)}`);
    }
    count("query");
    const out: Record<string, unknown> = {};
    const re = /(?:(\w+)\s*:\s*)?item\(where:\{(?:path:\$(\w+)|itemId:\$(\w+))(?:,\s*language:(?:"([\w-]+)"|\$(\w+)))?\}\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(query))) {
      const [, alias, pathVar, idVar, langLit, langVar] = m;
      const lang = langLit ?? (langVar ? variables[langVar] : "en");
      const it = pathVar ? byPath(String(variables[pathVar] ?? "")) : items.get(norm(String(variables[idVar!] ?? "")));
      out[alias ?? "item"] = view(it ?? null, lang, query);
    }
    return out;
  };

  return { gql, calls, items, byPath, addSite, total: () => Object.values(calls).reduce((a, b) => a + b, 0), reset: () => { for (const k of Object.keys(calls)) delete calls[k]; } };
}
