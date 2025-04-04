"use client";

import { useState } from "react";
import { Balance } from "./Balance";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import CopyToClipboard from "react-copy-to-clipboard";
import { getAddress } from "viem";
import { Address } from "viem";
import { useDisconnect } from "wagmi";
import {
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { BlockieAvatar, isENS } from "~~/components/scaffold-eth";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerAddressLink } from "~~/utils/scaffold-eth";

/**
 * DirectConnectWallet - A simplified wallet connect component that displays options directly
 */
export const DirectConnectWallet = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();
  const { disconnect } = useDisconnect();
  const [addressCopied, setAddressCopied] = useState(false);

  const handleCopyAddress = (address: string) => {
    setAddressCopied(true);
    setTimeout(() => {
      setAddressCopied(false);
    }, 800);
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const checkSumAddress = account ? getAddress(account.address) : undefined;
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;

        if (!connected) {
          return (
            <button className="w-full btn btn-primary btn-md" onClick={openConnectModal} type="button">
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported || chain.id !== targetNetwork.id) {
          return (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-error">Wrong network</div>
              <button className="w-full btn btn-warning btn-sm" onClick={openConnectModal} type="button">
                Switch to {targetNetwork.name}
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col items-center w-full gap-2">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <BlockieAvatar address={checkSumAddress as Address} size={30} ensImage={account.ensAvatar} />
                <span className="font-medium truncate max-w-[120px]">
                  {isENS(account.displayName)
                    ? account.displayName
                    : checkSumAddress?.slice(0, 6) + "..." + checkSumAddress?.slice(-4)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <Balance address={account.address as Address} className="text-right" />
                {/* <span className="text-xs" style={{ color: networkColor }}>
                  {chain.name}
                </span> */}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 w-full mt-2">
              {/* Copy Address */}
              <CopyToClipboard
                text={checkSumAddress as string}
                onCopy={() => handleCopyAddress(checkSumAddress as string)}
              >
                <button className="justify-start w-full gap-2 normal-case btn btn-sm btn-ghost">
                  {addressCopied ? (
                    <CheckCircleIcon className="w-4 h-4 text-success" />
                  ) : (
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm">{addressCopied ? "Copied!" : "Copy Address"}</span>
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
                <span className="text-sm">View on Explorer</span>
              </a>

              {/* Disconnect Button */}
              <button
                onClick={() => disconnect()}
                className="justify-start w-full gap-2 normal-case btn btn-sm btn-ghost text-error hover:bg-error hover:bg-opacity-20"
              >
                <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
