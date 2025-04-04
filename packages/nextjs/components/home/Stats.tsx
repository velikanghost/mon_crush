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
    pendingTxCount,
    scoreMultiplier,
    comboCounter,
  } = useGameStore();

  // Use store values with fallback to props for backward compatibility
  const score = storeScore ?? propsScore ?? 0;
  const highScore = storeHighScore ?? propsHighScore ?? 0;
  const txCount = storeTxCount ?? propsTxCount ?? 0;
  const comboCount = propsComboCount ?? comboCounter ?? 0;

  return (
    <div className="px-3 mb-4">
      <div className="stat">
        <div className="stat-title">Score</div>
        <div className="text-base md:text-2xl stat-value">{score}</div>
      </div>

      <div className="stat">
        <div className="stat-title">High Score</div>
        <div className="text-base md:text-2xl stat-value">{highScore}</div>
      </div>

      <div className="stat" onClick={handleOpenDrawer} style={{ cursor: "pointer" }}>
        <div className="stat-title">Matches Sent</div>
        <div className="text-base md:text-2xl stat-value">{txCount}</div>
        {pendingTxCount > 0 && <div className="text-xs stat-desc text-info">~{pendingTxCount} pending</div>}
      </div>

      {scoreMultiplier > 1 && (
        <div className="stat">
          <div className="stat-title text-accent">Combo</div>
          <div className="text-base md:text-2xl stat-value text-accent">×{scoreMultiplier.toFixed(1)}</div>
          <div className="stat-desc">{comboCount} chain</div>
        </div>
      )}
    </div>
  );
};

export default Stats;
