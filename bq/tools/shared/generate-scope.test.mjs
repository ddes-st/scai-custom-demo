/**
 * Run: node --import tsx --test tools/shared/generate-scope.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  componentKeyAllowed,
  componentKeyInAllowlist,
  definitionMatchesKeyAllowlist,
  definitionMatchesScope,
  filterDefinitionsByKeyAllowlist,
  filterDefinitionsByScope,
  parseDefinitionKeyAllowlist,
  parseGenerateScope,
  shouldForceApplyForDefinition,
} from './generate-scope.ts';

const scopeAll = { siteSystem: null, collectionSystem: null, active: false };
const scopeAxaBe = {
  siteSystem: 'axa-be',
  collectionSystem: 'axa',
  active: true,
};

describe('parseGenerateScope --url', () => {
  it('maps https://www.sitecore.com to sitecore-com / sitecore', () => {
    const scope = parseGenerateScope([
      '--url',
      'https://www.sitecore.com',
    ]);
    assert.equal(scope.active, true);
    assert.equal(scope.siteSystem, 'sitecore-com');
    assert.equal(scope.collectionSystem, 'sitecore');
    assert.equal(scope.urlHost, 'sitecore.com');
  });

  it('maps bare https URL the same way', () => {
    const scope = parseGenerateScope(['https://www.axa.be/nl/particulieren']);
    assert.equal(scope.siteSystem, 'axa-be');
    assert.equal(scope.collectionSystem, 'axa');
    assert.equal(scope.urlHost, 'axa.be');
  });

  it('lets --site override URL-derived site', () => {
    const scope = parseGenerateScope([
      '--url',
      'https://www.sitecore.com',
      '--site',
      'sitecore-com',
      '--collection',
      'sitecore',
    ]);
    assert.equal(scope.siteSystem, 'sitecore-com');
    assert.equal(scope.collectionSystem, 'sitecore');
  });
});

describe('definitionMatchesScope', () => {
  it('keeps everything when scope is inactive', () => {
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'component',
          definitionKey: 'x',
          collectionSystem: 'sitecore',
          siteSystem: 'sitecore-com',
        },
        scopeAll,
      ),
      true,
    );
  });

  it('keeps matching site components and drops other siteSystems', () => {
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'component',
          definitionKey: 'axa-header',
          collectionSystem: 'axa',
          siteSystem: 'axa-be',
        },
        scopeAxaBe,
      ),
      true,
    );
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'component',
          definitionKey: 'sitecore-header',
          collectionSystem: 'sitecore',
          siteSystem: 'sitecore-com',
        },
        scopeAxaBe,
      ),
      false,
    );
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'component',
          definitionKey: 'other-axa-site',
          collectionSystem: 'axa',
          siteSystem: 'axa-fr',
        },
        scopeAxaBe,
      ),
      false,
    );
  });

  it('keeps collection-shared component with no siteSystem', () => {
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'component',
          definitionKey: 'shared-axa',
          collectionSystem: 'axa',
        },
        scopeAxaBe,
      ),
      true,
    );
  });

  it('keeps shared field-validator without collection', () => {
    assert.equal(
      definitionMatchesScope(
        { kind: 'field-validator', definitionKey: 'fv' },
        scopeAxaBe,
      ),
      true,
    );
  });

  it('keeps axa collection and axa-be site defs', () => {
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'collection',
          definitionKey: 'axa-collection',
          name: 'AXA',
          systemName: 'axa',
        },
        scopeAxaBe,
      ),
      true,
    );
    assert.equal(
      definitionMatchesScope(
        {
          kind: 'site',
          definitionKey: 'axa-be-site',
          name: 'AXA Belgium',
          systemName: 'axa-be',
          collectionSystem: 'axa',
        },
        scopeAxaBe,
      ),
      true,
    );
  });
});

describe('filterDefinitionsByScope + componentKeyAllowed', () => {
  it('filters loaded rows by site', () => {
    const loaded = [
      {
        definition: {
          kind: 'component',
          definitionKey: 'a',
          collectionSystem: 'axa',
          siteSystem: 'axa-be',
        },
      },
      {
        definition: {
          kind: 'component',
          definitionKey: 'b',
          collectionSystem: 'axa',
          siteSystem: 'axa-fr',
        },
      },
    ];
    const kept = filterDefinitionsByScope(loaded, scopeAxaBe);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].definition.definitionKey, 'a');
  });

  it('componentKeyAllowed respects siteByKey', () => {
    const coll = new Map([
      ['a', 'axa'],
      ['b', 'axa'],
      ['c', 'sitecore'],
    ]);
    const site = new Map([
      ['a', 'axa-be'],
      ['b', 'axa-fr'],
      ['c', 'sitecore-com'],
    ]);
    assert.equal(componentKeyAllowed('a', coll, scopeAxaBe, site), true);
    assert.equal(componentKeyAllowed('b', coll, scopeAxaBe, site), false);
    assert.equal(componentKeyAllowed('c', coll, scopeAxaBe, site), false);
    assert.equal(
      componentKeyAllowed('a', coll, scopeAxaBe, new Map([['a', null]])),
      true,
    );
  });
});

describe('definitionKey allowlist', () => {
  it('parseDefinitionKeyAllowlist is null when flag/env absent', () => {
    const prev = process.env.BQ_GENERATE_DEFINITION_KEYS;
    delete process.env.BQ_GENERATE_DEFINITION_KEYS;
    try {
      assert.equal(parseDefinitionKeyAllowlist(['--site=x']), null);
    } finally {
      if (prev === undefined) delete process.env.BQ_GENERATE_DEFINITION_KEYS;
      else process.env.BQ_GENERATE_DEFINITION_KEYS = prev;
    }
  });

  it('parseDefinitionKeyAllowlist parses CLI keys', () => {
    const prev = process.env.BQ_GENERATE_DEFINITION_KEYS;
    delete process.env.BQ_GENERATE_DEFINITION_KEYS;
    try {
      const keys = parseDefinitionKeyAllowlist([
        '--definitionKeys=sitecore-footer-legal,sitecore-footer-signpost',
      ]);
      assert.ok(keys);
      assert.equal(keys.size, 2);
      assert.ok(keys.has('sitecore-footer-legal'));
    } finally {
      if (prev === undefined) delete process.env.BQ_GENERATE_DEFINITION_KEYS;
      else process.env.BQ_GENERATE_DEFINITION_KEYS = prev;
    }
  });

  it('always keeps collection/site/presentation; filters components', () => {
    const allow = new Set(['keep-me']);
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'collection', definitionKey: 'sitecore' },
        allow,
      ),
      true,
    );
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'site-presentation', definitionKey: 'sitecore-com-presentation' },
        allow,
      ),
      true,
    );
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'component', definitionKey: 'keep-me' },
        allow,
      ),
      true,
    );
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'component', definitionKey: 'drop-me' },
        allow,
      ),
      false,
    );
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'page-stub', definitionKey: 'stub-foo' },
        allow,
      ),
      false,
    );
    assert.equal(
      definitionMatchesKeyAllowlist(
        { kind: 'page', definitionKey: 'crelan-be-particulieren' },
        new Set(['crelan-be-particulieren']),
      ),
      true,
    );
  });

  it('filterDefinitionsByKeyAllowlist + componentKeyInAllowlist', () => {
    const allow = new Set(['a']);
    const loaded = [
      { definition: { kind: 'component', definitionKey: 'a' } },
      { definition: { kind: 'component', definitionKey: 'b' } },
      { definition: { kind: 'site', definitionKey: 'site-x' } },
    ];
    const kept = filterDefinitionsByKeyAllowlist(loaded, allow);
    assert.equal(kept.length, 2);
    assert.equal(componentKeyInAllowlist('a', allow), true);
    assert.equal(componentKeyInAllowlist('b', allow), false);
    assert.equal(componentKeyInAllowlist('a', null), true);
  });
});

describe('shouldForceApplyForDefinition (scoped force)', () => {
  const allow = new Set(['sitecore-site-footer']);

  it('global force when no allowlist', () => {
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'collection', definitionKey: 'sitecore' },
        true,
        null,
      ),
      true,
    );
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'component', definitionKey: 'anything' },
        true,
        null,
      ),
      true,
    );
  });

  it('with allowlist: force only listed component keys', () => {
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'component', definitionKey: 'sitecore-site-footer' },
        true,
        allow,
      ),
      true,
    );
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'component', definitionKey: 'other-comp' },
        true,
        allow,
      ),
      false,
    );
  });

  it('with allowlist: infra kinds keep mtime skip (no force)', () => {
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'collection', definitionKey: 'sitecore' },
        true,
        allow,
      ),
      false,
    );
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'site', definitionKey: 'sitecore-com' },
        true,
        allow,
      ),
      false,
    );
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'site-presentation', definitionKey: 'sitecore-com-presentation' },
        true,
        allow,
      ),
      false,
    );
  });

  it('forceApply false never forces', () => {
    assert.equal(
      shouldForceApplyForDefinition(
        { kind: 'component', definitionKey: 'sitecore-site-footer' },
        false,
        allow,
      ),
      false,
    );
  });
});
