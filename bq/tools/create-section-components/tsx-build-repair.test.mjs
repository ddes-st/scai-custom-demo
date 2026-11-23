/**
 * Run: node --test tools/create-section-components/tsx-build-repair.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stripForbiddenUseServerDirective,
  mapEntryImportsCompanionClient,
  sourceNeedsJsxNamespaceImport,
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
} from './ai-source-fixup.mjs';
import {
  resolveTsxBuildMaxRetries,
  isTsxBuildFailure,
  TSX_BUILD_AI_RETRIES_DEFAULT,
} from './tsx-build-iters.mjs';
import {
  looksLikeTruncatedTsxEmit,
  writeComponentPackageWithBuildRetries,
  diagnosticsAreListNoneOnly,
  diagnosticsAreMechanicalOnly,
} from './tsx-build-repair.mjs';
import { collectCompanionClientContractDiagnostics } from './tsx-contract-diagnostics.mjs';

describe('mechanical always-on while kill switch off', () => {
  it('applyWritePathAlwaysOnTsxSanitizers still injects list-none', () => {
    assert.equal(WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED, false);
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `export const Default = () => (
  <ul className="space-y-2"><li key="a"><a href="/a">A</a></li></ul>
);
`,
    });
    assert.match(tsx, /\blist-none\b/);
  });

  it('applyWritePathAlwaysOnTsxSanitizers remaps md:grid-cols to lg:', () => {
    assert.equal(WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED, false);
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `export const Default = () => (
  <div className="grid grid-cols-1 md:grid-cols-8" />
);
`,
    });
    assert.match(tsx, /\blg:grid-cols-8\b/);
    assert.doesNotMatch(tsx, /\bmd:grid-cols-8\b/);
  });

  it('applyWritePathAlwaysOnTsxSanitizers still injects JSX namespace import', () => {
    assert.equal(WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED, false);
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import React from 'react';
export const Default = (): JSX.Element => <div />;
`,
    });
    assert.match(tsx, /import\s+React\s*,\s*\{\s*JSX\s*\}\s*from\s*['"]react['"]/);
    assert.equal(sourceNeedsJsxNamespaceImport(tsx), false);
  });

  it('applyWritePathAlwaysOnTsxSanitizers still injects Field type imports', () => {
    assert.equal(WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED, false);
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: `import React from 'react';
type Fields = { Title: Field; Body: RichTextField };
export const Default = (props: { fields: Fields }): JSX.Element => <div />;
`,
    });
    assert.match(
      tsx,
      /import\s+type\s*\{[^}]*\b(?:Field|RichTextField)\b[^}]*\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/,
    );
    assert.match(tsx, /\bJSX\b/);
  });
});

describe('looksLikeTruncatedTsxEmit', () => {
  it('rejects trailing lone = line', () => {
    assert.equal(
      looksLikeTruncatedTsxEmit(
        "import React from 'react';\nexport const Default = () => null;\n\n=\n",
      ),
      true,
    );
  });

  it('rejects ellipsis-only placeholder', () => {
    assert.equal(looksLikeTruncatedTsxEmit('...\n'), true);
  });

  it('does not reject a file whose last comment ends with a period', () => {
    assert.equal(
      looksLikeTruncatedTsxEmit(
        "import React from 'react';\nexport const Default = () => null;\n// done.\n",
      ),
      false,
    );
  });

  it('accepts complete map-entry', () => {
    assert.equal(
      looksLikeTruncatedTsxEmit(
        "import React from 'react';\nexport const Default = () => null;\n",
      ),
      false,
    );
  });
});

describe('stripForbiddenUseServerDirective', () => {
  it('strips leading use server', () => {
    const out = stripForbiddenUseServerDirective(
      "'use server';\n\nimport React from 'react';\nexport const Default = () => null;\n",
    );
    assert.equal(/use server/.test(out), false);
    assert.match(out, /import React/);
  });

  it('is a no-op without use server', () => {
    const src = "import React from 'react';\nexport const Default = () => null;\n";
    assert.equal(stripForbiddenUseServerDirective(src), src);
  });
});

describe('mapEntryImportsCompanionClient', () => {
  it('detects default import of .client', () => {
    assert.equal(
      mapEntryImportsCompanionClient(
        "import MenuBand from './menzis-header-menu-band.client';\n",
      ),
      true,
    );
    assert.equal(
      mapEntryImportsCompanionClient("export const Default = () => null;\n"),
      false,
    );
  });
});

describe('resolveTsxBuildMaxRetries / isTsxBuildFailure', () => {
  it('defaults to 1 when env unset', () => {
    const prev = process.env.BQ_TSX_VALIDATE_MAX_ITERS;
    delete process.env.BQ_TSX_VALIDATE_MAX_ITERS;
    try {
      assert.equal(resolveTsxBuildMaxRetries({}), TSX_BUILD_AI_RETRIES_DEFAULT);
    } finally {
      if (prev !== undefined) process.env.BQ_TSX_VALIDATE_MAX_ITERS = prev;
    }
  });

  it('returns 0 when env is 0', () => {
    assert.equal(
      resolveTsxBuildMaxRetries({ BQ_TSX_VALIDATE_MAX_ITERS: '0' }),
      0,
    );
  });

  it('classifies missing-client refuse as build failure', () => {
    assert.equal(
      isTsxBuildFailure(
        new Error(
          `[codegen] Demo: map-entry imports './….client' but clientTsx is missing/empty — refusing to write broken package`,
        ),
      ),
      true,
    );
  });
});

describe('collectCompanionClientContractDiagnostics use server', () => {
  it("flags 'use server' on map-entry", () => {
    const diags = collectCompanionClientContractDiagnostics({
      tsx: `'use server';\nimport X from './x.client';\nexport const Default = () => null;\n`,
      clientTsx: `'use client';\nexport default function X() { return null; }\n`,
    });
    assert.ok(
      diags.some((d) => /must NOT use 'use server'/i.test(d)),
      diags.join('\n'),
    );
  });
});

describe('writeComponentPackageWithBuildRetries', () => {
  it('skips gate when maxRetries=0 and writes via formatWriteFn', async () => {
    let wrote = null;
    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'Demo',
        kebab: 'demo',
        tsx: "'use server';\nexport const Default = () => null;\n",
      },
      {
        maxRetries: 0,
        formatWriteFn: async (opts) => {
          wrote = opts;
          return { tsx: 'ok' };
        },
      },
    );
    assert.deepEqual(paths, { tsx: 'ok' });
    // Always-on strip still applied before legacy write.
    assert.equal(/use server/.test(wrote.tsx), false);
  });

  it('repairs when collectFn returns diagnostics then writes', async () => {
    let collectCalls = 0;
    let repairCalls = 0;
    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'DemoBand',
        kebab: 'demo-band',
        tsx: "import Band from './demo-band.client';\nexport const Default = (p) => <Band fields={p.fields} />;\n",
        clientTsx: null,
      },
      {
        maxRetries: 1,
        collectFn: async () => {
          collectCalls += 1;
          if (collectCalls === 1) {
            return [
              "CONTRACT: map-entry imports './….client' but clientTsx is missing/empty",
            ];
          }
          return [];
        },
        repairFn: async () => {
          repairCalls += 1;
          return {
            ok: true,
            tsx: "import Band from './demo-band.client';\nexport const Default = (p) => <Band fields={p.fields} />;\n",
            clientTsx:
              "'use client';\nexport default function Band() { return null; }\n",
          };
        },
        formatWriteFn: async (opts) => {
          assert.ok(opts.clientTsx && /use client/.test(opts.clientTsx));
          return { tsx: 'written', clientTsx: 'written' };
        },
      },
    );
    assert.equal(repairCalls, 1);
    assert.equal(collectCalls, 2);
    assert.deepEqual(paths, { tsx: 'written', clientTsx: 'written' });
  });

  it('throws after exhausting repairs', async () => {
    await assert.rejects(
      () =>
        writeComponentPackageWithBuildRetries(
          {
            hostSlug: 'demo',
            componentName: 'Broken',
            kebab: 'broken',
            tsx: "import X from './broken.client';\nexport const Default = () => null;\n",
          },
          {
            maxRetries: 1,
            collectFn: async () => [
              "CONTRACT: map-entry imports './….client' but clientTsx is missing/empty",
            ],
            repairFn: async () => ({
              ok: true,
              tsx: "import X from './broken.client';\nexport const Default = () => null;\n",
              // Still missing client — next collect fails again
              clientTsx: null,
            }),
            formatWriteFn: async () => {
              throw new Error('should not write');
            },
          },
        ),
      /TSX build validate failed for Broken/,
    );
  });

  it('clears JSX-only CONTRACT without calling repairFn', async () => {
    let repairCalls = 0;
    const clientBroken = `'use client';
import { useState } from 'react';
export default function CookieChrome(): JSX.Element {
  return <div />;
}
`;
    assert.equal(sourceNeedsJsxNamespaceImport(clientBroken), true);
    assert.equal(WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED, false);

    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'Cookie',
        kebab: 'cookie',
        tsx: "import Cookie from './cookie.client';\nexport const Default = (p) => <Cookie fields={p.fields} />;\n",
        clientTsx: clientBroken,
      },
      {
        maxRetries: 1,
        collectFn: async (_opts, draft) => {
          const diags = [];
          if (sourceNeedsJsxNamespaceImport(draft.clientTsx || '')) {
            diags.push(
              "CONTRACT: clientTsx uses JSX.Element (or JSX.*) without importing JSX from 'react' — emit import React, { JSX, … } from 'react' (TS2694)",
            );
          }
          return diags;
        },
        repairFn: async () => {
          repairCalls += 1;
          return { ok: false, skipReason: 'should not run' };
        },
        formatWriteFn: async (opts) => {
          assert.equal(sourceNeedsJsxNamespaceImport(opts.clientTsx || ''), false);
          assert.match(opts.clientTsx || '', /JSX/);
          return { tsx: 'ok', clientTsx: 'ok' };
        },
      },
    );

    assert.equal(repairCalls, 0);
    assert.deepEqual(paths, { tsx: 'ok', clientTsx: 'ok' });
  });

  it('clears list-none-only CONTRACT without calling repairFn', async () => {
    let repairCalls = 0;
    const broken = `export const Default = () => (
  <ul className="space-y-2"><li key="a"><a href="/a">A</a></li></ul>
);
`;
    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'Nav',
        kebab: 'nav',
        tsx: broken,
      },
      {
        maxRetries: 1,
        collectFn: async (_opts, draft) => {
          const diags = [];
          const src = draft.tsx || '';
          if (
            /<li\b(?![^>]*\blist-none\b)[^>]*>/.test(src) &&
            !/<ul\b[^>]*\blist-none\b/.test(src)
          ) {
            diags.push(
              'CONTRACT: <li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
            );
          }
          return diags;
        },
        repairFn: async () => {
          repairCalls += 1;
          return { ok: false, skipReason: 'should not run' };
        },
        formatWriteFn: async (opts) => {
          assert.match(opts.tsx || '', /\blist-none\b/);
          return { tsx: 'ok', clientTsx: null };
        },
      },
    );
    assert.equal(repairCalls, 0);
    assert.deepEqual(paths, { tsx: 'ok', clientTsx: null });
  });

  it('diagnosticsAreListNoneOnly matches the CONTRACT string', () => {
    assert.equal(
      diagnosticsAreListNoneOnly([
        'CONTRACT: <li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreListNoneOnly([
        'CONTRACT: <li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
        'TSC: something else',
      ]),
      false,
    );
  });

  it('clears desktop-layout-only CONTRACT without calling repairFn', async () => {
    let repairCalls = 0;
    const broken = `export const Default = () => (
  <div className="grid grid-cols-1 md:grid-cols-8" />
);
`;
    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'Hero',
        kebab: 'hero',
        tsx: broken,
      },
      {
        maxRetries: 1,
        collectFn: async (_opts, draft) => {
          const diags = [];
          const src = draft.tsx || '';
          if (
            /\bmd:grid-cols-[2-9]\b/.test(src) &&
            !/\blg:grid-cols-/.test(src)
          ) {
            diags.push(
              'CONTRACT: multi-column grid at md: without lg: — desktop composition must unlock at lg: (≥1024)',
            );
          }
          return diags;
        },
        repairFn: async () => {
          repairCalls += 1;
          return { ok: false, skipReason: 'should not run' };
        },
        formatWriteFn: async (opts) => {
          assert.match(opts.tsx || '', /\blg:grid-cols-8\b/);
          assert.doesNotMatch(opts.tsx || '', /\bmd:grid-cols-8\b/);
          return { tsx: 'ok', clientTsx: null };
        },
      },
    );
    assert.equal(repairCalls, 0);
    assert.deepEqual(paths, { tsx: 'ok', clientTsx: null });
  });

  it('diagnosticsAreMechanicalOnly accepts list-none and desktop-layout CONTRACTs', () => {
    assert.equal(
      diagnosticsAreMechanicalOnly([
        'CONTRACT: multi-column grid at md: without lg: — desktop composition must unlock at lg: (≥1024)',
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        'CONTRACT: carousel wraps to grid at md: — use lg:grid (≥1024) so tablet keeps the slider',
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        'CONTRACT: <li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
        'CONTRACT: multi-column grid at md: without lg: — desktop composition must unlock at lg: (≥1024)',
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        'CONTRACT: multi-column grid at md: without lg: — desktop composition must unlock at lg: (≥1024)',
        'TSC: something else',
      ]),
      false,
    );
  });

  it('diagnosticsAreMechanicalOnly accepts JSX and Field-type import CONTRACTs', () => {
    assert.equal(
      diagnosticsAreMechanicalOnly([
        "CONTRACT: tsx uses JSX.Element (or JSX.*) without importing JSX from 'react' — emit import React, { JSX, … } from 'react' (TS2694)",
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        "CONTRACT: tsx uses RichTextField, ImageField, LinkField, Field without import type { RichTextField, ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs' (TS2304)",
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        "CONTRACT: tsx uses JSX.Element (or JSX.*) without importing JSX from 'react' — emit import React, { JSX, … } from 'react' (TS2694)",
        "CONTRACT: tsx uses Field without import type { Field } from '@sitecore-content-sdk/nextjs' (TS2304)",
        'CONTRACT: <li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
      ]),
      true,
    );
    assert.equal(
      diagnosticsAreMechanicalOnly([
        "CONTRACT: tsx uses JSX.Element (or JSX.*) without importing JSX from 'react' — emit import React, { JSX, … } from 'react' (TS2694)",
        'TSC: something else',
      ]),
      false,
    );
  });

  it('does not treat fields.children as a hard CONTRACT failure', async () => {
    let repairCalls = 0;
    const src = `import { Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
export const Default = (props: ComponentWithContextProps) => {
  return fields.children.results.map((c) => <Text field={c.fields.Label} />);
};
`;

    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'List',
        kebab: 'list',
        tsx: src,
      },
      {
        maxRetries: 1,
        collectFn: async () => [],
        repairFn: async () => {
          repairCalls += 1;
          return { ok: false, skipReason: 'should not run' };
        },
        formatWriteFn: async (opts) => {
          // Gate removed: fields.children may remain; no forced rewrite.
          assert.match(opts.tsx || '', /\bfields\.children\b/);
          return { tsx: 'ok', clientTsx: null };
        },
      },
    );

    assert.equal(repairCalls, 0);
    assert.deepEqual(paths, { tsx: 'ok', clientTsx: null });
  });

  it('syncs definition placeholders from AppPlaceholder before collect (no repairFn)', async () => {
    let repairCalls = 0;
    /** @type {string|null} */
    let seenDefinition = null;
    const tsx = `import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'insured-links';
const phName = placeholderBase;
export const Default = () => (
  <div className="grid gap-4">
    <AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
  </div>
);
`;
    const emptyDef = `export const menzisSupportLinksDefinition = {
  definitionKey: 'menzis-support-links',
  componentName: 'MenzisSupportLinks',
  placeholders: [],
};
`;

    const paths = await writeComponentPackageWithBuildRetries(
      {
        hostSlug: 'demo',
        componentName: 'MenzisSupportLinks',
        kebab: 'menzis-support-links',
        role: 'child',
        definitionKey: 'menzis-support-links',
        definitionTs: emptyDef,
        sectionInfo: {
          layout: {
            equalHeightChildren: true,
            equalHeightEvidence: 'peer cards share one row height',
            pattern: 'card-grid',
          },
        },
        tsx,
      },
      {
        maxRetries: 1,
        collectFn: async (opts, draft) => {
          seenDefinition = String(opts.definitionTs || '');
          const diags = [];
          if (
            /\bAppPlaceholder\b/.test(draft.tsx || '') &&
            !/key\s*:\s*["']insured-links["']/.test(seenDefinition)
          ) {
            diags.push(
              'CONTRACT: AppPlaceholder in TSX requires definition placeholders with keys',
            );
          }
          return diags;
        },
        repairFn: async () => {
          repairCalls += 1;
          return { ok: false, skipReason: 'should not run' };
        },
        formatWriteFn: async (opts) => {
          assert.match(String(opts.definitionTs || ''), /insured-links/);
          // Equal-height layout tracks are always-on sanitizers (kill switch);
          // when off, sync still fills placeholder keys without rewriting layout.
          if (WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED) {
            assert.match(opts.tsx || '', /items-stretch/);
            assert.match(opts.tsx || '', /\[&>\*\]:h-full/);
          }
          return { tsx: 'ok', clientTsx: null };
        },
      },
    );

    assert.equal(repairCalls, 0);
    assert.match(String(seenDefinition || ''), /insured-links/);
    assert.deepEqual(paths, { tsx: 'ok', clientTsx: null });
  });

  it('discards AI repair when diagnostics do not improve', async () => {
    let repairCalls = 0;
    /** @type {string[]} */
    const seenTsx = [];
    await assert.rejects(
      () =>
        writeComponentPackageWithBuildRetries(
          {
            hostSlug: 'demo',
            componentName: 'BrokenBrace',
            kebab: 'broken-brace',
            tsx: 'export const Default = () => {\nreturn null;\n',
          },
          {
            maxRetries: 1,
            collectFn: async (_opts, draft) => {
              seenTsx.push(String(draft.tsx || ''));
              // Always report the same failure — candidate never improves
              return ["TSC: file.tsx:3:1 — TS1005: '}' expected."];
            },
            repairFn: async () => {
              repairCalls += 1;
              // "Fix" that does not clear the diagnostic
              return {
                ok: true,
                tsx: 'export const Default = () => {\nreturn null;\n// noise\n',
              };
            },
            formatWriteFn: async () => {
              throw new Error('should not write after discard');
            },
          },
        ),
      /TSX build validate failed for BrokenBrace/,
    );
    assert.equal(repairCalls, 1);
    // After discard, prior source kept (no // noise in a later successful write — we failed)
    assert.ok(seenTsx.length >= 2);
  });
});
