"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LocalAccount } from "viem";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount } from "wagmi";
import { useSendTransaction, useSignMessage } from "wagmi";
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
import { decryptData, deriveEncryptionKey, encryptData } from "~~/services/utils/crypto";

export default function Home() {
  const { address: connectedAddress, isConnected } = useAccount();
  const gameStore = useGameStore();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Game Wallet State
  const [gameWallet, setGameWallet] = useState<LocalAccount | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.01"); // Default deposit amount
  const [gameWalletFunded, setGameWalletFunded] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Connect, 1: Sign, 2: Fund, 3: Play
  const [signature, setSignature] = useState<string>("");
  const { signMessage } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  // Get on-chain high score for the connected address
  const { data: onChainHighScore } = useScaffoldReadContract({
    contractName: "MonadMatch", // Use the correct contract name from your project
    functionName: "playerScores", // Use the correct function name from your contract
    args: [connectedAddress],
  });

  // Set up write contract for updating high score
  const { writeContractAsync: writeHighScore } = useScaffoldWriteContract({
    contractName: "MonadMatch", // Use the correct contract name from your project
  });

  // Read contract data for game wallet linking
  const { data: mainWalletForGameWallet } = useScaffoldReadContract({
    contractName: "MonadMatch",
    functionName: "getMainWallet",
    args: [gameWallet?.address],
  });

  // Write contract function for linking game wallet
  const { writeContractAsync: linkGameWallet } = useScaffoldWriteContract({
    contractName: "MonadMatch",
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

  // Function to handle signing message
  const handleSignMessage = async () => {
    if (!isConnected || !connectedAddress) {
      toast.error("Please connect your main wallet first!");
      return;
    }

    const message = `Sign this message to generate or restore your Monad Match game wallet. Nonce: ${Date.now()}`;

    signMessage(
      { message },
      {
        onSuccess: signedMessage => {
          const savedWallet = localStorage.getItem(`gameWallet_${connectedAddress}`);
          if (savedWallet) {
            try {
              const key = deriveEncryptionKey(signedMessage);
              const decryptedPrivateKey = decryptData(savedWallet, key);
              if (decryptedPrivateKey) {
                const account = privateKeyToAccount(decryptedPrivateKey as `0x${string}`);
                setGameWallet(account);
                console.log("Restored game wallet:", account.address);
                setGameWalletFunded(true); // Assume funded if restored, can add balance check later

                // Store the private key and address in the game store for transaction signing
                gameStore.setGameWalletPrivateKey(decryptedPrivateKey);
                gameStore.setGameWalletAddress(account.address);

                setCurrentStep(3); // Go directly to game
                setSignature(signedMessage); // Store signature for potential future use
                toast.success("Game wallet restored!");
              } else {
                throw new Error("Decryption failed");
              }
            } catch (error) {
              console.error("Failed to restore game wallet:", error);
              toast.error("Failed to restore wallet. Generating a new one.");
              localStorage.removeItem(`gameWallet_${connectedAddress}`); // Clear invalid data
              setSignature(signedMessage); // Keep signature
              setCurrentStep(1); // Proceed to generate new wallet
            }
          } else {
            setSignature(signedMessage); // Store signature for generation
            setCurrentStep(1); // Proceed to generate a new game wallet
            toast.success("Sign message successful. Ready to generate game wallet.");
          }
        },
        onError: error => {
          console.error("Signing failed", error);
          toast.error(`Signing failed: ${error.message}`);
        },
      },
    );
  };

  // Function to generate a new game wallet
  const generateGameWallet = async () => {
    if (!signature || !connectedAddress) {
      toast.error("Signature is missing. Please sign the message again.");
      setCurrentStep(0); // Go back to signing step
      return;
    }

    try {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      setGameWallet(account);

      // Store the private key and address in the game store for transaction signing
      gameStore.setGameWalletPrivateKey(privateKey);
      gameStore.setGameWalletAddress(account.address);

      const key = deriveEncryptionKey(signature);
      const encryptedPrivateKey = encryptData(privateKey, key);
      localStorage.setItem(`gameWallet_${connectedAddress}`, encryptedPrivateKey);
      console.log("Generated and encrypted game wallet:", account.address);
      toast.success("New game wallet generated!");
      setCurrentStep(2); // Move to funding step
    } catch (error) {
      console.error("Error generating game wallet:", error);
      toast.error("Failed to generate game wallet.");
    }
  };

  // Function to link game wallet on-chain
  const handleLinkGameWallet = async () => {
    if (!gameWallet || !connectedAddress) {
      toast.error("Game wallet or main wallet not available.");
      return;
    }

    // Check if already linked
    if (mainWalletForGameWallet === connectedAddress) {
      toast.success("Game wallet already linked to this main wallet.");
      setCurrentStep(3); // Move to game if already linked
      return;
    }
    // Check if linked to another main wallet (should ideally not happen with current logic)
    if (mainWalletForGameWallet && mainWalletForGameWallet !== "0x0000000000000000000000000000000000000000") {
      toast.error(`Game wallet already linked to a different main wallet: ${mainWalletForGameWallet}`);
      // Potentially offer recovery or reset options here
      return;
    }

    try {
      await linkGameWallet({
        functionName: "linkGameWallet",
        args: [gameWallet.address],
      });
      toast.success("Game wallet successfully linked on-chain!");
      setCurrentStep(3); // Move to the game playing step
    } catch (error: any) {
      console.error("Error linking game wallet:", error);
      toast.error(`Failed to link game wallet: ${error.message || error}`);
    }
  };

  // Function to deposit funds
  const depositTokens = async () => {
    if (!connectedAddress || !gameWallet) {
      toast.error("Wallets not ready for deposit.");
      return;
    }

    try {
      toast.loading("Processing deposit...");
      const tx = await sendTransactionAsync({
        to: gameWallet.address,
        value: parseEther(depositAmount),
      });
      console.log("Deposit Transaction:", tx);
      toast.dismiss(); // Dismiss loading toast
      toast.success(`Successfully deposited ${depositAmount} DMON!`);
      setGameWalletFunded(true);
      // After successful funding, automatically try to link the wallet
      await handleLinkGameWallet();
    } catch (error: any) {
      toast.dismiss(); // Dismiss loading toast
      console.error("Error depositing tokens:", error);
      toast.error(`Deposit failed: ${error.message}`);
    }
  };

  // Initialize game when component mounts and main wallet is connected
  useEffect(() => {
    if (isConnected && connectedAddress) {
      // Attempt to restore wallet automatically on connect if signature exists
      const savedWallet = localStorage.getItem(`gameWallet_${connectedAddress}`);
      // We need a signature to decrypt, so prompt user to sign first.
      // Automatic restoration requires storing the signature or prompting on load.
      // For now, we require manual signing first.
      setCurrentStep(0); // Start at signing step when main wallet connects

      // Initialize game store basics
      if (gameStore.setAddress) {
        gameStore.setAddress(connectedAddress); // Set main address in store
      }
      initMatchSound(); // Initialize sounds
    } else {
      // Reset state if wallet disconnects
      setGameWallet(null);
      setGameWalletFunded(false);
      setCurrentStep(0);
      setSignature("");
      // Optionally clear stored wallet on disconnect?
      // localStorage.removeItem(`gameWallet_${connectedAddress}`);
    }
    // Dependencies ensure this runs when connection state changes
  }, [isConnected, connectedAddress, gameStore.setAddress]);

  // Existing useEffect for game init - Now conditional on game wallet being ready (Step 3)
  useEffect(() => {
    if (currentStep === 3 && gameWallet && connectedAddress) {
      // Initialize the actual game logic only when wallet is ready and linked
      if (gameStore.initGame) {
        console.log("Initializing game with main address:", connectedAddress, "and game wallet:", gameWallet.address);

        // Get the private key from localStorage since the gameWallet object doesn't expose it
        try {
          const savedWalletData = localStorage.getItem(`gameWallet_${connectedAddress}`);
          if (savedWalletData && signature) {
            const key = deriveEncryptionKey(signature);
            const privateKey = decryptData(savedWalletData, key);
            if (privateKey) {
              gameStore.setGameWalletPrivateKey(privateKey);
              gameStore.setGameWalletAddress(gameWallet.address);
            }
          }
        } catch (error) {
          console.error("Failed to retrieve game wallet private key:", error);
        }

        // Initialize the game
        gameStore.initGame();
      }
    }
  }, [
    currentStep,
    gameWallet,
    connectedAddress,
    gameStore.initGame,
    gameStore.setGameWalletPrivateKey,
    gameStore.setGameWalletAddress,
    signature,
  ]);

  // Prepare handleOpenDrawer function for Stats
  const handleOpenDrawer = () => {
    // Also initialize audio on first interaction
    if (!audioInitialized) {
      initAudio();
    }

    if (gameStore.setIsDrawerOpen) {
      gameStore.setIsDrawerOpen(true);
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

  // Conditional Rendering based on the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Sign Message Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Step 1: Verify Ownership</h3>
            <p className="text-center">
              Sign a message with your main wallet to generate or restore your secure game wallet.
            </p>
            <button className="btn btn-primary" onClick={handleSignMessage} disabled={!isConnected}>
              Sign Message
            </button>
            {!isConnected && <p className="mt-2 text-sm text-warning">Please connect your main wallet above.</p>}
          </div>
        );
      case 1: // Generate Wallet Step (Only shown if no wallet found after signing)
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Step 2: Generate Game Wallet</h3>
            <p className="text-center">
              No existing game wallet found for this address. Click below to generate a new one.
            </p>
            <button className="btn btn-secondary" onClick={generateGameWallet}>
              Generate New Game Wallet
            </button>
          </div>
        );
      case 2: // Fund Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Step 3: Fund Your Game Wallet</h3>
            <p className="text-center">
              Deposit a small amount of DMON to your new game wallet ({gameWallet?.address.slice(0, 6)}...
              {gameWallet?.address.slice(-4)}) to cover transaction fees.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                className="w-24 input input-bordered input-sm"
                min="0.001"
                step="0.001"
              />
              <span>DMON</span>
            </div>
            <button className="w-full btn btn-accent" onClick={depositTokens} disabled={!gameWallet}>
              Deposit Funds & Link Wallet
            </button>
            <button
              className="mt-2 text-xs btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(gameWallet?.address ?? "")}
              disabled={!gameWallet}
            >
              Copy Game Wallet Address
            </button>
          </div>
        );
      case 3: // Play Game (Main Game UI)
        return (
          <>
            {/* Left Column - Game Title and Stats */}
            <div className="w-[25%] flex flex-col">
              <div className="mb-4 pl-9">
                <div className="text-3xl font-bold">Monad Match</div>
                <div className="mt-2 text-base opacity-70">Match monanimals to earn points!</div>
                <p className="mt-1 text-xs text-neutral-500">
                  Game Wallet: {gameWallet?.address.slice(0, 6)}...{gameWallet?.address.slice(-4)}
                </p>
              </div>

              {/* Game Status Messages */}
              <div className="mt-1 mb-4 ml-9">
                {gameStore.gameStatus && <div className="text-accent animate-pulse">{gameStore.gameStatus}</div>}
              </div>

              {/* Stats Component */}
              <Stats handleOpenDrawer={handleOpenDrawer} />
            </div>

            {/* Middle Column - Game Board */}
            <div className="w-[50%] flex items-center justify-center" onClick={handleBoardClick}>
              {gameWallet && gameStore.gameBoard ? (
                <Board />
              ) : (
                <div className="text-xl text-center">Initializing Game Board...</div>
              )}
            </div>

            {/* Right Column - Wallet & Buttons are handled outside this switch */}
          </>
        );
      default:
        return <div>Loading...</div>; // Or some initial loading state
    }
  };

  return (
    <>
      {/* Main Layout - Fixed height, no scrolling */}
      <div className="flex justify-between overflow-hidden mt-[2%] gap-6">
        {/* Conditional Rendering for Steps or Game */}
        {currentStep < 3 ? (
          <div className="flex items-center justify-center w-full">
            {" "}
            {/* Centering container for steps */}
            {renderStepContent()}
          </div>
        ) : (
          renderStepContent() // Render game layout for step 3
        )}

        {/* Right Column - Always visible for Wallet connection and basic controls */}
        {currentStep < 3 ? (
          // Simplified Right Column for Setup Steps
          <div className="w-[25%] flex flex-col pr-9 space-y-4">
            <div className="p-4 rounded-lg shadow-md bg-base-100">
              <DirectConnectWallet />
            </div>
            {/* Add other non-game controls if needed during setup */}
          </div>
        ) : (
          // Full Right Column for Game Play (Step 3)
          <div className="w-[25%] flex flex-col pr-9 space-y-4">
            {/* Wallet Info & Actions */}
            <div className="p-4 rounded-lg shadow-md bg-base-100">
              <DirectConnectWallet />
              {/* Optionally show Game Wallet balance here if needed */}
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
                {/* SVG Icon */}
                Transaction History
              </button>
              {/* Add button to view/copy private key if desired (USE WITH CAUTION) */}
              {/* <button className="btn btn-xs btn-warning" onClick={copyPrivateKey}>Copy Game Private Key (Debug)</button> */}
            </div>
          </div>
        )}
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
