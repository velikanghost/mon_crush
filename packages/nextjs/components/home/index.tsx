"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { LocalAccount } from "viem";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount } from "wagmi";
import { useSendTransaction, useSignMessage } from "wagmi";
import { SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import Board from "~~/components/home/Board";
import { FarcasterActions } from "~~/components/home/FarcasterActions";
import Stats from "~~/components/home/Stats";
import { User } from "~~/components/home/User";
import ZustandDrawer from "~~/components/home/ZustandDrawer";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { GameWalletDetails } from "~~/components/scaffold-eth/GameWalletDetails";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useMiniAppContext } from "~~/hooks/use-miniapp-context";
import { initGameAudio, startBackgroundMusic, toggleBackgroundMusic } from "~~/services/audio/gameAudio";
import { clearTxHashesFromDB } from "~~/services/indexeddb/transactionDB";
import { initMatchSound } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";
import { decryptData, deriveEncryptionKey, encryptData } from "~~/services/utils/crypto";
import { clearUserSession, getUserSession, storeUserSession } from "~~/services/utils/sessionStorage";
import { extendUserSession } from "~~/services/utils/sessionStorage";

export default function Home() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { context: farcasterContext, actions: farcasterActions } = useMiniAppContext();
  const farcasterUser = farcasterContext?.user;
  const isFarcasterConnected = !!farcasterUser;

  const gameStore = useGameStore();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Game Wallet State
  const [gameWallet, setGameWallet] = useState<LocalAccount | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.01"); // Default deposit amount
  const [gameWalletFunded, setGameWalletFunded] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Connect Farcaster, 1: Connect Wallet, 2: Sign, 3: Fund, 4: Play
  const [signature, setSignature] = useState<string>("");
  const { signMessage } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  // Ref to track previous connected address for disconnect detection
  const previousAddressRef = useRef<string | undefined>(undefined);
  const previousFidRef = useRef<number | undefined>(undefined);

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

    // Create a unique identifier combining Farcaster FID and wallet address
    const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;

    // Check if we have a valid session - if so, use it instead of asking for signature
    const existingSignature = getUserSession(userIdentifier);
    if (existingSignature) {
      console.log("Using existing session signature");
      toast.success("Using existing session (valid for 3 days)");

      // Process the existing signature
      processSignature(existingSignature, userIdentifier);
      return;
    }

    const message = `Sign this message to generate or restore your Monad Match game wallet for Farcaster user ${farcasterUser?.username || "unknown"}`;

    signMessage(
      { message },
      {
        onSuccess: signedMessage => {
          // Store the signature for 3-day session persistence
          storeUserSession(userIdentifier, signedMessage);

          // Process the signature
          processSignature(signedMessage, userIdentifier);
        },
        onError: error => {
          console.error("Signing failed", error);
          toast.error(`Signing failed: ${error.message}`);
        },
      },
    );
  };

  // Helper function to process signature (extracted to avoid code duplication)
  const processSignature = (signedMessage: string, userIdentifier: string) => {
    const savedWallet = localStorage.getItem(`gameWallet_${userIdentifier}`);
    if (savedWallet) {
      try {
        //console.log("Restoring wallet from localStorage...", savedWallet);
        const key = deriveEncryptionKey(signedMessage);
        const decryptedPrivateKey = decryptData(savedWallet, key);

        // Ensure the decrypted private key is properly formatted
        const formattedPrivateKey = decryptedPrivateKey.startsWith("0x")
          ? decryptedPrivateKey
          : `0x${decryptedPrivateKey}`;

        const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
        setGameWallet(account);
        console.log("Restored game wallet:", account.address);
        setGameWalletFunded(true); // Assume funded if restored

        // Store in game store for transaction signing
        gameStore.setGameWalletPrivateKey(formattedPrivateKey);
        gameStore.setGameWalletAddress(account.address);

        setCurrentStep(4); // Go directly to game
        setSignature(signedMessage); // Store signature for future use
        toast.success("Game wallet restored!");
      } catch (error) {
        console.error("Failed to restore game wallet:", error);
        toast.error("Failed to restore wallet. Generating a new one.");
        localStorage.removeItem(`gameWallet_${userIdentifier}`); // Clear invalid data
        setSignature(signedMessage); // Keep signature
        setCurrentStep(2); // Proceed to generate new wallet
      }
    } else {
      setSignature(signedMessage); // Store signature for generation
      setCurrentStep(2); // Proceed to generate a new game wallet
      toast.success("Sign message successful. Ready to generate game wallet.");
    }
  };

  // Function to generate a new game wallet
  const generateGameWallet = async () => {
    if (!signature || !connectedAddress) {
      toast.error("Signature is missing. Please sign the message again.");
      setCurrentStep(1); // Go back to signing step
      return;
    }

    try {
      // Create a unique identifier combining Farcaster FID and wallet address
      const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      setGameWallet(account);

      // Store the private key and address in the game store for transaction signing
      gameStore.setGameWalletPrivateKey(privateKey);
      gameStore.setGameWalletAddress(account.address);

      // Encrypt and store the private key
      const key = deriveEncryptionKey(signature);
      const encryptedPrivateKey = encryptData(privateKey, key);
      localStorage.setItem(`gameWallet_${userIdentifier}`, encryptedPrivateKey);
      console.log("Generated and encrypted game wallet:", account.address);
      toast.success("New game wallet generated!");
      setCurrentStep(3); // Move to funding step
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
      setCurrentStep(4); // Move to game if already linked
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
      setCurrentStep(4); // Move to the game playing step
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

  // Initialize game when component mounts and Farcaster user is connected
  useEffect(() => {
    // Check for disconnect by comparing previous and current state
    const wasConnected = previousAddressRef.current !== undefined;
    const isDisconnect = wasConnected && !isConnected;

    const wasFarcasterConnected = previousFidRef.current !== undefined;
    const isFarcasterDisconnect = wasFarcasterConnected && !isFarcasterConnected;

    // Handle disconnect case
    if ((isDisconnect && previousAddressRef.current) || (isFarcasterDisconnect && previousFidRef.current)) {
      console.log("Wallet or Farcaster disconnected, clearing session");

      if (previousAddressRef.current) {
        const userIdentifier = previousFidRef.current
          ? `${previousFidRef.current}_${previousAddressRef.current}`
          : previousAddressRef.current;
        clearUserSession(userIdentifier);
      }

      previousAddressRef.current = undefined;
      previousFidRef.current = undefined;
    }

    // If Farcaster is connected, we can move to next step
    if (isFarcasterConnected && farcasterUser) {
      // Update FID ref
      previousFidRef.current = farcasterUser.fid;

      // Move to the "Connect Wallet" step if we're on the initial connection step
      if (currentStep === 0) {
        setCurrentStep(1); // Move to "Connect Wallet" step
      }
    }

    if (isConnected && connectedAddress) {
      // Update wallet address ref
      previousAddressRef.current = connectedAddress;

      // Create user identifier using Farcaster FID if available
      const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;

      // Attempt to restore session automatically on connect
      const sessionSignature = getUserSession(userIdentifier);

      if (sessionSignature) {
        // If we have a valid session, process it automatically
        console.log("Found valid session, automatically restoring game wallet");
        processSignature(sessionSignature, userIdentifier);
      } else {
        // If wallet is connected but no session, start at sign message step
        setCurrentStep(1); // Step 1 is now Sign Message
      }

      // Initialize game store basics
      if (gameStore.setAddress) {
        gameStore.setAddress(connectedAddress); // Set main address in store
      }
      initMatchSound(); // Initialize sounds
    } else if (!isConnected && currentStep > 0) {
      // Keep Farcaster connection but reset wallet-related state
      setCurrentStep(1); // Go back to "Connect Wallet" step
    }
    // Dependencies ensure this runs when connection state changes
  }, [isConnected, connectedAddress, gameStore.setAddress, isFarcasterConnected, farcasterUser, currentStep]);

  // Existing useEffect for game init - Now conditional on game wallet being ready (Step 4)
  useEffect(() => {
    if (currentStep === 4 && gameWallet && connectedAddress) {
      // Initialize the actual game logic only when wallet is ready and linked
      if (gameStore.initGame) {
        console.log("Initializing game with main address:", connectedAddress, "and game wallet:", gameWallet.address);

        // Get the private key from localStorage since the gameWallet object doesn't expose it
        try {
          // Create user identifier using Farcaster FID if available
          const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;

          const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);
          if (savedWalletData && signature) {
            const key = deriveEncryptionKey(signature);
            const privateKey = decryptData(savedWalletData, key);

            // Ensure the private key is properly formatted
            const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

            gameStore.setGameWalletPrivateKey(formattedPrivateKey);
            gameStore.setGameWalletAddress(gameWallet.address);
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
    farcasterUser,
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
  const handleResetGame = async () => {
    // Extend user session when they reset the game
    if (connectedAddress) {
      // Create user identifier using Farcaster FID if available
      const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;
      extendUserSession(userIdentifier);
    }

    if (gameStore.resetGame) {
      gameStore.resetGame();

      // Clear transaction hashes from zustand store
      gameStore.setTxHashes([]);

      // Clear transaction hashes from IndexedDB
      try {
        await clearTxHashesFromDB();
        toast.success("Game reset! Transaction history cleared.");
      } catch (error) {
        console.error("Error clearing transaction history:", error);
      }
    }
  };

  // Handle board click to initialize audio
  const handleBoardClick = () => {
    // Extend user session when they interact with the game
    if (connectedAddress) {
      // Create user identifier using Farcaster FID if available
      const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;
      extendUserSession(userIdentifier);
    }

    if (!audioInitialized) {
      initAudio();
    }
  };

  // Effect to handle page refresh/load session check
  useEffect(() => {
    // This effect only runs once on mount to handle page refresh scenarios
    const handlePageRefresh = async () => {
      if (isConnected && connectedAddress && farcasterUser) {
        console.log("Page loaded/refreshed with connected wallet and Farcaster, checking session");

        // Create user identifier using Farcaster FID if available
        const userIdentifier = farcasterUser ? `${farcasterUser.fid}_${connectedAddress}` : connectedAddress;

        // Check for valid session
        const sessionSignature = getUserSession(userIdentifier);
        if (sessionSignature) {
          console.log("Found valid session on page refresh");

          // Extend the session on page load
          extendUserSession(userIdentifier);

          // Process the signature to restore wallet
          processSignature(sessionSignature, userIdentifier);
        }
      }
    };

    handlePageRefresh();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Conditional Rendering based on the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Connect to Farcaster Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Connect with Farcaster</h3>
            <p className="text-center">Please connect your Farcaster account to get started with Monad Match.</p>
            <p className="text-sm text-center text-base-content/70">
              If you're already connected in Farcaster, please wait a moment...
            </p>
            {/* Farcaster info component */}
            <User />
          </div>
        );
      case 1: // Connect Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Connect Wallet</h3>
            <p className="text-center">
              Hi, {farcasterUser?.displayName || farcasterUser?.username || "Farcaster user"}! Now connect your wallet
              to continue.
            </p>
            {isConnected ? (
              <button className="btn btn-primary" onClick={handleSignMessage}>
                Sign Message & Continue
              </button>
            ) : (
              <RainbowKitCustomConnectButton />
            )}
          </div>
        );
      case 2: // Generate Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Generate Game Wallet</h3>
            <p className="text-center">
              No existing game wallet found for {farcasterUser?.username || "your account"}. Click below to generate a
              new one.
            </p>
            <button className="btn btn-secondary" onClick={generateGameWallet}>
              Generate New Game Wallet
            </button>
          </div>
        );
      case 3: // Fund Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Fund Your Game Wallet</h3>
            <p className="text-center">
              Deposit a small amount of MON to your new game wallet ({gameWallet?.address.slice(0, 6)}...
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
              <span>MON</span>
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
      case 4: // Play Game (Main Game UI)
        return (
          <div className="flex flex-col w-full h-full">
            {/* Top Row - Game Title and Stats */}
            <div className="flex flex-row items-center justify-between w-full px-4 py-2 mb-2">
              <div className="flex flex-col">
                <div className="text-2xl font-bold">Monad Match</div>
                <div className="text-sm opacity-70">Match monanimals to earn points!</div>
                {gameStore.gameStatus && (
                  <div className="mt-1 text-sm text-accent animate-pulse">{gameStore.gameStatus}</div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-circle btn-sm btn-secondary"
                  onClick={handleToggleMusic}
                  title={musicPlaying ? "Mute Music" : "Play Music"}
                >
                  {musicPlaying ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
                </button>

                <button className="btn btn-primary btn-sm" onClick={handleResetGame}>
                  Reset
                </button>

                {/* Drawer toggle button */}
                <label htmlFor="wallet-drawer" className="btn btn-accent btn-sm">
                  Wallet
                </label>
              </div>
            </div>

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
            <div className="flex items-center justify-center flex-grow w-full px-2" onClick={handleBoardClick}>
              {gameWallet && gameStore.gameBoard ? (
                <Board />
              ) : (
                <div className="text-xl text-center">Initializing Game Board...</div>
              )}
            </div>

            {/* Wallet and Transaction History Drawer */}
            <div className="drawer drawer-end">
              <input id="wallet-drawer" type="checkbox" className="drawer-toggle" />
              <div className="z-50 drawer-side">
                <label htmlFor="wallet-drawer" className="drawer-overlay"></label>
                <div className="flex flex-col min-h-full p-4 w-80 bg-base-200 text-base-content">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Wallet & Transactions</h3>
                    <label htmlFor="wallet-drawer" className="btn btn-sm btn-circle">
                      ✕
                    </label>
                  </div>

                  {/* Farcaster Profile */}
                  {farcasterUser && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-base-100">
                      {farcasterUser.pfpUrl && (
                        <img src={farcasterUser.pfpUrl} className="w-8 h-8 rounded-full" alt="Farcaster Profile" />
                      )}
                      <div className="text-sm font-medium">{farcasterUser.displayName || farcasterUser.username}</div>
                    </div>
                  )}

                  {/* Main Wallet Connection */}
                  <div className="mb-4">
                    <RainbowKitCustomConnectButton />
                  </div>

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
                          {gameStore.txHashes.map((tx, index) => (
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
      default:
        return <div>Loading...</div>; // Or some initial loading state
    }
  };

  return (
    <>
      {/* Main container with min-height to ensure footer stays at bottom */}
      <div className="flex flex-col min-h-screen">
        {/* Main Layout - Fixed height, no scrolling */}
        <div className="flex justify-between overflow-hidden mt-[2%] gap-6 flex-grow">
          {/* Conditional Rendering for Steps or Game */}
          {currentStep < 4 ? (
            <div className="flex items-center justify-center w-full">{renderStepContent()}</div>
          ) : (
            renderStepContent() // Render game layout for step 4
          )}
        </div>

        {/* Footer - Now sticks to bottom */}
        <div className="flex items-center justify-between py-4 mt-auto border-t px-9 border-base-300">
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
      </div>
    </>
  );
}
