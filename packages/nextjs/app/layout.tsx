import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "~~/components/providers";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({ title: "Monad Match", description: "A Match-3 game on Monad" });

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
