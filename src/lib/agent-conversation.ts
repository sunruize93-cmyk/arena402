type RuntimeEventRecord = {
  event_id?: string;
  event_type?: string;
  type?: string;
  data?: Record<string, unknown>;
  occurred_at?: string;
  received_at?: string;
  sequence?: number;
};

export interface AgentConversationEntry {
  id: string;
  speaker: 'AGENT' | 'ARENA' | 'RUNTIME';
  label: string;
  text: string;
  occurredAt?: string;
}

const DISPLAY_FIELDS = [
  'message',
  'content',
  'text',
  'summary',
  'action',
  'status',
] as const;

const DISPLAY_EVENT_LABELS: Record<string, string> = {
  'arena.message': 'ARENA MESSAGE',
  'command.completed': 'COMMAND COMPLETED',
  'command.failed': 'COMMAND FAILED',
  'command.started': 'COMMAND STARTED',
  'process.completed': 'PROCESS COMPLETED',
  'process.failed': 'PROCESS FAILED',
  'process.started': 'PROCESS STARTED',
  'runtime.message': 'AGENT MESSAGE',
  'runtime.task.completed': 'TASK COMPLETED',
  'runtime.task.failed': 'TASK FAILED',
  'runtime.task.started': 'TASK STARTED',
  'session.completed': 'SESSION COMPLETED',
  'session.failed': 'SESSION FAILED',
  'session.started': 'SESSION STARTED',
  'task.completed': 'TASK COMPLETED',
  'task.failed': 'TASK FAILED',
  'task.started': 'TASK STARTED',
};

const SENSITIVE_TEXT = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bsk-[A-Za-z0-9_-]{12,}/gi,
  /\b(?:api[_ -]?key|client[_ -]?secret|private[_ -]?key)\s*[:=]\s*\S+/gi,
  /\b0x[a-fA-F0-9]{64}\b/g,
] as const;

function safeDisplayText(value: string): string {
  let next = value;
  for (const pattern of SENSITIVE_TEXT) {
    next = next.replace(pattern, '[REDACTED]');
  }
  return next.slice(0, 600);
}

function displayText(data: Record<string, unknown> | undefined): string {
  if (!data) return 'No public message was attached to this event.';
  for (const field of DISPLAY_FIELDS) {
    const value = data[field];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return safeDisplayText(text);
    }
  }
  return 'Event recorded. No public transcript text is available.';
}

function displayEventLabel(value: string): string {
  const normalized = value.toLowerCase();
  return DISPLAY_EVENT_LABELS[normalized] || 'RUNTIME EVENT';
}

function speaker(eventType: string, data?: Record<string, unknown>) {
  const role = String(data?.role || data?.speaker || '').toLowerCase();
  if (
    role === 'assistant' ||
    role === 'agent' ||
    eventType.includes('message')
  ) {
    return 'AGENT' as const;
  }
  if (
    eventType.includes('task') ||
    eventType.includes('command') ||
    eventType.includes('arena')
  ) {
    return 'ARENA' as const;
  }
  return 'RUNTIME' as const;
}

export function buildConversationEntries(
  events: RuntimeEventRecord[],
): AgentConversationEntry[] {
  return [...events]
    .sort((left, right) => {
      const leftTime = Date.parse(left.occurred_at || left.received_at || '');
      const rightTime = Date.parse(right.occurred_at || right.received_at || '');
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        return leftTime - rightTime;
      }
      return Number(left.sequence || 0) - Number(right.sequence || 0);
    })
    .map((event, index) => {
      const eventType = String(event.event_type || event.type || 'runtime.event');
      return {
        id: `runtime-event:${event.sequence ?? index}`,
        speaker: speaker(eventType, event.data),
        label: displayEventLabel(eventType),
        text: displayText(event.data),
        occurredAt: event.occurred_at || event.received_at,
      };
    });
}
