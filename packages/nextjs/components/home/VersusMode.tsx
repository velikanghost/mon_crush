import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { fetchUserByUsername } from "~~/lib/neynar";
import {
  notifyGameEnding,
  notifyGameInvitation,
  notifyGameResult,
  notifyGameStarted,
} from "~~/services/notifications/gameNotifications";
import { useGameStore } from "~~/services/store/gameStore";

interface VersusGame {
  player1: string;
  player2: string;
  wagerAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  isActive: boolean;
  isClaimed: boolean;
  player1FarcasterName: string;
  player2FarcasterName: string;
  player1Score: bigint;
  player2Score: bigint;
  player1ScoreSubmitted: boolean;
  player2ScoreSubmitted: boolean;
}

export const VersusMode = ({ user }: { user: any }) => {
  const { address } = useAccount();
  const gameStore = useGameStore();

  // State for creating a game
  const [opponentName, setOpponentName] = useState("");
  const [opponentFid, setOpponentFid] = useState<number | null>(null);
  const [wagerAmount, setWagerAmount] = useState("0.01");
  const [activeGames, setActiveGames] = useState<{ id: string; details: VersusGame }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; details: VersusGame }[]>([]);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  // Contract read hooks
  const { data: playerActiveGames } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getPlayerActiveGames",
    args: [address],
  });

  const { data: activeGameScores, refetch: refetchScores } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameScores",
    args: [(activeGameId as `0x${string}`) || "0x0000000000000000000000000000000000000000000000000000000000000000"],
  });

  const { data: gameDetails, refetch: refetchGameDetails } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameDetails",
    args: [(activeGameId as `0x${string}`) || "0x0000000000000000000000000000000000000000000000000000000000000000"],
  });

  // Contract write hooks
  const { writeContractAsync: createVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: joinVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: endVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: cancelVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: submitGameScore } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  // Fetch game details for an active game
  const fetchGameDetails = async (gameId: string) => {
    try {
      // Update the activeGameId which will trigger the gameDetails hook
      setActiveGameId(gameId);
      await refetchGameDetails?.();
      return gameDetails;
    } catch (error) {
      console.error("Error fetching game details:", error);
      return null;
    }
  };

  // Create a new versus game
  const handleCreateGame = async () => {
    if (!user?.username) {
      toast.error("You need to be connected with Farcaster to create a versus game");
      return;
    }

    if (!opponentName) {
      toast.error("Please enter an opponent's Farcaster username");
      return;
    }

    if (opponentName === user.username) {
      toast.error("You cannot challenge yourself");
      return;
    }

    try {
      setIsLoading(true);

      console.log("opponentName", opponentName);
      const opponentFid = await fetchUserByUsername(opponentName);
      console.log("opponent", opponentFid);

      const wagerInWei = parseEther(wagerAmount);

      await createVersusGame({
        functionName: "createGame",
        args: [opponentName, user.username],
        value: wagerInWei,
      });

      // Send notification to the challenged player
      if (opponentFid) {
        console.log("opponentFid", opponentFid);
        try {
          await notifyGameInvitation(Number(opponentFid.fid), user.username, wagerAmount);
          toast.success(`Game invitation sent to ${opponentName}!`);
          setOpponentName("");
        } catch (notifError) {
          console.error("Failed to send notification:", notifError);
          // Don't show error to user as the game was created successfully
        }
      }
    } catch (error: any) {
      console.error("Error creating game:", error);
      toast.error(`Failed to create game: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Join an existing game
  const handleJoinGame = async (gameId: string) => {
    try {
      setIsLoading(true);

      // Get game details to determine wager amount
      const gameDetails = pendingInvites.find(game => game.id === gameId)?.details;

      if (!gameDetails) {
        toast.error("Game details not found");
        return;
      }

      await joinVersusGame({
        functionName: "joinGame",
        args: [gameId as `0x${string}`, user.username],
        value: gameDetails.wagerAmount,
      });

      toast.success("You've joined the game!");
      setActiveGameId(gameId);
      setHasSubmittedScore(false);
      setGameEnded(false);

      // Notify the opponent that the game has started
      const opponentUsername = gameDetails.player1FarcasterName;
      const creatorFid = await fetchUserByUsername(opponentUsername);
      if (creatorFid) {
        try {
          await notifyGameStarted(Number(creatorFid.fid), user.username);
        } catch (notifError) {
          console.error("Failed to send game start notification:", notifError);
        }
      }
    } catch (error: any) {
      console.error("Error joining game:", error);
      toast.error(`Failed to join game: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit score to contract
  const handleSubmitScore = async (gameId: string) => {
    if (!gameId || hasSubmittedScore) return;

    try {
      setIsLoading(true);
      const score = gameStore.score;

      await submitGameScore({
        functionName: "submitScore",
        args: [gameId as `0x${string}`, BigInt(score)],
      });

      toast.success("Score submitted!");
      setHasSubmittedScore(true);
      refetchScores();
    } catch (error: any) {
      console.error("Error submitting score:", error);
      toast.error(`Failed to submit score: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // End a game and distribute prizes
  const handleEndGame = async (gameId: string) => {
    try {
      setIsLoading(true);

      // Get game details to determine winner/loser before ending the game
      const gameDetails = activeGames.find(game => game.id === gameId)?.details;
      if (!gameDetails) {
        toast.error("Game details not found");
        return;
      }

      // Submit score if not already submitted
      if (!hasSubmittedScore) {
        await handleSubmitScore(gameId);
      }

      // Call endGame function which will compare submitted scores
      await endVersusGame({
        functionName: "endGame",
        args: [gameId as `0x${string}`],
      });

      toast.success("Game ended and prizes distributed!");
      setActiveGameId(null);
      setGameEnded(true);

      // Get FIDs for both players
      const player1Fid = await fetchUserByUsername(gameDetails.player1FarcasterName);
      const player2Fid = await fetchUserByUsername(gameDetails.player2FarcasterName);

      const prize = ((Number(gameDetails.wagerAmount) * 2) / 1e18).toString();

      // Refresh scores after ending
      await refetchScores();

      // Get the current scores
      const player1Score = gameDetails.player1ScoreSubmitted ? Number(gameDetails.player1Score) : gameStore.score;
      const player2Score = gameDetails.player2ScoreSubmitted ? Number(gameDetails.player2Score) : 0;

      // Determine if current user is player1
      const isPlayer1 = gameDetails.player1 === address;
      const myScore = gameStore.score;

      // Determine the winner and send notifications
      if (player1Fid && player2Fid) {
        if ((isPlayer1 && player1Score > player2Score) || (!isPlayer1 && player2Score > player1Score)) {
          // Current user won
          await notifyGameResult(Number(player1Fid.fid), true, myScore, prize);
          await notifyGameResult(Number(player2Fid.fid), false, isPlayer1 ? player2Score : player1Score);
        } else if ((isPlayer1 && player1Score < player2Score) || (!isPlayer1 && player2Score < player1Score)) {
          // Opponent won
          await notifyGameResult(Number(player2Fid.fid), true, isPlayer1 ? player2Score : player1Score, prize);
          await notifyGameResult(Number(player1Fid.fid), false, myScore);
        } else {
          // It's a tie
          await notifyGameResult(Number(player1Fid.fid), false, player1Score, prize + " (split)");
          await notifyGameResult(Number(player2Fid.fid), false, player2Score, prize + " (split)");
        }
      }
    } catch (error: any) {
      console.error("Error ending game:", error);
      toast.error(`Failed to end game: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel a pending game
  const handleCancelGame = async (gameId: string) => {
    try {
      setIsLoading(true);
      await cancelVersusGame({
        functionName: "cancelGame",
        args: [gameId as `0x${string}`],
      });
      toast.success("Game cancelled and wager refunded");
    } catch (error: any) {
      console.error("Error cancelling game:", error);
      toast.error(`Failed to cancel game: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load active games and invites
  useEffect(() => {
    const loadGames = async () => {
      if (!address || !playerActiveGames) return;

      const active: { id: string; details: VersusGame }[] = [];
      const pending: { id: string; details: VersusGame }[] = [];

      for (const gameId of playerActiveGames) {
        setActiveGameId(gameId);
        await refetchGameDetails?.();

        if (!gameDetails) continue;

        if (gameDetails.isActive) {
          active.push({ id: gameId, details: gameDetails as VersusGame });
          // If we're in an active game, set it as the current game
          if (gameDetails.player1 === address || gameDetails.player2 === address) {
            setActiveGameId(gameId);

            // Check if we've already submitted our score
            if (
              (gameDetails.player1 === address && gameDetails.player1ScoreSubmitted) ||
              (gameDetails.player2 === address && gameDetails.player2ScoreSubmitted)
            ) {
              setHasSubmittedScore(true);
            } else {
              setHasSubmittedScore(false);
            }
          }
        } else if (
          gameDetails.player2 === "0x0000000000000000000000000000000000000000" &&
          gameDetails.player2FarcasterName === user?.username
        ) {
          // This is an invite for the current user
          pending.push({ id: gameId, details: gameDetails as VersusGame });
        }
      }

      setActiveGames(active);
      setPendingInvites(pending);
    };

    loadGames();
  }, [address, playerActiveGames, user, gameDetails, refetchGameDetails]);

  // Countdown timer for active game
  useEffect(() => {
    if (!activeGameId) {
      setCountdown(null);
      return;
    }

    const activeGame = activeGames.find(game => game.id === activeGameId);
    if (!activeGame) return;

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = Number(activeGame.details.endTime);
      const timeLeft = endTime - now;

      setCountdown(timeLeft > 0 ? timeLeft : 0);

      // When 30 seconds remaining, send notification
      if (timeLeft === 30) {
        try {
          // Determine opponent's FID
          const isPlayer1 = activeGame.details.player1 === address;
          const opponentName = isPlayer1
            ? activeGame.details.player2FarcasterName
            : activeGame.details.player1FarcasterName;

          fetchUserByUsername(opponentName).then(user => {
            if (user) notifyGameEnding(Number(user.fid), 0.5);
          });
        } catch (error) {
          console.error("Failed to send ending notification:", error);
        }
      }

      // Automatically submit score and end game when timer reaches zero
      if (timeLeft <= 0 && !gameEnded) {
        if (!hasSubmittedScore) {
          handleSubmitScore(activeGameId).then(() => {
            handleEndGame(activeGameId);
          });
        } else {
          handleEndGame(activeGameId);
        }
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [activeGameId, activeGames, hasSubmittedScore, gameEnded]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 rounded-lg shadow-lg bg-base-100">
      <h2 className="mb-4 text-xl font-bold">Versus Mode</h2>

      {!user?.username ? (
        <div className="py-8 text-center">
          <p className="text-lg">Connect with Farcaster to play Versus Mode</p>
        </div>
      ) : activeGameId ? (
        <div className="versus-active-game">
          <div className="mb-6 text-center">
            <div className="mb-2 text-xl">Game in Progress!</div>
            {countdown !== null && <div className="text-2xl font-bold countdown">{formatTime(countdown)}</div>}
            <div className="mt-4 text-lg">
              Current Score: <span className="font-bold">{gameStore.score}</span>
            </div>
            <p className="mt-2 text-sm text-accent">Match as many monanimals as you can before time runs out!</p>

            {!hasSubmittedScore && (
              <button
                className="mt-4 btn btn-accent"
                onClick={() => handleSubmitScore(activeGameId)}
                disabled={isLoading}
              >
                {isLoading ? <span className="loading loading-spinner"></span> : "Submit Score"}
              </button>
            )}

            {hasSubmittedScore && (
              <div className="p-2 mt-4 rounded-md bg-success bg-opacity-20">
                <p className="text-success">Score submitted successfully!</p>
                <p className="text-xs">Waiting for game to end...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="versus-lobby">
          {/* Create new game section */}
          <div className="p-4 mb-8 border rounded-lg border-base-300">
            <h3 className="mb-3 text-lg font-semibold">Challenge a Friend</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Opponent's Farcaster Username</span>
              </label>
              <input
                type="text"
                placeholder="Enter username"
                className="w-full input input-bordered"
                value={opponentName}
                onChange={e => setOpponentName(e.target.value)}
              />
            </div>

            <div className="mt-3 form-control">
              <label className="label">
                <span className="label-text">Wager Amount (MON)</span>
              </label>
              <input
                type="number"
                placeholder="0.01"
                className="w-full input input-bordered"
                value={wagerAmount}
                onChange={e => setWagerAmount(e.target.value)}
                min="0.001"
                step="0.001"
              />
            </div>

            <button className="w-full mt-4 btn btn-primary" onClick={handleCreateGame} disabled={isLoading}>
              {isLoading ? <span className="loading loading-spinner"></span> : "Send Challenge"}
            </button>
          </div>

          {/* Pending invites section */}
          {pendingInvites.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-lg font-semibold">Game Invitations</h3>
              <div className="space-y-3">
                {pendingInvites.map(game => (
                  <div key={game.id} className="p-3 border rounded-lg border-base-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p>
                          From: <span className="font-semibold">{game.details.player1FarcasterName}</span>
                        </p>
                        <p className="text-sm">Wager: {Number(game.details.wagerAmount) / 1e18} MON</p>
                      </div>
                      <button
                        className="btn btn-sm btn-accent"
                        onClick={() => handleJoinGame(game.id)}
                        disabled={isLoading}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Your active games section (games you've created) */}
          {activeGames.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-semibold">Your Active Games</h3>
              <div className="space-y-3">
                {activeGames.map(game => (
                  <div key={game.id} className="p-3 border rounded-lg border-base-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p>
                          {game.details.player1 === address
                            ? `vs ${game.details.player2FarcasterName}`
                            : `vs ${game.details.player1FarcasterName}`}
                        </p>
                        <p className="text-sm">Wager: {Number(game.details.wagerAmount) / 1e18} MON</p>
                      </div>
                      {game.details.player2 === "0x0000000000000000000000000000000000000000" && (
                        <button
                          className="btn btn-sm btn-error"
                          onClick={() => handleCancelGame(game.id)}
                          disabled={isLoading}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingInvites.length === 0 && activeGames.length === 0 && (
            <div className="py-4 text-center text-base-content opacity-70">No active games or pending invitations</div>
          )}
        </div>
      )}
    </div>
  );
};
