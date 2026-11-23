/**
 * Run: node --test tools/create-section-components/tsx-validate-loop.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHECKBOX_FIELD_TSC_FIX,
  CLIENT_APPPLACEHOLDER_RSC_FIX,
  HARDCODED_CAPTURE_IMAGE_URL_FIX,
  OPTIONAL_LINK_IMAGE_FIELD_TSC_FIX,
  PAGE_PROPS_TSC_FIX,
  VALIDATE_FIX_HEADER,
  VALIDATE_FIX_HEADER_LIST_PAINT_OWNER,
  annotatePagePropsTscDiagnostics,
  annotateValidateDiagnostics,
  collectValidateDiagnostics,
  formatValidateAttemptLog,
  resolveValidateFixHeader,
} from './tsx-validate-loop.mjs';
import { resolveTsxValidateMaxIters } from './tsx-validate-iters.mjs';
import {
  collectTsxEmitContractDiagnostics,
  usesPropsPageWithoutContextProps,
} from './ai-source-fixup.mjs';

describe('annotateValidateDiagnostics sticky chrome', () => {
  it('appends Fix for useStickyChromeInset TS2345', () => {
    const out = annotateValidateDiagnostics([
      "TSC: foo.client.tsx:10:51 — TS2345: Argument of type '{ fallbackPx: number; }' is not assignable to parameter of type 'number'.",
    ]);
    assert.ok(
      out.some((d) =>
        /useStickyChromeInset\(edge.*fallbackInsetPx/.test(d),
      ),
      out.join('\n'),
    );
  });
});

describe('VALIDATE_FIX_HEADER', () => {
  it('requires definitionTs and tsx dual-file Image repair', () => {
    assert.match(VALIDATE_FIX_HEADER, /definitionTs AND tsx/);
    assert.match(VALIDATE_FIX_HEADER, /\{ url, alt \}/);
    assert.match(VALIDATE_FIX_HEADER, /<Image field=/);
  });

  it('resolveValidateFixHeader softens for platform list Title-only catch-22', () => {
    const header = resolveValidateFixHeader([
      'CONTRACT: platform list folder (Link/Icon/Image Link Lists) parent may only declare Title — forbid extra parent fields (Logo)',
      'CONTRACT: Mount these HTML logo/wordmark images as Sitecore <Image> fields. Missing: https://cdn.example.com/logo.svg',
    ]);
    assert.equal(header, VALIDATE_FIX_HEADER_LIST_PAINT_OWNER);
    assert.match(header, /Title-only/);
    assert.match(header, /do NOT add Logo/);
  });

  it('resolveValidateFixHeader softens logo demand naming FooterNavigationGroup', () => {
    const header = resolveValidateFixHeader([
      'CONTRACT: Mount these HTML logo/wordmark images as Sitecore <Image> fields (not <Text>). Missing: https://x/logo.svg',
      'SitecoreFooterNavigationGroup',
    ]);
    assert.equal(header, VALIDATE_FIX_HEADER_LIST_PAINT_OWNER);
  });

  it('resolveValidateFixHeader keeps default Image repair otherwise', () => {
    assert.equal(
      resolveValidateFixHeader([
        'CONTRACT: Mount these HTML images as Sitecore <Image> fields. Missing: https://cdn.example.com/hero.jpg',
      ]),
      VALIDATE_FIX_HEADER,
    );
  });
});

describe('annotateValidateDiagnostics', () => {
  it('appends Fix for Property page does not exist', () => {
    const out = annotateValidateDiagnostics([
      "TSC: src/x.tsx:34:35 — TS2339: Property 'page' does not exist on type 'SitecoreMainNavigationProps'.",
    ]);
    assert.equal(out.length, 1);
    assert.match(out[0], /Property 'page' does not exist/);
    assert.ok(out[0].includes(PAGE_PROPS_TSC_FIX));
  });

  it('appends Fix for no exported member CheckboxField', () => {
    const out = annotateValidateDiagnostics([
      `TSC: src/x.tsx:5:8 — TS2305: Module '"@sitecore-content-sdk/nextjs"' has no exported member 'CheckboxField'.`,
    ]);
    assert.equal(out.length, 1);
    assert.match(out[0], /CheckboxField/);
    assert.ok(out[0].includes(CHECKBOX_FIELD_TSC_FIX));
  });

  it('appends Fix for LinkField | undefined TS2322', () => {
    const out = annotateValidateDiagnostics([
      "TSC: src/x.tsx:138:19 — TS2322: Type 'LinkField | undefined' is not assignable to type '(LinkField | LinkFieldValue) & FieldMetadata'.",
    ]);
    assert.equal(out.length, 1);
    assert.ok(out[0].includes(OPTIONAL_LINK_IMAGE_FIELD_TSC_FIX));
  });

  it('appends Fix for clientTsx AppPlaceholder/componentMap CONTRACT', () => {
    const out = annotateValidateDiagnostics([
      'CONTRACT: clientTsx must not use AppPlaceholder or componentMap — mount AppPlaceholder on server map-entry only',
    ]);
    assert.equal(out.length, 1);
    assert.ok(out[0].includes(CLIENT_APPPLACEHOLDER_RSC_FIX));
  });

  it('appends Fix for hardcoded capture/CDN image URL CONTRACT', () => {
    const out = annotateValidateDiagnostics([
      'CONTRACT: hardcoded capture/CDN image URL(s) in tsx/clientTsx must be Sitecore Image fields — Offending: https://www.menzis.nl/x.svg',
    ]);
    assert.equal(out.length, 1);
    assert.ok(out[0].includes(HARDCODED_CAPTURE_IMAGE_URL_FIX));
  });

  it('leaves unrelated diagnostics unchanged', () => {
    const out = annotatePagePropsTscDiagnostics([
      'CONTRACT: AppPlaceholder needs flex/grid',
    ]);
    assert.deepEqual(out, ['CONTRACT: AppPlaceholder needs flex/grid']);
  });
});

describe('classList / CTA arrow / equal-height emit CONTRACT', () => {
  it('flags multi-token classList.toggle', () => {
    const src = `
'use client';
export default function Chrome() {
  panel.classList.toggle('border-[#e4e2e8] shadow-[0_4px_16px_rgba(147,51,234,0.15)]', active);
  return null;
}
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(diags.some((d) => /classList\.toggle must use one CSS token/.test(d)));
  });

  it('flags solid-square CTA after:bg + content arrow', () => {
    const src = `
export const Default = () => (
  <Link className="after:h-[22px] after:w-[22px] after:bg-current after:content-['→']" />
);
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(diags.some((d) => /sc-cta-after-arrow|solid square/.test(d)));
  });

  it('flags sized after:bg box without sc-cta-after-arrow', () => {
    const src = `
export const Default = () => (
  <Link className="after:ml-2 after:block after:h-[22px] after:w-[22px] after:bg-current" />
);
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      diags.some((d) => /sc-cta-after-arrow|solid square/.test(d)),
      diags.join('\n'),
    );
  });

  it('passes sc-cta-after-arrow with after:bg color override', () => {
    const src = `
export const Default = () => (
  <Link className="sc-cta-after-arrow after:ml-2 after:bg-current" />
);
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(!diags.some((d) => /sc-cta-after-arrow|solid square/.test(d)));
  });

  it('flags equal-height track with only [&>*]:h-full (no items-stretch)', () => {
    const src = `
export const Default = () => (
  <div className="flex [&>*]:h-full">
    <AppPlaceholder name="cards" />
  </div>
);
`;
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
      equalHeightChildren: true,
    });
    assert.ok(
      diags.some((d) =>
        /items-stretch AND \[&>\*\]:h-full/.test(d),
      ),
    );
  });

  it('passes equal-height when items-stretch and [&>*]:h-full both present', () => {
    const src = `
export const Default = () => (
  <div className="flex items-stretch [&>*]:h-full">
    <AppPlaceholder name="cards" />
  </div>
);
`;
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
      equalHeightChildren: true,
    });
    assert.ok(
      !diags.some((d) =>
        /items-stretch AND \[&>\*\]:h-full/.test(d),
      ),
    );
  });

  it('does not force equal-height for layoutMode=carousel alone (logo marquee)', () => {
    const src = `
export const Default = () => (
  <div className="overflow-hidden">
    <AppPlaceholder name="logos" />
  </div>
);
`;
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
      sectionInfo: {
        layout: {
          pattern: 'horizontal-logo-carousel',
          motion: { kind: 'continuous-marquee' },
        },
      },
    });
    assert.ok(
      !diags.some((d) => /items-stretch AND \[&>\*\]:h-full/.test(d)),
      diags.join('\n'),
    );
  });
});

describe('CheckboxField emit CONTRACT', () => {
  it('flags CheckboxField import/usage', () => {
    const src = `
import { Text, type CheckboxField, type TextField } from '@sitecore-content-sdk/nextjs';
interface Fields { Open: CheckboxField; Title: TextField }
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      diags.some((d) =>
        /CheckboxField is not an SDK type — use Field<boolean>/.test(d),
      ),
    );
  });

  it('passes Field<boolean> for Checkbox', () => {
    const src = `
import { Text, type Field, type TextField } from '@sitecore-content-sdk/nextjs';
interface Fields { Open: Field<boolean>; Title: TextField }
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      !diags.some((d) => /CheckboxField is not an SDK type/.test(d)),
    );
  });
});

describe('usesPropsPageWithoutContextProps / emit CONTRACT', () => {
  it('flags ComponentProps + props.page', () => {
    const src = `
import { ComponentProps } from 'lib/component-props';
type Props = ComponentProps & { fields: Fields };
export const Default = (props: Props) => {
  const isEditing = Boolean(props.page?.mode?.isEditing);
  return <div />;
};
`;
    assert.equal(usesPropsPageWithoutContextProps(src), true);
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      diags.some((d) =>
        /props\.page requires ComponentWithContextProps/.test(d),
      ),
    );
  });

  it('passes ComponentWithContextProps + props.page', () => {
    const src = `
import type { ComponentWithContextProps } from 'lib/component-props';
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props) => {
  const isEditing = Boolean(props.page?.mode?.isEditing);
  return <div />;
};
`;
    assert.equal(usesPropsPageWithoutContextProps(src), false);
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      !diags.some((d) =>
        /props\.page requires ComponentWithContextProps/.test(d),
      ),
    );
  });
});

describe('formatValidateAttemptLog', () => {
  it('lists why AI is retrying with truncated bullets', () => {
    const log = formatValidateAttemptLog(
      [
        'TSC: src/x.tsx:21:35 — TS2339: Property \'page\' does not exist on type',
        'CONTRACT: Child/group Title seeds look collapsed or copied from section Heading',
      ],
      { maxItems: 5, maxChars: 220 },
    );
    assert.match(log, /AI rewrite will fix:/);
    assert.match(log, /TSC:.*Property 'page'/);
    assert.match(log, /ComponentWithContextProps/);
    assert.match(log, /CONTRACT:.*Title seeds/);
  });

  it('caps listed diagnostics', () => {
    const many = Array.from({ length: 8 }, (_, i) => `CONTRACT: issue ${i}`);
    const log = formatValidateAttemptLog(many, { maxItems: 3 });
    assert.match(log, /issue 0/);
    assert.match(log, /and 5 more/);
    assert.doesNotMatch(log, /issue 7/);
  });
});

describe('collectValidateDiagnostics', () => {
  it('does not flag xl: (evidence-first); still returns CONTRACT without staged tsc', () => {
    const diags = collectValidateDiagnostics({
      tsx: `export const Default = () => <div className="xl:block xl:py-10" />;`,
      clientTsx: null,
      tsxPath: 'c:/__missing__/nope.tsx',
      clientTsxPath: null,
      componentName: 'Test',
    });
    assert.ok(!diags.some((d) => /found xl:|use lg: for desktop/.test(d)));
    assert.ok(!diags.some((d) => d.startsWith('TSC:')));
  });

  it('collects multiple contract issues for revision briefs', () => {
    const many = collectValidateDiagnostics({
      tsx: `
'use client';
'use client';
export const Default = () => <div className="xl:flex md:grid-cols-3" />;
`,
      tsxPath: 'c:/__missing__/nope.tsx',
    });
    assert.ok(many.some((d) => /duplicate 'use client'/.test(d)));
    assert.ok(!many.some((d) => /found xl:/.test(d)));
    assert.ok(many.every((d) => d.startsWith('CONTRACT:') || d.startsWith('TSC:')));
  });
});

describe('maxIters=0 skip', () => {
  it('resolveTsxValidateMaxIters(0) disables the loop', () => {
    const prev = process.env.BQ_TSX_VALIDATE_MAX_ITERS;
    process.env.BQ_TSX_VALIDATE_MAX_ITERS = '0';
    try {
      assert.equal(resolveTsxValidateMaxIters(), 0);
    } finally {
      if (prev === undefined) delete process.env.BQ_TSX_VALIDATE_MAX_ITERS;
      else process.env.BQ_TSX_VALIDATE_MAX_ITERS = prev;
    }
  });
});
