import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureCompanionClientUseClient,
  fixJsxClassNameEscapedQuotes,
  normalizeClientTsx,
  normalizeComponentTsx,
} from './ai-source-fixup.mjs';
import {
  collapseJsxTagWhitespace,
  formatGeneratedSource,
  stripUnnecessaryJsxSpaceExpressions,
} from './format-generated-source.mjs';

describe('collapseJsxTagWhitespace', () => {
  it('collapses spaces between adjacent tags', () => {
    const src = '<div> <span>x</span> </div>';
    const out = collapseJsxTagWhitespace(src);
    assert.equal(out, '<div>\n<span>x</span>\n</div>');
  });

  it('does not rewrite spaces inside string literals', () => {
    const src = `const s = "> <";\n<div> <span /></div>`;
    const out = collapseJsxTagWhitespace(src);
    assert.match(out, /const s = "> <"/);
    assert.match(out, /<div>\n<span \/>/);
  });
});

describe('stripUnnecessaryJsxSpaceExpressions', () => {
  it('strips own-line and between-tag space expressions (consent-like)', () => {
    const src = `export const Default = () => (
  <ConsentChrome>
    {' '}
    <section>
      {' '}
      <div>
        <Text field={fields.Message} />{' '}
      </div>{' '}
      <input />{' '}
      <Text field={fields.Label} />{' '}
    </section>{' '}
  </ConsentChrome>
);
`;
    const out = stripUnnecessaryJsxSpaceExpressions(src);
    assert.equal((out.match(/\{' '\}/g) || []).length, 0, out);
    assert.match(out, /<ConsentChrome>/);
    assert.match(out, /<Text field=\{fields\.Message\} \/>/);
  });

  it('keeps space between expression/text joins', () => {
    const src = `export const Default = () => (
  <p>
    {first}{' '}{last}
    Hello{' '}{name}
  </p>
);
`;
    const out = stripUnnecessaryJsxSpaceExpressions(src);
    assert.equal((out.match(/\{' '\}/g) || []).length, 2, out);
    assert.match(out, /\{first\}\{' '\}\{last\}/);
    assert.match(out, /Hello\{' '\}\{name\}/);
  });

  it('strips double-quoted space expressions between tags', () => {
    const src = `<div>{" "}<span /></div>`;
    const out = stripUnnecessaryJsxSpaceExpressions(src);
    assert.equal((out.match(/\{["'] ["']\}/g) || []).length, 0, out);
  });
});

describe('fixJsxClassNameEscapedQuotes via normalize', () => {
  it("normalizeComponentTsx rewrites font-[\\\"…\\\"] to font-['…']", () => {
    const src = `export const Default = () => (
  <div className="font-[\\"DM_Sans\\"] text-black" />
);
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /font-\['DM_Sans'\]/);
    assert.doesNotMatch(out, /\\"/);
  });

  it("normalizeClientTsx rewrites font-[\\\"…\\\"] to font-['…']", () => {
    const src = `'use client';
export default function Chrome() {
  return <div className="font-[\\"DM_Sans\\"]" />;
}
`;
    const out = normalizeClientTsx(src);
    assert.match(out, /font-\['DM_Sans'\]/);
  });

  it("normalizeClientTsx collapses duplicate 'use client' directives", () => {
    const src = `'use client';
'use client';
export default function Chrome() {
  return null;
}
`;
    const out = normalizeClientTsx(src);
    assert.equal((out.match(/['"]use client['"]/g) || []).length, 1);
    assert.match(out, /^'use client';/);
  });

  it("normalizeClientTsx prepends 'use client' when missing", () => {
    const src = `export default function Chrome({ children }: { children: React.ReactNode }) {
  return <div className="flex">{children}</div>;
}
`;
    const out = normalizeClientTsx(src);
    assert.match(out, /^'use client';\s*\n/);
    assert.match(out, /export default function Chrome/);
  });

  it("ensureCompanionClientUseClient prepends without duplicating", () => {
    const missing = `export default function Chrome() { return null; }\n`;
    const once = ensureCompanionClientUseClient(missing);
    assert.match(once, /^'use client';\s*\n/);
    assert.equal(
      (ensureCompanionClientUseClient(once).match(/['"]use client['"]/g) || [])
        .length,
      1,
    );
  });

  it('fixJsxClassNameEscapedQuotes is exported for direct use', () => {
    const out = fixJsxClassNameEscapedQuotes('font-[\\"X\\"]');
    assert.equal(out, "font-['X']");
  });

  it("flips className='…font-[\\'…\\']…' to double-quoted font-['…']", () => {
    const src =
      "<h2 className='m-0 font-[\\'CrelanSunset\\',sans-serif] text-[18px] font-medium leading-[1.2] text-[#3c3c3c]'>";
    const out = fixJsxClassNameEscapedQuotes(src);
    assert.match(out, /className="m-0 font-\['CrelanSunset',sans-serif]/);
    assert.doesNotMatch(out, /\\'/);
  });

  it("preserves comma stacks when rewriting font-[\\\"…\\\",sans-serif]", () => {
    const out = fixJsxClassNameEscapedQuotes(
      'className="font-[\\"Open_Sans\\",sans-serif]"',
    );
    assert.equal(out, "className=\"font-['Open_Sans',sans-serif]\"");
  });

  it("normalizeComponentTsx + format succeeds on Crelan-style \\' className", async () => {
    const src = `export const Default = () => (
  <div className='flex min-w-0 flex-1 flex-col justify-center gap-4'>
    <h2 className='m-0 font-[\\'CrelanSunset\\',sans-serif] text-[18px] font-medium leading-[1.2] text-[#3c3c3c]'>
      Title
    </h2>
  </div>
);
`;
    const normalized = normalizeComponentTsx(src);
    assert.match(normalized, /className="[^"]*font-\['CrelanSunset',sans-serif]/);
    const pretty = await formatGeneratedSource(normalized, {
      filepath: 'crelan-hero-card.tsx',
    });
    assert.match(pretty, /font-\['CrelanSunset',sans-serif]/);
    assert.doesNotMatch(pretty, /\\'/);
  });
});

describe('formatGeneratedSource', () => {
  it('does not invent a sea of {\' \'} from minified inter-tag spaces', async () => {
    const src = `export default function C() {
  return (<section><div className="a"> <span>hi</span> </div></section>);
}
`;
    const out = await formatGeneratedSource(src, { filepath: 'sample.tsx' });
    const spaceTokens = out.match(/\{' '\}/g) || [];
    assert.ok(
      spaceTokens.length <= 1,
      `expected few or no {' '} tokens, got ${spaceTokens.length}:\n${out}`,
    );
    assert.match(out, /export default function C/);
    assert.match(out, /<section>/);
  });

  it('strips LLM-emitted between-tag spaces after format', async () => {
    const src = `export default function C() {
  return (
    <section>
      {' '}
      <div className="a">
        <span>hi</span>{' '}
      </div>{' '}
    </section>
  );
}
`;
    const out = await formatGeneratedSource(src, { filepath: 'sample.tsx' });
    assert.equal(
      (out.match(/\{' '\}/g) || []).length,
      0,
      `expected no {' '} tokens:\n${out}`,
    );
    assert.match(out, /<section>/);
    assert.match(out, /<span>hi<\/span>/);
  });

  it('keeps necessary text/expression space joins after format', async () => {
    const src = `export default function C({ first, last }: { first: string; last: string }) {
  return <p>{first}{' '}{last}</p>;
}
`;
    const out = await formatGeneratedSource(src, { filepath: 'sample.tsx' });
    // Prettier may normalize {' '} to a literal space between expressions.
    assert.match(out, /\{first\}(?:\{' '\}| )\{last\}/);
    assert.doesNotMatch(out, /\{first\}\{last\}/);
  });

  it('rejects unparseable TSX instead of writing the raw dump', async () => {
    await assert.rejects(
      () =>
        formatGeneratedSource('export const Default = ( => <div/>;', {
          filepath: 'broken.tsx',
        }),
      /prettier failed|refusing to write/i,
    );
  });

  it('expands compact-but-valid JSX to multiline', async () => {
    const src =
      'export default function C(){return(<section><div className="a"><span>hi</span></div></section>);}';
    const out = await formatGeneratedSource(src, { filepath: 'sample.tsx' });
    assert.match(out, /\n/);
    assert.match(out, /<section>/);
    assert.match(out, /<span>hi<\/span>/);
  });
});
