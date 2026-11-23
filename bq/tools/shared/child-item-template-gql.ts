/**
 * Build Json Rendering ComponentQuery for packages with model.childItemTemplate
 * (FAQ / tiles / recognition cards / award badges — not only Link Lists).
 */

export type TemplateFieldRef = { name: string };

function toAlias(fieldName: string): string {
  const cleaned = String(fieldName || '')
    .replace(/[^A-Za-z0-9]+([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, '');
  if (!cleaned) return 'field';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function fieldSelection(fields: TemplateFieldRef[]): string {
  return fields
    .map((f) => {
      const name = String(f.name || '').trim();
      if (!name) return '';
      const alias = toAlias(name);
      return `        ${alias}: field(name: "${name}") {\n          jsonValue\n        }`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Synthesize ComponentQuery: parent fields + children.results with child fields.
 */
export function buildChildItemTemplateComponentQuery(options: {
  parentFields?: TemplateFieldRef[];
  childFields?: TemplateFieldRef[];
  first?: number;
}): string {
  const parentFields = options.parentFields || [];
  const childFields = options.childFields || [];
  const first = Math.max(1, Math.min(200, options.first ?? 90));
  const parentSel = fieldSelection(parentFields);
  const childSel = fieldSelection(childFields);
  const childrenBlock = childSel
    ? `    children(first: ${first}) {
      results {
${childSel}
      }
    }`
    : `    children(first: ${first}) {
      results {
        id
        name
      }
    }`;
  const parentBlock = parentSel ? `${parentSel}\n` : '';
  return `query ChildItemTemplateQuery($datasource: String!, $language: String!) {
  datasource: item(path: $datasource, language: $language) {
${parentBlock}${childrenBlock}
  }
}`;
}

/**
 * Collect { name } from definition model template sections.
 */
export function collectTemplateFieldRefs(
  template:
    | {
        sections?: Array<{
          fields?: Array<{ name?: string }>;
        }>;
      }
    | null
    | undefined,
): TemplateFieldRef[] {
  const out: TemplateFieldRef[] = [];
  for (const section of template?.sections || []) {
    for (const field of section.fields || []) {
      const name = String(field?.name || '').trim();
      if (name) out.push({ name });
    }
  }
  return out;
}
