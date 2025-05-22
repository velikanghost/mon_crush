"use client";

import { FC } from "react";

interface GenerateWalletStepProps {
  user: any;
  generateGameWallet: () => Promise<void>;
}

export const GenerateWalletStep: FC<GenerateWalletStepProps> = ({ user, generateGameWallet }) => {
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
};
