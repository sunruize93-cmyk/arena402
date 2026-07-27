type RecordValue = Record<string, unknown>;

function pick(record: RecordValue, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function publicAgentText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, 120);
}

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
  const agentId = publicAgentText(pick(row, 'agentId', 'agent_id'));
  const displayName =
    publicAgentText(pick(row, 'displayName', 'display_name')) ||
    `Agent ${String(index + 1).padStart(2, '0')}`;
  return {
    agentId,
    displayName,
    shortId: compactAgentId(agentId, index),
  };
}

