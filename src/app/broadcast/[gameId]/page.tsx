import type { Metadata } from 'next';
import ExpoBroadcastBoard from '@/components/ExpoBroadcastBoard';

export const metadata: Metadata = {
  title: 'Live Broadcast',
  description: 'Arena 402 Expo live market broadcast.',
};

export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return <ExpoBroadcastBoard gameId={gameId} />;
}
