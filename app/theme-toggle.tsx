"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/lib/lucide";

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("liorandb_theme_change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("liorandb_theme_change", callback);
  };
}

function getThemeSnapshot(): string {
  if (typeof window === "undefined") {
    return "light";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerThemeSnapshot(): string {
  return "light";
}

export function ThemeToggle({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    try {
      localStorage.setItem("liorandb_theme", nextTheme);
    } catch {
      // Ignore localStorage permission errors
    }

    window.dispatchEvent(new Event("liorandb_theme_change"));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`sketch-btn-secondary inline-flex items-center justify-center gap-1.5 p-2 text-xs font-bold uppercase transition ${className}`}
      suppressHydrationWarning
    >
      {isDark ? (
        <>
          <SunIcon size={15} />
          {showLabel && <span>Light</span>}
        </>
      ) : (
        <>
          <MoonIcon size={15} />
          {showLabel && <span>Dark</span>}
        </>
      )}
    </button>
  );
}
