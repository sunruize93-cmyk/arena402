import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadPlatformApi() {
  const filePath = fileURLToPath(
    new URL('../src/lib/platform-api.ts', import.meta.url),
  );
  const source = readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  Function('require', 'module', 'exports', compiled)(
    undefined,
    module,
    module.exports,
  );
  return module.exports;
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('GET retries one transient browser network failure', async () => {
  const previousFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('temporary network failure');
    return jsonResponse({ ok: true });
  };

  try {
    const { arenaApiRequest } = loadPlatformApi();
    assert.deepEqual(await arenaApiRequest('/api/test'), { ok: true });
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('idempotent POST retries with the original key and body', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(init);
    if (calls.length === 1) throw new TypeError('response lost');
    return jsonResponse({ participantId: 'participant:test' });
  };

  try {
    const { arenaApiRequest } = loadPlatformApi();
    const result = await arenaApiRequest('/api/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'join-stable',
      },
      body: '{"agentId":"agent:test"}',
    });
    assert.equal(result.participantId, 'participant:test');
    assert.equal(calls.length, 2);
    assert.equal(
      new Headers(calls[1].headers).get('Idempotency-Key'),
      'join-stable',
    );
    assert.equal(calls[1].body, calls[0].body);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('non-idempotent POST is not retried', async () => {
  const previousFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new TypeError('network down');
  };

  try {
    const { ArenaApiError, arenaApiRequest } = loadPlatformApi();
    await assert.rejects(
      arenaApiRequest('/api/unsafe', {
        method: 'POST',
        body: '{}',
      }),
      (error) =>
        error instanceof ArenaApiError
        && error.code === 'network_unavailable',
    );
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
