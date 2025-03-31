interface DrawerProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isDrawerOpen: boolean) => void;
  isLoadingHashes: boolean;
  txHashes: string[];
}

const Drawer = ({ isDrawerOpen, setIsDrawerOpen, isLoadingHashes, txHashes }: DrawerProps) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50">
      {/* Close overlay when clicking outside */}
      <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)}></div>

      {/* History Panel */}
      <div className="relative z-10 min-h-screen p-4 overflow-y-auto border-l border-purple-300 shadow-xl w-full md:w-[30%] bg-base-200 text-base-content">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-accent">Transaction History</h3>
          <button className="btn btn-sm btn-circle" onClick={() => setIsDrawerOpen(false)}>
            ✕
          </button>
        </div>
        <div className="divider"></div>

        {/* Pending Transactions Info */}
        {/* {pendingTxCount > 0 && (
          <div className="p-3 mb-4 rounded-lg bg-info/10 text-info-content">
            <p className="text-sm font-semibold">~{pendingTxCount} transactions pending in the next batch.</p>
            <p className="text-xs">Hashes will appear below once processed by the relayer.</p>
          </div>
        )} */}

        {isLoadingHashes ? (
          <div className="flex flex-col items-center justify-center p-8">
            <span className="loading loading-spinner loading-lg text-accent"></span>
            <p className="mt-4 text-sm">Loading transaction history...</p>
          </div>
        ) : txHashes.length > 0 ? (
          <div className="space-y-2">
            <p className="mb-2 text-sm text-base-content/80">Recent confirmed transactions: {txHashes.length}</p>
            <div className="overflow-y-auto max-h-[70vh]">
              {txHashes.map((hash, index) => (
                <div key={index} className="pb-3 mb-3 border-b border-base-300">
                  <div className="mb-1 text-xs text-base-content/60">Transaction #{txHashes.length - index}</div>
                  <a
                    href={`https://monad-testnet.socialscan.io/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-mono text-sm break-all link link-accent hover:text-clip"
                  >
                    {hash}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 text-base-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="mt-4">No confirmed transaction hashes found.</p>
            {/* {pendingTxCount === 0 && (
              <p className="mt-2 text-sm">Make some matches to see your blockchain transactions!</p>
            )}
            {pendingTxCount > 0 && <p className="mt-2 text-sm">Check back shortly for confirmed transactions.</p>} */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawer;
