/**
 * TS build-contract fixups (optional Link, CheckboxField, content.presentation).
 * Run: node --test tools/create-section-components/ai-source-fixup.build-contract.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coerceGetFieldValueLinkImageLocals,
  ensureNarrowedLinkFields,
  ensureNullableDomRootGuards,
  ensureOptionalFieldValueAccess,
  ensureRequiredFieldsProperties,
  narrowIsEditingFieldGuards,
  narrowOptionalPropertyLinkFields,
  normalizeClientTsx,
  normalizeComponentTsx,
  assertAllowedSitecoreFieldTypesInDefinition,
  normalizeDefinitionTs,
  remapOrphanChromeJsxToCompanionImport,
  ensureCompanionClientImport,
  renameReservedSitecoreFieldNames,
  rewriteCheckboxFieldType,
  rewriteGetDatasourceImportPath,
  rewriteCompanionClientImport,
  ensureFieldTypesFromContentSdk,
  stripFieldTypesFromLibComponentPropsImports,
  dedupeUseClientDirective,
  stripUnknownChromeProps,
  stripContentPresentationFromDefinition,
  stripPlaceholdersWhenSingleMode,
  warnSingleModeAppPlaceholder,
} from './ai-source-fixup.mjs';

describe('ensureNarrowedLinkFields / optional props.fields', () => {
  it('wraps <Link field={props.fields?.Link}> so field is defined', () => {
    const src = `
export const Default = (props: Props) => (
  <div>
    <Link
      field={props.fields?.Link}
      className="underline"
      showLinkTextWithChildrenPresent
    >
      <span aria-hidden="true">→</span>
    </Link>
  </div>
);
`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /props\.fields\?\.Link \? \(/);
    assert.match(out, /field=\{props\.fields\.Link\}/);
    assert.doesNotMatch(out, /field=\{props\.fields\?\.Link\}/);
  });

  it('wraps spaced optional Link keys without a dangling dot', () => {
    const src = `<Link field={fields?.["All Reports Link"]} />`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /fields\?\.\["All Reports Link"\] \? \(/);
    assert.match(out, /field=\{fields\["All Reports Link"\]\}/);
    assert.doesNotMatch(out, /fields\.\[/);
  });

  it('wraps self-closing optional Image', () => {
    const src = `<Image field={props.fields?.Image} className="h-24" />`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /props\.fields\?\.Image \? \(/);
    assert.match(out, /field=\{props\.fields\.Image\}/);
  });

  it('is applied by normalizeComponentTsx', () => {
    const src = `
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField } from '@sitecore-content-sdk/nextjs';
interface Fields { Link?: LinkField }
export const Default = (props: { fields?: Fields }) => (
  <Link field={props.fields?.Link} />
);
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /field=\{props\.fields\?\.Link\}/);
    assert.match(out, /field=\{props\.fields\.Link\}/);
    assert.match(out, /interface Fields \{\s*Link:\s*LinkField/);
    assert.doesNotMatch(out, /Link\?:\s*LinkField/);
  });

  it('rewrites (x?.value?.href || isEditing) so Link field is defined', () => {
    const src = `
const allReportsLink = getFieldValue(ds?.allReportsLink) as LinkField | undefined;
{(allReportsLink?.value?.href || isEditing) && (
  <Link field={allReportsLink} className="x" />
)}
`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /allReportsLink && \(allReportsLink\.value\?\.href \|\| isEditing\)/);
    assert.match(out, /emptyLinkField/);
    assert.match(out, /getFieldValue\(ds\?\.allReportsLink\) \?\? emptyLinkField/);
    assert.doesNotMatch(out, /as\s+LinkField\s*\|\s*undefined/);
  });
});

describe('coerceGetFieldValueLinkImageLocals', () => {
  it('replaces multiline LinkField | undefined cast with empty fallback', () => {
    const src = `
const emptyTextField = { value: '' } as TextField;
const allReportsLink = getFieldValue(datasource?.allReportsLink) as
  | LinkField
  | undefined;
export const Default = () => null;
`;
    const out = coerceGetFieldValueLinkImageLocals(src);
    assert.match(out, /emptyLinkField/);
    assert.match(
      out,
      /const allReportsLink = getFieldValue\(datasource\?\.allReportsLink\) \?\? emptyLinkField;/,
    );
  });
});

describe('narrowIsEditingFieldGuards', () => {
  it('truthy-narrows optional locals before isEditing gate', () => {
    const src = `
{(linkField?.value?.href || isEditing) && (
  <Link field={linkField} />
)}
`;
    const out = narrowIsEditingFieldGuards(src);
    assert.match(out, /\{linkField && \(linkField\.value\?\.href \|\| isEditing\) &&/);
  });
});

describe('ensureRequiredFieldsProperties', () => {
  it('strips ? from Fields Content SDK properties', () => {
    const src = `
interface Fields {
  Title: TextField;
  Link?: LinkField;
  'Brand Logo'?: ImageField;
  "Brand Link"?: LinkField;
}
`;
    const out = ensureRequiredFieldsProperties(src);
    assert.match(out, /Link:\s*LinkField/);
    assert.match(out, /'Brand Logo':\s*ImageField/);
    assert.match(out, /"Brand Link":\s*LinkField/);
    assert.doesNotMatch(out, /\?:\s*(?:LinkField|ImageField)/);
  });

  it('does not strip ? on non-Fields interfaces', () => {
    const src = `
interface LinkListChild {
  link?: LinkField;
}
interface Fields {
  Title?: TextField;
}
`;
    const out = ensureRequiredFieldsProperties(src);
    assert.match(out, /link\?:\s*LinkField/);
    assert.match(out, /Title:\s*TextField/);
    assert.doesNotMatch(out, /Title\?:\s*TextField/);
  });

  it('normalizeComponentTsx strips optional Fields props', () => {
    const src = `
import { Link, Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  'Brand Logo'?: ImageField;
  'Brand Link'?: LinkField;
}
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  return (
    <div>
      <Image field={fields['Brand Logo']} />
      <Link field={fields['Brand Link']} />
    </div>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /'Brand Logo':\s*ImageField/);
    assert.match(out, /'Brand Link':\s*LinkField/);
    assert.doesNotMatch(out, /'Brand Logo'\?:\s*ImageField/);
    assert.doesNotMatch(out, /'Brand Link'\?:\s*LinkField/);
  });
});

describe('narrowOptionalPropertyLinkFields / showLink + videoHref', () => {
  it('rewrites showLink boolean + field={fields.Link} to linkField local', () => {
    const src = `
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  Link?: LinkField;
}
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  const showLink = Boolean(fields.Link?.value?.href);
  return showLink ? (
    <Link field={fields.Link} className="group" showLinkTextWithChildrenPresent>
      <span>→</span>
    </Link>
  ) : (
    <div />
  );
};
`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /const linkField = fields\.Link/);
    assert.match(out, /field=\{linkField\}/);
    assert.match(out, /linkField\?\.value\?\.href \?/);
    assert.doesNotMatch(out, /field=\{fields\.Link\}/);
    assert.doesNotMatch(out, /const showLink =/);
  });

  it('rewrites videoHref + field={fields.Video} to videoField local', () => {
    const src = `
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  Video?: LinkField;
}
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  const videoHref =
    typeof fields.Video?.value?.href === 'string' ? fields.Video.value.href : undefined;
  return videoHref ? (
    <Link field={fields.Video} className="absolute inset-0 block">
      child
    </Link>
  ) : (
    <div />
  );
};
`;
    const out = ensureNarrowedLinkFields(src);
    assert.match(out, /const videoField = fields\.Video/);
    assert.match(out, /field=\{videoField\}/);
    assert.match(out, /videoField && videoHref \?/);
    assert.doesNotMatch(out, /field=\{fields\.Video\}/);
  });

  it('is applied by normalizeComponentTsx for FeatureTile-shaped source', () => {
    const src = `
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  Image?: ImageField;
  Link?: LinkField;
}
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  const showImage = Boolean(fields.Image?.value?.src);
  const showLink = Boolean(fields.Link?.value?.href);
  return (
    <article>
      {showImage && <Image field={fields.Image} className="h-12" />}
      {showLink ? (
        <Link field={fields.Link} showLinkTextWithChildrenPresent>
          <Text field={fields.Title} />
        </Link>
      ) : (
        <div><Text field={fields.Title} /></div>
      )}
    </article>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /const linkField = fields\.Link/);
    assert.match(out, /const imageField = fields\.Image/);
    assert.match(out, /field=\{linkField\}/);
    assert.match(out, /field=\{imageField\}/);
    assert.doesNotMatch(out, /field=\{fields\.Link\}/);
    assert.doesNotMatch(out, /field=\{fields\.Image\}/);
    assert.match(out, /Link:\s*LinkField/);
    assert.match(out, /Image:\s*ImageField/);
    assert.doesNotMatch(out, /Link\?:\s*LinkField/);
    assert.doesNotMatch(out, /Image\?:\s*ImageField/);
  });

  it('exports narrowOptionalPropertyLinkFields for direct use', () => {
    const src = `
interface Fields { Link?: LinkField }
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  return <Link field={fields.Link} />;
};
`;
    const out = narrowOptionalPropertyLinkFields(src);
    assert.match(out, /const linkField = fields\.Link/);
    assert.match(out, /field=\{linkField\}/);
  });
});

describe('rewriteCheckboxFieldType', () => {
  it('replaces CheckboxField with Field<boolean> and imports Field', () => {
    const src = `
import { Text, type CheckboxField, type TextField } from "@sitecore-content-sdk/nextjs";
interface Fields {
  Label: TextField;
  Expandable: CheckboxField;
}
`;
    const out = rewriteCheckboxFieldType(src);
    assert.doesNotMatch(out, /CheckboxField/);
    assert.match(out, /Expandable:\s*Field<boolean>/);
    assert.match(out, /\bField\b/);
  });

  it('is applied by normalizeComponentTsx', () => {
    const src = `
import { Text, type CheckboxField, type TextField } from "@sitecore-content-sdk/nextjs";
interface Fields { Expandable: CheckboxField }
export const Default = () => <div />;
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /CheckboxField/);
    assert.match(out, /Field<boolean>/);
  });

  it('strips type CheckboxField = Field<boolean> aliases', () => {
    const src = `
import type { Field, TextField } from "@sitecore-content-sdk/nextjs";
type CheckboxField = Field<boolean>;
interface Fields { Open: CheckboxField; Title: TextField }
`;
    const out = rewriteCheckboxFieldType(src);
    assert.doesNotMatch(out, /type CheckboxField/);
    assert.match(out, /Open:\s*Field<boolean>/);
  });
});

describe('ensureFieldTypesFromContentSdk', () => {
  it('strips Field* from lib/component-props and adds SDK import type', () => {
    const src = `
import React, { JSX } from 'react';
import { Text, Link, Image } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps, Field, LinkField, ImageField } from 'lib/component-props';
interface Fields {
  Heading: Field<string>;
  CTA: LinkField;
  Image: ImageField;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => <div />;
`;
    const stripped = stripFieldTypesFromLibComponentPropsImports(src);
    assert.match(
      stripped,
      /import type \{ ComponentWithContextProps \} from 'lib\/component-props'/,
    );
    assert.doesNotMatch(
      stripped,
      /from 'lib\/component-props'[^;]*\bField\b/,
    );
    const out = ensureFieldTypesFromContentSdk(src);
    assert.match(
      out,
      /import type \{ ComponentWithContextProps \} from 'lib\/component-props'/,
    );
    assert.match(
      out,
      /import type \{[^}]*\bField\b[^}]*\} from '@sitecore-content-sdk\/nextjs'/,
    );
    assert.match(
      out,
      /import type \{[^}]*\bLinkField\b[^}]*\} from '@sitecore-content-sdk\/nextjs'/,
    );
    assert.match(
      out,
      /import type \{[^}]*\bImageField\b[^}]*\} from '@sitecore-content-sdk\/nextjs'/,
    );
    assert.doesNotMatch(
      out,
      /from 'lib\/component-props'[^;\n]*\b(?:Field|LinkField|ImageField)\b/,
    );
  });

  it('adds missing SDK Field import when used with no Field import at all', () => {
    const src = `
import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields { Heading: Field<string> }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => <div />;
`;
    const out = ensureFieldTypesFromContentSdk(src);
    assert.match(
      out,
      /import type \{ Field \} from '@sitecore-content-sdk\/nextjs'/,
    );
  });
});

describe('rewriteGetDatasourceImportPath', () => {
  it('moves getDatasource from SDK to lib/component-props', () => {
    const src = `
import { Text, getDatasource } from '@sitecore-content-sdk/nextjs';
const d = getDatasource(props.fields);
`;
    const out = rewriteGetDatasourceImportPath(src);
    assert.match(out, /import \{ getDatasource \} from 'lib\/component-props'/);
    assert.match(out, /import \{ Text \} from '@sitecore-content-sdk\/nextjs'/);
    assert.doesNotMatch(
      out,
      /import \{[^}]*\bgetDatasource\b[^}]*\} from '@sitecore-content-sdk\/nextjs'/,
    );
  });
});

describe('stripContentPresentationFromDefinition', () => {
  it('removes presentation under component content', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  content: {
    location: { root: "data", folder: ["Cards"] },
    items: [{ name: "One", fields: { Title: "A" } }],
    presentation: {
      children: [{ datasourceItem: "Gartner Recognition", placeholder: "recognition-cards" }],
    },
  },
};
`;
    const out = stripContentPresentationFromDefinition(src);
    assert.doesNotMatch(out, /\bpresentation\s*:/);
    assert.match(out, /items:\s*\[/);
  });

  it('leaves site-presentation definitions alone', () => {
    const src = `
export const sitecorecomPresentation = {
  kind: "site-presentation",
  partialDesigns: [{ presentation: { x: 1 } }],
};
`;
    const out = stripContentPresentationFromDefinition(src);
    assert.match(out, /presentation:\s*\{\s*x:\s*1/);
  });

  it('is applied by normalizeDefinitionTs', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Foos"] },
    items: [{ name: "One", fields: { Title: "A" } }],
    presentation: { children: [{ datasourceItem: "One" }] },
  },
};
`;
    const out = normalizeDefinitionTs(src, { definitionKey: 'foo' });
    assert.doesNotMatch(out, /\bpresentation\s*:/);
  });
});

describe('renameReservedSitecoreFieldNames', () => {
  it('renames Personalization field without touching Personalization Enabled', () => {
    const src = `
  fields: [
    { name: "Personalization", type: "Single-Line Text" },
    { name: "Personalization Enabled", type: "Checkbox" },
  ],
  content: {
    items: [{ fields: { Personalization: "Personalization", "Personalization Enabled": false } }],
  },
`;
    const out = renameReservedSitecoreFieldNames(src);
    assert.match(out, /name:\s*"Personalization Label"/);
    assert.match(out, /name:\s*"Personalization Enabled"/);
    assert.match(out, /"Personalization Label"\s*:/);
    assert.match(out, /"Personalization Enabled"\s*:/);
  });
});

describe('ensureOptionalFieldValueAccess', () => {
  it('rewrites spaced bracket .value to optional chain', () => {
    const src = `target={fields["Open In New Window"].value ? "_blank" : "_self"}`;
    const out = ensureOptionalFieldValueAccess(src);
    assert.match(out, /fields\["Open In New Window"\]\?\.value/);
    assert.doesNotMatch(out, /fields\["Open In New Window"\]\.value/);
  });

  it('rewrites identifier .value and nested value?.text', () => {
    const src = `{fields.Link.value?.text} {fields.Heading.value}`;
    const out = ensureOptionalFieldValueAccess(src);
    assert.match(out, /fields\.Link\?\.value\?\.text/);
    assert.match(out, /fields\.Heading\?\.value/);
  });

  it('rewrites props.fields and is idempotent', () => {
    const src = `props.fields.CTA.value`;
    const once = ensureOptionalFieldValueAccess(src);
    const twice = ensureOptionalFieldValueAccess(once);
    assert.equal(once, 'props.fields.CTA?.value');
    assert.equal(twice, once);
  });

  it('leaves already-optional .value alone', () => {
    const src = `fields["Previous Button Label"]?.value`;
    assert.equal(ensureOptionalFieldValueAccess(src), src);
  });

  it('is applied by normalizeComponentTsx', () => {
    const src = `
import { Link } from '@sitecore-content-sdk/nextjs';
export const Default = (props: { fields: { ["Open In New Window"]?: { value?: boolean } } }) => {
  const { fields } = props;
  return <a target={fields["Open In New Window"].value ? "_blank" : "_self"} href="/" />;
};
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /fields\["Open In New Window"\]\?\.value/);
  });
});

describe('rewriteCompanionClientImport', () => {
  it('rewrites invented short .client paths to ./kebab.client', () => {
    const src = `import ConsentToggleChrome from "./consent-toggle.client";`;
    const out = rewriteCompanionClientImport(
      src,
      'sitecore-consent-preference-toggle',
    );
    assert.match(
      out,
      /from "\.\/sitecore-consent-preference-toggle\.client"/,
    );
    assert.doesNotMatch(out, /consent-toggle\.client/);
  });

  it('rewrites PascalCase invented .client paths to ./kebab.client', () => {
    const src = `import HeaderClient from './CrelanPrimaryNavigationHeader.client';`;
    const out = rewriteCompanionClientImport(
      src,
      'crelan-responsive-navigation-header',
    );
    assert.match(
      out,
      /from '\.\/crelan-responsive-navigation-header\.client'/,
    );
    assert.doesNotMatch(out, /CrelanPrimaryNavigationHeader\.client/);
  });

  it('leaves correct kebab.client imports alone', () => {
    const src = `import Chrome from './sitecore-consent-preference-toggle.client';`;
    const out = rewriteCompanionClientImport(
      src,
      'sitecore-consent-preference-toggle',
    );
    assert.equal(out, src);
  });

  it('is applied by normalizeComponentTsx when kebab is set', () => {
    const src = `
import ConsentToggleChrome from "./consent-toggle.client";
export const Default = () => <ConsentToggleChrome />;
`;
    const out = normalizeComponentTsx(src, {
      kebab: 'sitecore-consent-preference-toggle',
    });
    assert.match(
      out,
      /from "\.\/sitecore-consent-preference-toggle\.client"/,
    );
  });
});

describe('remapOrphanChromeJsxToCompanionImport', () => {
  it('remaps invented Sitecore*Chrome tags and unwraps nested duplicate wraps', () => {
    const src = `
import ResourceCarouselChrome from './sitecore-resource-carousel.client';
export const Default = () => (
  <ResourceCarouselChrome previousLabel="Prev" nextLabel="Next">
    <div className="flex snap-x overflow-x-auto">
      <SitecoreResourceCarouselChrome>
        <AppPlaceholder name="resource-carousel" rendering={r} page={p} componentMap={m} />
      </SitecoreResourceCarouselChrome>
    </div>
  </ResourceCarouselChrome>
);
`;
    const out = remapOrphanChromeJsxToCompanionImport(src);
    assert.doesNotMatch(out, /SitecoreResourceCarouselChrome/);
    assert.match(out, /<ResourceCarouselChrome\b/);
    assert.match(out, /<\/ResourceCarouselChrome>/);
    // Nested duplicate unwrapped — only one open/close pair around AppPlaceholder path
    const opens = out.match(/<ResourceCarouselChrome\b/g) || [];
    assert.equal(opens.length, 1);
    assert.match(out, /AppPlaceholder/);
  });

  it('is applied by normalizeComponentTsx', () => {
    const src = `
import ResourceCarouselChrome from './sitecore-resource-carousel.client';
export const Default = () => (
  <ResourceCarouselChrome>
    <SitecoreResourceCarouselChrome>
      <span>slide</span>
    </SitecoreResourceCarouselChrome>
  </ResourceCarouselChrome>
);
`;
    const out = normalizeComponentTsx(src, {
      kebab: 'sitecore-resource-carousel',
    });
    assert.doesNotMatch(out, /SitecoreResourceCarouselChrome/);
    const opens = out.match(/<ResourceCarouselChrome\b/g) || [];
    assert.equal(opens.length, 1);
  });
});

describe('dedupeUseClientDirective', () => {
  it('collapses two leading use client directives to one', () => {
    const src = `'use client';
'use client';
import { useRef } from 'react';
export default function Chrome() { return null; }
`;
    const out = dedupeUseClientDirective(src);
    const matches = out.match(/^['"]use client['"];?\s*$/gm) || [];
    assert.equal(matches.length, 1);
    assert.match(out, /^'use client';\s*\nimport/);
  });

  it('is applied by normalizeClientTsx', () => {
    const src = `'use client';
'use client';
export default function Chrome() {
  return <div>{null}</div>;
}
`;
    const out = normalizeClientTsx(src);
    const matches = out.match(/['"]use client['"]/g) || [];
    assert.equal(matches.length, 1);
    assert.match(out, /^'use client';/);
  });
});

describe('stripUnknownChromeProps', () => {
  const clientTsx = `'use client';
import type { ReactNode } from 'react';
type SitecoreResourceCarouselChromeProps = {
  children?: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
};
export default function SitecoreResourceCarouselChrome({
  children,
  previousLabel = 'Previous slide',
  nextLabel = 'Next slide',
}: SitecoreResourceCarouselChromeProps) {
  return <div data-prev={previousLabel} data-next={nextLabel}>{children}</div>;
}
`;

  it('strips previousControl/nextControl while keeping previousLabel/nextLabel', () => {
    const tsx = `
import ResourceCarouselChrome from './sitecore-resource-carousel.client';
export const Default = () => (
  <ResourceCarouselChrome
    previousLabel={previousLabel}
    nextLabel={nextLabel}
    previousControl={<Text field={fields['Previous Slide Label']} />}
    nextControl={<Text field={fields['Next Slide Label']} />}
  >
    <AppPlaceholder name="resource-carousel" rendering={r} page={p} componentMap={m} />
  </ResourceCarouselChrome>
);
`;
    const out = stripUnknownChromeProps(tsx, clientTsx);
    assert.match(out, /previousLabel=\{previousLabel\}/);
    assert.match(out, /nextLabel=\{nextLabel\}/);
    assert.doesNotMatch(out, /previousControl/);
    assert.doesNotMatch(out, /nextControl/);
  });

  it('is applied by normalizeComponentTsx when clientTsx option is set', () => {
    const tsx = `
import ResourceCarouselChrome from './sitecore-resource-carousel.client';
export const Default = () => (
  <ResourceCarouselChrome previousLabel="a" previousControl={<span />} nextControl={<span />}>
    <span>ok</span>
  </ResourceCarouselChrome>
);
`;
    const out = normalizeComponentTsx(tsx, {
      kebab: 'sitecore-resource-carousel',
      clientTsx,
    });
    assert.match(out, /previousLabel="a"/);
    assert.doesNotMatch(out, /previousControl/);
    assert.doesNotMatch(out, /nextControl/);
  });
});

describe('single-mode placeholder consistency', () => {
  it('warnSingleModeAppPlaceholder leaves source unchanged', () => {
    const src = `import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = () => <AppPlaceholder name="hero-actions" />;
`;
    const out = warnSingleModeAppPlaceholder(src, { planMode: 'single' });
    assert.equal(out, src);
  });

  it('stripPlaceholdersWhenSingleMode clears placeholders array for leaf TSX', () => {
    const src = `
export const def = {
  placeholders: [{ key: "hero-actions", allowedControls: ["sitecore-technology-hero-action"] }],
  variants: [{ name: "Default" }],
};
`;
    const out = stripPlaceholdersWhenSingleMode(src, {
      tsxSource: 'export const Default = () => <div />;',
    });
    assert.match(out, /placeholders:\s*\[\],/);
    assert.doesNotMatch(out, /hero-actions/);
  });

  it('stripPlaceholdersWhenSingleMode ignores planMode without TSX', () => {
    const src = `
export const def = {
  placeholders: [{ key: "hero-actions", allowedControls: ["x"] }],
};
`;
    const out = stripPlaceholdersWhenSingleMode(src, { planMode: 'single' });
    assert.match(out, /hero-actions/);
  });

  it('stripPlaceholdersWhenSingleMode clears when TSX has no AppPlaceholder (leaf)', () => {
    const src = `
export const def = {
  placeholders: [
    { key: "cookie-option", allowedControls: [] },
    { key: "cookie-options", allowedControls: ["menzis-cookie-option-item"] },
  ],
  variants: [{ name: "Default" }],
};
`;
    const tsx = `
export const Default = () => <div><span>Cookie option</span></div>;
`;
    const out = stripPlaceholdersWhenSingleMode(src, {
      planMode: 'composite',
      tsxSource: tsx,
    });
    assert.match(out, /placeholders:\s*\[\],/);
    assert.doesNotMatch(out, /cookie-options/);
  });

  it('stripPlaceholdersWhenSingleMode keeps placeholders when TSX has AppPlaceholder', () => {
    const src = `
export const def = {
  placeholders: [{ key: "cookie-options", allowedControls: ["menzis-cookie-option"] }],
};
`;
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = () => <AppPlaceholder name="cookie-options" />;
`;
    const out = stripPlaceholdersWhenSingleMode(src, {
      planMode: 'composite',
      tsxSource: tsx,
    });
    assert.match(out, /cookie-options/);
  });

  it('normalizeDefinitionTs strips placeholders when leaf tsxSource (ignores planMode label)', () => {
    const src = `
import type { ComponentTemplateDefinition } from "x";
export const foo = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [{ key: "hero-actions", allowedControls: ["foo-action"] }],
  content: { culture: "en", location: { root: "data", folder: ["Foos"] }, items: [{ name: "Foo", fields: { Title: "Hi" } }] },
} satisfies ComponentTemplateDefinition;
`;
    const out = normalizeDefinitionTs(src, {
      definitionKey: 'foo',
      planMode: 'composite',
      tsxSource: 'export const Default = () => <section />;',
    });
    assert.match(out, /placeholders:\s*\[\],/);
    assert.doesNotMatch(out, /hero-actions/);
  });

  it('normalizeComponentTsx warns path still keeps AppPlaceholder (prompt-first)', () => {
    const src = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = () => (
  <section>
    <AppPlaceholder name="hero-actions" rendering={r} page={p} componentMap={m} />
  </section>
);
`;
    const out = normalizeComponentTsx(src, { planMode: 'single' });
    assert.match(out, /AppPlaceholder/);
  });
});

describe('ensureNullableDomRootGuards', () => {
  it('inserts if (!root) return after optional closest assignment', () => {
    const src = `
useEffect(() => {
  const root = document.querySelector('[data-mobile-menu-toggle]')?.closest('section');
  const button = root?.querySelector<HTMLButtonElement>('[data-mobile-menu-toggle]');
  const panel = root?.querySelector<HTMLElement>('[data-mobile-menu]');
  if (!button || !panel) return;
  const explorer = root.querySelector<HTMLElement>('[data-platform-explorer]');
  explorer?.classList.toggle('hidden', true);
}, []);
`;
    const out = ensureNullableDomRootGuards(src);
    assert.match(out, /closest\('section'\);\s*if \(!root\) return;/);
    assert.match(out, /root\.querySelector<HTMLElement>\('\[data-platform-explorer\]'\)/);
  });

  it('does not double-insert when guard already present', () => {
    const src = `
  const root = document.querySelector('[data-x]')?.closest('section');
  if (!root) return;
  root.querySelector('[data-y]');
`;
    const out = ensureNullableDomRootGuards(src);
    const guards = out.match(/if \(!root\) return;/g) || [];
    assert.equal(guards.length, 1);
  });

  it('is applied by normalizeClientTsx', () => {
    const src = `'use client';
export default function Chrome() {
  useEffect(() => {
    const root = document.querySelector('[data-t]')?.closest('section');
    root.querySelector('[data-m]');
  }, []);
  return null;
}
`;
    const out = normalizeClientTsx(src);
    assert.match(out, /if \(!root\) return;/);
  });
});

describe('assertAllowedSitecoreFieldTypesInDefinition', () => {
  it('accepts allowlisted field types', () => {
    assert.doesNotThrow(() =>
      assertAllowedSitecoreFieldTypesInDefinition(`
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Body", type: "Rich Text" },
          { name: "Logo", type: "Image" },
          { name: "CTA", type: "General Link" },
          { name: "Open", type: "Checkbox" },
          { name: "Notes", type: "Multi-Line Text" },
        ]
      `),
    );
  });

  it('rejects type Array', () => {
    assert.throws(
      () =>
        assertAllowedSitecoreFieldTypesInDefinition(
          `fields: [{ name: "Questions", type: "Array" }]`,
          'faq.definition.ts',
        ),
      /unsupported Sitecore field type|Array|childItemTemplate/i,
    );
  });

  it('normalizeDefinitionTs fails fast on Array', () => {
    const src = `
export const faqDefinition = {
  kind: "component",
  definitionKey: "faq",
  name: "faq",
  displayName: "FAQ",
  componentName: "Faq",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Faqs"] },
  model: {
    folderTemplate: { name: "Faq Folder" },
    itemTemplate: {
      name: "Faq",
      sections: [{ name: "Data", fields: [
        { name: "Heading", type: "Single-Line Text" },
        { name: "Questions", type: "Array" },
      ] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: { location: { root: "data", folder: ["Faqs"] }, items: [] },
};
`;
    assert.throws(
      () => normalizeDefinitionTs(src, { definitionKey: 'faq', skipParseAssert: true }),
      /unsupported Sitecore field type|Array/i,
    );
  });
});

describe('ensureCompanionClientImport', () => {
  it('adds missing .client import for bare FaqChrome (FAQ crash pattern)', () => {
    const tsx = `
import React, { JSX } from 'react';
import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields {
  Question: Field<string>;
  Answer: Field<string>;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => <FaqChrome fields={props.fields} />;
export default Default;
`;
    const clientTsx = `'use client';
import React, { JSX, useState } from 'react';
import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Question: Field<string>;
  Answer: Field<string>;
}
export default function FaqChrome({ fields }: { fields: Fields }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <Text field={fields.Question} />
    </button>
  );
}
`;
    const out = ensureCompanionClientImport(tsx, {
      kebab: 'energyprice-business-faq-item',
      clientTsx,
      componentName: 'EnergypriceBusinessFaqItem',
    });
    assert.match(
      out,
      /import FaqChrome from ['"]\.\/energyprice-business-faq-item\.client['"]/,
    );
    assert.match(out, /<FaqChrome fields=\{props\.fields\} \/>/);
  });

  it('rewrites path and remaps orphan Chrome when import already exists', () => {
    const tsx = `
import WrongChrome from './wrong.client';
export const Default = () => <FaqChrome fields={f} />;
`;
    const clientTsx = `'use client';
export default function FaqChrome() { return null; }
`;
    const out = ensureCompanionClientImport(tsx, {
      kebab: 'energyprice-business-faq-item',
      clientTsx,
      componentName: 'EnergypriceBusinessFaqItem',
    });
    assert.match(
      out,
      /import WrongChrome from ['"]\.\/energyprice-business-faq-item\.client['"]/,
    );
    assert.match(out, /<WrongChrome fields=\{f\} \/>/);
    assert.doesNotMatch(out, /<FaqChrome\b/);
  });

  it('is a no-op when clientTsx is empty', () => {
    const tsx = `export const Default = () => <FaqChrome />;`;
    const out = ensureCompanionClientImport(tsx, {
      kebab: 'energyprice-business-faq-item',
      clientTsx: '',
      componentName: 'EnergypriceBusinessFaqItem',
    });
    assert.equal(out, tsx);
  });
});
