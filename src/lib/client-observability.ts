export const ARENA_TELEMETRY_EVENT = 'arena402:client-telemetry';

export type ArenaClientTelemetryKind =
  | 'client_error'
  | 'navigation_start'
  | 'unhandled_rejection'
  | 'web_vital';

export function emitArenaClientTelemetry(
  kind: ArenaClientTelemetryKind,
  fields: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ARENA_TELEMETRY_EVENT, {
      detail: {
        kind,
        at: Date.now(),
        ...fields,
      },
    }),
  );
}
