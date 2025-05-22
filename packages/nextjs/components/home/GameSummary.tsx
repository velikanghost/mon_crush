import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export interface GameSummaryProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  wagerAmount: string;
  isWinner: boolean | null; // true = player1 won, false = player2 won, null = tie
  onStartNew: () => void;
  onSendCast: () => void;
  gameId: string;
  userAddress: string;
}

const GameSummary: React.FC<GameSummaryProps> = ({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  wagerAmount,
  isWinner,
  onStartNew,
  onSendCast,
  gameId,
  userAddress,
}) => {
  // Get latest game details
  const { data: gameDetails } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameDetails",
    args: [gameId as `0x${string}`],
  });

  // Get latest game scores
  const { data: gameScores } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameScores",
    args: [gameId as `0x${string}`],
  });

  // Update scores based on latest contract data
  const finalPlayer1Score = gameScores ? Number(gameScores[0]) : player1Score;
  const finalPlayer2Score = gameScores ? Number(gameScores[1]) : player2Score;

  let resultMessage = "";
  if (isWinner === true) {
    resultMessage = "You won!";
  } else if (isWinner === false) {
    resultMessage = "You lost!";
  } else {
    resultMessage = "It's a tie!";
  }

  const prize = isWinner
    ? `${parseFloat(wagerAmount) * 2} MON`
    : isWinner === null
      ? `${wagerAmount} MON (refunded)`
      : "0 MON";

  return (
    <div className="p-6 bg-base-200 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-4">{resultMessage}</h2>

      <div className="flex justify-between items-center mb-6">
        <div className="text-center w-5/12">
          <div className="font-semibold mb-1">{player1Name}</div>
          <div className="text-3xl font-bold">{finalPlayer1Score}</div>
        </div>

        <div className="text-center text-lg font-bold">VS</div>

        <div className="text-center w-5/12">
          <div className="font-semibold mb-1">{player2Name}</div>
          <div className="text-3xl font-bold">{finalPlayer2Score}</div>
        </div>
      </div>

      <div className="text-center mb-6">
        <div className="text-sm opacity-70">Prize</div>
        <div className="text-xl font-bold">{prize}</div>
      </div>

      <div className="flex gap-4 justify-center">
        <button className="btn btn-primary" onClick={onStartNew}>
          Start New Game
        </button>

        <button className="btn btn-secondary" onClick={onSendCast}>
          Share on Farcaster
        </button>
      </div>
    </div>
  );
};

export default GameSummary;
