import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { monadTestnet } from "~~/scaffold.config";

// Create a more robust connector for Farcaster Mini Apps
export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
  connectors: [farcasterFrame()],
  // Enable auto-connecting
  syncConnectedChain: true,
});

const queryClient = new QueryClient();

export default function FrameWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
