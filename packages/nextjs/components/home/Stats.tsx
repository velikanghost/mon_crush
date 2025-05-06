import { useGameStore } from "~~/services/store/gameStore";

interface StatsProps {
  handleOpenDrawer: () => void;
  txCount?: number;
  score?: number;
  highScore?: number;
  comboCount?: number;
}

const Stats = ({
  handleOpenDrawer,
  txCount: propsTxCount,
  score: propsScore,
  highScore: propsHighScore,
  comboCount: propsComboCount,
}: StatsProps) => {
  // Get states directly from the store with fallback to props
  const {
    score: storeScore,
    highScore: storeHighScore,
    txCount: storeTxCount,
    scoreMultiplier,
    comboCounter,
  } = useGameStore();

  // Use store values with fallback to props for backward compatibility
  const score = storeScore ?? propsScore ?? 0;
  const highScore = storeHighScore ?? propsHighScore ?? 0;
  const txCount = storeTxCount ?? propsTxCount ?? 0;
  const comboCount = propsComboCount ?? comboCounter ?? 0;

  return (
    <div className="w-full px-2">
      <div className="flex flex-row justify-between p-2 rounded-lg shadow-sm bg-base-200">
        <div className="min-w-0 px-2 py-1 stat">
          <div className="text-xs stat-title">Score</div>
          <div className="text-base stat-value md:text-lg">{score}</div>
        </div>

        <div className="min-w-0 px-2 py-1 stat">
          <div className="text-xs stat-title">High Score</div>
          <div className="text-base stat-value md:text-lg">{highScore}</div>
        </div>

        <div className="min-w-0 px-2 py-1 stat">
          <div className="text-xs stat-title">Matches</div>
          <div className="text-base stat-value md:text-lg">{txCount}</div>
        </div>

        {scoreMultiplier > 1 && (
          <div className="min-w-0 px-2 py-1 stat">
            <div className="text-xs stat-title text-accent">Combo</div>
            <div className="text-base stat-value md:text-lg text-accent">×{scoreMultiplier.toFixed(1)}</div>
            <div className="text-xs stat-desc">{comboCount} chain</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
