"use client";

import { FC, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { LocalAccount, generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useGameStore } from "~~/services/store/gameStore";
import { decryptData, deriveEncryptionKey, encryptData } from "~~/services/utils/crypto";

interface ConnectFarcasterStepProps {
  isLoading: boolean;
  isSignedIn: boolean;
  user: any;
  error: string | null;
  signIn: () => Promise<void>;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  connectedAddress: string;
  setGameWallet: (wallet: LocalAccount) => void;
}

export const ConnectFarcasterStep: FC<ConnectFarcasterStepProps> = ({
  isLoading,
  isSignedIn,
  user,
  error,
  signIn,
  currentStep,
  setCurrentStep,
  connectedAddress,
  setGameWallet,
}) => {
  const gameStore = useGameStore();

  // Automatically restore wallet/session on mount if possible
  useEffect(() => {
    if (isSignedIn && user && currentStep === 0) {
      const userIdentifier = user ? `${user.fid}_${connectedAddress || ""}` : connectedAddress || "farcaster-user";
      const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);
      if (savedWalletData) {
        try {
          const key = deriveEncryptionKey(user.fid.toString());
          const privateKey = decryptData(savedWalletData, key);
          const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
          const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

          setGameWallet(account);
          gameStore.setGameWalletPrivateKey(formattedPrivateKey);
          gameStore.setGameWalletAddress(account.address);

          setCurrentStep(2); // Skip directly to game
          toast.success("Existing game wallet restored! Skipping to game.");
        } catch (error) {
          console.error("Failed to restore wallet after sign-in:", error);
          localStorage.removeItem(`gameWallet_${userIdentifier}`);
        }
      }
    }
  }, [isSignedIn, user, connectedAddress, currentStep, setGameWallet, setCurrentStep, gameStore]);

  // Handle Farcaster sign-in completion
  const getStarted = () => {
    if (isSignedIn && user && currentStep === 0) {
      // Check for existing wallet data immediately after sign-in
      const userIdentifier = user ? `${user.fid}_${connectedAddress || ""}` : connectedAddress || "farcaster-user";
      const savedWalletData = localStorage.getItem(`gameWallet_${userIdentifier}`);
      if (savedWalletData) {
        try {
          const key = deriveEncryptionKey(user.fid.toString());
          const privateKey = decryptData(savedWalletData, key);
          const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
          const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);

          setGameWallet(account);
          gameStore.setGameWalletPrivateKey(formattedPrivateKey);
          gameStore.setGameWalletAddress(account.address);

          setCurrentStep(2); // Skip directly to game
          toast.success("Existing game wallet restored! Skipping to game.");
          return;
        } catch (error) {
          console.error("Failed to restore wallet after sign-in:", error);
          // If error, remove corrupted wallet and continue to step 2
          localStorage.removeItem(`gameWallet_${userIdentifier}`);
        }
      } else {
        // Function to generate a new game wallet
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
          setCurrentStep(1); // Move to funding step
        } catch (error) {
          toast.error("Failed to generate game wallet.");
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
      {!user ? (
        <h3 className="text-xl font-semibold">Connecting your Farcaster account</h3>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-2 mt-2 text-xs bg-base-300 rounded-xl">
          <h3 className="text-xl font-semibold">
            Welcome,{" "}
            <span className="flex items-center gap-2">
              <Image
                src={user.pfp_url}
                alt={user.display_name || user.username || "Farcaster user"}
                width={20}
                height={20}
              />
            </span>
            {user.display_name || user.username || "Farcaster user"}!
          </h3>

          <p>{connectedAddress}</p>
        </div>
      )}

      {!user ? (
        <p className="text-center">Please wait...</p>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-2 mt-2 text-xs bg-base-300 rounded-xl">
          {user && currentStep === 0 && (
            <>
              {/* Mini setup information for the user */}
              <div className="max-w-md p-3 mb-2 text-sm rounded-lg bg-info text-info-content">
                <strong>What happens next?</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>
                    <b>Game Wallet Creation:</b> A dedicated game wallet will be generated for you. This wallet is used
                    to play Monad Match securely and keeps your main wallet safe.
                  </li>
                  <li>
                    <b>Why a Game Wallet?</b> The game wallet allows you to interact with the game without exposing your
                    main wallet to risks or unnecessary permissions.
                  </li>
                  <li>
                    <b>Deposit MON:</b> You will be asked to deposit MON tokens into your game wallet. This is required
                    to participate in the game rounds.
                  </li>
                  <li>
                    <b>Link Wallet Transaction:</b> After depositing, you will need to confirm a second transaction to
                    link your game wallet to your Farcaster account. This step is necessary to verify ownership and
                    enable gameplay features.
                  </li>
                </ul>
              </div>
              <div className="flex justify-center w-full">
                <button className="w-full btn btn-primary" onClick={getStarted}>
                  Get Started
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual sign-in button as fallback */}
      {!isLoading && !isSignedIn && (
        <button
          className="w-full btn btn-primary"
          onClick={() => {
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
    </div>
  );
};
