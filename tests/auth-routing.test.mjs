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
const deploymentJourneySource = fs.readFileSync(
  new URL('../src/components/AgentDeploymentJourney.tsx', import.meta.url),
  'utf8',
);
const hostedAgentSource = fs.readFileSync(
  new URL('../src/components/HostedAgentCreator.tsx', import.meta.url),
  'utf8',
);
const agentIntegrationStyles = fs.readFileSync(
  new URL('../src/app/arena402-integration.css', import.meta.url),
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

test('agent workshop supports direct Arena and GitHub identities', () => {
  assert.match(deploymentJourneySource, /auth_provider === 'github'/);
  assert.match(deploymentJourneySource, /竞技场身份 · 工坊已解锁/);
  assert.match(deploymentJourneySource, /Sign in to continue/);
  assert.doesNotMatch(
    deploymentJourneySource,
    /Your GitHub identity owns every runtime binding/,
  );
});

test('both Agent paths load synchronously so first-open localization is stable', () => {
  assert.match(
    deploymentJourneySource,
    /import ConnectorConsole from '@\/components\/ConnectorConsole'/,
  );
  assert.match(
    deploymentJourneySource,
    /import HostedAgentCreator from '@\/components\/HostedAgentCreator'/,
  );
  assert.doesNotMatch(deploymentJourneySource, /next\/dynamic/);
});

test('Hosted Agent creation requires testnet and API-cost acknowledgement', () => {
  assert.match(hostedAgentSource, /const \[costAcknowledged/);
  assert.match(
    hostedAgentSource,
    /I understand Arena uses testnet assets, while my model provider[\s\S]*may charge for API calls/,
  );
  assert.match(
    hostedAgentSource,
    /!editingAgent && !costAcknowledged/,
  );
});

test('agent path styling uses stable component classes', () => {
  assert.match(agentIntegrationStyles, /\.connector-primary/);
  assert.match(agentIntegrationStyles, /\.hosted-forge-form/);
  assert.doesNotMatch(agentIntegrationStyles, /\[class\*='rounded-xl'\]/);
});
