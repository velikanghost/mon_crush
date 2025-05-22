import { useEffect, useState } from "react";
import Board from "./Board";
import GameSummary from "./GameSummary";
import { sdk } from "@farcaster/frame-sdk";
import toast from "react-hot-toast";
import { LocalAccount, parseEther } from "viem";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { fetchUserByUsername } from "~~/lib/neynar";
import { monadTestnet } from "~~/scaffold.config";
import {
  notifyGameEnding,
  notifyGameInvitation,
  notifyGameResult,
  notifyGameStarted,
} from "~~/services/notifications/gameNotifications";
import { useGameStore } from "~~/services/store/gameStore";
import { endVersusGame, submitVersusGameScore } from "~~/services/wallet/gameWalletService";
import { notification } from "~~/utils/scaffold-eth";

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

export const VersusMode = ({ user, gameWallet }: { user: any; gameWallet: LocalAccount }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const gameStore = useGameStore();

  // State for creating a game
  const [opponentName, setOpponentName] = useState("");
  const [opponentFid, setOpponentFid] = useState<number | null>(null);
  const [wagerAmount, setWagerAmount] = useState("0.01");
  const [pendingInvites, setPendingInvites] = useState<{ id: string; details: VersusGame }[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  // Throttling flags to prevent multiple simultaneous calls
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [hasTriggeredEndGame, setHasTriggeredEndGame] = useState(false);

  // New state for waiting screen and challenge ID
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  // New state to track if game is in progress (after accepting/creating)
  const [gameInProgress, setGameInProgress] = useState(false);
  const [myGameId, setMyGameId] = useState("");
  const [opponent, setOpponent] = useState("");

  // Add connection loading state
  const [isConnecting, setIsConnecting] = useState(false);

  // Add state to hold opponent score
  const [opponentScore, setOpponentScore] = useState<number>(0);
  // Add state to store game result information
  const [gameResult, setGameResult] = useState<{
    isWinner: boolean | null;
    player1Score: number;
    player2Score: number;
    wagerAmount: string;
  } | null>(null);

  // Parse gameId from URL on component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const gameIdParam = params.get("gameId");

      if (gameIdParam) {
        setMyGameId(gameIdParam);
        // Auto-focus the versus tab (handled by parent component via tab parameter)
      }
    }
  }, []);

  // Contract read hooks
  const { data: playerActiveGames } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getPlayerActiveGames",
    args: [address],
  });

  const { data: activeGameScores, refetch: refetchScores } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameScores",
    args: [(myGameId as `0x${string}`) || "0x0000000000000000000000000000000000000000000000000000000000000000"],
  });

  const { data: gameDetails, refetch: refetchGameDetails } = useScaffoldReadContract({
    contractName: "GameEscrow",
    functionName: "getGameDetails",
    args: [myGameId as `0x${string}`],
    query: {
      enabled: !!myGameId,
    },
  });

  useEffect(() => {
    console.log("gameDetails", gameDetails);
    // If game details are loaded and game is active, set game in progress
    if (gameDetails && gameDetails.isActive) {
      setGameInProgress(true);
      // Set opponent name for display
      const isPlayer1 = gameDetails.player1 === address;
      setOpponent(isPlayer1 ? gameDetails.player2FarcasterName : gameDetails.player1FarcasterName);
    } else if (gameDetails && !gameDetails.isActive && gameInProgress) {
      // If game is no longer active but we thought it was
      //notification.success("Game has ended");
      setGameInProgress(false);
      setGameEnded(true);
    }
  }, [gameDetails, address, gameInProgress]);

  // Contract write hooks
  const { writeContractAsync: createVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: joinVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  const { writeContractAsync: cancelVersusGame } = useScaffoldWriteContract({
    contractName: "GameEscrow",
  });

  useEffect(() => {
    // Check if wallet is connected before proceeding
    if (!isConnected) {
      // Try to connect first
      connect({ connector: connectors[0] });
      const switchToMonadTestnet = async () => {
        try {
          await switchChain({ chainId: monadTestnet.id });
        } catch (error) {
          notification.error("Failed to switch to Monad Testnet. Please try again.");
        }
      };

      switchToMonadTestnet();
    }
  }, []);

  // Handle create game with connection check
  const handleCreateGame = async () => {
    if (!user?.username) {
      notification.error("You need to be connected with Farcaster to create a versus game");
      return;
    }

    if (!isConnected) {
      notification.error("Please wait while connecting your wallet...");
      return;
    }

    if (!opponentName) {
      notification.error("Please enter an opponent's Farcaster username");
      return;
    }

    if (opponentName === user.username) {
      notification.error("You cannot challenge yourself");
      return;
    }

    try {
      setIsCreatingGame(true);
      setGameEnded(false);
      setGameResult(null);
      setGameInProgress(false);

      const opponentFid = await fetchUserByUsername(opponentName);
      // Send notification to the challenged player with the game ID
      if (opponentFid) {
        const wagerInWei = parseEther(wagerAmount);

        await createVersusGame(
          {
            functionName: "createGame",
            args: [opponentName, user.username],
            value: wagerInWei,
          },
          {
            onBlockConfirmation: async txnReceipt => {
              const gameId = txnReceipt.logs[0].topics[1];
              setMyGameId(gameId as string);

              try {
                await notifyGameInvitation(
                  Number(opponentFid.fid),
                  user.username,
                  wagerAmount,
                  gameId as `0x${string}`,
                );
                setWaitingForOpponent(true);
                notification.success(`Game invitation sent to ${opponentName}!`);
                setOpponent(opponentName);
                setOpponentName("");
              } catch (notifError) {
                console.error("Failed to send notification:", notifError);
              }
            },
          },
        );
      }
    } catch (error: any) {
      console.error("Error creating game:", error);
      //notification.error(`Failed to create game: ${error.message || "Unknown error"}`);
      setWaitingForOpponent(false);
    } finally {
      setIsCreatingGame(false);
    }
  };

  // Join an existing game
  const handleJoinGame = async (id: string) => {
    try {
      setIsJoiningGame(true);

      // Reset all game states immediately when joining
      setWaitingForOpponent(false);
      setGameEnded(false);
      setGameResult(null);
      setHasSubmittedScore(false);
      setHasTriggeredEndGame(false);

      const switchToMonadTestnet = async () => {
        try {
          await switchChain({ chainId: monadTestnet.id });
        } catch (error) {
          notification.error("Failed to switch to Monad Testnet. Please try again.");
        }
      };

      switchToMonadTestnet();

      // Get fresh game details before joining
      await refetchGameDetails();
      console.log("gameDetails before joining", gameDetails);

      if (!gameDetails) {
        notification.error("Game details not found");
        return;
      }

      const tx = await joinVersusGame({
        functionName: "joinGame",
        args: [id as `0x${string}`, user.username],
        value: gameDetails.wagerAmount,
      });

      console.log("Game join receipt:", tx);

      setMyGameId(id);
      setHasSubmittedScore(false);
      setGameEnded(false); // Ensure this is explicitly set to false
      setHasTriggeredEndGame(false);
      setGameResult(null); // Reset any previous game results

      // Set game in progress to show game board
      setGameInProgress(true);
      // Set opponent name for display
      setOpponent(gameDetails.player1FarcasterName);

      notification.success("You've joined the game!");

      // Initialize the game board if not already initialized
      if (!gameStore.isInitialized) {
        gameStore.initGame();
      }

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

      // Refresh game details to get the updated state
      refetchGameDetails();
    } catch (error: any) {
      console.error("Error joining game:", error);
      //notification.error(`Failed to join game: ${error.message || "Unknown error"}`);
    } finally {
      setIsJoiningGame(false);
    }
  };

  // Submit score to contract
  const handleSubmitScore = async (gameId: string) => {
    if (!gameId || hasSubmittedScore || isSubmittingScore) return;

    try {
      setIsSubmittingScore(true);
      setIsLoading(true);
      const score = gameStore.score;

      // Get game wallet private key from gameStore
      const gameWalletPrivateKey = gameStore.gameWalletPrivateKey;

      if (!gameWalletPrivateKey) {
        notification.error("Game wallet private key not available");
        return;
      }

      // Check if game is still active before submitting score
      await refetchGameDetails();
      if (!gameDetails || !gameDetails.isActive) {
        notification.success("Game is no longer active");
        setGameInProgress(false);
        return;
      }

      // Use the gameWalletService function
      const success = await submitVersusGameScore(gameWalletPrivateKey, gameId, score, address as `0x${string}`);

      if (success) {
        notification.success("Score submitted!");
        setHasSubmittedScore(true);
        refetchScores();
      } else {
        notification.error("Failed to submit score");
      }
    } catch (error: any) {
      console.error("Error submitting score:", error);
    } finally {
      setIsSubmittingScore(false);
      setIsLoading(false);
    }
  };

  // End a game and distribute prizes
  const handleEndGame = async (gameId: string) => {
    if (isEndingGame) return;
    try {
      setIsEndingGame(true);
      setIsLoading(true);

      // Explicitly reset waiting state to ensure it's false when the game ends
      setWaitingForOpponent(false);

      // Refresh game details first to make sure we have the latest state
      const refreshedDetails = await refetchGameDetails();
      console.log("gameDetails before ending", refreshedDetails);

      const latestGameDetails = refreshedDetails?.data;

      // Check if the game can be ended
      if (!latestGameDetails) {
        notification.error("Game details not found");
        return;
      }

      if (!latestGameDetails.isActive || latestGameDetails.isClaimed) {
        notification.success("Game has already ended");
        setGameInProgress(false);
        setWaitingForOpponent(false);
        setGameEnded(true);
        return;
      }

      // Get game wallet private key from gameStore
      const gameWalletPrivateKey = gameStore.gameWalletPrivateKey;

      if (!gameWalletPrivateKey) {
        notification.error("Game wallet private key not available");
        return;
      }

      await refetchScores();

      // Use the gameWalletService function
      await endVersusGame(gameWalletPrivateKey, gameId);

      setMyGameId("");
      setGameEnded(true);

      // Calculate scores and create the game result directly here
      // Get FIDs for both players
      const player1Fid = await fetchUserByUsername(latestGameDetails.player1FarcasterName);
      const player2Fid = await fetchUserByUsername(latestGameDetails.player2FarcasterName);

      const prize = ((Number(latestGameDetails.wagerAmount) * 2) / 1e18).toString();

      // Refresh game details again to get final state
      const finalDetails = await refetchGameDetails();
      console.log("Final game details after ending", finalDetails);

      // Get the current scores
      const isPlayer1 = latestGameDetails.player1 === address;
      const myScore = gameStore.score;

      // Get more accurate scores
      const player1Score = latestGameDetails.player1ScoreSubmitted
        ? Number(latestGameDetails.player1Score)
        : isPlayer1
          ? myScore
          : 0;

      const player2Score = latestGameDetails.player2ScoreSubmitted
        ? Number(latestGameDetails.player2Score)
        : !isPlayer1
          ? myScore
          : 0;

      // Set opponent score for display in the summary
      setOpponentScore(isPlayer1 ? player2Score : player1Score);

      // Determine the winner
      let isWinner: boolean | null;
      if (player1Score > player2Score) {
        isWinner = isPlayer1 ? true : false;
      } else if (player2Score > player1Score) {
        isWinner = isPlayer1 ? false : true;
      } else {
        isWinner = null; // tie
      }

      // Set the game result immediately so it's available for the UI
      setGameResult({
        isWinner,
        player1Score: isPlayer1 ? myScore : player1Score,
        player2Score: isPlayer1 ? player2Score : myScore,
        wagerAmount: prize,
      });

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

      notification.success("Game ended and prizes distributed!");

      // Ensure all the right states are set
      setGameInProgress(false);
      setWaitingForOpponent(false);
    } catch (error: any) {
      console.error("Error ending game:", error);
      notification.error(`Failed to end game`);

      // if (error.message && error.message.includes("429")) {
      //   notification.error("Rate limit exceeded. Please try again in a moment.");
      // } else if (error.message && error.message.includes("Game not active")) {
      //   notification.success("Game has already ended");
      //   setGameInProgress(false);
      //   setWaitingForOpponent(false);
      //   setGameEnded(true);
      // } else {
      //   notification.error(`Failed to end game: ${error.message || "Unknown error"}`);
      // }
    } finally {
      setIsEndingGame(false);
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
      notification.success("Game cancelled and wager refunded");
      setWaitingForOpponent(false);
      setGameInProgress(false);
      setMyGameId("");
    } catch (error: any) {
      console.error("Error cancelling game:", error);
      notification.error(`Failed to cancel game`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle game board click
  const handleBoardClick = () => {
    // Ensure the game is initialized
    if (!gameStore.isInitialized && gameStore.initGame) {
      gameStore.initGame();
    }
  };

  // Update handleBackToLobby to reset the gameResult state
  const handleBackToLobby = () => {
    setGameInProgress(false);
    setWaitingForOpponent(false);
    setMyGameId("");
    setHasSubmittedScore(false);
    setGameEnded(false);
    setHasTriggeredEndGame(false);
    setCountdown(null);
    setGameResult(null);
  };

  // Update the countdown useEffect to ensure waitingForOpponent is reset
  useEffect(() => {
    if (!myGameId || !gameDetails?.isActive) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const endTime = Number(gameDetails?.endTime);
      const timeLeft = endTime - now;

      setCountdown(timeLeft > 0 ? timeLeft : 0);

      // When 30 seconds remaining, send notification
      if (timeLeft === 30) {
        try {
          // Determine opponent's FID
          const isPlayer1 = gameDetails?.player1 === address;
          const opponentName = isPlayer1 ? gameDetails?.player2FarcasterName : gameDetails?.player1FarcasterName;

          fetchUserByUsername(opponentName!).then(user => {
            if (user) notifyGameEnding(Number(user.fid), 0.5);
          });
        } catch (error) {
          console.error("Failed to send ending notification:", error);
        }
      }

      // Automatically submit score and end game when timer reaches zero
      if (timeLeft <= 0 && !hasTriggeredEndGame) {
        setHasTriggeredEndGame(true); // Set flag to prevent multiple calls
        setWaitingForOpponent(false); // Ensure waiting state is reset

        if (!hasSubmittedScore && !isSubmittingScore) {
          console.log("score", gameStore.score);

          handleSubmitScore(myGameId).then(() => {
            // Add a delay between submitting score and ending game
            setTimeout(() => {
              if (!isEndingGame) {
                handleEndGame(myGameId);
              }
            }, 2000);
          });
        } else if (!isEndingGame) {
          handleEndGame(myGameId);
        }
      }
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [
    myGameId,
    gameDetails,
    gameEnded,
    address,
    hasSubmittedScore,
    isSubmittingScore,
    isEndingGame,
    gameStore.score,
    hasTriggeredEndGame,
  ]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Add handler functions for the GameSummary component
  const handleStartNewGame = () => {
    // Reset game state
    setGameEnded(false);
    setMyGameId("");
    setHasSubmittedScore(false);
    setHasTriggeredEndGame(false);
    setCountdown(null);
    setGameResult(null);
    // Reset the game store
    if (gameStore.initGame) {
      gameStore.initGame();
    }
  };

  const handleSendCast = async () => {
    try {
      // Create game result message
      const isWinner = gameResult?.isWinner;
      const winnerText = isWinner ? "I won! 🎉" : isWinner === false ? "I lost 😔" : "It was a tie! 🤝";

      const message = `I just played Mon Crush versus mode against ${opponent}! ${winnerText}\n\nMy score: ${gameStore.score}\nOpponent score: ${opponentScore}\n\nPlay Mon Crush on @moncrush ⚡`;

      // Use Farcaster SDK to compose cast
      await sdk.actions.composeCast({
        text: message,
        embeds: ["https://mon-crush.vercel.app/"],
      });

      notification.success("Shared result on Farcaster!");
    } catch (error: any) {
      console.error("Error sending cast:", error);
      notification.error(`Failed to send cast`);
    }
  };

  // Fix the gameResult effect to prevent premature execution for player 2
  useEffect(() => {
    if (gameEnded && gameDetails && !gameResult) {
      // Only when game is truly ended (not when player just joins)
      console.log("Setting game result, gameEnded:", gameEnded, "gameDetails:", gameDetails);

      // Extra validation to ensure this only runs when the game actually ended
      if (!gameDetails.isActive || gameDetails.isClaimed) {
        // Only set game result once when the game ends
        const isPlayer1 = gameDetails.player1 === address;
        const myScore = gameStore.score;

        // Get the final scores
        const player1Score = gameDetails.player1ScoreSubmitted
          ? Number(gameDetails.player1Score)
          : isPlayer1
            ? myScore
            : 0;

        const player2Score = gameDetails.player2ScoreSubmitted
          ? Number(gameDetails.player2Score)
          : !isPlayer1
            ? myScore
            : 0;

        // Determine winner
        let isWinner: boolean | null;
        if (player1Score > player2Score) {
          isWinner = isPlayer1 ? true : false;
        } else if (player2Score > player1Score) {
          isWinner = isPlayer1 ? false : true;
        } else {
          isWinner = null; // tie
        }

        // Save the results
        setOpponentScore(isPlayer1 ? player2Score : player1Score);
        setGameResult({
          isWinner,
          player1Score: isPlayer1 ? myScore : player1Score,
          player2Score: isPlayer1 ? player2Score : myScore,
          wagerAmount: (Number(gameDetails.wagerAmount) / 1e18).toString(),
        });
      }
    }
  }, [gameEnded, gameDetails, address, gameStore.score, gameResult]);

  return (
    <div className="p-4 rounded-lg shadow-lg bg-base-100">
      {isConnecting ? (
        <div className="py-8 text-center">
          <span className="loading loading-spinner"></span>
          <p className="mt-2">Connecting wallet...</p>
        </div>
      ) : !user?.username ? (
        <div className="py-8 text-center">
          <p className="text-lg">Connect with Farcaster to play Versus Mode</p>
        </div>
      ) : !isConnected ? (
        <div className="py-8 text-center">
          <p className="text-lg">Failed to connect wallet. Please refresh the page.</p>
        </div>
      ) : gameInProgress ? (
        // Active game UI
        <div className="text-center">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Match vs {opponent}</h3>
            <button className="btn btn-sm btn-ghost" onClick={handleBackToLobby}>
              Back to Lobby
            </button>
          </div>

          {countdown !== null && (
            <div className="flex flex-col items-center p-3 mb-6 rounded-lg bg-base-200">
              <p className="mb-1 text-sm">Time Remaining</p>
              <div className="font-mono text-2xl countdown">
                <span style={{ "--value": Math.floor(countdown / 60) } as React.CSSProperties}></span>:
                <span style={{ "--value": countdown % 60 } as React.CSSProperties}></span>
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="mb-2 text-lg">Your Score: {gameStore.score}</p>
            {hasSubmittedScore ? (
              <div className="badge badge-success">Score Submitted</div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleSubmitScore(myGameId)}
                disabled={isLoading || isSubmittingScore}
              >
                {isLoading || isSubmittingScore ? <span className="loading loading-spinner"></span> : "Submit Score"}
              </button>
            )}
          </div>

          {/* Game board */}
          <div className="mb-4 rounded-lg bg-base-300" onClick={handleBoardClick}>
            {gameStore.isInitialized && gameStore.gameBoard ? (
              <Board />
            ) : (
              <div className="flex items-center justify-center h-64">
                <span className="loading loading-spinner"></span>
                <p className="ml-2">Initializing Game Board...</p>
              </div>
            )}
          </div>
        </div>
      ) : gameEnded && gameResult ? (
        // Game summary UI - only show when we have game results
        <div className="px-3 text-center">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Game Results</h3>
            <button className="btn btn-sm btn-ghost" onClick={handleBackToLobby}>
              Back to Lobby
            </button>
          </div>

          <GameSummary
            player1Name={user?.username || "You"}
            player2Name={opponent}
            player1Score={gameResult.player1Score}
            player2Score={gameResult.player2Score}
            wagerAmount={gameResult.wagerAmount}
            isWinner={gameResult.isWinner}
            onStartNew={handleStartNewGame}
            onSendCast={handleSendCast}
            gameId={myGameId}
            userAddress={address as string}
          />
        </div>
      ) : waitingForOpponent ? (
        // Waiting screen for player 1
        <div className="px-3 text-center">
          <h3 className="mb-4 text-lg font-bold">Waiting for Opponent</h3>
          <div className="flex justify-center mb-6">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
          <p className="mb-6">Your opponent has been invited and will receive a notification to join the game.</p>

          {myGameId && (
            <div className="p-4 mb-6 border rounded-lg border-base-300">
              <p className="mb-2 font-semibold">Game ID:</p>
              <p className="p-2 overflow-auto text-sm break-all bg-base-200">{myGameId}</p>
              <p className="mt-2 text-xs text-accent">
                Share this ID with your opponent if they don't receive the notification.
              </p>
            </div>
          )}

          <button
            className="btn btn-error"
            onClick={() => (myGameId ? handleCancelGame(myGameId) : setWaitingForOpponent(false))}
            disabled={isLoading}
          >
            {isLoading ? <span className="loading loading-spinner"></span> : "Cancel Challenge"}
          </button>
        </div>
      ) : (
        <div className="versus-lobby">
          {/* Create new game section */}
          <div className="p-4 mb-5 border rounded-lg border-accent">
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

            <button className="w-full mt-4 btn btn-primary" onClick={handleCreateGame} disabled={isCreatingGame}>
              {isCreatingGame ? <span className="loading loading-spinner"></span> : "Send Challenge"}
            </button>
          </div>

          {/* Join by Game ID section (This appears if a gameId is provided in URL) */}
          <div className="p-4 mb-8 border rounded-lg border-accent">
            <h3 className="mb-3 text-lg font-semibold">Join Challenge</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Game ID:</span>
              </label>
              <input
                type="text"
                className="w-full input input-bordered"
                value={myGameId}
                onChange={e => setMyGameId(e.target.value)}
                readOnly={!!myGameId}
              />
            </div>
            <button
              className="w-full mt-4 btn btn-accent"
              onClick={() => handleJoinGame(myGameId)}
              disabled={isJoiningGame}
            >
              {isJoiningGame ? <span className="loading loading-spinner"></span> : "Accept Challenge"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
