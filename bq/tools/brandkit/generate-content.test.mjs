/**
 * Run: node --test tools/brandkit/generate-content.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRANDKIT_PROMPT_VERSION,
  computeBrandkitInputHash,
  DOS_DONT_EXTENSIONS_FIELD,
  DOS_DONT_RESTRICTIONS_FIELD,
  ensureMandatoryDosAndDontsRules,
  lookupDraftFieldValue,
  MANDATORY_DOS_DONT_EXTENSION,
  MANDATORY_DOS_DONT_RESTRICTION,
  normalizeBrandkitDraft,
} from './generate-content.mjs';
import { brandKitNameForSite } from './state.mjs';

describe('normalizeBrandkitDraft', () => {
  it('maps sections and trims strings', () => {
    const d = normalizeBrandkitDraft({
      brandName: ' Acme ',
      industry: 'energy',
      description: 'desc',
      sections: {
        'Brand Context': {
          'Brand purpose': '  Fuel people  ',
          empty: '  ',
        },
      },
    });
    assert.equal(d.brandName, 'Acme');
    assert.equal(d.industry, 'energy');
    assert.deepEqual(d.sections['Brand Context'], {
      'Brand purpose': 'Fuel people',
    });
  });
});

describe('lookupDraftFieldValue', () => {
  const draft = {
    sections: {
      'Brand Context': { 'Brand purpose': 'Hello' },
      'Tone of Voice': { Friendly: 'Warm and clear' },
    },
  };

  it('matches case-insensitively', () => {
    assert.equal(
      lookupDraftFieldValue(draft, 'brand context', 'brand PURPOSE'),
      'Hello',
    );
  });

  it('returns null when missing', () => {
    assert.equal(lookupDraftFieldValue(draft, 'Missing', 'x'), null);
    assert.equal(lookupDraftFieldValue(draft, 'Brand Context', 'Nope'), null);
  });
});

describe('brandKitNameForSite', () => {
  it('appends Brand Kit', () => {
    assert.equal(
      brandKitNameForSite('Energyprice Belgium'),
      'Energyprice Belgium Brand Kit',
    );
  });
});

describe('ensureMandatoryDosAndDontsRules', () => {
  it('sets Extensions and Restrictions without altering AI prose', () => {
    const { draft, changed } = ensureMandatoryDosAndDontsRules({
      sections: {
        "Dos and Dont's": {
          "Dos and dont's": 'Do keep copy clear.',
        },
      },
    });
    assert.equal(changed, true);
    assert.equal(
      draft.sections["Dos and Dont's"]["Dos and dont's"],
      'Do keep copy clear.',
    );
    assert.equal(
      draft.sections["Dos and Dont's"][DOS_DONT_EXTENSIONS_FIELD],
      MANDATORY_DOS_DONT_EXTENSION,
    );
    assert.equal(
      draft.sections["Dos and Dont's"][DOS_DONT_RESTRICTIONS_FIELD],
      MANDATORY_DOS_DONT_RESTRICTION,
    );
  });

  it('is idempotent on second call', () => {
    const once = ensureMandatoryDosAndDontsRules({
      sections: { "Dos and Don'ts": { Note: 'x' } },
    });
    const twice = ensureMandatoryDosAndDontsRules(once.draft);
    assert.equal(twice.changed, false);
    assert.equal(
      twice.draft.sections["Dos and Don'ts"][DOS_DONT_EXTENSIONS_FIELD],
      MANDATORY_DOS_DONT_EXTENSION,
    );
  });

  it('creates Dos and Don\'ts section when absent', () => {
    const { draft, changed } = ensureMandatoryDosAndDontsRules({
      sections: { 'Brand Context': { Purpose: 'y' } },
    });
    assert.equal(changed, true);
    assert.ok(draft.sections["Dos and Don'ts"]);
    assert.equal(
      draft.sections["Dos and Don'ts"][DOS_DONT_RESTRICTIONS_FIELD],
      MANDATORY_DOS_DONT_RESTRICTION,
    );
    assert.equal(draft.sections['Brand Context'].Purpose, 'y');
  });
});

describe('computeBrandkitInputHash', () => {
  const base = {
    url: 'https://www.energyprice.be/',
    companyName: 'Energyprice Belgium',
    sourceHash: 'abc123',
    schemaKey: 'default-sections',
  };

  it('includes promptVersion so bumps invalidate cache', () => {
    const v2 = computeBrandkitInputHash({
      ...base,
      promptVersion: BRANDKIT_PROMPT_VERSION,
    });
    const v1 = computeBrandkitInputHash({
      ...base,
      promptVersion: 'v1-concise',
    });
    assert.notEqual(v2, v1);
    assert.equal(BRANDKIT_PROMPT_VERSION, 'v2-extended');
  });

  it('is stable for identical inputs', () => {
    assert.equal(
      computeBrandkitInputHash(base),
      computeBrandkitInputHash({ ...base }),
    );
  });
});
