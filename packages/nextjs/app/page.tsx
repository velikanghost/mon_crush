"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { HeartIcon, MusicalNoteIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import Board from "~~/components/home/Board";
import Stats from "~~/components/home/Stats";
import ZustandDrawer from "~~/components/home/ZustandDrawer";
import { DirectConnectWallet } from "~~/components/scaffold-eth/DirectConnectWallet";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  initGameAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  toggleBackgroundMusic,
} from "~~/services/audio/gameAudio";
import { initMatchSound } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";

export default function Home() {
  const { address } = useAccount();
  const gameStore = useGameStore();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

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

  // Initialize audio system on first user interaction
  const initAudio = async () => {
    if (!audioInitialized) {
      try {
        await initGameAudio();
        setAudioInitialized(true);
        // Automatically start background music
        startBackgroundMusic();
        setMusicPlaying(true);
      } catch (error) {
        console.error("Failed to initialize audio:", error);
      }
    }
  };

  // Handle music toggle
  const handleToggleMusic = () => {
    if (!audioInitialized) {
      initAudio();
      return;
    }

    const isPlaying = toggleBackgroundMusic();
    setMusicPlaying(isPlaying);
  };

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
    // Also initialize audio on first interaction
    if (!audioInitialized) {
      initAudio();
    }

    if (gameStore.setIsDrawerOpen) {
      gameStore.setIsDrawerOpen(true);
    }
    if (gameStore.fetchTxHashesFromApi) {
      gameStore.fetchTxHashesFromApi();
    }
  };

  // Handle game reset
  const handleResetGame = () => {
    // Also initialize audio on first interaction
    if (!audioInitialized) {
      initAudio();
    }

    if (gameStore.resetGame) {
      gameStore.resetGame();
    }
  };

  // Handle board click to initialize audio
  const handleBoardClick = () => {
    if (!audioInitialized) {
      initAudio();
    }
  };

  return (
    <>
      {/* Main Layout - Fixed height, no scrolling */}
      <div className="flex justify-between overflow-hidden mt-[2%] gap-6">
        {/* Left Column - Game Title and Stats */}
        <div className="w-[25%] flex flex-col">
          <div className="mb-4 pl-9">
            <div className="text-3xl font-bold">Monad Match</div>
            <div className="mt-2 text-base opacity-70">Match monanimals to earn points!</div>
          </div>

          {/* Game Status Messages */}
          <div className="mt-1 mb-4 ml-9">
            {gameStore.gameStatus && <div className="text-accent animate-pulse">{gameStore.gameStatus}</div>}
          </div>

          {/* Stats Component */}
          <Stats handleOpenDrawer={handleOpenDrawer} />
        </div>

        {/* Middle Column - Game Board */}
        <div className="w-[50%] flex items-center" onClick={handleBoardClick}>
          <Board />
        </div>

        {/* Right Column - Wallet & Buttons */}
        <div className="w-[25%] flex flex-col pr-9 space-y-4">
          {/* Wallet Info & Actions - Direct connect wallet with integrated options */}
          <div className="p-4 rounded-lg shadow-md bg-base-100">
            <DirectConnectWallet />
          </div>

          {/* Game Controls */}
          <div className="flex flex-col w-full gap-3">
            <div className="flex gap-2">
              <button className="flex-1 btn btn-primary" onClick={handleResetGame}>
                Reset Game
              </button>

              <button
                className="btn btn-circle btn-secondary"
                onClick={handleToggleMusic}
                title={musicPlaying ? "Mute Music" : "Play Music"}
              >
                {musicPlaying ? <SpeakerWaveIcon className="w-5 h-5" /> : <SpeakerXMarkIcon className="w-5 h-5" />}
              </button>
            </div>

            <button
              className="flex flex-row items-center justify-center btn btn-accent btn-outline"
              onClick={handleOpenDrawer}
            >
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
              Transaction History
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 px-9">
        <div></div>
        <div className="flex items-center justify-center gap-2 text-xs pl-9">
          <p className="">Built by</p>
          <a
            className="flex items-center justify-center gap-1 underline underline-offset-2"
            href="https://x.com/velkan_gst"
            target="_blank"
            rel="noreferrer"
          >
            velkan_gst
          </a>
          <p>using</p>
          <a
            className="flex items-center justify-center gap-1 underline underline-offset-2"
            href="https://scaffoldeth.io"
            target="_blank"
            rel="noreferrer"
          >
            Scaffold-ETH 2
          </a>
        </div>
        <SwitchTheme className={`pointer-events-auto`} />
      </div>

      {/* Transaction History Drawer */}
      <ZustandDrawer />
    </>
  );
}
