/**
 * Always-on widen: bare `: JSX.Element` + `return null` → `: JSX.Element | null` (TS2322).
 * Run: node --import tsx --test tools/create-section-components/nullable-jsx-return-type.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  ensureNullableJsxReturnType,
} from './ai-source-fixup.mjs';

/** Cookie-wall pattern that previously failed TS2322. */
const cookieWallBare = `'use client';
import React from 'react';

type Props = { fields: unknown };

export const Default = (props: Props): JSX.Element => {
  const [showWall, setShowWall] = React.useState(true);
  if (!showWall) {
    return null;
  }
  return <div role="dialog">Cookie wall</div>;
};
`;

describe('ensureNullableJsxReturnType', () => {
  it('widens bare JSX.Element when return null exists', () => {
    const out = ensureNullableJsxReturnType(cookieWallBare);
    assert.match(out, /:\s*JSX\.Element\s*\|\s*null/);
    assert.doesNotMatch(out, /:\s*JSX\.Element\s*=>/);
    assert.match(out, /return null/);
  });

  it('widens React.JSX.Element and ReactElement flavors', () => {
    const a = ensureNullableJsxReturnType(
      `export const Default = (p: P): React.JSX.Element => {\n  return null;\n};\n`,
    );
    assert.match(a, /:\s*React\.JSX\.Element\s*\|\s*null/);

    const b = ensureNullableJsxReturnType(
      `export default function C(): ReactElement {\n  if (x) return null;\n  return <div />;\n}\n`,
    );
    assert.match(b, /:\s*ReactElement\s*\|\s*null/);
  });

  it('is a no-op when already JSX.Element | null', () => {
    const src = `export const Default = (p: P): JSX.Element | null => {\n  return null;\n};\n`;
    const out = ensureNullableJsxReturnType(src);
    assert.equal(out, src);
    assert.equal((out.match(/\|\s*null/g) || []).length, 1);
  });

  it('is a no-op when there is no return null', () => {
    const src = `export const Default = (p: P): JSX.Element => {\n  return <div />;\n};\n`;
    assert.equal(ensureNullableJsxReturnType(src), src);
  });
});

describe('write-path sanitizer nullable JSX', {
  skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
}, () => {
  it('applyWritePathAlwaysOnTsxSanitizers widens map-entry cookie pattern', () => {
    const { tsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: cookieWallBare,
      kebab: 'menzis-cookie-preference-modal',
    });
    assert.match(tsx, /:\s*JSX\.Element\s*\|\s*null/);
    // Shape that would still fail tsc if left bare:
    assert.doesNotMatch(tsx, /:\s*JSX\.Element\s*=>/);
  });
});
