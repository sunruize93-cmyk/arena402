export type ProjectionRecord = Record<string, unknown>;

export function asProjectionRecord(value: unknown): ProjectionRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ProjectionRecord)
    : null;
}

export function projectionValue(
  record: ProjectionRecord | null | undefined,
  ...keys: string[]
): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

export function publicProjectionText(
  value: unknown,
  fallback = '',
  maxLength = 180,
): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const clean = String(value)
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim();
  return clean ? clean.slice(0, maxLength) : fallback;
}

export function publicAgentName(
  value: unknown,
  fallback = 'Unknown Agent',
  maxLength = 120,
): string {
  return publicProjectionText(value, fallback, maxLength);
}
