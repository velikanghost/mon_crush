"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useSignIn } from "~~/hooks/use-sign-in";

export const User = () => {
  const { signIn, isSignedIn, isLoading, error, user } = useSignIn({
    autoSignIn: true,
  });

  // Log authentication state for debugging
  useEffect(() => {
    console.log("Farcaster auth state:", { isSignedIn, isLoading, user });
  }, [isSignedIn, isLoading, user]);

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {isLoading ? (
        <div className="flex flex-col items-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-2">Connecting to Farcaster...</p>
        </div>
      ) : isSignedIn && user ? (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 p-3 border rounded-lg shadow-sm">
            {user.pfp_url && <img src={user.pfp_url} alt="Profile" className="w-12 h-12 rounded-full" />}
            <div>
              <p className="font-semibold">{user.display_name || user.username}</p>
              <p className="text-xs opacity-70">FID: {user.fid}</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-green-600">✓ Connected to Farcaster</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <button
            onClick={signIn}
            disabled={isLoading}
            className="px-4 py-2 text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            Connect with Farcaster
          </button>
          <p className="mt-2 text-xs opacity-70">You need to connect your Farcaster account to continue</p>
        </div>
      )}
    </div>
  );
};

export default User;
