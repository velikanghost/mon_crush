import { useMiniAppContext } from "~~/hooks/use-miniapp-context";
import { APP_URL } from "~~/lib/constants";

export function FarcasterActions() {
  const { actions } = useMiniAppContext();

  return (
    <div className="space-y-4 border border-[#333] rounded-md p-4">
      <h2 className="text-xl font-bold text-left">sdk.actions</h2>
      <div className="flex flex-row items-start justify-start space-x-4">
        {actions ? (
          <div className="flex flex-col justify-start space-y-4">
            <button className="p-2 text-sm text-black bg-white rounded-md" onClick={() => actions?.addFrame()}>
              addFrame
            </button>
            <button className="p-2 text-sm text-black bg-white rounded-md" onClick={() => actions?.close()}>
              close
            </button>
            <button
              className="p-2 text-sm text-black bg-white rounded-md"
              onClick={() =>
                actions?.composeCast({
                  text: "Check out this Monad Farcaster MiniApp Template!",
                  embeds: [`${APP_URL}`],
                })
              }
            >
              composeCast
            </button>
            <button
              className="p-2 text-sm text-black bg-white rounded-md"
              onClick={() => actions?.openUrl("https://docs.monad.xyz")}
            >
              openUrl
            </button>
            <button
              className="p-2 text-sm text-black bg-white rounded-md"
              onClick={() => actions?.signIn({ nonce: "1201" })}
            >
              signIn
            </button>
            <button
              className="p-2 text-sm text-black bg-white rounded-md"
              onClick={() => actions?.viewProfile({ fid: 17979 })}
            >
              viewProfile
            </button>
          </div>
        ) : (
          <p className="text-sm text-left">Actions not available</p>
        )}
      </div>
    </div>
  );
}
