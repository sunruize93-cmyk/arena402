import { emitArenaClientTelemetry } from '@/lib/client-observability';

try {
  performance.mark('arena402:app-init');

  window.addEventListener('error', (event) => {
    emitArenaClientTelemetry('client_error', {
      category:
        event.error instanceof Error ? event.error.name : 'WindowError',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    emitArenaClientTelemetry('unhandled_rejection', {
      category:
        event.reason instanceof Error ? event.reason.name : 'UnknownRejection',
    });
  });
} catch {
  // Observability must never prevent the Arena application from booting.
}

export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse',
): void {
  let path = 'unknown';
  try {
    path = new URL(url, window.location.origin).pathname;
  } catch {
    // Keep an opaque path rather than serializing an invalid or sensitive URL.
  }
  emitArenaClientTelemetry('navigation_start', {
    navigationType,
    path,
  });
}
