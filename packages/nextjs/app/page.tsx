"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import Board from "~~/components/home/Board";
import Stats from "~~/components/home/Stats";
import ZustandDrawer from "~~/components/home/ZustandDrawer";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { initMatchSound } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";

export default function Home() {
  const { address } = useAccount();
  const gameStore = useGameStore();

  // Get on-chain high score for the connected address
  const { data: onChainHighScore } = useScaffoldReadContract({
    contractName: "CandyCrushGame", // Use the correct contract name from your project
    functionName: "playerScores", // Use the correct function name from your contract
    args: [address],
  });

  // Set up write contract for updating high score
  const { writeContractAsync: writeHighScore } = useScaffoldWriteContract({
    contractName: "CandyCrushGame", // Use the correct contract name from your project
  });

  // Initialize game when component mounts
  useEffect(() => {
    if (address) {
      if (gameStore.setAddress) {
        gameStore.setAddress(address);
      }
      if (gameStore.initGame) {
        gameStore.initGame();
      }
      initMatchSound();
    }
  }, [address, gameStore.initGame, gameStore.setAddress]);

  // Sync with blockchain high score
  // useEffect(() => {
  //   if (onChainHighScore && address && gameStore.updateHighScoreOnChain) {
  //     gameStore.updateHighScoreOnChain(Number(onChainHighScore), async (newHighScore: number) => {
  //       try {
  //         await writeHighScore({
  //           functionName: "recordMatch",
  //           args: [0, 0, newHighScore],
  //         });
  //       } catch (error) {
  //         console.error("Failed to update high score on chain:", error);
  //       }
  //     });
  //   }
  // }, [onChainHighScore, address, gameStore, writeHighScore]);

  // Prepare handleOpenDrawer function for Stats
  const handleOpenDrawer = () => {
    if (gameStore.setIsDrawerOpen) {
      gameStore.setIsDrawerOpen(true);
    }
    if (gameStore.fetchTxHashesFromApi) {
      gameStore.fetchTxHashesFromApi();
    }
  };

  // Handle game reset
  const handleResetGame = () => {
    if (gameStore.resetGame) {
      gameStore.resetGame();
    }
  };

  return (
    <>
      <div className="flex flex-col items-center flex-grow pt-2 pb-12">
        <div className="w-full px-5 md:w-3/4">
          <div className="flex flex-col items-center justify-center w-full">
            {/* Header */}
            <div className="flex flex-col justify-between w-full mb-1 md:flex-row">
              <div className="flex items-center mb-4 space-x-2">
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold md:text-4xl">🍬 MonCrush</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <button className="btn btn-sm btn-primary" onClick={handleResetGame}>
                  Reset Game
                </button>
                <button className="btn btn-sm btn-accent btn-outline" onClick={handleOpenDrawer}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  History
                </button>
              </div>
            </div>

            {/* Game Stats */}
            <Stats handleOpenDrawer={handleOpenDrawer} />

            {/* Main Game Board */}
            <div className="py-8">
              <div className="flex justify-center">
                <Board />
              </div>
            </div>

            {/* Game Status Messages */}
            <div className="h-10 text-center">
              {gameStore.gameStatus && <div className="text-accent animate-pulse">{gameStore.gameStatus}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Drawer */}
      <ZustandDrawer />
    </>
  );
}
