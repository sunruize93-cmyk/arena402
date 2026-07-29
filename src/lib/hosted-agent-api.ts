import {
  ArenaHttpError,
  arenaHttpRequest,
} from '@/lib/arena-http';

export type HostedAgentStatus =
  | 'provisioning'
  | 'ready'
  | 'degraded'
  | 'disabled';

export type ThinkingMode = 'unsupported' | 'optional' | 'always_on';

export interface HostedModelCapability {
  providerId: string;
  modelId: string;
  displayName: string;
  supportsStructuredOutput: boolean;
  thinkingMode: ThinkingMode;
  thinkingCanToggle: boolean;
  effectiveThinkingDefault: boolean;
  maxOutputTokens: number;
  requestTimeoutCapMs: number;
  schemaVersion: string;
}

export interface HostedAgentCapabilities {
  creationEnabled: boolean;
  reasonCodes: string[];
  registryVersion: string;
  models: HostedModelCapability[];
  schemaVersion: string;
}

export interface HostedAgentSummary {
  agentId: string;
  displayName: string;
  providerId: string;
  modelId: string;
  thinkingEnabled: boolean;
  provisioningStatus: HostedAgentStatus;
  routeStatus: HostedAgentStatus;
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
}

export interface HostedAgentDetail extends HostedAgentSummary {
  credentialId: string;
  strategyInstructions: string;
}

export interface CredentialMetadata {
  credentialId: string;
  providerId: string;
  status:
    | 'pending_write'
    | 'stored'
    | 'pending_validation'
    | 'valid'
    | 'invalid'
    | 'revoking'
    | 'revoked';
  fingerprintHint: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
}

interface HostedAgentListResponse {
  agents: HostedAgentSummary[];
  total: number;
}

const SAFE_ERROR_CODES = new Set([
  'application_json_required',
  'invalid_request',
  'idempotency_key_required',
  'idempotency_conflict',
  'credential_not_found',
  'credential_not_usable',
  'provider_mismatch',
  'credential_ingress_unavailable',
  'credential_write_recovery_required',
  'hosted_agents_disabled',
  'non_durable_repository_forbidden',
  'repository_unavailable',
  'secret_store_unavailable',
  'agent_not_found',
  'agent_not_ready',
]);

export type HostedAgentApiErrorCode =
  | 'authentication_required'
  | 'csrf_required'
  | 'request_failed'
  | 'network_unavailable'
  | string;

export class HostedAgentApiError extends Error {
  constructor(
    public readonly code: HostedAgentApiErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'HostedAgentApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { csrf?: boolean },
): Promise<T> {
  try {
    return await arenaHttpRequest<T>(path, init, { csrf: options?.csrf });
  } catch (error) {
    if (error instanceof ArenaHttpError) {
      let code = SAFE_ERROR_CODES.has(error.code) ? error.code : 'request_failed';
      if (error.status === 0) code = 'network_unavailable';
      if (error.status === 401) code = 'authentication_required';
      if (error.status === 403 && error.code === 'csrf_required') {
        code = 'csrf_required';
      }
      throw new HostedAgentApiError(code, error.status);
    }
    throw error;
  }
}

export function createHostedIdempotencyKey(
  operation: 'credential' | 'agent' | 'update',
): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `hosted-${operation}-${suffix}`.slice(0, 128);
}

export async function getHostedAgentCapabilities(): Promise<HostedAgentCapabilities> {
  return request<HostedAgentCapabilities>(
    '/api/hosted-agents/capabilities',
  );
}

export async function getHostedAgents(): Promise<HostedAgentSummary[]> {
  const response = await request<HostedAgentListResponse>(
    '/api/hosted-agents?scope=mine',
  );
  return response.agents || [];
}

export async function getHostedAgent(
  agentId: string,
): Promise<HostedAgentDetail> {
  return request<HostedAgentDetail>(
    `/api/hosted-agents/${encodeURIComponent(agentId)}`,
  );
}

export async function createModelCredential(
  input: {
    providerId: string;
    apiKey: string;
  },
  idempotencyKey: string,
): Promise<CredentialMetadata> {
  return request<CredentialMetadata>(
    '/api/model-credentials',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    },
    { csrf: true },
  );
}

export async function createHostedAgent(
  input: {
    displayName: string;
    credentialId: string;
    providerId: string;
    modelId: string;
    thinkingEnabled: boolean;
    strategyInstructions: string;
  },
  idempotencyKey: string,
): Promise<HostedAgentSummary> {
  return request<HostedAgentSummary>(
    '/api/hosted-agents',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    },
    { csrf: true },
  );
}

export async function updateHostedAgent(
  agentId: string,
  input: {
    providerId: string;
    modelId: string;
    thinkingEnabled: boolean;
    strategyInstructions: string;
  },
  idempotencyKey: string,
): Promise<HostedAgentSummary> {
  return request<HostedAgentSummary>(
    `/api/hosted-agents/${encodeURIComponent(agentId)}`,
    {
      method: 'PATCH',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    },
    { csrf: true },
  );
}
