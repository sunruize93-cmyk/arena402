'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PawnhouseTimelineEvent } from '@/lib/game-api';
import { buildNegotiationTerminalLines } from '@/lib/negotiation-terminal';

interface NegotiationTerminalProps {
  events: PawnhouseTimelineEvent[];
  pairingId: string;
  onReplay?: () => void;
}

export default function NegotiationTerminal({
  events,
  pairingId,
  onReplay,
}: NegotiationTerminalProps) {
  const lines = useMemo(
    () => buildNegotiationTerminalLines(events, pairingId),
    [events, pairingId],
  );
  const [visibleChars, setVisibleChars] = useState<Record<string, number>>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setVisibleChars({});
  }, [pairingId]);

  useEffect(() => {
    const nextLine = lines.find(
      (line) => (visibleChars[line.key] || 0) < line.text.length,
    );
    if (!nextLine) return;

    if (reduceMotion) {
      setVisibleChars((current) =>
        Object.fromEntries(lines.map((line) => [line.key, line.text.length])),
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleChars((current) => ({
        ...current,
        [nextLine.key]: Math.min(
          (current[nextLine.key] || 0) + 1,
          nextLine.text.length,
        ),
      }));
    }, nextLine.highlight ? 28 : 16);
    return () => window.clearTimeout(timer);
  }, [lines, reduceMotion, visibleChars]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [lines, visibleChars]);

  const negotiationEvents = events.filter(
    (event) =>
      event.type === 'negotiation.message' &&
      String(event.data.pairingId || event.data.pairing_id || '') === pairingId,
  );
  const lastAction = String(
    negotiationEvents.at(-1)?.data.action ||
      negotiationEvents.at(-1)?.data.type ||
      '',
  ).toLowerCase();
  const pairingEvent = events.find(
    (event) =>
      event.type === 'pairing.created' &&
      String(event.data.pairingId || event.data.pairing_id || '') === pairingId,
  );
  const sellerId = String(
    pairingEvent?.data.sellerAgentId ||
      pairingEvent?.data.seller_agent_id ||
      pairingEvent?.data.seller ||
      '',
  );
  const lastActorId = String(
    negotiationEvents.at(-1)?.data.actorAgentId ||
      negotiationEvents.at(-1)?.data.actor_agent_id ||
      '',
  );
  const settled = events.some(
    (event) =>
      event.type === 'settlement.inventory_committed' &&
      String(event.data.pairingId || event.data.pairing_id || '') === pairingId,
  );
  const nextRole =
    negotiationEvents.length === 0
      ? 'BUYER'
      : lastActorId === sellerId
        ? 'BUYER'
        : 'SELLER';
  const waiting = lastAction !== 'accept' && lastAction !== 'reject' && !settled;

  return (
    <div className="gm-negotiation-terminal">
      <div className="crt" data-pairing-id={pairingId}>
        <div className="crt-bar">
          <span className="crt-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="crt-bar-title">
            THE KING&apos;S PAWNHOUSE — AGENT-TO-AGENT NEGOTIATION
          </span>
          {onReplay && (
            <button className="crt-replay" type="button" onClick={onReplay}>
              ↻ Replay
            </button>
          )}
        </div>
        <div className="crt-meta label">
          <span>[TURN {Math.min(Math.ceil(negotiationEvents.length / 2), 3)}/3]</span>
          <span>A2A · PUBLIC TRANSCRIPT</span>
        </div>
        <div className="crt-body" ref={bodyRef} aria-live="polite">
          {lines.map((line) => (
            <div
              className={`crt-line ${line.kind}${line.quote ? ' quote' : ''}${
                line.highlight ? ' hl' : ''
              }`}
              data-terminal-line={line.key}
              key={line.key}
            >
              {line.text.slice(0, visibleChars[line.key] || 0)}
            </div>
          ))}
          {waiting && (
            <div className="crt-line think">
              $ {nextRole} &gt; ...thinking...
              <span className="crt-progress" aria-hidden="true">
                <span className="crt-progress-fill" />
              </span>
            </div>
          )}
          <span className="crt-cursor" aria-hidden="true">
            ▊
          </span>
        </div>
      </div>
    </div>
  );
}
