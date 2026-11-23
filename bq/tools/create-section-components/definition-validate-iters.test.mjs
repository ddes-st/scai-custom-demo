/**
 * Run: node --test tools/create-section-components/definition-validate-iters.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  BQ_DEFINITION_VALIDATE_MAX_ITERS,
  applyDefinitionValidateMaxItersCli,
  isDefinitionParseFailure,
  resolveDefinitionValidateMaxIters,
} from './definition-validate-iters.mjs';
import { codegenWithDefinitionParseRetries } from './tsx-validate-loop.mjs';

describe('resolveDefinitionValidateMaxIters', () => {
  it('defaults to 1 (one retry)', () => {
    assert.equal(resolveDefinitionValidateMaxIters({}), 1);
  });

  it('reads 0 as no retries', () => {
    assert.equal(
      resolveDefinitionValidateMaxIters({
        [BQ_DEFINITION_VALIDATE_MAX_ITERS]: '0',
      }),
      0,
    );
  });

  it('clamps to 0..3', () => {
    assert.equal(
      resolveDefinitionValidateMaxIters({
        [BQ_DEFINITION_VALIDATE_MAX_ITERS]: '9',
      }),
      3,
    );
  });
});

describe('applyDefinitionValidateMaxItersCli', () => {
  afterEach(() => {
    delete process.env[BQ_DEFINITION_VALIDATE_MAX_ITERS];
  });

  it('sets process.env from CLI', () => {
    const n = applyDefinitionValidateMaxItersCli(2);
    assert.equal(n, 2);
    assert.equal(process.env[BQ_DEFINITION_VALIDATE_MAX_ITERS], '2');
  });
});

describe('isDefinitionParseFailure', () => {
  it('detects refuse-to-write parse errors', () => {
    assert.equal(
      isDefinitionParseFailure(
        new Error(
          '[codegen] foo.definition.ts is not valid TypeScript after fixups — refusing to write broken definition.\nTransform failed with 1 error:\nExpected "]" but found "}"',
        ),
      ),
      true,
    );
  });

  it('ignores unrelated errors', () => {
    assert.equal(isDefinitionParseFailure(new Error('ENOSPC')), false);
  });

  it('detects GraphQL seed-shape refusal', () => {
    assert.equal(
      isDefinitionParseFailure(
        new Error(
          '[codegen] x.definition.ts has GraphQL-shaped content seed — refusing to write broken definition (DEFINITION SEED SHAPE).',
        ),
      ),
      true,
    );
  });
});

describe('codegenWithDefinitionParseRetries', () => {
  it('aborts on first parse fail when maxRetries=0', async () => {
    let codegenCalls = 0;
    await assert.rejects(
      () =>
        codegenWithDefinitionParseRetries({
          definitionMaxRetries: 0,
          componentName: 'Test',
          codegenArgs: {},
          codegenFn: async () => {
            codegenCalls += 1;
            return { definitionTs: 'broken', tsx: '', kebab: 'test' };
          },
          async finalizeDefinitionTs() {
            throw new Error(
              '[codegen] test.definition.ts is not valid TypeScript after fixups — refusing to write broken definition.',
            );
          },
        }),
      /not valid TypeScript/,
    );
    assert.equal(codegenCalls, 1);
  });

  it('retries once when maxRetries=1 then succeeds', async () => {
    let codegenCalls = 0;
    let finalizeCalls = 0;
    const out = await codegenWithDefinitionParseRetries({
      definitionMaxRetries: 1,
      componentName: 'Test',
      codegenArgs: {},
      codegenFn: async (args) => {
        codegenCalls += 1;
        if (codegenCalls === 2) {
          assert.match(
            String(args.revisionBrief?.changes?.[0] || ''),
            /DEFINITION PARSE FIX/,
          );
          assert.ok(args.revisionBrief?.previousDefinitionTs);
        }
        return {
          definitionTs: codegenCalls === 1 ? 'broken' : 'ok-def',
          tsx: 'tsx',
          kebab: 'test',
        };
      },
      async finalizeDefinitionTs(definitionTs) {
        finalizeCalls += 1;
        if (finalizeCalls === 1) {
          throw new Error(
            '[codegen] test.definition.ts is not valid TypeScript after fixups — refusing to write broken definition.\nTransform failed',
          );
        }
        return definitionTs;
      },
    });
    assert.equal(codegenCalls, 2);
    assert.equal(finalizeCalls, 2);
    assert.equal(out.definitionTs, 'ok-def');
    assert.equal(out.definitionAttempts, 2);
  });
});
