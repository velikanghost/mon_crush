import "@rainbow-me/rainbowkit/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import { FrameProvider } from "~~/components/farcaster-provider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({ title: "Scaffold-ETH 2 App", description: "Built with 🏗 Scaffold-ETH 2" });

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning>
      <body>
        <FrameProvider>
          <ThemeProvider enableSystem>
            <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
          </ThemeProvider>
        </FrameProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
