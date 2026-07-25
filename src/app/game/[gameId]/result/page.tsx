import GameResult from '@/components/GameResult';

export default async function GameResultPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <div className="site-main">
      <GameResult gameId={gameId} />
    </div>
  );
}
