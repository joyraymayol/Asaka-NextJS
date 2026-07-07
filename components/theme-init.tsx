"use client";

import { useLayoutEffect } from "react";

// Rendered once in the root layout so it applies on every page (including
// /login, outside the dashboard header where ThemeToggle lives). Deliberately
// not a <script> tag: next/script's beforeInteractive strategy and a plain
// inline <script> both still get processed as a real script element during
// hydration in this Next 16.2.10 / React 19.2 combination, which trips
// React's new "script tag encountered while rendering" dev warning either
// way. useLayoutEffect runs synchronously before the browser's first paint,
// so this achieves the same no-flash result without a script element at all.
export function ThemeInit() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // ignore -- worst case the page renders in light mode
    }
  }, []);

  return null;
}
