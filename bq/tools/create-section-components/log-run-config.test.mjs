/**
 * Run: node --test tools/create-section-components/log-run-config.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectCreateRunConfig,
  formatCreateRunConfig,
} from './log-run-config.mjs';

function byKey(entries, key) {
  return entries.find((e) => e.key === key);
}

describe('collectCreateRunConfig', () => {
  it('defaults screenshot viewports to mobile,tablet,desktop', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_SCREENSHOT_VIEWPORTS');
    assert.equal(row.value, 'mobile,tablet,desktop');
    assert.equal(row.source, 'default');
  });

  it('defaults BQ_CODEGEN_EVIDENCE_MODE to html without screenshots', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_CODEGEN_EVIDENCE_MODE');
    assert.equal(row.value, 'html  attachScreenshots=off');
    assert.equal(row.source, 'default');
  });

  it('defaults BQ_CODEGEN_V2_FIXUPS to prompt-first off under v2', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_CODEGEN_V2_FIXUPS');
    assert.ok(row);
    assert.match(row.value, /prompt-first|mutate skipped/i);
    assert.equal(row.source, 'default');
  });

  it('reads BQ_CODEGEN_EVIDENCE_MODE=png from env', () => {
    const entries = collectCreateRunConfig({
      env: { BQ_CODEGEN_EVIDENCE_MODE: 'png' },
    });
    const row = byKey(entries, 'BQ_CODEGEN_EVIDENCE_MODE');
    assert.equal(row.value, 'png  attachScreenshots=on');
    assert.equal(row.source, 'env');
  });

  it('uses explicit BQ_SCREENSHOT_VIEWPORTS from env', () => {
    const entries = collectCreateRunConfig({
      env: {
        BQ_SCREENSHOT_VIEWPORTS:
          'mobile,tablet,desktop,desktopRegular,desktopLarge',
      },
    });
    const row = byKey(entries, 'BQ_SCREENSHOT_VIEWPORTS');
    assert.equal(
      row.value,
      'mobile,tablet,desktop,desktopRegular,desktopLarge',
    );
    assert.equal(row.source, 'env');
  });

  it('defaults validate max iters to 3', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_TSX_VALIDATE_MAX_ITERS');
    assert.equal(row.value, '3');
    assert.equal(row.source, 'default');
  });

  it('defaults definition validate retries to 1', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_DEFINITION_VALIDATE_MAX_ITERS');
    assert.ok(row);
    assert.match(row.value, /^1\s+/);
    assert.match(row.value, /retries after definition parse fail/);
    assert.equal(row.source, 'default');
  });

  it('reads BQ_TSX_VALIDATE_MAX_ITERS=0 from env', () => {
    const entries = collectCreateRunConfig({
      env: { BQ_TSX_VALIDATE_MAX_ITERS: '0' },
    });
    const row = byKey(entries, 'BQ_TSX_VALIDATE_MAX_ITERS');
    assert.equal(row.value, '0');
    assert.equal(row.source, 'env');
  });

  it('marks validate iters as cli when hinted', () => {
    const entries = collectCreateRunConfig({
      env: { BQ_TSX_VALIDATE_MAX_ITERS: '2' },
      cliHints: { tsxValidateMaxIters: true },
    });
    assert.equal(byKey(entries, 'BQ_TSX_VALIDATE_MAX_ITERS').source, 'cli');
  });

  it('distinguishes cultures unset vs empty', () => {
    const unset = collectCreateRunConfig({ env: {} });
    assert.equal(
      byKey(unset, 'BQ_CULTURES').value,
      '(unset → none / CLI later)',
    );
    assert.equal(byKey(unset, 'BQ_CULTURES').source, 'default');

    const empty = collectCreateRunConfig({ env: { BQ_CULTURES: '' } });
    assert.equal(byKey(empty, 'BQ_CULTURES').value, '(empty)');
    assert.equal(byKey(empty, 'BQ_CULTURES').source, 'env');

    const listed = collectCreateRunConfig({
      env: { BQ_CULTURES: 'nl-BE,fr-BE' },
    });
    assert.equal(byKey(listed, 'BQ_CULTURES').value, 'nl-BE,fr-BE');
    assert.equal(byKey(listed, 'BQ_CULTURES').source, 'env');
  });

  it('shows fidelity off by default with default maxIters/minScore', () => {
    const entries = collectCreateRunConfig({ env: {} });
    assert.match(
      byKey(entries, 'BQ_SOURCE_FIDELITY').value,
      /^off\s+maxIters=3\s+minScore=90$/,
    );
    assert.match(
      byKey(entries, 'BQ_VISUAL_FIDELITY').value,
      /^off\s+maxIters=3\s+minScore=95$/,
    );
    assert.match(
      byKey(entries, 'BQ_VISUAL_CAPTURE_ONLY').value,
      /^on \(shots without AI when fidelity off\)$/,
    );
    assert.equal(byKey(entries, 'BQ_VISUAL_CAPTURE_ONLY').source, 'default');
  });

  it('shows BQ_VISUAL_CAPTURE_ONLY off from env', () => {
    const entries = collectCreateRunConfig({
      env: { BQ_VISUAL_CAPTURE_ONLY: 'false' },
    });
    assert.equal(byKey(entries, 'BQ_VISUAL_CAPTURE_ONLY').value, 'off');
    assert.equal(byKey(entries, 'BQ_VISUAL_CAPTURE_ONLY').source, 'env');
  });

  it('defaults BQ_LINK_LIST_AS_COMPOSITE to off', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = byKey(entries, 'BQ_LINK_LIST_AS_COMPOSITE');
    assert.ok(row);
    assert.match(row.value, /^off\b/);
    assert.equal(row.source, 'default');
  });

  it('reads BQ_LINK_LIST_AS_COMPOSITE=1 from env', () => {
    const entries = collectCreateRunConfig({
      env: { BQ_LINK_LIST_AS_COMPOSITE: '1' },
    });
    const row = byKey(entries, 'BQ_LINK_LIST_AS_COMPOSITE');
    assert.match(row.value, /^on\b/);
    assert.match(row.value, /link-item|JSON bags forbidden/i);
    assert.equal(row.source, 'env');
  });
});

describe('formatCreateRunConfig', () => {
  it('includes header and screenshot note', () => {
    const text = formatCreateRunConfig(
      collectCreateRunConfig({ env: {} }),
    );
    assert.match(text, /^Run config \(resolved\):/m);
    assert.match(text, /BQ_SCREENSHOT_VIEWPORTS=mobile,tablet,desktop \(default\)/);
    assert.match(text, /BQ_CODEGEN_EVIDENCE_MODE/);
  });
});
