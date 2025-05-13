"use client";

import { FC } from "react";

interface FundWalletStepProps {
  gameWallet: { address: string } | null;
  depositAmount: string;
  setDepositAmount: (value: string) => void;
  depositTokens: () => Promise<void>;
}

export const FundWalletStep: FC<FundWalletStepProps> = ({
  gameWallet,
  depositAmount,
  setDepositAmount,
  depositTokens,
}) => {
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
};
