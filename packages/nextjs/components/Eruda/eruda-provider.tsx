"use client";

import { ReactNode, useEffect, useState } from "react";

export const Eruda = (props: { children: ReactNode }) => {
  const [erudaLoaded, setErudaLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development" && !erudaLoaded) {
      import("eruda").then(module => {
        const eruda = module.default;
        eruda.init();
        setErudaLoaded(true);
      });
    }
  }, [erudaLoaded]);

  return <>{props.children}</>;
};
