"use client";

//import { useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
//import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { useInitializeNativeCurrencyPrice } from "~~/hooks/scaffold-eth";

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  useInitializeNativeCurrencyPrice();

  return (
    <>
      <div className={`min-h-screen`}>
        <main className="relative flex flex-col flex-1">{children}</main>
      </div>
      <Toaster />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  // const { resolvedTheme } = useTheme();
  // const isDarkMode = resolvedTheme === "dark";
  // const [mounted, setMounted] = useState(false);

  // useEffect(() => {
  //   setMounted(true);
  // }, []);

  return (
    <>
      <ProgressBar height="3px" color="#2299dd" />
      <ScaffoldEthApp>{children}</ScaffoldEthApp>
    </>
  );
};
