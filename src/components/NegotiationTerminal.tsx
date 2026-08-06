'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PawnhouseTimelineEvent } from '@/lib/game-api';
import {
  buildNegotiationTerminalLines,
  eventPairingId,
} from '@/lib/negotiation-terminal';
import { useLocale } from '@/components/LocaleProvider';
import { translateText } from '@/lib/i18n';
import { isPairingAwaitingAgentAction } from '@/lib/timeline-projection';

interface NegotiationTerminalProps {
  events: PawnhouseTimelineEvent[];
  pairingId: string;
  pairingStatus?: string;
  onReplay?: () => void;
}

export default function NegotiationTerminal({
  events,
  pairingId,
  pairingStatus,
  onReplay,
}: NegotiationTerminalProps) {
  const { locale } = useLocale();
  const lines = useMemo(
    () =>
      buildNegotiationTerminalLines(events, pairingId).map((line) => ({
        ...line,
        text: translateText(line.text, locale),
      })),
    [events, locale, pairingId],
  );
  const [visibleChars, setVisibleChars] = useState<Record<string, number>>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const matchesPairing = (event: PawnhouseTimelineEvent) =>
    eventPairingId(event) === pairingId;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setVisibleChars({});
  }, [locale, pairingId]);

  useEffect(() => {
    const nextLine = lines.find(
      (line) => (visibleChars[line.key] || 0) < line.text.length,
    );
    if (!nextLine) return;

    if (reduceMotion) {
      setVisibleChars(
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
      event.type === 'negotiation.message' && matchesPairing(event),
  );
  const pairingEvent = events.find(
    (event) =>
      ['pairing.created', 'market.engagement_created'].includes(event.type)
      && eventPairingId(event) === pairingId,
  );
  const sellerId = String(
    pairingEvent?.data.sellerAgentId ||
      pairingEvent?.data.seller_agent_id ||
      pairingEvent?.data.sellerParticipantId ||
      pairingEvent?.data.seller_participant_id ||
      pairingEvent?.data.seller ||
      '',
  );
  const lastActorId = String(
    negotiationEvents.at(-1)?.data.actorAgentId ||
      negotiationEvents.at(-1)?.data.actor_agent_id ||
      '',
  );
  const reportedRole = String(
    negotiationEvents.at(-1)?.data.role ||
      negotiationEvents.at(-1)?.data.actorRole ||
      '',
  ).toLowerCase();
  const nextRole =
    negotiationEvents.length === 0
      ? 'BUYER'
      : reportedRole === 'seller' || lastActorId === sellerId
        ? 'BUYER'
        : 'SELLER';
  const waiting = isPairingAwaitingAgentAction(
    events,
    pairingId,
    pairingStatus,
  );

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
            {locale === 'zh-CN'
              ? '王家典当行 — 智能体对智能体谈判'
              : 'THE KING’S PAWNHOUSE — AGENT-TO-AGENT NEGOTIATION'}
          </span>
          {onReplay && (
            <button className="crt-replay" type="button" onClick={onReplay}>
              {locale === 'zh-CN' ? '↻ 重播' : '↻ Replay'}
            </button>
          )}
        </div>
        <div className="crt-meta label">
          <span>
            {locale === 'zh-CN' ? '[轮次 ' : '[TURN '}
            {Math.min(Math.ceil(negotiationEvents.length / 2), 3)}/3]
          </span>
          <span>{locale === 'zh-CN' ? 'A2A · 公开记录' : 'A2A · PUBLIC TRANSCRIPT'}</span>
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
              $ {locale === 'zh-CN' ? translateText(nextRole, locale) : nextRole}{' '}
              &gt; {locale === 'zh-CN' ? '…思考中…' : '...thinking...'}
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
