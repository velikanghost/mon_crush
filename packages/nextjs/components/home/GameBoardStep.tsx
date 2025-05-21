"use client";

import { FC, useEffect, useState } from "react";
import Board from "./Board";
import Stats from "./Stats";
import { VersusMode } from "./VersusMode";
import { ChevronRightIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { GameWalletDetails } from "~~/components/scaffold-eth/GameWalletDetails";

interface GameBoardStepProps {
  gameStore: any;
  musicPlaying: boolean;
  handleToggleMusic: () => void;
  handleResetGame: () => Promise<void>;
  handleBoardClick: () => void;
  gameWallet: any;
  user: any;
}

export const GameBoardStep: FC<GameBoardStepProps> = ({
  gameStore,
  musicPlaying,
  handleToggleMusic,
  handleResetGame,
  handleBoardClick,
  gameWallet,
  user,
}) => {
  const [activeTab, setActiveTab] = useState<"solo" | "versus">("solo");

  return (
    <div className="flex flex-col w-full h-full">
      {/* Top Row - Game Title and Stats */}
      <div className="flex flex-row items-center justify-between w-full px-4 py-2 mb-2">
        <div className="flex flex-col">
          <div className="text-xl font-bold">Monad Match</div>
          <div className="text-sm opacity-70">Match monanimals to earn points!</div>
          {gameStore.gameStatus && <div className="mt-1 text-xs text-accent animate-pulse">{gameStore.gameStatus}</div>}
          {/* Guest mode indicator */}
          {!user && (
            <div className="mt-1 text-xs italic text-warning">Playing as guest - blockchain features limited</div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Farcaster Profile or Guest Icon*/}
          {user ? (
            <label htmlFor="wallet-drawer" className="flex items-center rounded-full">
              {user.pfp_url && <img src={user.pfp_url} className="w-8 h-8 rounded-full" alt="Farcaster Profile" />}
              <ChevronRightIcon className="w-4 h-4 font-bold" color="black" strokeWidth={2} />
            </label>
          ) : (
            <label htmlFor="wallet-drawer" className="flex items-center p-1 bg-gray-200 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <ChevronRightIcon className="w-4 h-4 font-bold" color="black" strokeWidth={2} />
            </label>
          )}
        </div>
      </div>

      {/* Game Mode Tabs */}
      <div className="justify-center mb-4 tabs tabs-boxed">
        <a className={`tab ${activeTab === "solo" ? "tab-active" : ""}`} onClick={() => setActiveTab("solo")}>
          Solo Mode
        </a>
        <a className={`tab ${activeTab === "versus" ? "tab-active" : ""}`} onClick={() => setActiveTab("versus")}>
          Versus Mode
        </a>
      </div>

      {activeTab === "solo" ? (
        <>
          {/* Stats Row - Quick Access to Key Stats */}
          <div className="flex justify-center w-full px-4 mb-4">
            <Stats
              handleOpenDrawer={() => {
                const drawerElement = document.getElementById("wallet-drawer") as HTMLInputElement;
                if (drawerElement) drawerElement.checked = true;
              }}
            />
          </div>

          {/* Game Board - Full Width */}
          <div className="flex flex-col items-center justify-center flex-grow w-full px-2" onClick={handleBoardClick}>
            {gameWallet && gameStore.gameBoard ? (
              <>
                <Board />
                <button className="w-full h-10 px-4 mt-8 mb-4 btn btn-primary" onClick={handleResetGame}>
                  Reset
                </button>
              </>
            ) : (
              <div className="text-xl text-center">Initializing Game Board...</div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-grow px-2">
          <VersusMode user={user} />

          {/* Game Board for Versus Mode */}
          {/* <div className="flex flex-col items-center justify-center w-full mt-4" onClick={handleBoardClick}>
            {gameWallet && gameStore.gameBoard ? (
              <Board />
            ) : (
              <div className="text-xl text-center">Initializing Game Board...</div>
            )}
          </div> */}
        </div>
      )}

      {/* Wallet and Transaction History Drawer */}
      <div className="drawer drawer-end">
        <input id="wallet-drawer" type="checkbox" className="drawer-toggle" />
        <div className="z-50 drawer-side">
          <label htmlFor="wallet-drawer" className="drawer-overlay"></label>
          <div className="flex flex-col w-full min-h-full p-4 bg-base-200 text-base-content">
            {/* Drawer Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Wallet & Transactions</h3>
              <label htmlFor="wallet-drawer" className="btn btn-sm btn-circle">
                ✕
              </label>
            </div>

            {/* Farcaster Profile */}
            {user ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 mb-4 rounded-lg bg-base-100">
                <div className="flex items-center gap-2">
                  {user.pfp_url && <img src={user.pfp_url} className="w-8 h-8 rounded-full" alt="Farcaster Profile" />}
                  <div className="text-sm font-medium">{user.display_name || user.username}</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Main Wallet Connection */}
                  <button
                    className="btn btn-circle btn-sm btn-secondary"
                    onClick={handleToggleMusic}
                    title={musicPlaying ? "Mute Music" : "Play Music"}
                  >
                    {musicPlaying ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              /* Guest Mode Profile */
              <div className="flex items-center justify-between gap-2 px-3 py-2 mb-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Guest Mode</div>
                    <div className="text-xs text-yellow-600">Limited blockchain features</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-circle btn-sm btn-secondary"
                    onClick={handleToggleMusic}
                    title={musicPlaying ? "Mute Music" : "Play Music"}
                  >
                    {musicPlaying ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Game Wallet Details */}
            <div className="p-4 mb-4 rounded-lg shadow-md bg-base-100">
              <GameWalletDetails />
            </div>

            {/* Transaction History */}
            <div className="mb-4">
              <h4 className="mb-2 font-semibold text-md">Transaction History</h4>
              <div className="p-2 overflow-y-auto border rounded-lg border-base-300 max-h-60">
                {gameStore.txHashes && gameStore.txHashes.length > 0 ? (
                  <ul className="space-y-2">
                    {gameStore.txHashes.map((tx: string, index: number) => (
                      <li key={index} className="text-xs break-all">
                        <a
                          href={`${process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL}/tx/${tx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline"
                        >
                          {tx.slice(0, 10)}...{tx.slice(-8)}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-center opacity-70">No transactions yet</p>
                )}
              </div>
            </div>

            {/* Game Controls */}
            <div className="mt-auto">
              <button className="w-full btn btn-primary" onClick={handleResetGame}>
                Reset Game
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
