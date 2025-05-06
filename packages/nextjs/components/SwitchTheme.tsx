"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export const SwitchTheme = ({ className }: { className?: string }) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isDarkMode = resolvedTheme === "dark";

  const handleToggle = () => {
    if (isDarkMode) {
      setTheme("light");
      return;
    }
    setTheme("dark");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className={`flex h-8 items-center justify-center text-sm ${className}`}>
      <label className="cursor-pointer swap swap-rotate">
        <input
          id="theme-toggle"
          type="checkbox"
          className="sr-only theme-controller"
          onChange={handleToggle}
          checked={isDarkMode}
        />
        <div className="flex items-center justify-center w-8 h-8 p-1 rounded-full swap-on bg-base-300">
          <MoonIcon className="w-5 h-5 text-accent" />
        </div>
        <div className="flex items-center justify-center w-8 h-8 p-1 rounded-full swap-off bg-base-300">
          <SunIcon className="w-5 h-5 text-accent" />
        </div>
      </label>
    </div>
  );
};
