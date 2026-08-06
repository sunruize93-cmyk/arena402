import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const signInSource = fs.readFileSync(
  new URL('../src/app/signin/page.tsx', import.meta.url),
  'utf8',
);
const credentialSource = fs.readFileSync(
  new URL('../src/components/CredentialAuthForm.tsx', import.meta.url),
  'utf8',
);
const walletSource = fs.readFileSync(
  new URL('../src/components/WalletSurface.tsx', import.meta.url),
  'utf8',
);
const agentsPageSource = fs.readFileSync(
  new URL('../src/app/agents/page.tsx', import.meta.url),
  'utf8',
);

test('registration is invite-free and opens the memorial claim page', () => {
  assert.doesNotMatch(credentialSource, /inviteCode|Invite code|invite_code/);
  assert.match(
    credentialSource,
    /registerReturnTo = '\/founding402\/claim'/,
  );
  assert.match(
    credentialSource,
    /router\.replace\(isRegistering \? registerReturnTo : returnTo\)/,
  );
});

test('existing sign-ins still use the requested platform destination', () => {
  assert.match(signInSource, /fallback = '\/play'/);
  assert.match(signInSource, /safeReturnTo\(params\.return_to, '\/play'\)/);
  assert.match(signInSource, /return candidate;/);
  assert.doesNotMatch(signInSource, /params\.invite|params\.invite_code/);
});

test('wallet surface exposes the memorial claim page', () => {
  assert.match(walletSource, /href=\{\s*session\s*\? '\/founding402\/claim'/s);
  assert.match(walletSource, /Open memorial record/);
  assert.match(walletSource, /Sign in to claim/);
});

test('agent workshop loads its deployment journey styles', () => {
  assert.match(agentsPageSource, /import '\.\.\/arena402-auth\.css';/);
});
