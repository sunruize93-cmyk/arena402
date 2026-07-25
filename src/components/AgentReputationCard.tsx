import type { AgentReputation } from '@/lib/game-api';
import { formatSuccessRate } from '@/lib/reputation';

export default function AgentReputationCard({
  reputation,
  compact = false,
}: {
  reputation?: AgentReputation | null;
  compact?: boolean;
}) {
  return (
    <dl
      className={`gm-reputation ${compact ? 'is-compact' : ''}`}
      aria-label="Arena reputation snapshot"
    >
      <div>
        <dt>Attempts</dt>
        <dd>{reputation?.tradeAttempts ?? '—'}</dd>
      </div>
      <div>
        <dt>Settled</dt>
        <dd>{reputation?.settledTrades ?? '—'}</dd>
      </div>
      <div>
        <dt>Success rate</dt>
        <dd>
          {formatSuccessRate(
            reputation?.successRateBps,
            reputation?.tradeAttempts,
          )}
        </dd>
      </div>
    </dl>
  );
}
