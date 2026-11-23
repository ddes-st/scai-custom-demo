/**
 * Unit tests for spaced field access fixup.
 * Run: node --test tools/create-section-components/ai-source-fixup.spaced-fields.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fixSpacedFieldAccess,
  normalizeComponentTsx,
} from './ai-source-fixup.mjs';

describe('fixSpacedFieldAccess', () => {
  it('quotes unquoted spaced bracket keys', () => {
    const src = `
interface Fields {
  "Partner Logo": ImageField;
}
field={fields[Partner Logo]}
field={props.fields[Desktop Image]}
`;
    const out = fixSpacedFieldAccess(src);
    assert.match(out, /fields\["Partner Logo"\]/);
    assert.match(out, /props\.fields\["Desktop Image"\]/);
    assert.doesNotMatch(out, /fields\[Partner Logo\]/);
  });

  it('rewrites fields.PascalCase to quoted spaced key from interface', () => {
    const src = `
interface Fields {
  "Mobile Image": ImageField;
}
<Image field={fields.MobileImage} />
`;
    const out = fixSpacedFieldAccess(src);
    assert.match(out, /fields\["Mobile Image"\]/);
  });
});

describe('normalizeComponentTsx spaced brackets', () => {
  it('quotes unquoted spaced brackets as a safety net', () => {
    const src = `
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  "Partner Logo": ImageField;
}

type Props = ComponentProps & { fields: Fields };
export const Default = (props: Props) => (
  <Image field={props.fields[Partner Logo]} />
);
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /fields\["Partner Logo"\]/);
  });

  it('spaces PascalCase Fields keys like IntroHeadline', () => {
    const src = `
import type { TextField } from '@sitecore-content-sdk/nextjs';
import { Text } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  IntroHeadline: TextField;
}

type Props = ComponentProps & { fields: Fields };
export const Default = (props: Props) => (
  <Text field={props.fields.IntroHeadline} />
);
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /"Intro Headline":\s*TextField/);
    assert.match(out, /fields\["Intro Headline"\]/);
  });
});
