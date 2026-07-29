import GameViewer from '@/components/GameViewer';
import '../../arena402-game.css';
import '../../arena402-terminal.css';

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <div className="site-main">
      <GameViewer gameId={gameId} />
    </div>
  );
}
