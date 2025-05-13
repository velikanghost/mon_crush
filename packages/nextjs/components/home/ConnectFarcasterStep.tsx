"use client";

import { FC } from "react";
import { User } from "./User";
import toast from "react-hot-toast";
import { Account, LocalAccount, generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useSignIn } from "~~/hooks/use-sign-in";
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
        // If no wallet, generate wallet

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
      // If no wallet, proceed to step 2 (generate wallet)
      // setCurrentStep(1);
      // toast.success(
      //   `Welcome, ${user.display_name || user.username || "Farcaster user"}! Please generate a game wallet.`,
      // );
    }
  };

  return (
    <div className="flex flex-col items-center p-6 space-y-4 bg-base-200 rounded-box">
      <h3 className="text-xl font-semibold">Connect with Farcaster</h3>
      <p className="text-center">Please connect your Farcaster account to get started with Monad Match.</p>

      {/* Debug information */}
      <div className="p-2 mt-2 text-xs bg-base-300 rounded-box">
        <p>Status: {isLoading ? "Loading..." : isSignedIn ? "Signed In" : "Not Signed In"}</p>
        {user && (
          <div>
            <p>
              User: {user.display_name || user.username}
              Connected Address: {connectedAddress}
            </p>
            <button className="btn btn-primary" onClick={getStarted}>
              Get Started
            </button>
          </div>
        )}
        {error && <p className="text-error">Error: {error}</p>}
      </div>

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
