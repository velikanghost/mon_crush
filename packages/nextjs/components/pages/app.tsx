"use client";

import dynamic from "next/dynamic";
import { SafeAreaContainer } from "~~/components/safe-area-container";
import { useMiniAppContext } from "~~/hooks/use-miniapp-context";

const Demo = dynamic(() => import("~~/components/home"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Home() {
  const { context } = useMiniAppContext();
  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <Demo />
    </SafeAreaContainer>
  );
}
