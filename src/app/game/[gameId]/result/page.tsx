import GameResult from '@/components/GameResult';
import '../../../arena402-game.css';

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
