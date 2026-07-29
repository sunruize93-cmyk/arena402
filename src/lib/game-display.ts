import {
  projectionValue as pick,
  publicAgentName,
} from '@/lib/public-projection';
import type { ProjectionRecord as RecordValue } from '@/lib/public-projection';

function compactAgentId(agentId: string, index: number): string {
  if (!agentId) return `agent_${String(index + 1).padStart(2, '0')}`;
  const prefix = agentId.match(/^agent[_:-]/i)?.[0] || '';
  const body = agentId.slice(prefix.length);
  return `${prefix || 'agent_'}${body.slice(0, 8)}`;
}

export function rankingAgentIdentity(
  row: RecordValue,
  index: number,
): {
  agentId: string;
  displayName: string;
  shortId: string;
} {
  const agentId = publicAgentName(pick(row, 'agentId', 'agent_id'), '');
  const displayName =
    publicAgentName(pick(row, 'displayName', 'display_name'), '') ||
    `Agent ${String(index + 1).padStart(2, '0')}`;
  return {
    agentId,
    displayName,
    shortId: compactAgentId(agentId, index),
  };
}
