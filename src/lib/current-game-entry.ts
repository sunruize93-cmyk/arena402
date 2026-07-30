import {
  createPaymentMandate,
  getArenaWallet,
  getJoinPreflight,
  getPaymentMandate,
  isJoinPreflightReady,
  joinCurrentGame,
  revokeCurrentGameMandate,
} from '@/lib/game-api';
import type {
  JoinCurrentGameResponse,
  JoinPreflight,
  PaymentMandate,
} from '@/lib/game-api';
import type { InitialPortfolio } from '@/lib/initial-loadout';
import { ArenaApiError } from '@/lib/platform-api';

export type CurrentGameEntryStage =
  | 'wallet'
  | 'preflight'
  | 'mandate_lookup'
  | 'mandate_revoke'
  | 'mandate_create'
  | 'join';

export interface CurrentGameEntryKeys {
  preflight: string;
  mandateId: string;
  mandateRequest: string;
  join: string;
  mandateValidFrom: string;
}

export interface CurrentGameEntryIdentity {
  gameId: string;
  agentId: string;
}

export interface CurrentGameEntryKeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredCurrentGameEntryIdentity
  extends CurrentGameEntryIdentity {
  scope?: string;
}

export interface PrepareCurrentGameEntryOptions
  extends CurrentGameEntryIdentity {
  preflightKey: string;
  checkWallet?: boolean;
  onStage?: (stage: CurrentGameEntryStage) => void;
}

export interface SealCurrentGameEntryOptions
  extends CurrentGameEntryIdentity {
  preflight: JoinPreflight;
  keys: Omit<CurrentGameEntryKeys, 'preflight'>;
  portfolio?: InitialPortfolio;
  onStage?: (stage: CurrentGameEntryStage) => void;
}

export interface SealedCurrentGameEntry {
  mandate: PaymentMandate;
  response: JoinCurrentGameResponse;
  participantId: string | null;
}

export interface RunCurrentGameEntryOptions
  extends StoredCurrentGameEntryIdentity {
  storage: CurrentGameEntryKeyStore;
  portfolio?: InitialPortfolio;
  checkWallet?: boolean;
  onStage?: (stage: CurrentGameEntryStage) => void;
  onAuthorizationRenewed?: () => void;
}

function opaqueEntryId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`.slice(0, 128);
}

function scopeHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function entryStoragePrefix({
  gameId,
  agentId,
  scope = '',
}: StoredCurrentGameEntryIdentity): string {
  return `arena402:entry:${encodeURIComponent(gameId)}:${encodeURIComponent(agentId)}:${scopeHash(scope)}`;
}

export function getStoredCurrentGameEntryKeys(
  identity: StoredCurrentGameEntryIdentity,
  storage: CurrentGameEntryKeyStore,
  createId = opaqueEntryId,
  now = Date.now(),
): CurrentGameEntryKeys {
  const prefix = entryStoragePrefix(identity);
  const readOrCreate = (name: string, idPrefix: string) => {
    const key = `${prefix}:${name}`;
    const current = storage.getItem(key);
    if (current) return current;
    const created = createId(idPrefix);
    storage.setItem(key, created);
    return created;
  };
  const validFromKey = `${prefix}:mandate-valid-from`;
  let mandateValidFrom = storage.getItem(validFromKey);
  if (!mandateValidFrom) {
    mandateValidFrom = new Date(now - 5_000).toISOString();
    storage.setItem(validFromKey, mandateValidFrom);
  }
  return {
    preflight: readOrCreate('preflight', 'web-preflight'),
    mandateId: readOrCreate('mandate-id', 'web-mandate-id'),
    mandateRequest: readOrCreate('mandate-request', 'web-mandate-request'),
    join: readOrCreate('join', 'web-join'),
    mandateValidFrom,
  };
}

export function clearStoredCurrentGameEntryKeys(
  identity: StoredCurrentGameEntryIdentity,
  storage: CurrentGameEntryKeyStore,
): void {
  const prefix = entryStoragePrefix(identity);
  [
    'preflight',
    'mandate-id',
    'mandate-request',
    'join',
    'mandate-valid-from',
  ].forEach((name) => storage.removeItem(`${prefix}:${name}`));
}

export function isReusablePaymentMandate(
  mandate: PaymentMandate | null,
  preflight: JoinPreflight,
  now = Date.now(),
): boolean {
  return Boolean(
    mandate
      && mandate.joinAuthorizationId === preflight.joinAuthorizationId
      && !mandate.revokedAt
      && Number.isFinite(new Date(mandate.expiresAt).getTime())
      && new Date(mandate.expiresAt).getTime() > now,
  );
}

export async function prepareCurrentGameEntry({
  gameId,
  agentId,
  preflightKey,
  checkWallet = false,
  onStage,
}: PrepareCurrentGameEntryOptions): Promise<JoinPreflight> {
  if (checkWallet) {
    onStage?.('wallet');
    await getArenaWallet();
  }
  onStage?.('preflight');
  return getJoinPreflight(gameId, agentId, preflightKey);
}

export async function sealCurrentGameEntry({
  gameId,
  agentId,
  preflight,
  keys,
  portfolio,
  onStage,
}: SealCurrentGameEntryOptions): Promise<SealedCurrentGameEntry> {
  if (!isJoinPreflightReady(preflight)) {
    throw new ArenaApiError(
      409,
      preflight.safeErrorCode || 'join_preflight_not_ready',
    );
  }

  onStage?.('mandate_lookup');
  const current = (await getPaymentMandate(gameId)).mandate;
  let mandate = current;

  if (!isReusablePaymentMandate(mandate, preflight)) {
    if (mandate && !mandate.revokedAt) {
      onStage?.('mandate_revoke');
      await revokeCurrentGameMandate(mandate.mandateId);
    }
    onStage?.('mandate_create');
    const requirements = preflight.mandateRequirements;
    mandate = (
      await createPaymentMandate(
        {
          mandateId: keys.mandateId,
          gameId,
          joinAuthorizationId: preflight.joinAuthorizationId,
          chainId: requirements.chainId,
          tokenAddress: requirements.tokenAddress,
          maxPerPaymentAtomic: requirements.maxPerPaymentAtomic,
          maxCumulativeAtomic: requirements.maxCumulativeAtomic,
          allowedPayeeRule: requirements.allowedPayeeRule,
          validFrom: keys.mandateValidFrom,
          expiresAt: requirements.expiresAt,
        },
        keys.mandateRequest,
      )
    ).mandate;
  }

  if (!mandate) {
    throw new ArenaApiError(502, 'payment_mandate_missing');
  }

  onStage?.('join');
  const response = await joinCurrentGame(
    gameId,
    {
      agentId,
      joinAuthorizationId: preflight.joinAuthorizationId,
      paymentMandateId: mandate.mandateId,
      portfolio,
    },
    keys.join,
  );
  const participantId =
    response.participant?.participantId || response.participantId || null;
  return { mandate, response, participantId };
}

/**
 * Execute one complete entry attempt. If the backend reports an expired join
 * authorization, renew the whole key set and replay the same user-approved
 * intent exactly once.
 */
export async function runCurrentGameEntry({
  gameId,
  agentId,
  scope,
  storage,
  portfolio,
  checkWallet = false,
  onStage,
  onAuthorizationRenewed,
}: RunCurrentGameEntryOptions): Promise<SealedCurrentGameEntry> {
  const identity = { gameId, agentId, scope };
  let renewed = false;

  while (true) {
    const keys = getStoredCurrentGameEntryKeys(identity, storage);
    try {
      const preflight = await prepareCurrentGameEntry({
        gameId,
        agentId,
        preflightKey: keys.preflight,
        checkWallet,
        onStage,
      });
      return await sealCurrentGameEntry({
        gameId,
        agentId,
        preflight,
        keys,
        portfolio,
        onStage,
      });
    } catch (error) {
      if (
        renewed
        || !(error instanceof ArenaApiError)
        || error.code !== 'join_authorization_expired'
      ) {
        throw error;
      }
      renewed = true;
      clearStoredCurrentGameEntryKeys(identity, storage);
      onAuthorizationRenewed?.();
    }
  }
}
