"use client";

import { FC } from "react";
import { User } from "./User";
import toast from "react-hot-toast";
import { useSignIn } from "~~/hooks/use-sign-in";

interface ConnectFarcasterStepProps {
  isLoading: boolean;
  isSignedIn: boolean;
  user: any;
  error: string | null;
  signIn: () => Promise<void>;
}

export const ConnectFarcasterStep: FC<ConnectFarcasterStepProps> = ({ isLoading, isSignedIn, user, error, signIn }) => {
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
