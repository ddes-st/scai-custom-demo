/**
 * Run: node --test tools/capture/lib/interactive-states.probe.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasInteractiveFromDiscovery,
  isCmpSectionMeta,
} from './interactive-states.mjs';

describe('hasInteractiveFromDiscovery', () => {
  it('is false when nothing interactive', () => {
    const r = hasInteractiveFromDiscovery({ tabs: [], accordion: [], menuL1: [] }, null);
    assert.equal(r.hasInteractive, false);
  });

  it('detects unselected tabs', () => {
    const r = hasInteractiveFromDiscovery({
      tabs: [
        { selected: true, label: 'A' },
        { selected: false, label: 'B' },
      ],
      accordion: [],
      menuL1: [],
    });
    assert.equal(r.hasInteractive, true);
    assert.equal(r.tabCandidatesPreview.length, 1);
  });

  it('detects closed accordion', () => {
    const r = hasInteractiveFromDiscovery({
      tabs: [],
      accordion: [{ open: false, label: 'Item' }],
      menuL1: [],
    });
    assert.equal(r.hasInteractive, true);
  });

  it('detects menu L1', () => {
    const r = hasInteractiveFromDiscovery({
      tabs: [],
      accordion: [],
      menuL1: [{ label: 'Products', selector: 'a' }],
    });
    assert.equal(r.hasInteractive, true);
  });

  it('detects hamburger preview', () => {
    const r = hasInteractiveFromDiscovery(
      { tabs: [], accordion: [], menuL1: [] },
      { selector: 'button.menu' },
    );
    assert.equal(r.hasInteractive, true);
  });
});

describe('isCmpSectionMeta', () => {
  it('flags consent overlays', () => {
    assert.equal(isCmpSectionMeta({ cmsName: 'Cookie Consent' }, ''), true);
    assert.equal(isCmpSectionMeta({ folderName: 'section-01' }, '#onetrust-banner'), true);
    assert.equal(isCmpSectionMeta({ cmsName: 'Hero Banner' }, 'section.hero'), false);
  });
});
