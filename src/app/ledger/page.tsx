import type { Metadata } from 'next';
import ImperialLedger from '@/components/ImperialLedger';

export const metadata: Metadata = {
  title: 'Ledger',
  description:
    'The public on-chain ledger of Arena 402 — every sealed trade, one verifiable transaction on Injective EVM testnet.',
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; agent?: string }>;
}) {
  const { game, agent } = await searchParams;
  return (
    <ImperialLedger
      requestedGameId={game || undefined}
      requestedAgentId={agent || undefined}
    />
  );
}
