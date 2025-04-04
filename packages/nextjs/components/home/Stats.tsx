const Stats = ({
  score,
  highScore,
  txCount,
  pendingTxCount,
  scoreMultiplier,
  comboCounter,
}: {
  score: number;
  highScore: number;
  txCount: number;
  pendingTxCount: number;
  scoreMultiplier: number;
  comboCounter: number;
}) => {
  return (
    <div className="px-3 mb-4 shadow stats">
      <div className="stat">
        <div className="stat-title">Score</div>
        <div className="text-base md:text-2xl stat-value">{score || 0}</div>
      </div>

      <div className="stat">
        <div className="stat-title">High Score</div>
        <div className="text-base md:text-2xl stat-value">{highScore || 0}</div>
      </div>

      <div className="stat">
        <div className="stat-title">Matches Sent</div>
        <div className="text-base md:text-2xl stat-value">{txCount || 0}</div>
        <div className="text-xs stat-desc text-info">~{pendingTxCount} pending</div>
      </div>

      {scoreMultiplier > 1 && (
        <div className="stat">
          <div className="stat-title text-accent">Combo</div>
          <div className="text-base md:text-2xl stat-value text-accent">×{scoreMultiplier.toFixed(1)}</div>
          <div className="stat-desc">{comboCounter} chain</div>
        </div>
      )}
    </div>
  );
};

export default Stats;
