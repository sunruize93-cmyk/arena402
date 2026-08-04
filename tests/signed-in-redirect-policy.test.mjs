import assert from 'node:assert/strict';
import test from 'node:test';

import { nextSignedInRedirectState } from '../src/lib/signed-in-redirect-policy.mjs';

test('a session created after an unauthenticated render does not override registration routing', () => {
  const unauthenticated = nextSignedInRedirectState({
    loading: false,
    hasSession: false,
    sawUnauthenticated: false,
  });

  assert.deepEqual(unauthenticated, {
    redirect: false,
    sawUnauthenticated: true,
  });

  assert.deepEqual(
    nextSignedInRedirectState({
      loading: false,
      hasSession: true,
      sawUnauthenticated: unauthenticated.sawUnauthenticated,
    }),
    {
      redirect: false,
      sawUnauthenticated: true,
    },
  );
});

test('a session present on the initial resolved render still redirects', () => {
  assert.deepEqual(
    nextSignedInRedirectState({
      loading: false,
      hasSession: true,
      sawUnauthenticated: false,
    }),
    {
      redirect: true,
      sawUnauthenticated: false,
    },
  );
});
