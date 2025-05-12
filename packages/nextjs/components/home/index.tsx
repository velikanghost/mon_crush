"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { LocalAccount } from "viem";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { ChevronRightIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import Board from "~~/components/home/Board";
import Stats from "~~/components/home/Stats";
import { User } from "~~/components/home/User";
import { GameWalletDetails } from "~~/components/scaffold-eth/GameWalletDetails";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useSignIn } from "~~/hooks/use-sign-in";
import { monadTestnet } from "~~/scaffold.config";
import { initGameAudio, startBackgroundMusic, toggleBackgroundMusic } from "~~/services/audio/gameAudio";
import { clearTxHashesFromDB } from "~~/services/indexeddb/transactionDB";
import { initMatchSound } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";
import { decryptData, deriveEncryptionKey, encryptData } from "~~/services/utils/crypto";
import { clearUserSession, getUserSession, storeUserSession } from "~~/services/utils/sessionStorage";
import { extendUserSession } from "~~/services/utils/sessionStorage";

export default function Home() {
  const { signIn, isLoading, isSignedIn, user, error } = useSignIn({
    autoSignIn: true,
  });
  const { address: connectedAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const gameStore = useGameStore();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Game Wallet State
  const [gameWallet, setGameWallet] = useState<LocalAccount | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.01"); // Default deposit amount
  const [gameWalletFunded, setGameWalletFunded] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Connect Farcaster, 1: Connect Wallet, 2: Sign, 3: Fund, 4: Play

  const { sendTransactionAsync } = useSendTransaction();

  // Ref to track previous connected address for disconnect detection
  const previousAddressRef = useRef<string | undefined>(undefined);
  const previousFidRef = useRef<string | undefined>(undefined);
  // Ref to prevent duplicate wallet restoration and toasts
  const hasRestoredWallet = useRef(false);

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

  // Function to generate a new game wallet
  const generateGameWallet = async () => {
    if (!isSignedIn || !user) {
      toast.error("User is missing. Please sign in again.");
      setCurrentStep(1); // Go back to signing step
      return;
    }

    try {
      // Create a unique identifier combining Farcaster FID and wallet address
      const userIdentifier = user ? `${user.fid}_${connectedAddress || ""}` : connectedAddress || "farcaster-user";

      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      setGameWallet(account);

      // Store the private key and address in the game store for transaction signing
      gameStore.setGameWalletPrivateKey(privateKey);
      gameStore.setGameWalletAddress(account.address);

      // Encrypt and store the private key
      const key = deriveEncryptionKey(user?.fid.toString());
      const encryptedPrivateKey = encryptData(privateKey, key);
      localStorage.setItem(`gameWallet_${userIdentifier}`, encryptedPrivateKey);

      toast.success("New game wallet generated!");
      setCurrentStep(3); // Move to funding step
    } catch (error) {
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
    if (!gameWallet) {
      toast.error("Game wallet not created yet.");
      return;
    }

    try {
      toast.loading("Processing deposit...");
      const tx = await sendTransactionAsync({
        to: gameWallet.address,
        value: parseEther(depositAmount),
      });

      toast.dismiss(); // Dismiss loading toast
      toast.success(`Successfully deposited ${depositAmount} MON!`);
      setGameWalletFunded(true);

      // After successful funding, automatically try to link the wallet
      await handleLinkGameWallet();
    } catch (error: any) {
      toast.dismiss(); // Dismiss loading toast
      toast.error(`Deposit failed: ${error.message}`);
    }
  };

  // Add debug logging near the top of the component to track state changes
  useEffect(() => {
    console.log("Home component state:", {
      currentStep,
      isSignedIn,
      user: user?.fid ? `FID: ${user.fid}` : "No user",
      isConnected: isConnected ? "Yes" : "No",
      gameWallet: gameWallet ? `${gameWallet.address.slice(0, 6)}...` : "None",
    });
  }, [currentStep, isSignedIn, user, isConnected, gameWallet]);

  // Fix the Farcaster authentication and step transitions
  useEffect(() => {
    // Handle Farcaster sign-in completion
    if (isSignedIn && user && currentStep === 0) {
      console.log("✅ Farcaster sign-in complete, progressing to next step", { user });
      // Force move to next step
      setCurrentStep(1);
      toast.success(`Welcome, ${user.display_name || user.username || "Farcaster user"}!`);
    }
  }, [isSignedIn, user, currentStep]);

  // Initialize game when component mounts and Farcaster user is connected
  useEffect(() => {
    // Check for disconnect by comparing previous and current state
    const wasConnected = previousAddressRef.current !== undefined;
    const isDisconnect = wasConnected && !isConnected;

    const wasFarcasterConnected = previousFidRef.current !== undefined;
    const isFarcasterDisconnect = wasFarcasterConnected && !isSignedIn;

    // Handle disconnect case
    if ((isDisconnect && previousAddressRef.current) || (isFarcasterDisconnect && previousFidRef.current)) {
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
    if (isSignedIn && user) {
      // Update FID ref
      previousFidRef.current = user.fid;

      // Move to the "Connect Wallet" step if we're on the initial connection step
      if (currentStep === 0) {
        setCurrentStep(1); // Move to "Initialize Game Wallet" step
      }

      // If wallet address is available, update the reference
      if (connectedAddress) {
        previousAddressRef.current = connectedAddress;

        // Switch to Monad Testnet when wallet is connected
        const switchToMonadTestnet = async () => {
          try {
            await switchChain({ chainId: monadTestnet.id });
          } catch (error) {
            toast.error("Failed to switch to Monad Testnet. Please try again.");
          }
        };

        switchToMonadTestnet();
      }

      // Get Farcaster wallet address if available
      let farcasterWalletAddress = connectedAddress;

      // Create user identifier using Farcaster FID
      const userIdentifier = user?.fid
        ? `${user.fid}_${farcasterWalletAddress || ""}`
        : farcasterWalletAddress || "farcaster-user";

      // Attempt to restore session automatically
      const sessionSignature = getUserSession(userIdentifier);

      if (sessionSignature) {
        // If we have a valid session, process it automatically
        if (!hasRestoredWallet.current) {
          hasRestoredWallet.current = true;
          signIn();
        }
      }

      // Initialize game store basics
      if (gameStore.setAddress) {
        gameStore.setAddress(farcasterWalletAddress || "farcaster-user"); // Set main address in store
      }
      initMatchSound(); // Initialize sounds
    } else if (!isSignedIn && currentStep > 0) {
      // Reset to initial step if Farcaster disconnects
      setCurrentStep(0);
    }
    // Dependencies ensure this runs when connection state changes
  }, [isConnected, connectedAddress, gameStore.setAddress, isSignedIn, user, currentStep, switchChain]);

  // Existing useEffect for game init - Now conditional on game wallet being ready (Step 4)
  useEffect(() => {
    if (currentStep === 4 && gameWallet) {
      // Initialize the actual game logic only when wallet is ready and linked
      if (gameStore.initGame) {
        // Check if we're in guest mode (no Farcaster user)
        const isGuestMode = !user;

        if (!isGuestMode) {
          // Only try to retrieve wallet for non-guest users
          try {
            // Create user identifier using Farcaster FID if available
            const userIdentifier = user
              ? `${user.fid}_${connectedAddress || ""}`
              : connectedAddress || "farcaster-user";

            const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);
            if (savedWalletData && isSignedIn) {
              const key = deriveEncryptionKey(user?.fid.toString());
              const privateKey = decryptData(savedWalletData, key);

              // Ensure the private key is properly formatted
              const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

              gameStore.setGameWalletPrivateKey(formattedPrivateKey);
              gameStore.setGameWalletAddress(gameWallet.address);
            }
          } catch (error) {
            toast.error("Failed to retrieve game wallet private key");
          }
        }

        // Initialize the game
        gameStore.initGame();

        // Add a welcome message for guest users
        if (isGuestMode) {
          toast.success("Welcome to guest mode! Enjoy the game!");
          gameStore.setGameStatus("Guest mode active - Have fun!");
        }
      }
    }
  }, [
    currentStep,
    gameWallet,
    connectedAddress,
    gameStore.initGame,
    gameStore.setGameWalletPrivateKey,
    gameStore.setGameWalletAddress,
    gameStore.setGameStatus,
    isSignedIn,
    user,
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
      const userIdentifier = user ? `${user.fid}_${connectedAddress}` : connectedAddress;
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
      const userIdentifier = user ? `${user.fid}_${connectedAddress}` : connectedAddress;
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
      if (isConnected && connectedAddress && user) {
        console.log("Page loaded/refreshed with connected wallet and Farcaster, checking session");

        // Create user identifier using Farcaster FID if available
        const userIdentifier = user ? `${user.fid}_${connectedAddress}` : connectedAddress;

        // Check for valid session
        const sessionSignature = getUserSession(userIdentifier);
        if (sessionSignature) {
          console.log("Found valid session on page refresh");

          // Extend the session on page load
          extendUserSession(userIdentifier);

          // Process the signature to restore wallet
          if (!hasRestoredWallet.current) {
            hasRestoredWallet.current = true;
            signIn();
          }
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

            {/* Farcaster User component with connection status */}
            <User />

            {/* Debug information */}
            <div className="p-2 mt-2 text-xs bg-base-300 rounded-box">
              <p>Status: {isLoading ? "Loading..." : isSignedIn ? "Signed In" : "Not Signed In"}</p>
              {user && (
                <p>
                  User: {user.display_name || user.username} (FID: {user.fid})
                </p>
              )}
              {error && <p className="text-error">Error: {error}</p>}
            </div>

            {/* Manual sign-in button as fallback */}
            {!isLoading && !isSignedIn && (
              <button
                className="w-full btn btn-primary"
                onClick={() => {
                  console.log("Manual sign-in button clicked");
                  toast.loading("Connecting to Farcaster...");
                  signIn()
                    .then(() => toast.dismiss())
                    .catch(err => {
                      toast.dismiss();
                      toast.error(`Failed to connect: ${err.message || "Unknown error"}`);
                    });
                }}
              >
                Connect Manually
              </button>
            )}

            {/* Skip button */}
            <div className="w-full pt-2 mt-2 border-t border-base-300">
              <button
                className="w-full btn btn-outline"
                onClick={() => {
                  // Generate a random guest wallet
                  const privateKey = generatePrivateKey();
                  const account = privateKeyToAccount(privateKey);
                  setGameWallet(account);

                  // Store the private key and address in the game store
                  gameStore.setGameWalletPrivateKey(privateKey);
                  gameStore.setGameWalletAddress(account.address);

                  // Set a guest session identifier
                  const guestId = `guest_${Date.now()}`;
                  gameStore.setAddress(guestId);

                  // Initialize the game
                  setGameWalletFunded(true); // Skip funding step
                  setCurrentStep(4); // Jump directly to game

                  // Initialize the game after a short delay
                  setTimeout(() => {
                    if (gameStore.initGame) {
                      gameStore.initGame();
                    }
                  }, 100);

                  toast.success("Entered as guest. Enjoy the game!");
                }}
              >
                Skip and Play as Guest
              </button>
              <p className="mt-2 text-xs text-center text-base-content/70">
                Note: Playing as guest limits blockchain interactions.
              </p>
            </div>
          </div>
        );
      case 1: // Connect Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Initialize Game Wallet</h3>
            <p className="text-center">
              Hi, {user?.display_name || user?.username || "Farcaster user"}! Click below to continue.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                // Move directly to the Generate Wallet step
                setCurrentStep(2);

                // Check for existing wallet data
                if (user) {
                  const userIdentifier = `${user.fid}_${connectedAddress || ""}`;
                  const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);

                  // If wallet data exists, attempt to restore it
                  if (savedWalletData) {
                    try {
                      const key = deriveEncryptionKey(user.fid.toString());
                      const privateKey = decryptData(savedWalletData, key);
                      const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
                      const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

                      setGameWallet(account);
                      gameStore.setGameWalletPrivateKey(formattedPrivateKey);
                      gameStore.setGameWalletAddress(account.address);

                      // Skip directly to funding step
                      setCurrentStep(3);
                      toast.success("Existing game wallet restored!");
                    } catch (error) {
                      console.error("Failed to restore wallet:", error);
                      // Keep on step 2 to generate new wallet
                      localStorage.removeItem(`gameWallet_${userIdentifier}`);
                    }
                  }
                }
              }}
            >
              Initialize Game Wallet
            </button>
          </div>
        );
      case 2: // Generate Wallet Step
        return (
          <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
            <h3 className="text-xl font-semibold">Generate Game Wallet</h3>
            <p className="text-center">
              No existing game wallet found for {user?.username || "your account"}. Click below to generate a new one.
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
              Deposit MON from your Farcaster wallet on Monad Testnet to your game wallet to cover transaction fees.
            </p>
            <div className="flex items-center gap-2 text-lg">
              <span className="font-mono">
                {gameWallet?.address.slice(0, 6)}...{gameWallet?.address.slice(-4)}
              </span>
              <button
                className="text-xs btn btn-ghost btn-xs"
                onClick={() => navigator.clipboard.writeText(gameWallet?.address ?? "")}
                disabled={!gameWallet}
              >
                Copy
              </button>
            </div>
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

            <p className="text-xs text-center">Make sure your Farcaster wallet is connected to Monad Testnet.</p>
          </div>
        );
      case 4: // Play Game (Main Game UI)
        return (
          <div className="flex flex-col w-full h-full">
            {/* Top Row - Game Title and Stats */}
            <div className="flex flex-row items-center justify-between w-full px-4 py-2 mb-2">
              <div className="flex flex-col">
                <div className="text-xl font-bold">Monad Match</div>
                <div className="text-sm opacity-70">Match monanimals to earn points!</div>
                {gameStore.gameStatus && (
                  <div className="mt-1 text-xs text-accent animate-pulse">{gameStore.gameStatus}</div>
                )}
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
                    {user.pfp_url && (
                      <img src={user.pfp_url} className="w-8 h-8 rounded-full" alt="Farcaster Profile" />
                    )}
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
                        {user.pfp_url && (
                          <img src={user.pfp_url} className="w-8 h-8 rounded-full" alt="Farcaster Profile" />
                        )}
                        <div className="text-sm font-medium">{user.display_name || user.username}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Main Wallet Connection */}

                        <button
                          className="btn btn-circle btn-sm btn-secondary"
                          onClick={handleToggleMusic}
                          title={musicPlaying ? "Mute Music" : "Play Music"}
                        >
                          {musicPlaying ? (
                            <SpeakerWaveIcon className="w-4 h-4" />
                          ) : (
                            <SpeakerXMarkIcon className="w-4 h-4" />
                          )}
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
                          {musicPlaying ? (
                            <SpeakerWaveIcon className="w-4 h-4" />
                          ) : (
                            <SpeakerXMarkIcon className="w-4 h-4" />
                          )}
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
        <div className="flex items-center justify-between px-4 py-1 mt-auto border-t border-base-300">
          <div className="flex items-center justify-center gap-2 text-xs">
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
