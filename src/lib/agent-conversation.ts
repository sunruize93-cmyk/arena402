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

type DisplayField =
  | 'action'
  | 'content'
  | 'message'
  | 'status'
  | 'summary'
  | 'text';

type DisplayEventDefinition = {
  fields: readonly DisplayField[];
  label: string;
  speaker: AgentConversationEntry['speaker'];
};

const DISPLAY_EVENTS: Record<string, DisplayEventDefinition> = {
  'arena.message': {
    fields: ['message', 'content', 'text'],
    label: 'ARENA MESSAGE',
    speaker: 'ARENA',
  },
  'command.completed': {
    fields: ['summary', 'status', 'action'],
    label: 'COMMAND COMPLETED',
    speaker: 'ARENA',
  },
  'command.failed': {
    fields: ['summary', 'status', 'action'],
    label: 'COMMAND FAILED',
    speaker: 'ARENA',
  },
  'command.started': {
    fields: ['summary', 'status', 'action'],
    label: 'COMMAND STARTED',
    speaker: 'ARENA',
  },
  'process.completed': {
    fields: ['summary', 'status'],
    label: 'PROCESS COMPLETED',
    speaker: 'RUNTIME',
  },
  'process.failed': {
    fields: ['summary', 'status'],
    label: 'PROCESS FAILED',
    speaker: 'RUNTIME',
  },
  'process.started': {
    fields: ['summary', 'status'],
    label: 'PROCESS STARTED',
    speaker: 'RUNTIME',
  },
  'runtime.message': {
    fields: ['message', 'content'],
    label: 'AGENT MESSAGE',
    speaker: 'AGENT',
  },
  'runtime.task.completed': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK COMPLETED',
    speaker: 'ARENA',
  },
  'runtime.task.failed': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK FAILED',
    speaker: 'ARENA',
  },
  'runtime.task.started': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK STARTED',
    speaker: 'ARENA',
  },
  'session.completed': {
    fields: ['summary', 'status'],
    label: 'SESSION COMPLETED',
    speaker: 'RUNTIME',
  },
  'session.failed': {
    fields: ['summary', 'status'],
    label: 'SESSION FAILED',
    speaker: 'RUNTIME',
  },
  'session.started': {
    fields: ['summary', 'status'],
    label: 'SESSION STARTED',
    speaker: 'RUNTIME',
  },
  'task.completed': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK COMPLETED',
    speaker: 'ARENA',
  },
  'task.failed': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK FAILED',
    speaker: 'ARENA',
  },
  'task.started': {
    fields: ['summary', 'status', 'action'],
    label: 'TASK STARTED',
    speaker: 'ARENA',
  },
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

function displayText(
  data: Record<string, unknown> | undefined,
  fields: readonly DisplayField[],
): string {
  if (!data) return 'No public message was attached to this event.';
  for (const field of fields) {
    const value = data[field];
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return safeDisplayText(text);
    }
  }
  return 'Event recorded. No public transcript text is available.';
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
    .flatMap((event, index) => {
      const eventType = String(
        event.event_type || event.type || '',
      ).toLowerCase();
      const definition = DISPLAY_EVENTS[eventType];
      if (!definition) return [];
      return {
        id: `runtime-event:${event.sequence ?? index}`,
        speaker: definition.speaker,
        label: definition.label,
        text: displayText(event.data, definition.fields),
        occurredAt: event.occurred_at || event.received_at,
      };
    });
}
