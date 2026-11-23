/**
 * Run: node --test tools/create-section-components/ensure-jsx-namespace-import.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureJsxNamespaceImport,
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  ensureEqualHeightTrackAroundAppPlaceholder,
  ensurePeerGridAroundAppPlaceholder,
  ensureImageInLinkUsesLinkField,
  stripCrossOriginCssMaskImage,
  rewriteMaskPaintFromSvgMarkup,
  rewritePictureSrcSetToImages,
  ensureImplicitAnyParamsTyped,
  ensureFieldsIndexedAccessTyped,
  ensureListNoneOnLists,
  ensureMapEntryPassesFieldsToCompanion,
  mapEntryImportsCompanionClient,
  parseCompanionClientImportAlias,
  narrowCompanionChromePropsType,
  rewriteFieldsChildrenViaDatasource,
  sourceNeedsJsxNamespaceImport,
} from './ai-source-fixup.mjs';
import { collectCompanionClientContractDiagnostics } from './tsx-contract-diagnostics.mjs';

describe('ensureJsxNamespaceImport', () => {
  it('merges JSX into hooks-only react import', () => {
    const src = `'use client';
import { useState } from 'react';
export default function Chrome(): JSX.Element {
  return null;
}
`;
    assert.equal(sourceNeedsJsxNamespaceImport(src), true);
    const out = ensureJsxNamespaceImport(src);
    assert.match(out, /import \{ useState, JSX \} from 'react'/);
    assert.equal(sourceNeedsJsxNamespaceImport(out), false);
  });

  it('is a no-op when JSX already imported', () => {
    const src = `import React, { JSX } from 'react';
export const Default = (): JSX.Element => null;
`;
    assert.equal(ensureJsxNamespaceImport(src), src);
  });

  it('inserts import when no react import present', () => {
    const src = `export default function Chrome(): JSX.Element {
  return null;
}
`;
    const out = ensureJsxNamespaceImport(src);
    assert.match(out, /import React, \{ JSX \} from 'react'/);
    assert.match(out, /export default function Chrome/);
  });
});

describe('applyWritePathAlwaysOnTsxSanitizers', {
  skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
}, () => {
  it('fixes JSX on client companion', () => {
    const { clientTsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import React from 'react';\nexport const Default = () => null;\n`,
      clientTsx: `'use client';
import { useState } from 'react';
export default function CookieChrome(): JSX.Element {
  const [open, setOpen] = useState(true);
  return <div>{open ? 'x' : null}</div>;
}
`,
    });
    assert.ok(clientTsx);
    assert.match(clientTsx, /JSX/);
    assert.equal(sourceNeedsJsxNamespaceImport(clientTsx), false);
  });

  it('moves getDatasource from SDK to lib/component-props', () => {
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import { Text, getDatasource, getFieldValue } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
export const Default = (props: ComponentWithContextProps) => {
  const datasource = getDatasource(props.fields);
  return <Text field={getFieldValue(datasource?.Heading)} />;
};
`,
    });
    assert.match(tsx, /import \{ getDatasource, getFieldValue \} from 'lib\/component-props'/);
    assert.doesNotMatch(
      tsx,
      /import \{[^}]*\bgetDatasource\b[^}]*\} from '@sitecore-content-sdk\/nextjs'/,
    );
    assert.match(tsx, /import \{ Text \} from '@sitecore-content-sdk\/nextjs'/);
  });

  it('rewrites fields.children via getDatasource without AI', () => {
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import { Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
export const Default = (props: ComponentWithContextProps) => {
  return fields.children.results.map((c) => <Text field={c.fields.Label} />);
};
`,
    });
    assert.doesNotMatch(tsx, /\bfields\.children\b/);
    assert.match(tsx, /getDatasource\(props\.fields\)/);
    assert.match(tsx, /datasource\?\.children/);
    assert.match(tsx, /import \{ getDatasource \} from 'lib\/component-props'/);
  });
});

describe('companion import with named type binding', () => {
  const tsx = `import React, { JSX } from 'react';
import CookieClient, { type CookieFields } from './menzis-cookie-preference-modal.client';
export const Default = (props: { fields: CookieFields }): JSX.Element => (
  <CookieClient fields={props.fields} />
);
`;

  it('mapEntryImportsCompanionClient accepts default + type import', () => {
    assert.equal(mapEntryImportsCompanionClient(tsx), true);
    assert.equal(parseCompanionClientImportAlias(tsx), 'CookieClient');
  });

  it('does not CONTRACT-flag default + type companion import', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: `'use client';\nexport default function CookieClient() { return null; }\nexport type CookieFields = {};\n`,
      kebab: 'menzis-cookie-preference-modal',
    });
    assert.ok(
      !diags.some((d) => /must import the companion/i.test(d)),
      `unexpected companion CONTRACT: ${diags.join(' | ')}`,
    );
  });
});

describe('ensureFieldsIndexedAccessTyped', () => {
  it('adds keyof cast for fields[option.label]', () => {
    const src = `const x = fields[option.label];
const y = <Text field={fields[option.help]} />;
`;
    const out = ensureFieldsIndexedAccessTyped(src);
    assert.match(out, /fields\[option\.label as keyof typeof fields\]/);
    assert.match(out, /fields\[option\.help as keyof typeof fields\]/);
  });
});

describe('always-on spaced fields + Image-in-Link + mask/picture', () => {
  it('spaces ImageLeft / CardLink Fields and access without AI', {
    skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  }, () => {
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Heading: Field<string>;
  Image: ImageField;
  CardLink: LinkField;
  ImageLeft: Field<boolean>;
}
export const Default = (props: { fields: Fields }) => (
  <>
    <Link field={props.fields.CardLink}><Image field={props.fields.Image} /></Link>
    {props.fields.ImageLeft?.value ? 'L' : 'R'}
  </>
);
`,
    });
    assert.match(tsx, /"Card Link"\s*:\s*LinkField/);
    assert.match(tsx, /"Image Left"\s*:\s*Field/);
    assert.match(tsx, /fields\["Card Link"\]/);
    assert.match(tsx, /fields\["Image Left"\]/);
  });

  it('ensurePeerGridAroundAppPlaceholder adds lg:grid-cols-3', () => {
    const src = `export const Default = () => (
  <div className="w-full">
    <AppPlaceholder name={ph} rendering={r} page={p} componentMap={m} />
  </div>
);
`;
    const out = ensurePeerGridAroundAppPlaceholder(src, {
      layout: { columnsMax: 3, cardCount: 3 },
    });
    assert.match(out, /lg:grid-cols-3/);
    assert.match(out, /\bgrid\b/);
  });

  it('ensurePeerGrid wraps first AP only when multiple placeholders', () => {
    const src = `export const Default = () => (
  <main className="grid w-full">
    <AppPlaceholder name={a} rendering={r} page={p} componentMap={m} />
    <AppPlaceholder name={b} rendering={r} page={p} componentMap={m} />
  </main>
);
`;
    const out = ensurePeerGridAroundAppPlaceholder(src, {
      layout: { columnsMax: 3 },
    });
    assert.match(out, /<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">/);
    assert.match(out, /name=\{a\}/);
    assert.doesNotMatch(out, /main className="[^"]*lg:grid-cols-3/);
  });

  it('stripCrossOriginCssMaskImage clears url(https) maskImage', () => {
    const src = `const x = {
  WebkitMaskImage: mobileMask ? \`url(\${mobileMask})\` : undefined,
  maskImage: 'url(https://www.menzis.nl/mask.svg)',
  WebkitMaskSize: '100% 100%',
  backgroundImage: desktopMask ? \`url(\${desktopMask})\` : undefined,
};`;
    const out = stripCrossOriginCssMaskImage(src);
    assert.match(out, /maskImage:\s*undefined/);
    assert.match(out, /WebkitMaskImage:\s*undefined/);
    assert.match(out, /WebkitMaskSize:\s*'100% 100%'/);
    assert.match(out, /backgroundImage/);
    assert.doesNotMatch(out, /undefined\}\)/);
  });

  it('rewritePictureSrcSetToImages keeps SDK Image', () => {
    const src = `const heroImage = getImageSrc(fields['Hero Image']);
const heroImageTablet = getImageSrc(fields['Hero Image Tablet']);
<picture>
  <source media="(min-width: 768px)" srcSet={heroImage} />
  <source media="(min-width: 541px)" srcSet={heroImageTablet} />
  <Image field={fields['Hero Image']} className="w-full" />
</picture>`;
    const out = rewritePictureSrcSetToImages(src);
    assert.match(out, /<Image field=\{fields\['Hero Image'\]\}/);
    assert.match(out, /<Image field=\{fields\['Hero Image Tablet'\]\}/);
    assert.doesNotMatch(out, /<picture/);
    assert.doesNotMatch(out, /<source/);
  });

  it('ensureImageInLinkUsesLinkField remaps CardLink', () => {
    const out = ensureImageInLinkUsesLinkField(
      `<Link field={fields.CardLink}><Image field={fields.Image} /></Link>`,
    );
    assert.match(out, /fields\["Card Link"\]/);
  });

  it('rewriteMaskPaintFromSvgMarkup keeps CORS-safe data-URI after strip', () => {
    const def = `content: { items: [{ fields: {
      'Mobile Mask': { svgMarkup: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><path d=\\"M0 0h1v1z\\"/></svg>", alt: '' },
    }}]}`;
    const src = `const mobileMask = getImageSrc(fields['Mobile Mask']);
export const Default = () => (
  <div style={{ maskImage: mobileMask ? \`url(\${mobileMask})\` : undefined, WebkitMaskImage: mobileMask ? \`url(\${mobileMask})\` : undefined }} />
);
`;
    const painted = rewriteMaskPaintFromSvgMarkup(src, def);
    const out = stripCrossOriginCssMaskImage(painted);
    assert.match(out, /__maskSvgDataUri_/);
    assert.match(out, /data:image\/svg\+xml/);
    assert.match(out, /xmlns%3D%22http/);
    assert.doesNotMatch(out, /maskImage:\s*undefined/);
  });

  it('always-on clears spaced/mask/picture without needing repairFn shape', {
    skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  }, () => {
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import { Image, Link } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Image: ImageField;
  CardLink: LinkField;
  ImageLeft: Field<boolean>;
  'Hero Image': ImageField;
}
const heroImage = getImageSrc(fields['Hero Image']);
export const Default = (props: { fields: Fields }) => (
  <>
    <Link field={props.fields.CardLink}><Image field={props.fields.Image} /></Link>
    <picture><source media="(min-width: 768px)" srcSet={heroImage} /><Image field={props.fields['Hero Image']} /></picture>
    <div style={{ maskImage: 'url(https://cdn.example/mask.svg)' }} />
  </>
);
`,
      sectionInfo: { layout: { columnsMax: 3 } },
    });
    assert.match(tsx, /fields\["Card Link"\]/);
    assert.match(tsx, /"Image Left"/);
    assert.doesNotMatch(tsx, /maskImage:\s*'url\(https:/);
    assert.doesNotMatch(tsx, /<source/);
  });
});

describe('ensureImplicitAnyParamsTyped', () => {
  it('types bare .map(column => with MenuColumn when interface present', () => {
    const src = `interface MenuColumn { title: string }
interface MenuGroup { columns: MenuColumn[] }
groups[expanded].columns.map(column => <div key={column.title} />)`;
    const out = ensureImplicitAnyParamsTyped(src);
    assert.match(out, /\.columns\.map\(\(column: MenuColumn\) =>/);
    assert.doesNotMatch(out, /\.map\(column =>/);
  });

  it('upgrades (item: any, index) on .links.map to LinkItem', () => {
    const src = `interface LinkItem { label: string }
const LinkList = ({ links }: { links: LinkItem[] }) => (
  <ul>{links.map((item: any, index: number) => <li key={index}>{item.label}</li>)}</ul>
);`;
    const out = ensureImplicitAnyParamsTyped(src);
    assert.match(out, /links\.map\(\(item: LinkItem, index: number\) =>/);
    assert.doesNotMatch(out, /item: any/);
  });

  it('always-on clientTsx clears HeaderNavigation-shaped bare map without repairFn', {
    skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  }, () => {
    const { clientTsx } = applyWritePathAlwaysOnTsxSanitizers({
      clientTsx: `'use client';
interface MenuColumn { title: string; links: { label: string }[] }
interface MenuGroup { label: string; columns: MenuColumn[] }
export default function C({ fields }: { fields: { x: string } }) {
  const groups = [] as MenuGroup[];
  return groups.map((group: any, index: number) =>
    group.columns.map(column => <div key={column.title}>{column.title}</div>),
  );
}
`,
    });
    assert.match(clientTsx || '', /columns\.map\(\(column: MenuColumn\) =>/);
    assert.match(clientTsx || '', /groups\.map\(\(group: MenuGroup, index: number\) =>/);
    assert.doesNotMatch(clientTsx || '', /\.map\(column =>/);
    assert.doesNotMatch(clientTsx || '', /group: any/);
  });
});

describe('ensureEqualHeightTrackAroundAppPlaceholder', () => {
  const sectionInfo = {
    layout: {
      equalHeightChildren: true,
      equalHeightEvidence: 'peer cards share one row height',
      pattern: 'card-grid',
    },
  };

  it('adds items-stretch and [&>*]:h-full on parent track', () => {
    const src = `export const Default = () => (
  <div className="grid gap-4">
    <AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
  </div>
);
`;
    const out = ensureEqualHeightTrackAroundAppPlaceholder(src, sectionInfo);
    assert.match(out, /items-stretch/);
    assert.match(out, /\[&>\*\]:h-full/);
  });

  it('is a no-op when stretch + fill already present', () => {
    const src = `export const Default = () => (
  <div className="grid items-stretch [&>*]:h-full gap-4">
    <AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
  </div>
);
`;
    assert.equal(
      ensureEqualHeightTrackAroundAppPlaceholder(src, sectionInfo),
      src,
    );
  });
});

describe('ensureListNoneOnLists', () => {
  it('adds list-none to ternary className branches', () => {
    const src = `export default function C() {
  return <ul className={desktop ? 'flex gap-1' : 'border-t'}><li>a</li></ul>;
};
`;
    const out = ensureListNoneOnLists(src);
    assert.match(out, /list-none flex gap-1/);
    assert.match(out, /list-none border-t/);
  });

  it('adds list-none on bare li roots without a wrapping ul', () => {
    const src = `export const Default = () => (
  <>
    <li key="1"><a href="/a">A</a></li>
  </>
);
`;
    const out = ensureListNoneOnLists(src);
    assert.match(out, /<li[^>]*\blist-none\b/);
  });
});

describe('ensureMapEntryPassesFieldsToCompanion', () => {
  it('injects fields={props.fields} when chrome tag omits fields', () => {
    const tsx = `import Chrome from './cookie.client';
export const Default = (props: Props) => {
  return <Chrome />;
};
`;
    const client = `type Props = { fields: Fields };
export default function Chrome({ fields }: Props) { return null; }
`;
    const out = ensureMapEntryPassesFieldsToCompanion(tsx, client);
    assert.match(out, /<Chrome\s+fields=\{props\.fields\}\s*\/>/);
  });
});

describe('narrowCompanionChromePropsType', () => {
  it('drops ComponentWithContextProps from companion Props', () => {
    const src = `import type { ComponentWithContextProps } from 'lib/component-props';
type Props = ComponentWithContextProps & { fields: Fields; children?: ReactNode };
export default function Chrome({ fields, children }: Props) { return null; }
`;
    const out = narrowCompanionChromePropsType(src);
    assert.match(out, /type Props = \{ fields: Fields; children\?: ReactNode \};/);
    assert.doesNotMatch(out, /ComponentWithContextProps/);
  });
});

describe('rewriteFieldsChildrenViaDatasource', () => {
  it('adds getDatasource + rewrites fields.children?.results', () => {
    const src = `import { Text } from '@sitecore-content-sdk/nextjs';
export const Default = (props: Props) => {
  return fields.children?.results.map((c) => <Text field={c.fields.Label} />);
};
`;
    const out = rewriteFieldsChildrenViaDatasource(src);
    assert.match(out, /const datasource = getDatasource\(props\.fields\);/);
    assert.match(out, /datasource\?\.children\?\.results/);
    assert.doesNotMatch(out, /\bfields\.children\b/);
    assert.match(out, /import \{ getDatasource \} from 'lib\/component-props'/);
  });

  it('is a no-op when already using getDatasource + datasource.children', () => {
    const src = `import { getDatasource } from 'lib/component-props';
export const Default = (props: Props) => {
  const datasource = getDatasource(props.fields);
  return datasource?.children?.results ?? [];
};
`;
    assert.equal(rewriteFieldsChildrenViaDatasource(src), src);
  });

  it('rewrites fields.children when datasource binding already exists', () => {
    const src = `import { getDatasource } from 'lib/component-props';
export const Default = (props: Props) => {
  const datasource = getDatasource(props.fields);
  return fields.children?.results ?? [];
};
`;
    const out = rewriteFieldsChildrenViaDatasource(src);
    assert.match(out, /datasource\?\.children\?\.results/);
    assert.doesNotMatch(out, /\bfields\.children\b/);
  });
});
