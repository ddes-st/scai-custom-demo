/**
 * HTML multi-band CONTRACT — HelpAndHealth-like + footer fixtures.
 * Diagnostics must mention packages/placeholders/field-bags — never planMode.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectHtmlMultiBandEmitDiagnostics,
  collectLayoutSketchInstancePlan,
  countDefinitionTsContentItems,
  countLayoutSketchNestedPeers,
  countLayoutSketchPeersByComponentName,
  detectHtmlMultiBandEvidence,
  parentDefinitionHasPeerBandFieldBags,
  presentationChildrenFromLayoutSketch,
} from './html-multi-band-contract.mjs';

const HELP_AND_HEALTH_HTML = `
<section class="help-and-health">
  <div class="grid-section support">
    <h2>Hulp en gezondheid</h2>
    <a href="/a">Card A</a>
  </div>
  <div class="grid-section tips">
    <h2>Tips</h2>
    <a href="/b">Card B</a>
  </div>
  <div class="grid-section more">
    <h2>Meer</h2>
    <a href="/c">Card C</a>
  </div>
</section>
`;

const FOOTER_HTML = `
<footer>
  <div class="footer-signpost">Signpost</div>
  <nav class="footer-navigation">Nav</nav>
  <div class="footer-legal">Legal</div>
  <div class="footer-branding">Brand</div>
</footer>
`;

describe('detectHtmlMultiBandEvidence', () => {
  it('detects HelpAndHealth-like stacked grid-section peers', () => {
    const ev = detectHtmlMultiBandEvidence(HELP_AND_HEALTH_HTML);
    assert.equal(ev.multiBand, true);
    assert.ok(ev.bandCount >= 2);
  });

  it('detects footer band peers', () => {
    const ev = detectHtmlMultiBandEvidence(FOOTER_HTML);
    assert.equal(ev.multiBand, true);
    assert.ok(ev.bandCount >= 2);
  });

  it('returns false for single-band HTML', () => {
    const ev = detectHtmlMultiBandEvidence('<section><h2>Only one</h2></section>');
    assert.equal(ev.multiBand, false);
  });

  it('ignores grid-section peers nested inside dialog', () => {
    const html = `
<header class="header">
  <div class="grid-section"><div class="container">bar</div></div>
  <dialog class="modal--search">
    <div class="grid-section"><p class="h2">Search</p></div>
  </dialog>
</header>`;
    const ev = detectHtmlMultiBandEvidence(html);
    assert.equal(ev.multiBand, false);
    assert.equal(ev.bandCount, 1);
  });
});

describe('collectHtmlMultiBandEmitDiagnostics', () => {
  it('fails hollow mega package (no children) for HelpAndHealth HTML', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: HELP_AND_HEALTH_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-help-and-health',
          definitionTs: `
            export default {
              placeholders: [],
              fields: [{ name: 'Cards', type: 'Multi-Line Text' }],
            };
          `,
        },
      ],
      layoutSketch: null,
    });
    assert.ok(diags.length >= 1);
    assert.ok(diags.some((d) => /role:"child"|child packages/i.test(d)));
    assert.ok(diags.every((d) => !/\bplanMode\b/.test(d)));
  });

  it('fails empty allowedControls when children present', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: HELP_AND_HEALTH_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-help-and-health',
          definitionTs: `
            export default {
              placeholders: [{ key: 'support-cards', allowedControls: [] }],
            };
          `,
        },
        {
          role: 'child',
          definitionKey: 'menzis-link-card',
          parentPlaceholder: 'support-cards',
        },
      ],
      layoutSketch: {
        componentName: 'MenzisHelpAndHealth',
        placeholders: {
          'support-cards': [
            { componentName: 'MenzisLinkCard', datasourceName: 'Card A' },
          ],
        },
      },
    });
    assert.ok(diags.some((d) => /allowedControls|placeholders/i.test(d)));
    assert.ok(diags.every((d) => !/\bplanMode\b/.test(d)));
  });

  it('fails field-bag mega host without child packages', () => {
    const def = `
      export default {
        placeholders: [],
        fields: [{ name: 'Cards', type: 'Multi-Line Text' }],
        content: { items: [{ Cards: '[{"text":"A"}]' }] },
      };
    `;
    assert.equal(parentDefinitionHasPeerBandFieldBags(def), true);
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: HELP_AND_HEALTH_HTML,
      packages: [{ role: 'section', definitionTs: def }],
    });
    assert.ok(diags.some((d) => /field bags|Multi-Line Text/i.test(d)));
    assert.ok(diags.every((d) => !/\bplanMode\b/.test(d)));
  });

  it('fails missing layoutSketch peers when children exist', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: FOOTER_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-footer',
          definitionTs: `
            export default {
              placeholders: [{ key: 'footer-columns', allowedControls: ['menzis-footer-col'] }],
            };
          `,
        },
        {
          role: 'child',
          definitionKey: 'menzis-footer-col',
          parentPlaceholder: 'footer-columns',
        },
      ],
      layoutSketch: { componentName: 'MenzisFooter', placeholders: {} },
    });
    assert.ok(diags.some((d) => /layoutSketch/i.test(d)));
    assert.ok(diags.every((d) => !/\bplanMode\b/.test(d)));
  });

  it('passes complete composite emit for HelpAndHealth-like HTML', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: HELP_AND_HEALTH_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-help-and-health',
          definitionTs: `
            export default {
              placeholders: [{ key: 'support-cards', allowedControls: ['menzis-link-card'] }],
            };
          `,
        },
        {
          role: 'child',
          componentName: 'MenzisLinkCard',
          definitionKey: 'menzis-link-card',
          parentPlaceholder: 'support-cards',
          definitionTs: `
            export default {
              componentName: 'MenzisLinkCard',
              content: {
                items: [
                  { name: 'Card A', fields: {} },
                  { name: 'Card B', fields: {} },
                ],
              },
            };
          `,
        },
      ],
      layoutSketch: {
        componentName: 'MenzisHelpAndHealth',
        placeholders: {
          'support-cards': [
            { componentName: 'MenzisLinkCard', datasourceName: 'Card A' },
            { componentName: 'MenzisLinkCard', datasourceName: 'Card B' },
          ],
        },
      },
    });
    assert.deepEqual(diags, []);
  });

  it('fails when content.items under-seed layoutSketch peers of same type', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: HELP_AND_HEALTH_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-help-and-health',
          definitionTs: `
            export default {
              placeholders: [{ key: 'support-cards', allowedControls: ['menzis-link-card'] }],
            };
          `,
        },
        {
          role: 'child',
          componentName: 'MenzisLinkCard',
          definitionKey: 'menzis-link-card',
          parentPlaceholder: 'support-cards',
          definitionTs: `
            export default {
              componentName: 'MenzisLinkCard',
              content: {
                items: [{ name: 'Card A', fields: {} }],
              },
            };
          `,
        },
      ],
      layoutSketch: {
        componentName: 'MenzisHelpAndHealth',
        placeholders: {
          'support-cards': [
            { componentName: 'MenzisLinkCard', datasourceName: 'Card A' },
            { componentName: 'MenzisLinkCard', datasourceName: 'Card B' },
          ],
        },
      },
    });
    assert.ok(diags.some((d) => /content\.items\.length=1.*peers=2/i.test(d)));
  });

  it('same checker for footer fixture with complete emit', () => {
    const diags = collectHtmlMultiBandEmitDiagnostics({
      sectionHtml: FOOTER_HTML,
      packages: [
        {
          role: 'section',
          definitionKey: 'menzis-footer',
          definitionTs: `
            export default {
              placeholders: [{ key: 'footer-bands', allowedControls: ['menzis-footer-band'] }],
            };
          `,
        },
        {
          role: 'child',
          componentName: 'MenzisFooterBand',
          definitionKey: 'menzis-footer-band',
          parentPlaceholder: 'footer-bands',
          definitionTs: `
            export default {
              componentName: 'MenzisFooterBand',
              content: {
                items: [
                  { name: 'Signpost', fields: {} },
                  { name: 'Nav', fields: {} },
                ],
              },
            };
          `,
        },
      ],
      layoutSketch: {
        componentName: 'MenzisFooter',
        placeholders: {
          'footer-bands': [
            { componentName: 'MenzisFooterBand', datasourceName: 'Signpost' },
            { componentName: 'MenzisFooterBand', datasourceName: 'Nav' },
          ],
        },
      },
    });
    assert.deepEqual(diags, []);
  });
});

describe('layoutSketch peer helpers', () => {
  it('counts peers by componentName and builds instance plan', () => {
    const sketch = {
      placeholders: {
        main: [
          { componentName: 'Split', datasourceName: 'A' },
          { componentName: 'Health', datasourceName: 'H' },
          { componentName: 'Split', datasourceName: 'B' },
        ],
      },
    };
    const byName = countLayoutSketchPeersByComponentName(sketch);
    assert.equal(byName.get('Split'), 2);
    assert.equal(byName.get('Health'), 1);
    const plan = collectLayoutSketchInstancePlan(sketch);
    assert.equal(plan.length, 3);
    assert.equal(plan[0].datasourceItem, 'A');
    assert.equal(plan[1].componentName, 'Health');
    assert.equal(plan[2].datasourceItem, 'B');
    assert.equal(countDefinitionTsContentItems(`content: { items: [{}, {}] }`), 2);
  });
});

describe('presentationChildrenFromLayoutSketch', () => {
  it('maps nested peers into presentation children', () => {
    const kids = presentationChildrenFromLayoutSketch(
      {
        componentName: 'MenzisHelpAndHealth',
        placeholders: {
          'support-cards': [
            { componentName: 'MenzisLinkCard', datasourceName: 'Card A' },
            { componentName: 'MenzisLinkCard', datasourceName: 'Card B' },
          ],
        },
      },
      [
        {
          role: 'section',
          componentName: 'MenzisHelpAndHealth',
          definitionKey: 'menzis-help-and-health',
        },
        {
          role: 'child',
          componentName: 'MenzisLinkCard',
          definitionKey: 'menzis-link-card',
        },
      ],
    );
    assert.equal(kids.length, 2);
    assert.equal(kids[0].definitionKey, 'menzis-link-card');
    assert.equal(kids[0].datasourceItem, 'Card A');
    assert.equal(kids[0].placeholder, 'support-cards');
    assert.equal(kids[1].datasourceItem, 'Card B');
  });

  it('counts nested peers', () => {
    assert.equal(
      countLayoutSketchNestedPeers({
        placeholders: { a: [{}, {}], b: [{}] },
      }),
      3,
    );
  });
});
