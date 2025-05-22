"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";

const Eruda = dynamic(() => import("./eruda-provider").then(c => c.Eruda), {
  ssr: false,
});

export const ErudaProvider = (props: { children: ReactNode }) => {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
    return props.children;
  }
  return <Eruda>{props.children}</Eruda>;
};
