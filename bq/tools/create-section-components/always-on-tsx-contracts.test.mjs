/**
 * Always-on write-path TSX contracts (prompt-first safe).
 * Run: node --import tsx --test tools/create-section-components/always-on-tsx-contracts.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  rewriteTextOnLinkField,
  ensureSdkJsxValueImports,
  normalizeCustomEventDetailVsFieldString,
} from './ai-source-fixup.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('rewriteTextOnLinkField', () => {
  it('strips Text on LinkField nested under matching Link', () => {
    const src = `
import { Link, Text } from '@sitecore-content-sdk/nextjs';
interface Fields { CTA: LinkField; }
export const Default = ({ fields }: { fields: Fields }) => (
  <Link field={fields.CTA} className="text-sm">
    <span className="underline"><Text field={fields.CTA} /></span>
    <span aria-hidden="true">→</span>
  </Link>
);
`;
    const out = rewriteTextOnLinkField(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\.CTA\}/);
    assert.doesNotMatch(out, /value\?\.text/);
    assert.match(out, /→/);
  });

  it('rewrites Text on LinkField under custom anchor to value.text', () => {
    const src = `
interface Fields { CTA: LinkField; }
export const Default = ({ fields }: { fields: Fields }) => (
  <a href={fields.CTA?.value?.href}>
    <span><Text field={fields.CTA} /></span>
  </a>
);
`;
    const out = rewriteTextOnLinkField(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\.CTA\}/);
    assert.match(out, /\{String\(fields\.CTA\?\.value\?\.text \?\? ''\)\}/);
  });

  it('rewrites spaced LinkField Text outside Link', () => {
    const src = `
interface Fields { "Primary CTA": LinkField; }
export const Default = ({ fields }: { fields: Fields }) => (
  <button type="button"><Text field={fields["Primary CTA"]} /></button>
);
`;
    const out = rewriteTextOnLinkField(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\["Primary CTA"\]\}/);
    assert.match(out, /fields\["Primary CTA"\]\?\.value\?\.text/);
  });
});

describe('ensureSdkJsxValueImports', () => {
  it('adds RichText to existing SDK value import when used', () => {
    const src = `
import { Text, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { RichTextField } from '@sitecore-content-sdk/nextjs';
export const Default = ({ fields }) => (
  <>
    <Text field={fields.Heading} />
    <RichText field={fields.Body} />
  </>
);
`;
    const out = ensureSdkJsxValueImports(src);
    assert.match(
      out,
      /import\s+\{\s*Text,\s*Image,\s*Link,\s*RichText\s*\}\s+from\s+['"]@sitecore-content-sdk\/nextjs['"]/,
    );
  });

  it('creates value import when only type import exists', () => {
    const src = `
import type { RichTextField } from '@sitecore-content-sdk/nextjs';
export const Default = ({ fields }) => <RichText field={fields.Body} />;
`;
    const out = ensureSdkJsxValueImports(src);
    assert.match(
      out,
      /import\s+\{\s*RichText\s*\}\s+from\s+['"]@sitecore-content-sdk\/nextjs['"]/,
    );
  });

  it('no-ops when imports already present', () => {
    const src = `
import { RichText, Text } from '@sitecore-content-sdk/nextjs';
export const Default = ({ fields }) => <RichText field={fields.Body} />;
`;
    assert.equal(ensureSdkJsxValueImports(src), src);
  });
});

describe('normalizeCustomEventDetailVsFieldString', () => {
  it('rewrites CustomEvent<number> when detail pairs with Field string value', () => {
    const src = `
'use client';
interface Fields { Heading: Field<string>; }
export const Default = (props: { fields: Fields }) => {
  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent<number>).detail !== props.fields.Heading?.value) setActive(false);
    };
    window.addEventListener('menzis-reason-active', handler);
  }, [props.fields.Heading?.value]);
  const toggle = () => {
    window.dispatchEvent(
      new CustomEvent('menzis-reason-active', { detail: props.fields.Heading?.value }),
    );
  };
};
`;
    const out = normalizeCustomEventDetailVsFieldString(src);
    assert.match(out, /CustomEvent<string>/);
    assert.doesNotMatch(out, /CustomEvent<number>/);
  });

  it('no-ops when CustomEvent<number> is unrelated to fields', () => {
    const src = `
const handler = (event: Event) => {
  if ((event as CustomEvent<number>).detail > 3) return;
};
`;
    assert.equal(normalizeCustomEventDetailVsFieldString(src), src);
  });
});

describe('write-path always-on wiring', () => {
  it('write-component.mjs calls the three always-on helpers', async () => {
    const src = await readFile(path.join(here, 'write-component.mjs'), 'utf8');
    assert.match(src, /rewriteTextOnLinkField/);
    assert.match(src, /ensureSdkJsxValueImports/);
    assert.match(src, /normalizeCustomEventDetailVsFieldString/);
    assert.match(
      src,
      /normalizedTsx\s*=\s*rewriteTextOnLinkField\s*\(\s*normalizedTsx\s*\)/,
    );
    assert.match(
      src,
      /normalizedTsx\s*=\s*ensureSdkJsxValueImports\s*\(\s*normalizedTsx\s*\)/,
    );
    assert.match(
      src,
      /normalizedTsx\s*=\s*normalizeCustomEventDetailVsFieldString\s*\(\s*normalizedTsx\s*\)/,
    );
  });
});
