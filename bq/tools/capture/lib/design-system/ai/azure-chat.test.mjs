/**
 * Run: node --test tools/capture/lib/design-system/ai/azure-chat.test.mjs
 * (from bq/)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAzureChatTransientFailure,
  isAzureChatTransientHttpStatus,
  azureChatCompletion,
} from './azure-chat.mjs';

describe('isAzureChatTransientHttpStatus', () => {
  it('matches gateway / request-timeout statuses', () => {
    assert.equal(isAzureChatTransientHttpStatus(408), true);
    assert.equal(isAzureChatTransientHttpStatus(502), true);
    assert.equal(isAzureChatTransientHttpStatus(503), true);
    assert.equal(isAzureChatTransientHttpStatus(504), true);
  });

  it('rejects auth and client errors', () => {
    assert.equal(isAzureChatTransientHttpStatus(400), false);
    assert.equal(isAzureChatTransientHttpStatus(401), false);
    assert.equal(isAzureChatTransientHttpStatus(404), false);
    assert.equal(isAzureChatTransientHttpStatus(429), false);
    assert.equal(isAzureChatTransientHttpStatus(200), false);
  });
});

describe('isAzureChatTransientFailure', () => {
  it('matches fetch / socket blips', () => {
    assert.equal(isAzureChatTransientFailure('fetch failed'), true);
    assert.equal(isAzureChatTransientFailure(new Error('fetch failed')), true);
    assert.equal(isAzureChatTransientFailure('Error: read ECONNRESET'), true);
    assert.equal(isAzureChatTransientFailure('connect ETIMEDOUT'), true);
    assert.equal(isAzureChatTransientFailure('getaddrinfo ENOTFOUND'), true);
    assert.equal(isAzureChatTransientFailure('getaddrinfo EAI_AGAIN'), true);
    assert.equal(isAzureChatTransientFailure('UND_ERR_CONNECT_TIMEOUT'), true);
    assert.equal(isAzureChatTransientFailure('socket hang up'), true);
    assert.equal(isAzureChatTransientFailure('The operation was aborted'), true);
    assert.equal(isAzureChatTransientFailure('This operation was aborted'), true);
    assert.equal(isAzureChatTransientFailure('Request timeout'), true);
  });

  it('matches Bad Gateway / HTTP 502–504 skipReasons', () => {
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 502: Bad Gateway'), true);
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 503: Unavailable'), true);
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 504: Gateway Timeout'), true);
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 408: Request Timeout'), true);
  });

  it('rejects DeploymentNotFound and client HTTP errors', () => {
    assert.equal(
      isAzureChatTransientFailure(
        'Azure chat HTTP 404: DeploymentNotFound (set AZURE_OPENAI_DEFAULT_MODEL…)',
      ),
      false,
    );
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 400: bad request'), false);
    assert.equal(isAzureChatTransientFailure('Azure chat HTTP 401: unauthorized'), false);
    assert.equal(isAzureChatTransientFailure('Azure env incomplete: missing X'), false);
  });
});

describe('azureChatCompletion transient retries', () => {
  const prev = {};

  before(() => {
    for (const k of [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_AI_FOUNDRY_ENDPOINT',
      'AZURE_OPENAI_API_KEY',
      'AZURE_FOUNDRY_API_KEY',
      'AZURE_OPENAI_DEFAULT_MODEL',
    ]) {
      prev[k] = process.env[k];
    }
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.test/openai/v1';
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_DEFAULT_MODEL = 'test-model';
  });

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function jsonRes(status, body, headerMap = {}) {
    const headers = {
      get(name) {
        const key = String(name).toLowerCase();
        for (const [k, v] of Object.entries(headerMap)) {
          if (k.toLowerCase() === key) return v;
        }
        return null;
      },
    };
    return {
      ok: status >= 200 && status < 300,
      status,
      headers,
      async text() {
        return typeof body === 'string' ? body : JSON.stringify(body);
      },
    };
  }

  it('retries fetch failed then succeeds', async () => {
    let calls = 0;
    const sleeps = [];
    const result = await azureChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async () => {
        calls += 1;
        if (calls <= 2) throw new Error('fetch failed');
        return jsonRes(200, {
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.content, 'ok');
    assert.equal(calls, 3);
    assert.equal(sleeps.length, 2);
    assert.ok(sleeps[0] >= 5_000);
  });

  it('does not retry non-transient throw', async () => {
    let calls = 0;
    const result = await azureChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      sleep: async () => {
        assert.fail('should not sleep');
      },
      fetchImpl: async () => {
        calls += 1;
        throw new Error('invalid api key shape');
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.skipReason, /invalid api key shape/);
    assert.equal(calls, 1);
  });

  it('retries HTTP 502 then succeeds', async () => {
    let calls = 0;
    const result = await azureChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return jsonRes(502, { error: { message: 'Bad Gateway' } });
        }
        return jsonRes(200, {
          choices: [{ message: { content: 'after-502' } }],
        });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.content, 'after-502');
    assert.equal(calls, 2);
  });

  it('retries This operation was aborted then succeeds', async () => {
    let calls = 0;
    const sleeps = [];
    const result = await azureChatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async () => {
        calls += 1;
        if (calls <= 2) throw new Error('This operation was aborted');
        return jsonRes(200, {
          choices: [{ message: { content: 'after-abort' } }],
        });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.content, 'after-abort');
    assert.equal(calls, 3);
    assert.equal(sleeps.length, 2);
  });
});
