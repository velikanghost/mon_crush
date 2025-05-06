import { useMiniAppContext } from "~~/hooks/use-miniapp-context";

export function User() {
  const { context } = useMiniAppContext();

  return (
    <div className="space-y-4 border border-[#333] rounded-md p-4">
      <h2 className="text-xl font-bold text-left">sdk.context</h2>
      <div className="flex flex-row items-start justify-start space-x-4">
        {context?.user ? (
          <>
            {context?.user?.pfpUrl && (
              <img
                src={context?.user?.pfpUrl}
                className="rounded-full w-14 h-14"
                alt="User Profile Picture"
                width={56}
                height={56}
              />
            )}
            <div className="flex flex-col items-start justify-start space-y-2">
              <p className="text-sm text-left">
                user.displayName:{" "}
                <span className="bg-white font-mono text-black rounded-md p-[4px]">{context?.user?.displayName}</span>
              </p>
              <p className="text-sm text-left">
                user.username:{" "}
                <span className="bg-white font-mono text-black rounded-md p-[4px]">{context?.user?.username}</span>
              </p>
              <p className="text-sm text-left">
                user.fid: <span className="bg-white font-mono text-black rounded-md p-[4px]">{context?.user?.fid}</span>
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-left">User context not available</p>
        )}
      </div>
    </div>
  );
}
