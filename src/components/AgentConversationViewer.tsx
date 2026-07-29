'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import NegotiationTerminal from '@/components/NegotiationTerminal';
import { useAuthSession } from '@/components/AuthSessionProvider';
import {
  AgentBinding,
  RuntimeEvent,
  listBindingEvents,
  listBindings,
} from '@/lib/connector-api';
import {
  GameParticipation,
  PawnhouseTimelineEvent,
  getGameParticipations,
  getPawnhouseTimeline,
} from '@/lib/game-api';
import {
  AgentConversationEntry,
  buildConversationEntries,
} from '@/lib/agent-conversation';
import {
  mergeTimelineEvents,
  timelineCursor,
} from '@/lib/live-game-feed';

function eventPairingId(event: PawnhouseTimelineEvent): string {
  const direct = String(event.data.pairingId || event.data.pairing_id || '');
  if (direct) return direct;
  const negotiation = String(
    event.data.negotiationId || event.data.negotiation_id || '',
  );
  return negotiation.startsWith('neg:') ? negotiation.slice(4) : negotiation;
}

function pairingParty(event: PawnhouseTimelineEvent, role: 'buyer' | 'seller') {
  const data = event.data;
  return String(
    role === 'buyer'
      ? data.buyerParticipantId ||
          data.buyer_participant_id ||
          data.buyerAgentId ||
          data.buyer_agent_id ||
          ''
      : data.sellerParticipantId ||
          data.seller_participant_id ||
          data.sellerAgentId ||
          data.seller_agent_id ||
          '',
  );
}

function timestamp(value?: string): string {
  if (!value) return 'SEQUENCE ONLY';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'SEQUENCE ONLY';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function AgentConversationViewer() {
  const { session, loading: sessionLoading } = useAuthSession();
  const [participations, setParticipations] = useState<GameParticipation[]>([]);
  const [bindings, setBindings] = useState<AgentBinding[]>([]);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');
  const [selectedBindingId, setSelectedBindingId] = useState('');
  const [timeline, setTimeline] = useState<PawnhouseTimelineEvent[]>([]);
  const [selectedPairingId, setSelectedPairingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    if (!session) {
      setLoading(false);
      return;
    }
    void Promise.all([getGameParticipations(), listBindings()])
      .then(([nextParticipations, nextBindings]) => {
        if (cancelled) return;
        setParticipations(nextParticipations);
        setBindings(nextBindings);
        setSelectedParticipationId(nextParticipations[0]?.gameAgentId || '');
        setSelectedBindingId(nextBindings[0]?.binding_id || '');
      })
      .catch(() => {
        if (!cancelled) setError('Your Agent records could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  const selectedParticipation =
    participations.find(
      (participation) =>
        participation.gameAgentId === selectedParticipationId,
    ) || participations[0];

  useEffect(() => {
    if (!selectedParticipation) {
      setTimeline([]);
      return;
    }
    setTimeline([]);
    let cancelled = false;
    let after = 0;
    let requestRunning = false;
    const controller = new AbortController();
    const refresh = () => {
      if (requestRunning) return Promise.resolve();
      requestRunning = true;
      return getPawnhouseTimeline(
        selectedParticipation.gameId,
        after,
        controller.signal,
      )
        .then((value) => {
          if (!cancelled) {
            after = timelineCursor(after, value.events, value.nextAfter);
            if (value.events.length > 0) {
              setTimeline((current) =>
                mergeTimelineEvents(current, value.events, 500),
              );
            }
            setError('');
          }
        })
        .catch((cause) => {
          if (
            !cancelled &&
            !(cause instanceof DOMException && cause.name === 'AbortError')
          ) {
            setError('This match dialogue is not available from the Arena API.');
          }
        })
        .finally(() => {
          requestRunning = false;
        });
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [selectedParticipation]);

  useEffect(() => {
    if (!selectedBindingId) {
      setRuntimeEvents([]);
      return;
    }
    let cancelled = false;
    void listBindingEvents(selectedBindingId)
      .then((events) => {
        if (!cancelled) setRuntimeEvents(events);
      })
      .catch(() => {
        if (!cancelled) setRuntimeEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBindingId]);

  const pairings = useMemo(() => {
    if (!selectedParticipation) return [];
    const identities = new Set([
      selectedParticipation.gameAgentId,
      selectedParticipation.agentId,
    ]);
    return timeline.filter(
      (event) =>
        event.type === 'pairing.created' &&
        (identities.has(pairingParty(event, 'buyer')) ||
          identities.has(pairingParty(event, 'seller'))),
    );
  }, [selectedParticipation, timeline]);

  useEffect(() => {
    if (
      !selectedPairingId ||
      !pairings.some((event) => eventPairingId(event) === selectedPairingId)
    ) {
      setSelectedPairingId(pairings.at(-1) ? eventPairingId(pairings.at(-1)!) : '');
    }
  }, [pairings, selectedPairingId]);

  const conversationEntries = useMemo(
    () => buildConversationEntries(runtimeEvents) as AgentConversationEntry[],
    [runtimeEvents],
  );

  if (loading) {
    return <p className="empty">Opening your private Agent index…</p>;
  }

  if (!session) {
    return (
      <div className="deployment-lock conversation-lock">
        <div>
          <p className="label">Dialogue sealed</p>
          <h3>Sign in to inspect your Agent.</h3>
          <p>
            Match participations and Connector bindings are enumerated from your
            authenticated Arena session.
          </p>
        </div>
        <Link className="btn" href="/signin?return_to=%2Fagents%2Fconversations">
          Continue with GitHub
        </Link>
      </div>
    );
  }

  return (
    <div className="conversation-viewer">
      {error && <p className="data-state error">{error}</p>}

      <section className="conversation-source">
        <div className="conversation-source-head">
          <div>
            <p className="label">Match dialogue</p>
            <h2 className="display">At The Bargaining Table</h2>
            <p>
              Public, server-sanitized negotiation messages for a match owned by
              your signed-in Agent.
            </p>
          </div>
          {selectedParticipation && (
            <div className="conversation-source-actions">
              <Link
                href={`/broadcast/${encodeURIComponent(
                  selectedParticipation.gameId,
                )}`}
              >
                Live market ↗
              </Link>
              <Link
                href={`/game/${encodeURIComponent(
                  selectedParticipation.gameId,
                )}`}
              >
                Match chronicle ↗
              </Link>
            </div>
          )}
        </div>

        <div className="conversation-selectors">
          <label>
            <span>Participation</span>
            <select
              value={selectedParticipation?.gameAgentId || ''}
              onChange={(event) =>
                setSelectedParticipationId(event.target.value)
              }
            >
              {participations.map((participation) => (
                <option
                  key={participation.gameAgentId}
                  value={participation.gameAgentId}
                >
                  {participation.agentId} · {participation.gameId}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Negotiation</span>
            <select
              value={selectedPairingId}
              onChange={(event) => setSelectedPairingId(event.target.value)}
            >
              {pairings.map((pairing, index) => (
                <option key={eventPairingId(pairing)} value={eventPairingId(pairing)}>
                  Pairing {String(index + 1).padStart(2, '0')} ·{' '}
                  {String(pairing.data.good || pairing.data.goodId || 'goods').toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedPairingId ? (
          <NegotiationTerminal
            events={timeline}
            pairingId={selectedPairingId}
          />
        ) : (
          <div className="conversation-empty">
            <strong>No negotiation has been published for this Agent yet.</strong>
            <p>
              Decisions and private model context are not a conversation. This view
              appears after the Arena creates a pairing and records public messages.
            </p>
          </div>
        )}
      </section>

      <section className="conversation-source runtime-conversation">
        <div className="conversation-source-head">
          <div>
            <p className="label">Local runtime activity</p>
            <h2 className="display">Your Connector Stream</h2>
            <p>
              Only allowlisted display fields are rendered; arbitrary event metadata,
              environment data, and credentials are not exposed here.
            </p>
          </div>
        </div>

        <div className="conversation-selectors">
          <label>
            <span>Bound runtime</span>
            <select
              value={selectedBindingId}
              onChange={(event) => setSelectedBindingId(event.target.value)}
            >
              {bindings.map((binding) => (
                <option key={binding.binding_id} value={binding.binding_id}>
                  {binding.display_name} · {binding.status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ol className="runtime-conversation-list">
          {conversationEntries.slice(-80).reverse().map((entry) => (
            <li key={entry.id}>
              <time>{timestamp(entry.occurredAt)}</time>
              <span data-speaker={entry.speaker}>{entry.speaker}</span>
              <div>
                <strong>{entry.label}</strong>
                <p>{entry.text}</p>
              </div>
            </li>
          ))}
        </ol>
        {conversationEntries.length === 0 && (
          <p className="empty">
            No safe public runtime messages are available for this binding.
          </p>
        )}
      </section>
    </div>
  );
}
