"use client";

import { useEffect, useRef, useState } from "react";
import { Footer } from "../Footer";
import { sdk } from "@farcaster/frame-sdk";
import toast from "react-hot-toast";
import { Account, LocalAccount } from "viem";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useConnect, useSendTransaction, useSwitchChain } from "wagmi";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { ConnectFarcasterStep } from "~~/components/home/ConnectFarcasterStep";
import { FundWalletStep } from "~~/components/home/FundWalletStep";
import { GameBoardStep } from "~~/components/home/GameBoardStep";
import { GenerateWalletStep } from "~~/components/home/GenerateWalletStep";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useSignIn } from "~~/hooks/use-sign-in";
import { monadTestnet } from "~~/scaffold.config";
import { initGameAudio, startBackgroundMusic, toggleBackgroundMusic } from "~~/services/audio/gameAudio";
import { clearTxHashesFromDB } from "~~/services/indexeddb/transactionDB";
import { initMatchSound } from "~~/services/store/gameLogic";
import { useGameStore } from "~~/services/store/gameStore";
import { decryptData, deriveEncryptionKey, encryptData } from "~~/services/utils/crypto";
import { clearUserSession, extendUserSession, getUserSession } from "~~/services/utils/sessionStorage";

export default function Home() {
  const { signIn, isLoading, isSignedIn, user, error } = useSignIn({
    autoSignIn: true,
  });

  const { address: connectedAddress, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { connect, connectors } = useConnect();

  const gameStore = useGameStore();
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

  // Game Wallet State
  const [gameWallet, setGameWallet] = useState<LocalAccount | null>(null);
  const [depositAmount, setDepositAmount] = useState("0.1"); // Default deposit amount
  const [currentStep, setCurrentStep] = useState<number>(0);

  const { sendTransactionAsync } = useSendTransaction();

  // Ref to track previous connected address for disconnect detection
  const previousAddressRef = useRef<string | undefined>(undefined);
  const previousFidRef = useRef<string | undefined>(undefined);
  // Ref to prevent duplicate wallet restoration and toasts
  const hasRestoredWallet = useRef(false);

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

  // Function to link game wallet on-chain
  const handleLinkGameWallet = async () => {
    if (!gameWallet || !connectedAddress) {
      toast.error("Game wallet or main wallet not available.");
      return;
    }

    // Check if already linked
    if (mainWalletForGameWallet === connectedAddress) {
      toast.success("Game wallet already linked to this main wallet.");
      setCurrentStep(2); // Move to game if already linked
      return;
    }
    // Check if linked to another main wallet (should ideally not happen with current logic)
    if (mainWalletForGameWallet && mainWalletForGameWallet !== "0x0000000000000000000000000000000000000000") {
      toast.error(`Game wallet already linked to a different main wallet: ${mainWalletForGameWallet}`);
      // Potentially offer recovery or reset options here
      return;
    }
    try {
      await switchChain({ chainId: monadTestnet.id });
    } catch (switchError) {
      toast.error("Failed to switch to Monad Testnet. Please switch manually.");
      return;
    }

    try {
      await linkGameWallet({
        functionName: "linkGameWallet",
        args: [gameWallet.address],
      });
      toast.success("Game wallet successfully linked on-chain!");
      setCurrentStep(2); // Move to the game playing step
    } catch (error: any) {
      console.error("Error linking game wallet:", error);
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

      try {
        await switchChain({ chainId: monadTestnet.id });
      } catch (switchError) {
        toast.error("Failed to switch to Monad Testnet. Please switch manually.");
        return;
      }

      await sendTransactionAsync({
        to: gameWallet.address,
        value: parseEther(depositAmount),
      });

      toast.dismiss(); // Dismiss loading toast
      toast.success(`Successfully deposited ${depositAmount} MON!`);

      // After successful funding, automatically try to link the wallet
      await handleLinkGameWallet();
    } catch (error: any) {
      toast.dismiss(); // Dismiss loading toast
      console.error(`Deposit failed: ${error.message}`);
    }
  };

  // Fix the Farcaster authentication and step transitions
  // useEffect(() => {
  //   // Handle Farcaster sign-in completion
  //   // if (isSignedIn && user && currentStep === 0) {
  //   //   // Check for existing wallet data immediately after sign-in
  //   //   const userIdentifier = user ? `${user.fid}_${connectedAddress || ""}` : connectedAddress || "farcaster-user";
  //   //   const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);
  //   //   if (savedWalletData) {
  //   //     try {
  //   //       const key = deriveEncryptionKey(user.fid.toString());
  //   //       const privateKey = decryptData(savedWalletData, key);
  //   //       const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  //   //       const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

  //   //       setGameWallet(account);
  //   //       gameStore.setGameWalletPrivateKey(formattedPrivateKey);
  //   //       gameStore.setGameWalletAddress(account.address);

  //   //       setCurrentStep(3); // Skip directly to game
  //   //       toast.success("Existing game wallet restored! Skipping to game.");
  //   //       return;
  //   //     } catch (error) {
  //   //       console.error("Failed to restore wallet after sign-in:", error);
  //   //       // If error, remove corrupted wallet and continue to step 2
  //   //       localStorage.removeItem(`gameWallet_${userIdentifier}`);
  //   //     }
  //   //   }
  //   //   // If no wallet, proceed to step 2 (generate wallet)
  //   //   setCurrentStep(1);
  //   //   toast.success(
  //   //     `Welcome, ${user.display_name || user.username || "Farcaster user"}! Please generate a game wallet.`,
  //   //   );
  //   // }

  //   console.log("isSignedIn", isSignedIn);
  //   console.log("user", user);
  //   console.log("currentStep", currentStep);
  //   console.log("connectedAddress", connectedAddress);
  // }, [
  //   isSignedIn,
  //   user,
  //   currentStep,
  //   connectedAddress,
  //   gameStore.setGameWalletPrivateKey,
  //   gameStore.setGameWalletAddress,
  // ]);

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

      // If wallet address is available, update the reference
      if (connectedAddress) {
        previousAddressRef.current = connectedAddress;

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
    if (currentStep === 2 && gameWallet) {
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
        } else {
          gameStore.setGameStatus("Game ready - Have fun!");
        }
      } else {
        console.error("❌ gameStore.initGame function not available!");
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
    // Check if wallet is connected before proceeding
    if (!isConnected) {
      // Try to connect first
      connect({ connector: connectors[0] });
    }
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

  // Add this useEffect to automatically request notifications
  useEffect(() => {
    // Track if we've already requested notifications
    const hasRequestedNotifications = localStorage.getItem(`notifications_requested_${user?.fid}`);

    const requestNotifications = async () => {
      if (hasRequestedNotifications) return;

      try {
        if (user?.username) {
          console.log("Attempting to add frame and request notifications...");
          const result = await sdk.actions.addFrame();

          if (result?.notificationDetails) {
            console.log("Notifications enabled successfully!");
            localStorage.setItem(`notifications_requested_${user?.fid}`, "true");
            toast.success("Notifications enabled for game updates!");
          }
        }
      } catch (error) {
        console.error("Failed to request notifications:", error);
      }
    };

    requestNotifications();
  }, [user?.username, user?.fid]); // Only depends on user identity

  // Render the appropriate step based on currentStep value
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Connect to Farcaster Step
        return (
          <ConnectFarcasterStep
            isLoading={isLoading}
            isSignedIn={isSignedIn}
            user={user}
            error={error}
            signIn={signIn}
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            connectedAddress={connectedAddress || ""}
            setGameWallet={setGameWallet as (wallet: LocalAccount) => void}
          />
        );
      case 1: // Fund Wallet Step
        return (
          <FundWalletStep
            gameWallet={gameWallet}
            depositAmount={depositAmount}
            setDepositAmount={setDepositAmount}
            depositTokens={depositTokens}
          />
        );
      case 2: // Play Game (Main Game UI)
        return (
          <GameBoardStep
            gameStore={gameStore}
            musicPlaying={musicPlaying}
            handleToggleMusic={handleToggleMusic}
            handleResetGame={handleResetGame}
            handleBoardClick={handleBoardClick}
            gameWallet={gameWallet}
            user={user}
          />
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
          {currentStep < 2 ? (
            <div className="flex items-center justify-center w-full">{renderStepContent()}</div>
          ) : (
            renderStepContent() // Render game layout for step 3
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
