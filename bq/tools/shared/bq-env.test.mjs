/**
 * Run: node --import tsx --test tools/shared/bq-env.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BQ_LINK_LIST_AS_COMPOSITE,
  envFlagEnabled,
  isLinkListAsCompositeEnabled,
  shouldPreferCompositeLinkList,
  linkListAsCompositePromptOverride,
} from './bq-env.mjs';

describe('envFlagEnabled', () => {
  it('accepts 1/true/yes/on case-insensitively', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'On']) {
      assert.equal(envFlagEnabled(v), true, v);
    }
  });
  it('rejects empty/false/0', () => {
    for (const v of ['', '0', 'false', 'no', undefined, null]) {
      assert.equal(envFlagEnabled(v), false, String(v));
    }
  });
});

describe('isLinkListAsCompositeEnabled', () => {
  it('reads BQ_LINK_LIST_AS_COMPOSITE from env object', () => {
    assert.equal(isLinkListAsCompositeEnabled({}), false);
    assert.equal(
      isLinkListAsCompositeEnabled({ [BQ_LINK_LIST_AS_COMPOSITE]: '1' }),
      true,
    );
    assert.equal(
      isLinkListAsCompositeEnabled({ [BQ_LINK_LIST_AS_COMPOSITE]: 'true' }),
      true,
    );
  });
});

describe('shouldPreferCompositeLinkList', () => {
  const on = { [BQ_LINK_LIST_AS_COMPOSITE]: '1' };
  const off = { [BQ_LINK_LIST_AS_COMPOSITE]: '0' };

  it('false when flag off even with placeholders', () => {
    assert.equal(
      shouldPreferCompositeLinkList(
        { placeholders: [{ allowedControls: ['x-link-item'] }] },
        off,
      ),
      false,
    );
  });

  it('true when flag on and allowedControls present', () => {
    assert.equal(
      shouldPreferCompositeLinkList(
        { placeholders: [{ allowedControls: ['crelan-link-item'] }] },
        on,
      ),
      true,
    );
  });

  it('false when flag on but no placeholder controls (keep platform folder path)', () => {
    assert.equal(
      shouldPreferCompositeLinkList(
        {
          placeholders: [],
          content: { location: { folder: ['Link Lists'] } },
        },
        on,
      ),
      false,
    );
  });

  it('true when flag on and definition omitted (prompt path)', () => {
    assert.equal(shouldPreferCompositeLinkList(null, on), true);
  });
});

describe('linkListAsCompositePromptOverride', () => {
  it('mentions env name and forbids platform folders / JSON bags', () => {
    const text = linkListAsCompositePromptOverride();
    assert.match(text, /BQ_LINK_LIST_AS_COMPOSITE/);
    assert.match(text, /AppPlaceholder/);
    assert.match(text, /Link Lists/);
    assert.match(text, /JSON/);
    assert.match(text, /footer column|mega-menu column/i);
    assert.match(text, /link-item/);
    assert.match(text, /ignore.*JSON-bag|Scalar seeds/i);
  });
});
