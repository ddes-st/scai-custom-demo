/**
 * Run: node --import tsx --test tools/create-section-components/resolve-wire-component-results.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWireComponentResults } from './resolve-wire-component-results.mjs';

describe('resolveWireComponentResults', () => {
  it('prefers sharedBuiltThisRun over prior ghosts', () => {
    const sharedBuiltThisRun = new Map([
      [
        'grid-section-1',
        {
          components: [
            {
              role: 'section',
              definitionKey: 'menzis-help-and-health-content',
            },
            {
              role: 'child',
              definitionKey: 'menzis-support-link-card',
              contentItemNames: ['Insured Links'],
            },
          ],
          layoutSketch: { target: 'page' },
        },
      ],
    ]);
    const out = resolveWireComponentResults({
      registryFolder: 'grid-section-1',
      sharedBuiltThisRun,
      priorComponents: [
        { role: 'section', definitionKey: 'menzis-help-and-health-content' },
        { role: 'child', definitionKey: 'menzis-support-grid', contentItemNames: [] },
      ],
    });
    assert.equal(out.source, 'sharedBuiltThisRun');
    assert.equal(out.layoutSketch?.target, 'page');
    assert.ok(
      out.componentResults.some((c) => c.definitionKey === 'menzis-support-link-card'),
    );
    assert.equal(
      out.componentResults.some((c) => c.definitionKey === 'menzis-support-grid'),
      false,
    );
  });

  it('hydrates/prunes prior when no sharedBuiltThisRun', () => {
    const out = resolveWireComponentResults({
      registryFolder: 'grid-section-1',
      sharedBuiltThisRun: new Map(),
      priorComponents: [
        { role: 'section', definitionKey: 'host' },
        { role: 'child', definitionKey: 'ghost-child', contentItemNames: [] },
      ],
    });
    assert.equal(out.source, 'prior');
    assert.equal(out.componentResults.length, 1);
    assert.equal(out.componentResults[0].definitionKey, 'host');
  });
});
