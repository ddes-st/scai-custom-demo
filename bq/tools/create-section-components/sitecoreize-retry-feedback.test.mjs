/**
 * Run: node --import tsx --test tools/create-section-components/sitecoreize-retry-feedback.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMultiBandRetryChanges,
  buildMultiBandSeedChecklist,
  buildSitecoreizeRetryRevisionBrief,
  formatSitecoreizeValidationFeedbackMessage,
  isSitecoreizeRetryCollapse,
  serializeSitecoreizePreviousForFeedback,
  sitecoreizeRetryPurposeLabel,
} from './section-codegen.mjs';

describe('formatSitecoreizeValidationFeedbackMessage', () => {
  it('demands FULL re-emit and attaches previous packages + sketch', () => {
    const brief = buildSitecoreizeRetryRevisionBrief({
      kind: 'multi-band',
      changes: ['CONTRACT: under-seeded'],
      packages: [
        {
          role: 'section',
          componentName: 'Host',
          definitionKey: 'host',
          tsx: 'export const Default = () => null;',
          definitionTs: 'export const host = { content: { items: [] } };',
        },
        {
          role: 'child',
          componentName: 'Band',
          definitionKey: 'band',
          parentPlaceholder: 'bands',
          tsx: 'export const Default = () => null;',
          definitionTs:
            'export const band = { content: { items: [{ name: "A", fields: {} }] } };',
        },
      ],
      layoutSketch: {
        renderings: [
          {
            componentName: 'Host',
            placeholders: {
              bands: [
                { componentName: 'Band', datasourceName: 'A' },
                { componentName: 'Band', datasourceName: 'B' },
              ],
            },
          },
        ],
      },
    });
    const msg = formatSitecoreizeValidationFeedbackMessage(brief);
    assert.ok(msg);
    assert.match(msg.content, /FULL RE-EMIT REQUIRED/i);
    assert.doesNotMatch(msg.content, /repair only/i);
    assert.match(msg.content, /PREVIOUS PACKAGES JSON/);
    assert.match(msg.content, /PREVIOUS LAYOUT SKETCH/);
    assert.match(msg.content, /"componentName": "Band"/);
    assert.match(msg.content, /datasourceName/);
    assert.match(msg.content, /never a delta/i);
  });

  it('returns null when empty', () => {
    assert.equal(formatSitecoreizeValidationFeedbackMessage(null), null);
    assert.equal(formatSitecoreizeValidationFeedbackMessage({}), null);
  });
});

describe('isSitecoreizeRetryCollapse', () => {
  it('detects host-only after composite', () => {
    assert.equal(
      isSitecoreizeRetryCollapse(
        [
          { role: 'section', tsx: 'a'.repeat(1000), definitionTs: 'b'.repeat(1000) },
          {
            role: 'child',
            parentPlaceholder: 'x',
            tsx: 'c'.repeat(1000),
            definitionTs: 'd'.repeat(1000),
          },
        ],
        [{ role: 'section', tsx: 'tiny', definitionTs: 'tiny' }],
      ),
      true,
    );
  });

  it('is false when children preserved', () => {
    assert.equal(
      isSitecoreizeRetryCollapse(
        [
          { role: 'section', tsx: 'a', definitionTs: 'b' },
          { role: 'child', parentPlaceholder: 'x', tsx: 'c', definitionTs: 'd' },
        ],
        [
          { role: 'section', tsx: 'a2', definitionTs: 'b2' },
          { role: 'child', parentPlaceholder: 'x', tsx: 'c2', definitionTs: 'd2' },
        ],
      ),
      false,
    );
  });
});

describe('buildMultiBandSeedChecklist', () => {
  it('lists required datasourceNames when under-seeded', () => {
    const lines = buildMultiBandSeedChecklist(
      {
        renderings: [
          {
            placeholders: {
              bands: [
                { componentName: 'MenzisSplitContentBand', datasourceName: 'One' },
                { componentName: 'MenzisSplitContentBand', datasourceName: 'Two' },
                { componentName: 'MenzisSplitContentBand', datasourceName: 'Three' },
              ],
            },
          },
        ],
      },
      [
        {
          role: 'child',
          componentName: 'MenzisSplitContentBand',
          definitionTs:
            'export const x = { content: { items: [{ name: "One", fields: {} }] } };',
        },
      ],
    );
    assert.equal(lines.length, 1);
    assert.match(lines[0], /length=3/);
    assert.match(lines[0], /have 1/);
    assert.match(lines[0], /One, Two, Three/);
  });
});

describe('buildMultiBandRetryChanges', () => {
  it('includes checklist and bans deltas without re-pasting HARD essay', () => {
    const changes = buildMultiBandRetryChanges(
      ['CONTRACT: under-seeded'],
      {
        renderings: [
          {
            placeholders: {
              bands: [
                { componentName: 'Band', datasourceName: 'A' },
                { componentName: 'Band', datasourceName: 'B' },
              ],
            },
          },
        ],
      },
      [
        {
          role: 'child',
          componentName: 'Band',
          definitionTs:
            'export const x = { content: { items: [{ name: "A", fields: {} }] } };',
        },
      ],
      { sectionComponentName: 'Host' },
    );
    assert.ok(changes.some((c) => /SEED CHECKLIST/i.test(c)));
    assert.ok(changes.some((c) => /FULL RE-EMIT/i.test(c)));
    assert.ok(!changes.some((c) => /^HARD — When section HTML/.test(c)));
  });
});

describe('serializeSitecoreizePreviousForFeedback', () => {
  it('caps oversized bodies', () => {
    const big = 'x'.repeat(80_000);
    const { packagesJson, layoutSketchJson } =
      serializeSitecoreizePreviousForFeedback(
        [
          {
            role: 'section',
            componentName: 'Host',
            tsx: big,
            definitionTs: big,
          },
        ],
        { renderings: [] },
        { maxChars: 40_000 },
      );
    assert.ok(packagesJson.length + layoutSketchJson.length <= 40_000 + 200);
    assert.match(packagesJson, /truncated/i);
  });
});

describe('sitecoreizeRetryPurposeLabel', () => {
  it('labels multi-band / orphan distinctly', () => {
    assert.equal(
      sitecoreizeRetryPurposeLabel({
        attempt: 0,
        orphanRetries: 0,
        multiBandRetries: 0,
      }),
      'codegen-sitecoreize',
    );
    assert.equal(
      sitecoreizeRetryPurposeLabel({
        attempt: 1,
        orphanRetries: 0,
        multiBandRetries: 1,
      }),
      'codegen-sitecoreize-multi-band-retry-1',
    );
    assert.equal(
      sitecoreizeRetryPurposeLabel({
        attempt: 1,
        orphanRetries: 1,
        multiBandRetries: 0,
      }),
      'codegen-sitecoreize-orphan-retry-1',
    );
  });
});
