"use client";

import dynamic from "next/dynamic";
import { SafeAreaContainer } from "~~/components/safe-area-container";

const Demo = dynamic(() => import("~~/components/home"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function Home() {
  return (
    <SafeAreaContainer>
      <Demo />
    </SafeAreaContainer>
  );
}
