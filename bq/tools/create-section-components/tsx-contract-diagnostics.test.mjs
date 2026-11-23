/**
 * Run: node --test tools/create-section-components/tsx-contract-diagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectCompanionClientPropsSpread,
  detectDuplicateUseClient,
  detectOrphanChromeJsx,
  detectUnknownChromeProps,
} from './ai-source-fixup.mjs';
import { BQ_LINK_LIST_AS_COMPOSITE } from '../shared/bq-env.mjs';
import {
  clientTsxHasFatChromeProps,
  collectClassNameTemplateLiteralContractDiagnostics,
  collectCompanionClientContractDiagnostics,
  collectDefinitionApostropheContractDiagnostics,
  collectHardcodedCaptureImageUrlDiagnostics,
  collectInteractionStateContractDiagnostics,
  collectLinkListJsonBagContractDiagnostics,
  collectTsxContractDiagnostics,
  collectFieldTypesImportedFromLibComponentProps,
  collectTsxImportChromePropsContractDiagnostics,
  findLinkShapedJsonBagFields,
  findTextOnLinkFieldNames,
  isImageRowRepeat,
  mapEntryHasClientHooksOrHandlers,
  resolveImageRowSeedNeed,
  sourceHasLeadingUseClient,
  sourceMissingJsxImport,
} from './tsx-contract-diagnostics.mjs';

const SERVER_WITH_CLIENT_IMPORT = `
import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import CookiePreferenceModalChrome from './crelan-cookie-preference-modal.client';

export const Default = (props) => (
  <CookiePreferenceModalChrome fields={props.fields}>
    <AppPlaceholder name="cookie-categories" rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </CookiePreferenceModalChrome>
);
`;

const GOOD_CLIENT_CHROME = `'use client';
import type { ReactNode } from 'react';
export default function CookiePreferenceModalChrome({
  children,
  fields,
}: {
  children?: ReactNode;
  fields?: unknown;
}) {
  return <div>{children}</div>;
}
`;

const BAD_CLIENT_WITH_PH = `'use client';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
export default function CookiePreferenceModalChrome(props) {
  return <AppPlaceholder name="x" rendering={props.rendering} page={props.page} componentMap={componentMap} />;
}
`;

const FOOTER_COLUMN_BAG_DEF = `
export const crelanFooterColumnDefinition = {
  definitionKey: "crelan-footer-column",
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Links', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  placeholders: [],
  content: {
    items: [{
      name: 'Ons aanbod',
      fields: {
        Heading: 'Ons aanbod',
        Links: '[{"text":"Beleggen","url":"https://www.crelan.be/nl/particulieren/sparen-en-beleggen/beleggen"},{"text":"Betalen","url":"https://www.crelan.be/nl/particulieren/betalen"}]',
      },
    }],
  },
};
`;

const FOOTER_COLUMN_COMPOSITE_DEF = `
export const crelanFooterColumnDefinition = {
  definitionKey: "crelan-footer-column",
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
        ],
      }],
    },
  },
  placeholders: [{ key: 'crelan-footer-column-links', allowedControls: ['crelan-footer-column-link-item'] }],
  content: {
    items: [{ name: 'Ons aanbod', fields: { Heading: 'Ons aanbod' } }],
  },
};
`;

const HEADING_ONLY_TSX = `
import { Text } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => {
  const fields = props.fields || {};
  return <h2><Text field={fields.Heading} /></h2>;
};
`;

const BAG_PAINT_TSX = `
import { Text } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => {
  const fields = props.fields || {};
  const links = (() => {
    try {
      const raw = fields.Links?.value;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })() as { text?: string; url?: string }[];
  return (
    <div>
      <h2><Text field={fields.Heading} /></h2>
      <ul>
        {links.map((link, index) => (
          <li key={index}><a href={link.url || '#'}>{link.text || ''}</a></li>
        ))}
      </ul>
    </div>
  );
};
`;

const MENU_STATE_INFO = {
  interactionStates: [
    {
      kind: 'menu',
      slug: 'menu-open',
      trigger: { selector: '#mobile-menu-anchor', method: 'click' },
      panel: { selector: '#mobile-menu' },
      narrowOnly: true,
    },
  ],
};

describe('detectCompanionClientPropsSpread', () => {
  it('flags {...props} into .client companion', () => {
    const src = `
import NavigationClient from './crelan-responsive-navigation-header.client';
export const Default = (props) => <NavigationClient {...props} />;
`;
    const diags = detectCompanionClientPropsSpread(src);
    assert.ok(diags.some((d) => /\{\.\.\.props\}/.test(d) && /componentMap/i.test(d)));
  });

  it('allows fields-only pass-through', () => {
    const src = `
import NavigationClient from './crelan-responsive-navigation-header.client';
export const Default = (props) => <NavigationClient fields={props.fields} />;
`;
    assert.deepEqual(detectCompanionClientPropsSpread(src), []);
  });
});

describe('detectOrphanChromeJsx', () => {
  it('reports orphan Chrome tags without rewriting', () => {
    const src = `
import FooChrome from './foo.client';
export const Default = () => (
  <BarChrome>
    <FooChrome>hi</FooChrome>
  </BarChrome>
);
`;
    const before = src;
    const diags = detectOrphanChromeJsx(src);
    assert.equal(src, before);
    assert.ok(diags.some((d) => /orphan Chrome/.test(d) && /BarChrome/.test(d)));
  });
});

describe('detectDuplicateUseClient', () => {
  it('flags duplicate use client', () => {
    const src = `'use client';\n'use client';\nexport const Default = () => null;\n`;
    const diags = detectDuplicateUseClient(src);
    assert.ok(diags.some((d) => /duplicate 'use client'/.test(d)));
  });
});

describe('detectUnknownChromeProps', () => {
  it('flags props not on companion', () => {
    const client = `
export default function FooChrome({ children }: { children?: React.ReactNode }) {
  return <div>{children}</div>;
}
`;
    const tsx = `
import FooChrome from './foo.client';
export const Default = () => <FooChrome inventedProp={1}>x</FooChrome>;
`;
    const diags = detectUnknownChromeProps(tsx, client);
    assert.ok(diags.some((d) => /inventedProp/.test(d)));
  });
});

describe('collectTsxContractDiagnostics', () => {
  it('does not flag xl: density utilities (evidence-first breakpoints)', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: `export const Default = () => <div className="py-6 lg:py-8 xl:py-10 xl:w-[40%]" />;`,
    });
    assert.ok(!diags.some((d) => /found xl:|use lg: for desktop/.test(d)));
  });

  it('does not rewrite source', () => {
    const tsx = `export const Default = () => <div className="xl:flex" />;`;
    const copy = tsx;
    collectTsxContractDiagnostics({ tsx });
    assert.equal(tsx, copy);
  });

  it('does not treat Link url seeds as IMAGE ROW SEEDS for non-image childItemTemplate', () => {
    const definitionTs = `
export const def = {
  model: {
    itemTemplate: { sections: [{ fields: [{ name: "Privacy", type: "General Link" }] }] },
    childItemTemplate: {
      sections: [{ fields: [
        { name: "Label", type: "Single-Line Text" },
        { name: "Enabled", type: "Checkbox" },
      ] }],
    },
  },
  content: { items: [{
    fields: { Privacy: { text: "Privacy", url: "https://example.com/privacy" } },
    children: [
      { name: "A", fields: { Label: "A", Enabled: false } },
      { name: "B", fields: { Label: "B", Enabled: false } },
      { name: "C", fields: { Label: "C", Enabled: false } },
    ],
  }] },
};
`;
    const diags = collectTsxContractDiagnostics({
      tsx: `export const Default = () => <div />;`,
      definitionTs,
      sectionInfo: {
        repeats: [
          {
            name: 'consentCategories',
            count: 3,
            whatRepeats: 'Configurable cookie categories as switches',
            fields: [
              { name: 'label', type: 'text' },
              { name: 'enabled', type: 'boolean' },
            ],
          },
        ],
      },
    });
    assert.ok(
      !diags.some((d) => /IMAGE ROW SEEDS/.test(d)),
      diags.join('\n'),
    );
  });

  it('flags under-seeded Image childItemTemplate rows', () => {
    const definitionTs = `
export const def = {
  model: {
    childItemTemplate: {
      sections: [{ fields: [{ name: "Logo", type: "Image" }] }],
    },
  },
  content: { items: [{
    children: [
      { name: "One", fields: { Logo: { url: "https://cdn.example/a.png", alt: "A" } } },
    ],
  }] },
};
`;
    const diags = collectTsxContractDiagnostics({
      tsx: `export const Default = () => <div />;`,
      definitionTs,
      sectionInfo: {
        repeats: [
          {
            name: 'partnerLogos',
            count: 3,
            fields: [{ name: 'image', type: 'image' }],
          },
        ],
      },
    });
    assert.ok(diags.some((d) => /IMAGE ROW SEEDS \(3\).*1 Image/.test(d)), diags.join('\n'));
  });

  it('does not treat icon-only valuePropositions as image-row repeats', () => {
    const valuePropositions = {
      name: 'valuePropositions',
      count: 4,
      fields: [
        { name: 'icon', type: 'icon' },
        { name: 'title', type: 'richText' },
        { name: 'description', type: 'richText' },
      ],
      value: [
        { icon: 'people', title: 'Welcome', description: 'Everyone' },
        { icon: 'heart', title: 'Care', description: 'Health' },
        { icon: 'home', title: 'Home', description: 'Local' },
        { icon: 'star', title: 'Quality', description: 'Rated' },
      ],
    };
    assert.equal(isImageRowRepeat(valuePropositions), false);

    const healthCards = {
      name: 'healthCards',
      count: 3,
      fields: [
        { name: 'image', type: 'image' },
        { name: 'title', type: 'text' },
        { name: 'description', type: 'multiline' },
        { name: 'link', type: 'link' },
      ],
      value: [
        {
          image: {
            src: 'https://cdn.example/sleep.jpg',
            alt: 'Sleep',
          },
          title: 'Sleep',
        },
        {
          image: {
            src: 'https://cdn.example/therapieland.jpg',
            alt: 'Therapieland',
          },
          title: 'Therapieland',
        },
        {
          image: {
            src: 'https://cdn.example/waiting.jpg',
            alt: 'Waiting',
          },
          title: 'Waiting',
        },
      ],
    };
    assert.equal(isImageRowRepeat(healthCards), true);
    assert.equal(
      resolveImageRowSeedNeed([
        {
          name: 'serviceCards',
          count: 3,
          fields: [
            { name: 'title', type: 'text' },
            { name: 'links', type: 'array' },
          ],
        },
        healthCards,
        valuePropositions,
      ]),
      3,
    );
  });

  it('clears IMAGE ROW SEEDS when healthCards need=3 and definition has 3 Image seeds amid icon repeats', () => {
    const definitionTs = `
export const def = {
  model: {
    childItemTemplate: {
      sections: [{ fields: [
        { name: "Image", type: "Image" },
        { name: "Heading", type: "Single-Line Text" },
      ] }],
    },
  },
  content: { items: [{
    children: [
      { name: "Sleep", fields: { Image: { url: "https://cdn.example/sleep.jpg", alt: "Sleep" }, Heading: "Sleep" } },
      { name: "Therapieland", fields: { Image: { url: "https://cdn.example/therapieland.jpg", alt: "Therapieland" }, Heading: "Therapieland" } },
      { name: "Waiting", fields: { Image: { url: "https://cdn.example/waiting.jpg", alt: "Waiting" }, Heading: "Waiting" } },
    ],
  }] },
};
`;
    const diags = collectTsxContractDiagnostics({
      tsx: `export const Default = () => <div />;`,
      definitionTs,
      sectionInfo: {
        repeats: [
          {
            name: 'serviceCards',
            count: 3,
            fields: [
              { name: 'title', type: 'text' },
              { name: 'links', type: 'array' },
            ],
          },
          {
            name: 'healthCards',
            count: 3,
            fields: [
              { name: 'image', type: 'image' },
              { name: 'title', type: 'text' },
              { name: 'description', type: 'multiline' },
              { name: 'link', type: 'link' },
            ],
            value: [
              {
                image: { src: 'https://cdn.example/sleep.jpg', alt: 'Sleep' },
                title: 'Sleep',
              },
            ],
          },
          {
            name: 'valuePropositions',
            count: 4,
            fields: [
              { name: 'icon', type: 'icon' },
              { name: 'title', type: 'richText' },
              { name: 'description', type: 'richText' },
            ],
            value: [{ icon: 'people', title: 'Welcome', description: 'Everyone' }],
          },
        ],
      },
    });
    assert.ok(
      !diags.some((d) => /IMAGE ROW SEEDS/.test(d)),
      diags.join('\n'),
    );
  });

  it('flags band-ticker when ContinuousMarquee wraps full-bleed bg children', () => {
    const diags = collectTsxContractDiagnostics({
      definitionKey: 'sitecore-announcement-bar',
      tsx: `
export const Default = (props) => (
  <AnnouncementBarChrome>
    <section className="flex h-[34px] w-full bg-[linear-gradient(90deg,#ff1f38,#8629ff)]">
      <span className="lg:min-w-0 whitespace-nowrap">text</span>
    </section>
  </AnnouncementBarChrome>
);
`,
      clientTsx: `
'use client';
import { ContinuousMarquee } from 'components/primitives/continuous-marquee';
export default function AnnouncementBarChrome({ children }) {
  return <ContinuousMarquee>{children}</ContinuousMarquee>;
}
`,
      sectionInfo: {
        cmsName: 'AnnouncementBar',
        layout: {
          motion: {
            kind: 'continuous-marquee',
            surface: 'band-ticker',
            loop: true,
          },
        },
      },
    });
    assert.ok(
      diags.some((d) => /band-ticker.*nowrap text track/i.test(d)),
      diags.join('\n'),
    );
    assert.ok(
      diags.some((d) => /variant="band"/i.test(d)),
      diags.join('\n'),
    );
    assert.ok(
      diags.some((d) => /lg:min-w-0/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags platform list-folder parent with Logo field', () => {
    const diags = collectTsxContractDiagnostics({
      definitionKey: 'sitecore-footer-branding-social',
      definitionTs: `
export const def = {
  datasourceLocation: { folder: ["Image Link Lists"] },
  model: {
    itemTemplate: {
      sections: [{ fields: [{ name: "Logo", type: "Image" }] }],
    },
  },
};
`,
      tsx: `export const Default = () => <div />;`,
    });
    assert.ok(
      diags.some((d) => /platform list folder/i.test(d) && /Logo/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags social ILL without empty-results fallback', () => {
    const diags = collectTsxContractDiagnostics({
      definitionKey: 'sitecore-footer-branding-social',
      definitionTs: `
export const def = {
  datasourceLocation: { folder: ["Image Link Lists"] },
  model: { itemTemplate: { sections: [{ fields: [{ name: "Title", type: "Single-Line Text" }] }] } },
};
`,
      tsx: `
export const Default = (props) => {
  const results = props.fields?.data?.datasource?.children?.results ?? [];
  return results.map((c) => {
    if (!c.link || !c.image) return null;
    return <a key={c.link}>x</a>;
  });
};
`,
    });
    assert.ok(
      diags.some((d) => /empty/i.test(d) && /children\.results/i.test(d)),
      diags.join('\n'),
    );
  });
});

describe('collectDefinitionApostropheContractDiagnostics', () => {
  it("flags Title: 'Buyer's Choice'", () => {
    const diags = collectDefinitionApostropheContractDiagnostics({
      definitionTs: `
content: { items: [{ name: 'Badge', fields: {
  Title: 'TrustRadius 2026 Buyer's Choice Badge',
  Logo: { url: 'https://example.com/x.png', alt: 'TrustRadius 2026 Buyer's Choice Badge' },
}}]},
`,
    });
    assert.ok(
      diags.some((d) => /apostrophe/i.test(d) && /double quotes/i.test(d)),
      diags.join('\n'),
    );
  });

  it('allows double-quoted apostrophe seeds', () => {
    const diags = collectDefinitionApostropheContractDiagnostics({
      definitionTs: `
Title: "TrustRadius 2026 Buyer's Choice Badge",
alt: "Buyer's Choice",
`,
    });
    assert.deepEqual(diags, []);
  });

  it('allows escaped single-quoted apostrophe seeds', () => {
    const diags = collectDefinitionApostropheContractDiagnostics({
      definitionTs: String.raw`Title: 'Buyer\'s Choice', alt: 'Buyer\'s',`,
    });
    assert.deepEqual(diags, []);
  });

  it('is wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: 'export const Default = () => null;',
      definitionTs: "fields: { Title: 'Buyer's Choice' },",
    });
    assert.ok(
      diags.some((d) => /apostrophe/i.test(d)),
      diags.join('\n'),
    );
  });
});

describe('collectClassNameTemplateLiteralContractDiagnostics', () => {
  it('flags className="…${…}" with nested quotes', () => {
    const diags = collectClassNameTemplateLiteralContractDiagnostics({
      tsx: '<span className="absolute transition-opacity ${isExpanded ? "opacity-0" : "opacity-100"}" />',
    });
    assert.ok(
      diags.some((d) => /template interpolation/i.test(d)),
      diags.join('\n'),
    );
  });

  it('allows className={`…${…}`}', () => {
    const diags = collectClassNameTemplateLiteralContractDiagnostics({
      tsx: '<span className={`absolute ${isExpanded ? "opacity-0" : "opacity-100"}`} />',
    });
    assert.deepEqual(diags, []);
  });

  it('allows static className="…"', () => {
    const diags = collectClassNameTemplateLiteralContractDiagnostics({
      tsx: `<div className="flex gap-2 font-['Open_Sans']" />`,
    });
    assert.deepEqual(diags, []);
  });
});

describe('collectCompanionClientContractDiagnostics', () => {
  it('flags .client import with empty clientTsx (mashed wipe)', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: '',
    });
    assert.ok(
      diags.some((d) => /clientTsx is missing\/empty/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags .client import with null clientTsx', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: null,
    });
    assert.ok(
      diags.some((d) => /clientTsx is missing\/empty/i.test(d)),
      diags.join('\n'),
    );
  });

  it('passes good server/client split', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: GOOD_CLIENT_CHROME,
    });
    assert.deepEqual(diags, []);
  });

  it("flags companion clientTsx missing leading 'use client'", () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: `import type { ReactNode } from 'react';
export default function Chrome({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
`,
    });
    assert.ok(
      diags.some((d) => /must start with 'use client'/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags AppPlaceholder / componentMap inside clientTsx', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: BAD_CLIENT_WITH_PH,
    });
    assert.ok(
      diags.some(
        (d) => /AppPlaceholder/i.test(d) && /componentMap/i.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('header-shaped client AppPlaceholder names RSC repair (server PH + children)', () => {
    const thinHeader = `
import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import MenzisSiteHeaderClient from './menzis-site-header.client';
type Props = ComponentWithContextProps & { fields: { 'Context Label': Field<string> } };
export const Default = (props: Props): JSX.Element => {
  return <MenzisSiteHeaderClient {...props} />;
};
`;
    const badHeaderClient = `'use client';
import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
export default function MenzisSiteHeaderClient({ fields, rendering, page }) {
  const contextPlaceholder = 'context-links';
  return (
    <nav>
      <AppPlaceholder name={contextPlaceholder} rendering={rendering} page={page} componentMap={componentMap} />
    </nav>
  );
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx: thinHeader,
      clientTsx: badHeaderClient,
    });
    assert.ok(
      diags.some(
        (d) =>
          /clientTsx must not use AppPlaceholder or componentMap/i.test(d) &&
          /children/i.test(d) &&
          (/Default: function Default/i.test(d) || /RSC/i.test(d)),
      ),
      diags.join('\n'),
    );
  });

  it('flags companion without export default', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: `'use client';\nexport function Chrome() { return null; }\n`,
    });
    assert.ok(
      diags.some((d) => /export default/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags bare *Chrome JSX without .client import (FAQ crash pattern)', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: `
import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
interface Fields { Question: Field<string>; Answer: Field<string>; }
type Props = { fields: Fields };
export const Default = (props: Props): JSX.Element => <FaqChrome fields={props.fields} />;
export default Default;
`,
      clientTsx: `'use client';
import React, { useState } from 'react';
export default function FaqChrome({ fields }) {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}>{String(open)}</button>;
}
`,
    });
    assert.ok(
      diags.some((d) => /must import the companion/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags non-null clientTsx with no .client import even without Chrome JSX', () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: `export const Default = () => <div />;`,
      clientTsx: GOOD_CLIENT_CHROME,
    });
    assert.ok(
      diags.some((d) => /must import the companion/i.test(d)),
      diags.join('\n'),
    );
  });

  it('is wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: SERVER_WITH_CLIENT_IMPORT,
      clientTsx: '',
    });
    assert.ok(
      diags.some((d) => /clientTsx is missing\/empty/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags map-entry that imports .client but still has useState/onClick (FeatureCard failure)', () => {
    const tsx = `
import FeatureCardChrome from './menzis-feature-card.client';
import React, { useState } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
type Props = { fields: { Title: Field<string> } };
export default function Default({ fields }: Props) {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}>{String(fields.Title?.value ?? '')}</button>;
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: GOOD_CLIENT_CHROME,
    });
    assert.ok(
      diags.some((d) =>
        /move hooks\/handlers into clientTsx; map-entry must only render chrome/i.test(
          d,
        ),
      ),
      diags.join('\n'),
    );
  });

  it('flags leaf map-entry with hooks/handlers and no use client', () => {
    const tsx = `
import React, { useState } from 'react';
export default function Default() {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}>toggle</button>;
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: null,
    });
    assert.ok(
      diags.some((d) =>
        /map-entry uses client hooks\/handlers without 'use client'/i.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('passes thin server wrapper with chrome (no hooks on map-entry)', () => {
    const tsx = `
import FeatureCardChrome from './menzis-feature-card.client';
import type { Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import React, { JSX } from 'react';
type Props = { fields: { Title: Field<string>; Body: RichTextField } };
export default function Default({ fields }: Props): JSX.Element {
  return <FeatureCardChrome fields={fields} />;
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: GOOD_CLIENT_CHROME,
    });
    assert.deepEqual(diags, []);
  });

  it('passes leaf map-entry that starts with use client', () => {
    const tsx = `'use client';
import React, { useState } from 'react';
export default function Default() {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}>toggle</button>;
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: null,
    });
    assert.deepEqual(diags, []);
  });

  it('does not flag hooks-without-use-client when AppPlaceholder is present', () => {
    // Server PH owner that incorrectly kept hooks is a different failure mode
    // (covered by chrome-duplicate rule when clientTsx exists); without chrome,
    // AppPlaceholder alone means we skip the leaf 'use client' diagnostic.
    const tsx = `
import React, { useState } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export default function Default(props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>x</button>
      <AppPlaceholder name="x" rendering={props.rendering} page={props.page} componentMap={props.componentMap} />
    </div>
  );
}
`;
    const diags = collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx: null,
    });
    assert.ok(
      !diags.some((d) =>
        /map-entry uses client hooks\/handlers without 'use client'/i.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('RSC hooks diagnostics are wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: `
import FeatureCardChrome from './menzis-feature-card.client';
import React, { useState } from 'react';
export default function Default() {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}>x</button>;
}
`,
      clientTsx: GOOD_CLIENT_CHROME,
    });
    assert.ok(
      diags.some((d) =>
        /move hooks\/handlers into clientTsx; map-entry must only render chrome/i.test(
          d,
        ),
      ),
      diags.join('\n'),
    );
  });
});

describe('mapEntryHasClientHooksOrHandlers / sourceHasLeadingUseClient', () => {
  it('detects useState and onClick', () => {
    assert.equal(
      mapEntryHasClientHooksOrHandlers('const [a, setA] = useState(0);'),
      true,
    );
    assert.equal(
      mapEntryHasClientHooksOrHandlers('<button onClick={() => {}} />'),
      true,
    );
    assert.equal(
      mapEntryHasClientHooksOrHandlers('export default function Default() { return <div />; }'),
      false,
    );
  });

  it('detects leading use client after blank/comments', () => {
    assert.equal(sourceHasLeadingUseClient(`'use client';\nexport default function X() {}`), true);
    assert.equal(
      sourceHasLeadingUseClient(`/* header */\n\n'use client';\nexport default function X() {}`),
      true,
    );
    assert.equal(
      sourceHasLeadingUseClient(`import React from 'react';\nexport default function X() {}`),
      false,
    );
  });
});

describe('collectTsxImportChromePropsContractDiagnostics', () => {
  it('flags JSX.Element without JSX import', () => {
    const bad = `'use client';
import React, { useState } from 'react';
export default function BenefitChrome({ fields }: { fields: unknown }): JSX.Element {
  const [on, setOn] = useState(false);
  return <button type="button" onClick={() => setOn(!on)}>{String(on)}</button>;
}
`;
    assert.equal(sourceMissingJsxImport(bad), true);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: bad,
    });
    assert.ok(
      diags.some((d) => /JSX\.Element/i.test(d) && /importing JSX/i.test(d)),
      diags.join('\n'),
    );
  });

  it('flags hooks-only import when nested helper returns JSX.Element (global-header style)', () => {
    const bad = `'use client';
import React, { useState } from 'react';
function LinkList({ links }: { links: { label: string }[] }): JSX.Element {
  return <ul>{links.map((l) => <li key={l.label}>{l.label}</li>)}</ul>;
}
export default function HeaderChrome(): JSX.Element {
  const [open, setOpen] = useState(false);
  return <button type="button" onClick={() => setOpen(!open)}><LinkList links={[]} /></button>;
}
`;
    assert.equal(sourceMissingJsxImport(bad), true);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: bad,
    });
    assert.ok(
      diags.some((d) => /JSX\.Element/i.test(d) && /importing JSX/i.test(d)),
      diags.join('\n'),
    );
  });

  it('accepts JSX in the react value import', () => {
    const good = `'use client';
import React, { JSX, useState } from 'react';
export default function BenefitChrome(): JSX.Element {
  const [on, setOn] = useState(false);
  return <button type="button" onClick={() => setOn(!on)}>{String(on)}</button>;
}
`;
    assert.equal(sourceMissingJsxImport(good), false);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: good,
    });
    assert.equal(
      diags.filter((d) => /JSX\.Element/i.test(d)).length,
      0,
      diags.join('\n'),
    );
  });

  it('flags Field / RichTextField / ImageField without import type', () => {
    const bad = `
import React, { JSX } from 'react';
import { Image, RichText, Text } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  "Background Image": ImageField;
}
export const Default = (props: { fields: Fields }): JSX.Element => <div />;
`;
    const diags = collectTsxImportChromePropsContractDiagnostics({ tsx: bad });
    assert.ok(
      diags.some(
        (d) =>
          /import type/i.test(d) &&
          /Field/.test(d) &&
          /RichTextField/.test(d) &&
          /ImageField/.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('flags Field / LinkField / ImageField imported from lib/component-props (TS2459)', () => {
    const bad = `
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
    assert.deepEqual(
      collectFieldTypesImportedFromLibComponentProps(bad).sort(),
      ['Field', 'ImageField', 'LinkField'],
    );
    const diags = collectTsxImportChromePropsContractDiagnostics({ tsx: bad });
    assert.ok(
      diags.some(
        (d) =>
          /lib\/component-props/.test(d) &&
          /TS2459/.test(d) &&
          /Field/.test(d) &&
          /LinkField/.test(d) &&
          /ImageField/.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('accepts Field types from SDK with ComponentWithContextProps from lib/component-props', () => {
    const good = `
import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields { Heading: Field<string>; CTA: LinkField }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => <div />;
`;
    assert.equal(collectFieldTypesImportedFromLibComponentProps(good).length, 0);
    const diags = collectTsxImportChromePropsContractDiagnostics({ tsx: good });
    assert.equal(
      diags.filter((d) => /TS2459/.test(d)).length,
      0,
      diags.join('\n'),
    );
  });

  it('accepts shared import type for field names', () => {
    const good = `
import React, { JSX } from 'react';
import { Image, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, RichTextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  "Background Image": ImageField;
}
export const Default = (props: { fields: Fields }): JSX.Element => <div />;
`;
    const diags = collectTsxImportChromePropsContractDiagnostics({ tsx: good });
    assert.equal(
      diags.filter((d) => /import type/i.test(d)).length,
      0,
      diags.join('\n'),
    );
  });

  it('flags fat Chrome props typed as ComponentWithContextProps', () => {
    const bad = `'use client';
import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { Field } from '@sitecore-content-sdk/nextjs';
interface Fields { Title: Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };
export default function CookieChrome({ fields }: Props): JSX.Element {
  return <div />;
}
`;
    assert.equal(clientTsxHasFatChromeProps(bad), true);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: bad,
    });
    assert.ok(
      diags.some((d) => /narrow/i.test(d) && /ComponentWithContextProps/i.test(d)),
      diags.join('\n'),
    );
  });

  it('accepts narrow Chrome props', () => {
    const good = `'use client';
import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
interface Fields { Title: Field<string>; }
type ChromeProps = { fields: Fields };
export default function CookieChrome({ fields }: ChromeProps): JSX.Element {
  return <div />;
}
`;
    assert.equal(clientTsxHasFatChromeProps(good), false);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: good,
    });
    assert.deepEqual(diags, []);
  });

  it('flags Text on Search Link LinkField', () => {
    const bad = `'use client';
import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
type Fields = {
  'Search Link': LinkField;
  'Login Link': LinkField;
  Title: Field<string>;
};
export default function NavChrome({ fields }: { fields: Fields }): JSX.Element {
  return (
    <button type="button">
      <Text field={fields['Search Link']} />
    </button>
  );
}
`;
    assert.deepEqual(findTextOnLinkFieldNames(bad), ['Search Link']);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: bad,
    });
    assert.ok(
      diags.some(
        (d) =>
          /Text field/i.test(d) &&
          /Search Link/.test(d) &&
          /LinkField/.test(d) &&
          /TS2322/.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('accepts childless Link on Search Link', () => {
    const good = `'use client';
import React, { JSX } from 'react';
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField } from '@sitecore-content-sdk/nextjs';
type Fields = { 'Search Link': LinkField };
export default function NavChrome({ fields }: { fields: Fields }): JSX.Element {
  return <Link field={fields['Search Link']} className="font-bold" />;
}
`;
    assert.deepEqual(findTextOnLinkFieldNames(good), []);
    const diags = collectTsxImportChromePropsContractDiagnostics({
      clientTsx: good,
    });
    assert.equal(
      diags.filter((d) => /Text field/i.test(d)).length,
      0,
      diags.join('\n'),
    );
  });

  it('is wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: `
import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
interface Fields { Title: Field<string>; }
export const Default = (): JSX.Element => <div />;
`,
      clientTsx: null,
    });
    assert.ok(
      diags.some((d) => /import type/i.test(d) && /Field/.test(d)),
      diags.join('\n'),
    );
  });
});

describe('collectLinkListJsonBagContractDiagnostics', () => {
  it('detects Links Multi-Line JSON bag fields', () => {
    assert.deepEqual(findLinkShapedJsonBagFields(FOOTER_COLUMN_BAG_DEF), [
      'Links',
    ]);
    assert.deepEqual(
      findLinkShapedJsonBagFields(FOOTER_COLUMN_COMPOSITE_DEF),
      [],
    );
  });

  it('flag on: CONTRACT when Links JSON bag is seeded', () => {
    const diags = collectLinkListJsonBagContractDiagnostics({
      definitionTs: FOOTER_COLUMN_BAG_DEF,
      tsx: BAG_PAINT_TSX,
      env: { [BQ_LINK_LIST_AS_COMPOSITE]: '1' },
    });
    assert.ok(
      diags.some(
        (d) =>
          /BQ_LINK_LIST_AS_COMPOSITE=1/.test(d) &&
          /Links/.test(d) &&
          /link-item/i.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('flag on: composite placeholders without bag pass', () => {
    const diags = collectLinkListJsonBagContractDiagnostics({
      definitionTs: FOOTER_COLUMN_COMPOSITE_DEF,
      tsx: HEADING_ONLY_TSX,
      env: { [BQ_LINK_LIST_AS_COMPOSITE]: '1' },
    });
    assert.deepEqual(diags, []);
  });

  it('flag off: bag + parse+map passes', () => {
    const diags = collectLinkListJsonBagContractDiagnostics({
      definitionTs: FOOTER_COLUMN_BAG_DEF,
      tsx: BAG_PAINT_TSX,
      env: { [BQ_LINK_LIST_AS_COMPOSITE]: '0' },
    });
    assert.deepEqual(diags, []);
  });

  it('flag off: bag + Heading-only TSX fails paint CONTRACT', () => {
    const diags = collectLinkListJsonBagContractDiagnostics({
      definitionTs: FOOTER_COLUMN_BAG_DEF,
      tsx: HEADING_ONLY_TSX,
      env: { [BQ_LINK_LIST_AS_COMPOSITE]: '0' },
    });
    assert.ok(
      diags.some(
        (d) => /JSON\.parse/i.test(d) && /Links/.test(d) && /paint/i.test(d),
      ),
      diags.join('\n'),
    );
  });

  it('is wired through collectTsxContractDiagnostics when flag on', () => {
    const prev = process.env[BQ_LINK_LIST_AS_COMPOSITE];
    process.env[BQ_LINK_LIST_AS_COMPOSITE] = '1';
    try {
      const diags = collectTsxContractDiagnostics({
        definitionTs: FOOTER_COLUMN_BAG_DEF,
        tsx: BAG_PAINT_TSX,
      });
      assert.ok(
        diags.some((d) => /BQ_LINK_LIST_AS_COMPOSITE=1/.test(d)),
        diags.join('\n'),
      );
    } finally {
      if (prev === undefined) delete process.env[BQ_LINK_LIST_AS_COMPOSITE];
      else process.env[BQ_LINK_LIST_AS_COMPOSITE] = prev;
    }
  });
});

describe('collectInteractionStateContractDiagnostics', () => {
  it('is empty when no interactionStates', () => {
    assert.deepEqual(
      collectInteractionStateContractDiagnostics({
        tsx: 'export const Default = () => <div />;',
        sectionInfo: {},
      }),
      [],
    );
  });

  it('flags menu state without client interactivity', () => {
    const diags = collectInteractionStateContractDiagnostics({
      tsx: `export const Default = () => <header><button type="button">Menu</button></header>;`,
      clientTsx: null,
      sectionInfo: MENU_STATE_INFO,
      role: 'section',
    });
    assert.ok(
      diags.some((d) => /client interactivity|clientTsx/i.test(d)),
      diags.join('\n'),
    );
    assert.ok(
      diags.some((d) => /toggle control/i.test(d) && /revealable/i.test(d)),
      diags.join('\n'),
    );
  });

  it('passes when clientTsx has toggle + open panel', () => {
    const clientTsx = `'use client';
import { useState } from 'react';
export default function Chrome() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="relative">
      <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
      {menuOpen ? <div className="absolute inset-x-0 top-full" data-mobile-menu>Nav</div> : null}
    </header>
  );
}
`;
    const diags = collectInteractionStateContractDiagnostics({
      tsx: `import Chrome from './x.client'; export const Default = () => <Chrome />;`,
      clientTsx,
      sectionInfo: MENU_STATE_INFO,
      role: 'section',
    });
    assert.deepEqual(diags, []);
  });

  it('skips child role packages', () => {
    const diags = collectInteractionStateContractDiagnostics({
      tsx: 'export const Default = () => null;',
      sectionInfo: MENU_STATE_INFO,
      role: 'child',
    });
    assert.deepEqual(diags, []);
  });

  it('is wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: `export const Default = () => <div />;`,
      sectionInfo: MENU_STATE_INFO,
      role: 'section',
    });
    assert.ok(diags.some((d) => /interactionStates/i.test(d)), diags.join('\n'));
  });
});

describe('collectHardcodedCaptureImageUrlDiagnostics', () => {
  it('flags hero-shaped hardcoded mask-image absolute URLs', () => {
    const diags = collectHardcodedCaptureImageUrlDiagnostics({
      tsx: `
export const Default = () => (
  <figure style={{
    maskImage: 'url(https://www.menzis.nl/Resources/hero-pebble-container-mask-mobile.svg)',
    WebkitMaskImage: 'url(https://www.menzis.nl/Resources/hero-pebble-container-mask-mobile.svg)',
  }}>
    <div style={{
      maskImage: 'url(https://www.menzis.nl/Resources/hero-pebble-container-mask.svg)',
    }} />
  </figure>
);
`,
    });
    assert.ok(
      diags.some((d) => /hardcoded capture\/CDN image URL/i.test(d)),
      diags.join('\n'),
    );
    assert.ok(diags.some((d) => /menzis\.nl/i.test(d)), diags.join('\n'));
  });

  it('passes when mask uses fields value.src', () => {
    const diags = collectHardcodedCaptureImageUrlDiagnostics({
      tsx: `
const mask = fields['Hero Mask']?.value?.src;
export const Default = () => (
  <figure style={{ maskImage: mask ? \`url(\${mask})\` : undefined }}>
    <Image field={fields['Hero Image']} />
  </figure>
);
`,
    });
    assert.deepEqual(diags, []);
  });

  it('flags bg-[url(https://…)] but not page hrefs', () => {
    const diags = collectHardcodedCaptureImageUrlDiagnostics({
      tsx: `
<a href="https://www.menzis.nl/dan-is-er-menzis">x</a>
<div className="bg-[url('https://cdn.example.com/band-texture.png')]" />
`,
    });
    assert.ok(diags.some((d) => /band-texture\.png/i.test(d)), diags.join('\n'));
    assert.ok(!diags.some((d) => /dan-is-er-menzis/i.test(d)), diags.join('\n'));
  });

  it('is wired through collectTsxContractDiagnostics', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: `<img src="https://cdn.example.com/hero.jpg" alt="" />`,
    });
    assert.ok(
      diags.some((d) => /hardcoded capture\/CDN image URL/i.test(d)),
      diags.join('\n'),
    );
  });
});

describe('rendering Path leaf collision CONTRACT', () => {
  it('is wired through collectTsxContractDiagnostics for duplicate componentName stems', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: 'export const Default = () => null;',
      definitionKey: 'menzis-footer-quick-link-list',
      componentName: 'MenzisFooterQuickLinkList',
      codePrefix: 'Menzis',
      childPackages: [
        {
          definitionKey: 'menzis-footer-quick-link-list-dup',
          name: 'menzis-footer-quick-link-list-dup',
          componentName: 'MenzisFooterQuickLinkList',
          role: 'child',
        },
      ],
    });
    assert.ok(
      diags.some((d) => /rendering Path leaf "Footer Quick Link List"/.test(d)),
      diags.join('\n'),
    );
  });

  it('allows shared Link List itemTemplate across distinct componentName stems', () => {
    const diags = collectTsxContractDiagnostics({
      tsx: 'export const Default = () => null;',
      definitionKey: 'menzis-footer-quick-link-list',
      componentName: 'MenzisFooterQuickLinkList',
      codePrefix: 'Menzis',
      childPackages: [
        {
          definitionKey: 'menzis-footer-account-link-list',
          name: 'menzis-footer-account-link-list',
          componentName: 'MenzisFooterAccountLinkList',
          role: 'child',
        },
      ],
    });
    assert.ok(
      !diags.some((d) => /rendering Path leaf/i.test(d)),
      diags.join('\n'),
    );
  });
});
