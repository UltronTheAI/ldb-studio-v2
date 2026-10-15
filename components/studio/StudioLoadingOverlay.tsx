"use client";

import React, { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useWorkspace } from "@/lib/studio/workspace-context";

const HUMOR_MESSAGES = [
  "Can't you even wait?",
  "Reticulating B-tree splines and bargaining with the query engine...",
  "Counting documents one by one using our fingers and toes...",
  "Warming up the Raft consensus engine... nodes are having an argument...",
  "Asking the database politely to give your data back...",
  "Brewing espresso while the cluster partitions reach agreement...",
  "Hold your horses, packets are traveling at 99% light speed...",
  "Untangling the WAL log and convincing the disk to spin faster...",
  "Allocating extra RAM and a little bit of patience...",
  "Recalibrating quantum flux capacitors for optimal query throughput...",
  "Shuffling collection indexes and blaming network latency...",
  "Don't touch anything yet, database wizardry is in progress...",
  "Negotiating with the garbage collector for a few more milliseconds...",
  "Reconstructing your workspace tabs from the memory void...",
  "Spinning up gRPC streams... please pretend this is instantaneous...",
  "Checking under the couch cushions for missing documents...",
];

export function StudioLoadingOverlay() {
  const { isRestored } = useWorkspace();
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [humorMessage, setHumorMessage] = useState<string>("Can't you even wait?");
  const [progress, setProgress] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (ignore) return;
      const randomIndex = Math.floor(Math.random() * HUMOR_MESSAGES.length);
      setHumorMessage(HUMOR_MESSAGES[randomIndex]);
    });

    const startTime = Date.now();
    const DURATION_MS = 3000; // Mandatory 3 seconds compulsory wait

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= DURATION_MS) {
        clearInterval(interval);
        setMinTimeElapsed(true);
      }
    }, 50);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!minTimeElapsed || !isRestored) return;

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }, 0);

    return () => clearTimeout(exitTimer);
  }, [minTimeElapsed, isRestored]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center select-none text-white transition-opacity duration-300 ${
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center p-8 rounded-[12px] bg-[#0c0d10]/90 border border-white/10 shadow-2xl max-w-sm w-[90%] text-center space-y-4">
        {/* Animated Lucide Icon */}
        <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10">
          <Loader2Icon size={24} className="animate-spin text-[var(--text-link)]" />
        </div>

        {/* Text Header & Random Humor Message */}
        <div className="space-y-1.5">
          <div className="font-sans text-sm font-bold tracking-wide text-white uppercase">
            Loading...
          </div>
          <p className="font-mono text-xs text-[var(--muted)] leading-relaxed italic px-2">
            &ldquo;{humorMessage}&rdquo;
          </p>
        </div>

        {/* Compulsory 3-Second Progress Bar */}
        <div className="w-full max-w-[200px] h-1 rounded-[2px] bg-white/10 overflow-hidden mt-1">
          <div
            className="h-full bg-[var(--text-link)] transition-all ease-linear duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
