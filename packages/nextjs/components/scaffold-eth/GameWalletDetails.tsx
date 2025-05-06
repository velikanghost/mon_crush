"use client";

import React from "react";
import { useState } from "react";
import { Balance } from "./Balance";
import CopyToClipboard from "react-copy-to-clipboard";
import { Address } from "viem";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useMiniAppContext } from "~~/hooks/use-miniapp-context";
import { useGameStore } from "~~/services/store/gameStore";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

/**
 * GameWalletDetails - Displays game wallet details
 */
export const GameWalletDetails = () => {
  const { targetNetwork } = useTargetNetwork();
  const [addressCopied, setAddressCopied] = useState(false);
  const { gameWalletAddress } = useGameStore();
  const { context: farcasterContext } = useMiniAppContext();
  const farcasterUser = farcasterContext?.user;

  const handleCopyAddress = () => {
    setAddressCopied(true);
    setTimeout(() => {
      setAddressCopied(false);
    }, 800);
  };

  // If game wallet isn't initialized yet
  if (!gameWalletAddress) {
    return (
      <div className="flex flex-col items-center w-full gap-2">
        <div className="text-sm font-medium">Game wallet not initialized</div>
      </div>
    );
  }

  const formattedAddress = `${gameWalletAddress.slice(0, 6)}...${gameWalletAddress.slice(-4)}`;
  const blockExplorerAddressLink = getBlockExplorerAddressLink(targetNetwork, gameWalletAddress);

  return (
    <div className="flex flex-col items-center w-full gap-2">
      <div className="w-full pb-1 border-b head border-base-300">
        <span className="mb-2 text-sm font-semibold text-left place-self-start">Game Wallet</span>
        {farcasterUser && (
          <span className="text-xs text-base-content/70">
            Linked to {farcasterUser.displayName || farcasterUser.username || `fid:${farcasterUser.fid}`}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <BlockieAvatar address={gameWalletAddress as Address} size={30} />
          <span className="font-medium truncate max-w-[120px]">{formattedAddress}</span>
        </div>
        <div className="flex flex-col items-end">
          <Balance address={gameWalletAddress as Address} className="text-right" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 w-full mt-2">
        {/* Copy Address */}
        <CopyToClipboard text={gameWalletAddress} onCopy={handleCopyAddress}>
          <button className="justify-start w-full gap-2 normal-case btn btn-sm btn-ghost">
            {addressCopied ? (
              <CheckCircleIcon className="w-4 h-4 text-success" />
            ) : (
              <DocumentDuplicateIcon className="w-4 h-4" />
            )}
            <span className="text-sm">{addressCopied ? "Copied!" : "Copy Game Wallet Address"}</span>
          </button>
        </CopyToClipboard>

        {/* QR Code - you may want to implement a modal for this */}
        <label htmlFor="qrcode-modal" className="justify-start w-full gap-2 normal-case btn btn-sm btn-ghost">
          <QrCodeIcon className="w-4 h-4" />
          <span className="text-sm">View QR Code</span>
        </label>

        {/* Block Explorer */}
        <a
          href={blockExplorerAddressLink}
          target="_blank"
          rel="noopener noreferrer"
          className="justify-start w-full gap-2 normal-case btn btn-sm btn-ghost"
        >
          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          <span className="text-sm">View Game Wallet on Explorer</span>
        </a>
      </div>
    </div>
  );
};
