import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTypeScriptModule(path) {
  const filePath = path instanceof URL ? fileURLToPath(path) : path;
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
    () => {
      throw new Error('Unexpected relay dependency');
    },
    module,
    module.exports,
  );
  return module.exports;
}

const relay = loadTypeScriptModule(
  new URL(
    '../src/app/api/internal/github/oauth/route.ts',
    import.meta.url,
  ),
);

const VALID_BODY = {
  client_id: 'Ov23li5jawa0KFXEhpX4',
  code: 'temporary-code',
  code_verifier: 'v'.repeat(64),
  redirect_uri: 'https://api.arena402.com/api/auth/github/callback',
};

test('OAuth relay rejects requests without the backend client secret', async () => {
  const previousFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('fetch should not be called');
  };

  try {
    const response = await relay.POST(
      new Request('https://www.arena402.com/api/internal/github/oauth', {
        method: 'POST',
        body: JSON.stringify(VALID_BODY),
      }),
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: 'relay_unauthorized',
    });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('OAuth relay forwards one allowlisted token exchange without caching', async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({
      access_token: 'github-access-token-for-test',
      token_type: 'bearer',
      scope: 'read:user',
      ignored: 'must-not-cross-the-relay',
    });
  };

  try {
    const response = await relay.POST(
      new Request('https://www.arena402.com/api/internal/github/oauth', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${'s'.repeat(40)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      access_token: 'github-access-token-for-test',
      token_type: 'bearer',
      scope: 'read:user',
    });
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'https://github.com/login/oauth/access_token',
    );
    const forwarded = new URLSearchParams(String(calls[0].init.body));
    assert.equal(forwarded.get('client_id'), VALID_BODY.client_id);
    assert.equal(forwarded.get('client_secret'), 's'.repeat(40));
    assert.equal(forwarded.get('code'), VALID_BODY.code);
    assert.equal(
      forwarded.get('code_verifier'),
      VALID_BODY.code_verifier,
    );
    assert.equal(forwarded.get('redirect_uri'), VALID_BODY.redirect_uri);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('OAuth relay rejects a callback outside the Arena API origin', async () => {
  const response = await relay.POST(
    new Request('https://www.arena402.com/api/internal/github/oauth', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${'s'.repeat(40)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...VALID_BODY,
        redirect_uri: 'https://attacker.example/callback',
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_request' });
});
