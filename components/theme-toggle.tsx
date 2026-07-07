"use client";

import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  // Server always renders "not dark" (light icon); real state is read after
  // mount so the client's first render matches the server's, avoiding a
  // hydration mismatch. useLayoutEffect (not useEffect) so this resolves
  // before paint -- ThemeInit (app/layout.tsx) already applied the real
  // class on <html> synchronously before this component's effects run.
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useLayoutEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore -- theme just won't persist across reloads
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={toggle} disabled={!mounted}>
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
