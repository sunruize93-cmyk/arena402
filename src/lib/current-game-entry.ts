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
