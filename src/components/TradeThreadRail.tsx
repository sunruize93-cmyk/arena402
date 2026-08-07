'use client';

import { useLocale } from '@/components/LocaleProvider';
import { translateText } from '@/lib/i18n';
import type { TradeThread } from '@/lib/trade-threads';

const STAGES = ['RFQ', 'PICK', 'BARGAIN', 'DEAL', 'CHAIN'] as const;

const STATUS_LABELS: Record<TradeThread['status'], string> = {
  rfq: 'Seller reviewing',
  engaged: 'Seller selected',
  negotiating: 'Bargaining',
  deal: 'Terms accepted',
  authorizing: 'Authorizing',
  submitted: 'Sent to chain',
  confirmed: 'Chain confirmed',
  settled: 'Inventory moved',
  rejected: 'No deal',
  failed: 'Settlement failed',
  expired: 'Not selected',
};

function priceLabel(value: string): string {
  if (!value) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const gold = Math.abs(numeric) >= 100_000 ? numeric / 1_000_000 : numeric;
  return `${gold.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })} G`;
}

function fallbackName(value: string, fallback: string): string {
  if (!value) return fallback;
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-5)}`;
}

export default function TradeThreadRail({
  threads,
  selectedId,
  currentRound,
  followingCurrent,
  participantNames,
  onSelect,
  onFollowCurrent,
}: {
  threads: TradeThread[];
  selectedId: string;
  currentRound: number;
  followingCurrent: boolean;
  participantNames: ReadonlyMap<string, string>;
  onSelect: (id: string) => void;
  onFollowCurrent: () => void;
}) {
  const { locale } = useLocale();
  const settled = threads.filter((thread) => thread.status === 'settled').length;
  const live = threads.filter((thread) => thread.active).length;
  const translated = (source: string) => translateText(source, locale);
  const currentThreads = threads.filter(
    (thread) => thread.roundIndex === currentRound,
  );
  const historicalThreads = threads.filter(
    (thread) => thread.roundIndex !== currentRound,
  );

  function threadButton(thread: TradeThread) {
    const buyer = participantNames.get(thread.buyerId)
      || fallbackName(thread.buyerId, translated('Unknown buyer'));
    const seller = participantNames.get(thread.sellerId)
      || fallbackName(thread.sellerId, translated('Seller reviewing'));
    const price = priceLabel(thread.agreedPriceAtomic);
    const status = translated(STATUS_LABELS[thread.status]);
    const good = translated((thread.goodId || 'goods').toUpperCase());
    return (
      <button
        type="button"
        className={`gm-thread-card is-${thread.status}`}
        aria-pressed={selectedId === thread.id}
        aria-label={
          locale === 'zh-CN'
            ? `第 ${thread.roundIndex || '?'} 回合 ${good}：${buyer} 到 ${seller}，${status}`
            : `Round ${thread.roundIndex || '?'} ${thread.goodId || 'trade'}: ${buyer} to ${seller}, ${status}`
        }
        key={thread.id}
        onClick={() => onSelect(thread.id)}
      >
        <span className="gm-thread-card-kicker">
          {locale === 'zh-CN'
            ? `第 ${thread.roundIndex || '–'} 回合 · ${good}`
            : `R${thread.roundIndex || '–'} · ${good}`}
        </span>
        <strong>
          <span>{buyer}</span>
          <b aria-hidden="true">→</b>
          <span>{seller}</span>
        </strong>
        <span className="gm-thread-stages" aria-hidden="true">
          {STAGES.map((stage, index) => (
            <i
              className={
                index < thread.stageIndex
                  ? 'is-done'
                  : index === thread.stageIndex
                    ? 'is-current'
                    : ''
              }
              key={stage}
            >
              {translated(stage)}
            </i>
          ))}
        </span>
        <span className="gm-thread-card-foot">
          <em>{status}</em>
          <b>
            {price
              || (locale === 'zh-CN'
                ? `${thread.turnCount} 轮`
                : `${thread.turnCount} TURN${thread.turnCount === 1 ? '' : 'S'}`)}
          </b>
        </span>
      </button>
    );
  }

  return (
    <section className="gm-thread-rail" aria-labelledby="trade-thread-title">
      <div className="gm-thread-rail-head">
        <div>
          <p className="label" id="trade-thread-title">
            {translated('Trade threads')}
          </p>
          <span>{translated('RFQ → negotiation → settlement')}</span>
        </div>
        <p>
          {locale === 'zh-CN'
            ? `${live} 条进行中 · ${settled} 条已结算`
            : `${live} LIVE · ${settled} SETTLED`}
        </p>
        {!followingCurrent && (
          <button
            type="button"
            className="gm-thread-follow"
            onClick={onFollowCurrent}
          >
            {locale === 'zh-CN' ? '返回当前回合' : 'Follow current round'}
          </button>
        )}
      </div>
      {threads.length > 0 ? (
        <div className="gm-thread-list" role="list" aria-label="Trade interaction threads">
          <div className="gm-thread-group is-current">
            <span className="gm-thread-group-label">
              {locale === 'zh-CN' ? `当前 · 第 ${currentRound} 回合` : `Current · Round ${currentRound}`}
            </span>
            {currentThreads.length > 0
              ? currentThreads.map(threadButton)
              : <p className="gm-thread-empty">No trade thread has opened this round yet.</p>}
          </div>
          {historicalThreads.length > 0 && (
            <details className="gm-thread-history" open={!followingCurrent}>
              <summary>
                {locale === 'zh-CN'
                  ? `历史回合 · ${historicalThreads.length} 条`
                  : `Earlier rounds · ${historicalThreads.length}`}
              </summary>
              <div className="gm-thread-group">
                {historicalThreads.map(threadButton)}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="gm-thread-empty">
          {translated('No RFQ or pairing thread has opened in this game yet.')}
        </p>
      )}
    </section>
  );
}
