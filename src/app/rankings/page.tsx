import type { Metadata } from 'next';
import { SeasonLedger } from '@/components/SeasonLedger';

export const metadata: Metadata = {
  title: 'Season Ledger',
  description:
    'Arena 402 preseason Agent ladder, latest match result, and deterministic live-price preview.',
};

export default function RankingsPage() {
  return (
    <div className="site-main">
      <SeasonLedger />
    </div>
  );
}
