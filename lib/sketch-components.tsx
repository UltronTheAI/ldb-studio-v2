"use client";

import { useState, useEffect, type ReactNode } from "react";

// Sthashta Logo mark: Two stickman heads / rough circles connected by a hand-drawn ink bridge line
export function SthashtaLogo({
  size = 28,
  showText = true,
  className = "",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size * 1.5}
        height={size}
        viewBox="0 0 60 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 text-[#111111]"
        aria-hidden="true"
      >
        {/* Left Stickman Head (Rahul-esque) */}
        <circle cx="14" cy="18" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Right Stickman Head (Ravi-esque with sunglasses) */}
        <circle cx="46" cy="18" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="42" y="15" width="8" height="3" rx="1" fill="currentColor" />
        {/* Hand-drawn ink bridge line connecting them */}
        <path
          d="M23 18C28 16 32 20 37 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Small speech/connection sparkle */}
        <path d="M30 11V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className="font-sans text-xl font-bold tracking-[-0.03em] text-[#000000]">
          STHASHTA
        </span>
      )}
    </div>
  );
}

// Rahul: 24yo Humble Founder
// Slim stickman body, simple round face, messy short black hair, tiny stubble marks, plain black T-shirt, black trousers
export function RahulStickman({
  size = 180,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size * 0.7}
      height={size}
      viewBox="0 0 140 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Rahul — Humble Founder"
    >
      {/* Messy hair rough strokes */}
      <path d="M52 35 C55 24, 65 20, 75 22 C85 24, 92 30, 95 38" stroke="#111111" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M60 22 C64 16, 74 15, 80 18" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M72 16 C76 12, 85 14, 88 19" stroke="#111111" strokeWidth="2" strokeLinecap="round" />

      {/* Round hand-drawn face */}
      <circle cx="72" cy="48" r="22" stroke="#111111" strokeWidth="2.5" fill="#FFFFFF" />

      {/* Eyes & Smile */}
      <circle cx="64" cy="46" r="2" fill="#111111" />
      <circle cx="80" cy="46" r="2" fill="#111111" />
      <path d="M66 57 Q72 63 78 57" stroke="#111111" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Stubble marks */}
      <line x1="68" y1="63" x2="69" y2="64" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="72" y1="64" x2="73" y2="65" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="76" y1="63" x2="77" y2="64" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />

      {/* Neck */}
      <line x1="72" y1="70" x2="72" y2="78" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />

      {/* Solid Black T-Shirt */}
      <path
        d="M50 78 L94 78 L98 122 L46 122 Z"
        fill="#111111"
        stroke="#111111"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* T-Shirt sleeves */}
      <path d="M50 78 L34 96 L42 102 L52 92" fill="#111111" stroke="#111111" strokeWidth="2" />
      <path d="M94 78 L110 96 L102 102 L92 92" fill="#111111" stroke="#111111" strokeWidth="2" />

      {/* Stickman Arms from sleeves */}
      <path d="M38 100 L32 134" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M106 100 L112 134" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />

      {/* Slim Trousers (Legs) */}
      <line x1="60" y1="122" x2="56" y2="188" stroke="#111111" strokeWidth="4" strokeLinecap="round" />
      <line x1="84" y1="122" x2="88" y2="188" stroke="#111111" strokeWidth="4" strokeLinecap="round" />

      {/* Simple Shoes */}
      <path d="M52 188 L44 192 L58 193 Z" fill="#111111" stroke="#111111" strokeWidth="1" />
      <path d="M86 188 L98 192 L84 193 Z" fill="#111111" stroke="#111111" strokeWidth="1" />
    </svg>
  );
}

// Ravi: 27yo Hip-Hop Founder
// Slightly broader stickman, sharper stylish hair, rectangular sunglasses, oversized streetwear jacket, subtle chain, confident pose
export function RaviStickman({
  size = 180,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size * 0.75}
      height={size}
      viewBox="0 0 150 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ravi — Hip-Hop Founder"
    >
      {/* Sharp stylish hair */}
      <path d="M54 32 L66 18 L76 22 L86 16 L98 24 L102 36" stroke="#111111" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="#111111" />

      {/* Face */}
      <circle cx="76" cy="48" r="23" stroke="#111111" strokeWidth="2.5" fill="#FFFFFF" />

      {/* Rectangular Black Sunglasses */}
      <rect x="58" y="42" width="16" height="8" rx="1.5" fill="#111111" stroke="#111111" strokeWidth="1.5" />
      <line x1="74" y1="45" x2="78" y2="45" stroke="#111111" strokeWidth="2" />
      <rect x="78" y="42" width="16" height="8" rx="1.5" fill="#111111" stroke="#111111" strokeWidth="1.5" />

      {/* Trimmed beard along jaw */}
      <path d="M60 56 Q76 70 92 56" stroke="#111111" strokeWidth="2" strokeDasharray="2 3" fill="none" />
      <path d="M70 59 Q76 63 82 59" stroke="#111111" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Neck & Subtle Chain */}
      <line x1="76" y1="71" x2="76" y2="78" stroke="#111111" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 78 Q76 86 82 78" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Oversized Streetwear Jacket over Black Shirt */}
      <path
        d="M44 78 L108 78 L114 126 L38 126 Z"
        fill="#111111"
        stroke="#111111"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Jacket lapels / open collar */}
      <path d="M68 78 L76 96 L84 78" stroke="#FFFFFF" strokeWidth="2" fill="none" />
      <line x1="76" y1="96" x2="76" y2="126" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* Jacket Sleeves (wider, confident pose) */}
      <path d="M44 78 L22 102 L30 110 L48 94" fill="#111111" stroke="#111111" strokeWidth="2" />
      <path d="M108 78 L130 102 L122 110 L104 94" fill="#111111" stroke="#111111" strokeWidth="2" />

      {/* Hands */}
      <path d="M26 108 L22 136" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M126 108 L130 136" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />

      {/* Trousers */}
      <line x1="60" y1="126" x2="56" y2="188" stroke="#111111" strokeWidth="5" strokeLinecap="round" />
      <line x1="92" y1="126" x2="96" y2="188" stroke="#111111" strokeWidth="5" strokeLinecap="round" />

      {/* Sneakers */}
      <path d="M50 188 L40 193 L58 193 Z" fill="#111111" stroke="#111111" strokeWidth="1.5" />
      <path d="M96 188 L108 193 L90 193 Z" fill="#111111" stroke="#111111" strokeWidth="1.5" />
    </svg>
  );
}

// Hero Scene: Rahul and Ravi inside two rough video-call boxes connected by a hand-drawn scribbled ink line
export function HeroMatchIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full max-w-xl mx-auto ${className}`}>
      {/* Sketched Desktop / Video Stage Box */}
      <div className="rounded-[10px] border-2 border-[#111111] bg-white p-4 sm:p-6 shadow-[4px_4px_0px_#111111]">
        {/* Top Wireframe Chrome */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-white" />
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-white" />
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-[#111111]" />
          </div>
          <div className="font-mono text-xs font-semibold tracking-wider text-[#111111] uppercase">
            STHASHTA LIVE • 1:1 MATCH
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#111111]">
            <span className="h-2 w-2 rounded-full bg-[#111111]" />
            LIVE
          </div>
        </div>

        {/* Two Video Call Panels */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative">
          {/* Left Panel: Rahul (YOU) */}
          <div className="relative rounded-[7px] border-2 border-[#111111] bg-white p-3 sm:p-4 flex flex-col items-center justify-between min-h-[170px] sm:min-h-[210px] shadow-[2px_2px_0px_#111111]">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#666666]">
              <span className="border border-[#111111] px-1.5 py-0.2 rounded bg-white text-[#111111] font-bold">YOU</span>
              <span>Rahul • 24</span>
            </div>

            <div className="my-auto py-1">
              <RahulStickman size={110} />
            </div>

            <div className="w-full text-center">
              <span className="font-mono text-[10px] sm:text-[11px] border border-[#111111] px-2 py-0.5 rounded bg-white text-[#111111]">
                DEVTOOLS • BANGALORE
              </span>
            </div>

            {/* Handwritten annotation pointing to YOU */}
            <div className="absolute -top-7 -left-2 hidden sm:flex items-center gap-1 font-sketch-note text-sm text-[#111111]">
              <span>you</span>
              <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                <path d="M2 2 C8 10, 16 12, 22 14 M16 14 L22 14 L20 8" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Right Panel: Ravi (RANDOM FOUNDER) */}
          <div className="relative rounded-[7px] border-2 border-[#111111] bg-white p-3 sm:p-4 flex flex-col items-center justify-between min-h-[170px] sm:min-h-[210px] shadow-[2px_2px_0px_#111111]">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#666666]">
              <span className="border border-[#111111] px-1.5 py-0.2 rounded bg-white text-[#111111] font-bold">MATCH</span>
              <span>Ravi • 27</span>
            </div>

            <div className="my-auto py-1">
              <RaviStickman size={110} />
            </div>

            <div className="w-full text-center">
              <span className="font-mono text-[10px] sm:text-[11px] border border-[#111111] px-2 py-0.5 rounded bg-white text-[#111111]">
                FINTECH • DELHI
              </span>
            </div>

            {/* Handwritten annotation pointing to Ravi */}
            <div className="absolute -top-7 -right-2 hidden sm:flex items-center gap-1 font-sketch-note text-sm text-[#111111]">
              <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
                <path d="M22 2 C16 10, 8 12, 2 14 M8 14 L2 14 L4 8" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>random founder →</span>
            </div>
          </div>

          {/* Scribbled connecting ink bridge in center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
              <path
                d="M4 16 C12 6, 20 26, 28 10 C36 24, 40 14, 44 16"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Video Controls Bar */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-[#111111] pt-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs border border-[#111111] px-2 py-1 rounded-[5px] bg-white text-[#111111]">
              03:42
            </span>
            <span className="text-xs text-[#666666] hidden sm:inline font-mono">
              Topic: Raising pre-seed vs bootstrapped
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[5px] border-2 border-[#111111] bg-white px-2.5 py-1 text-xs font-semibold text-[#111111] shadow-[1px_1px_0px_#111111]"
            >
              Skip
            </button>
            <button
              type="button"
              className="rounded-[5px] border-2 border-[#000000] bg-[#000000] px-3 py-1 text-xs font-semibold text-white shadow-[1px_1px_0px_#111111]"
            >
              Exchange Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Signature Interactive Founder Match Stage from DESIGN.md
export function InteractiveFounderMatchStage() {
  const [matchState, setMatchState] = useState<"searching" | "connected" | "exchange">("connected");
  const [timerSeconds, setTimerSeconds] = useState(148);
  const [sharedDetails, setSharedDetails] = useState({
    name: true,
    company: true,
    email: false,
    twitter: true,
  });

  useEffect(() => {
    if (matchState !== "connected") return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [matchState]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-[10px] border-2 border-[#111111] bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#111111]">
      {/* Stage Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#111111] pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#666666]">
            <span>STHASHTA STAGE</span>
            <span>/</span>
            <span className="font-bold text-[#111111]">FOUNDER MATCH ENGINE</span>
          </div>
          <h3 className="font-sans text-xl font-bold tracking-tight text-[#000000] mt-0.5">
            Founder-to-Founder Live Connection
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-[5px] border border-[#111111] bg-white px-2.5 py-1 font-mono text-xs font-semibold text-[#111111]">
            <span className="h-2 w-2 rounded-full bg-[#111111] animate-pulse" />
            {matchState === "searching" && "SEARCHING..."}
            {matchState === "connected" && "CONNECTED • LIVE"}
            {matchState === "exchange" && "CONTACT EXCHANGE"}
          </div>

          <div className="flex rounded-[5px] border border-[#111111] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setMatchState("searching");
                setTimeout(() => setMatchState("connected"), 1600);
              }}
              className={`px-2.5 py-1 font-mono text-xs ${
                matchState === "searching" ? "bg-[#111111] text-white" : "bg-white text-[#111111]"
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setMatchState("connected")}
              className={`px-2.5 py-1 font-mono text-xs border-l border-[#111111] ${
                matchState === "connected" ? "bg-[#111111] text-white" : "bg-white text-[#111111]"
              }`}
            >
              Talk
            </button>
            <button
              type="button"
              onClick={() => setMatchState("exchange")}
              className={`px-2.5 py-1 font-mono text-xs border-l border-[#111111] ${
                matchState === "exchange" ? "bg-[#111111] text-white" : "bg-white text-[#111111]"
              }`}
            >
              Card
            </button>
          </div>
        </div>
      </div>

      {/* Stage Body */}
      {matchState === "searching" && (
        <div className="py-16 text-center">
          <div className="inline-block relative mb-6">
            <RahulStickman size={120} />
            <div className="absolute -right-16 top-1/2 -translate-y-1/2">
              <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
                <path d="M4 15 C16 5, 30 25, 46 15 L56 15 M50 10 L56 15 L50 20" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <h4 className="font-sans text-2xl font-bold text-[#000000]">
            Finding someone building...
          </h4>
          <p className="mt-2 text-sm text-[#666666] font-mono">
            Random match. Founder to founder. No pitch decks, no algorithms.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#111111] animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-[#111111] animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-[#111111] animate-bounce [animation-delay:0.4s]" />
          </div>
        </div>
      )}

      {matchState === "connected" && (
        <div>
          <div className="grid md:grid-cols-2 gap-6 relative">
            {/* Left Panel: Self */}
            <div className="rounded-[10px] border-2 border-[#111111] bg-white p-5 flex flex-col items-center justify-between min-h-[260px] shadow-[3px_3px_0px_#111111]">
              <div className="w-full flex items-center justify-between">
                <span className="border border-[#111111] px-2 py-0.5 rounded-[4px] font-mono text-xs font-bold bg-white text-[#111111]">
                  YOU
                </span>
                <span className="font-mono text-xs text-[#666666]">Rahul (Bangalore)</span>
              </div>

              <div className="my-auto py-2">
                <RahulStickman size={140} />
              </div>

              <div className="w-full border-t border-[#111111] pt-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111]">Building: DevTools / DB Proxy</span>
                <span className="font-mono text-[#666666]">MIC: ON</span>
              </div>
            </div>

            {/* Right Panel: Peer */}
            <div className="rounded-[10px] border-2 border-[#111111] bg-white p-5 flex flex-col items-center justify-between min-h-[260px] shadow-[3px_3px_0px_#111111]">
              <div className="w-full flex items-center justify-between">
                <span className="border border-[#111111] px-2 py-0.5 rounded-[4px] font-mono text-xs font-bold bg-white text-[#111111]">
                  LIVE MATCH
                </span>
                <span className="font-mono text-xs text-[#666666]">Ravi (Delhi NCR)</span>
              </div>

              <div className="my-auto py-2">
                <RaviStickman size={140} />
              </div>

              <div className="w-full border-t border-[#111111] pt-3 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111111]">Building: AI Voice Agent SaaS</span>
                <span className="font-mono text-[#666666]">VIDEO: ON</span>
              </div>
            </div>

            {/* Scribbled bridge in center */}
            <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none items-center justify-center">
              <div className="rounded-full border-2 border-[#111111] bg-white p-2 shadow-[2px_2px_0px_#111111]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12 H20 M14 6 L20 12 L14 18" stroke="#111111" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Action & Stage Controls Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#111111] pt-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold border-2 border-[#111111] px-3 py-1.5 rounded-[7px] bg-white shadow-[2px_2px_0px_#111111]">
                ⏱ {formatTimer(timerSeconds)}
              </span>
              <span className="text-xs text-[#666666] hidden sm:inline">
                Both founders in live call. Talk directly without slides.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setMatchState("searching");
                  setTimeout(() => setMatchState("connected"), 1500);
                }}
                className="sketch-btn-secondary px-4 py-2 text-sm font-semibold"
              >
                Next Founder →
              </button>
              <button
                type="button"
                onClick={() => setMatchState("exchange")}
                className="sketch-btn-primary px-5 py-2 text-sm font-semibold"
              >
                Exchange Contact Card
              </button>
            </div>
          </div>
        </div>
      )}

      {matchState === "exchange" && (
        <div>
          <div className="text-center max-w-md mx-auto mb-6">
            <h4 className="font-sans text-2xl font-bold text-[#000000]">
              Good talk? Stay connected.
            </h4>
            <p className="mt-1 text-sm text-[#666666]">
              Choose which paper contact card to exchange. Details are only revealed if both founders agree.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Your Paper Slip */}
            <div className="paper-slip p-5 relative bg-white">
              <div className="flex items-center justify-between border-b-2 border-[#111111] pb-2 mb-3">
                <span className="font-mono text-xs font-bold uppercase text-[#111111]">Your Contact Slip</span>
                <span className="font-sketch-note text-xs text-[#666666]">paper note</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharedDetails.name}
                    onChange={(e) => setSharedDetails({ ...sharedDetails, name: e.target.checked })}
                    className="accent-black h-4 w-4"
                  />
                  <span>Share Name: <strong>Rahul Sharma</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharedDetails.company}
                    onChange={(e) => setSharedDetails({ ...sharedDetails, company: e.target.checked })}
                    className="accent-black h-4 w-4"
                  />
                  <span>Share Venture: <strong>LioranDB Engine</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharedDetails.twitter}
                    onChange={(e) => setSharedDetails({ ...sharedDetails, twitter: e.target.checked })}
                    className="accent-black h-4 w-4"
                  />
                  <span>Share X handle: <strong>@rahul_builds</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharedDetails.email}
                    onChange={(e) => setSharedDetails({ ...sharedDetails, email: e.target.checked })}
                    className="accent-black h-4 w-4"
                  />
                  <span>Share Email: <strong>rahul@lioran.io</strong></span>
                </label>
              </div>

              <div className="mt-4 border-t border-[#111111] pt-3 text-center">
                <span className="font-mono text-[11px] text-[#111111]">✓ READY TO SHARE</span>
              </div>
            </div>

            {/* Peer's Paper Slip */}
            <div className="paper-slip p-5 relative bg-white">
              <div className="flex items-center justify-between border-b-2 border-[#111111] pb-2 mb-3">
                <span className="font-mono text-xs font-bold uppercase text-[#111111]">Ravi&apos;s Contact Slip</span>
                <span className="font-sketch-note text-xs text-[#666666]">shared with you</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#666666] font-mono">NAME:</span>
                  <p className="font-semibold text-[#111111]">Ravi Kapoor</p>
                </div>
                <div>
                  <span className="text-[#666666] font-mono">VENTURE:</span>
                  <p className="font-semibold text-[#111111]">VocalPulse AI</p>
                </div>
                <div>
                  <span className="text-[#666666] font-mono">X HANDLE:</span>
                  <p className="font-semibold text-[#111111]">@ravik_ai</p>
                </div>
                <div>
                  <span className="text-[#666666] font-mono">SECTOR:</span>
                  <p className="font-semibold text-[#111111]">Voice Agents / Enterprise</p>
                </div>
              </div>

              <div className="mt-4 border-t border-[#111111] pt-3 text-center">
                <span className="font-mono text-[11px] text-[#111111]">✓ MUTUAL EXCHANGE</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMatchState("searching");
                setTimeout(() => setMatchState("connected"), 1400);
              }}
              className="sketch-btn-primary px-6 py-2.5 text-sm font-semibold"
            >
              Meet Another Founder →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Sketch Card Primitive
export function SketchCard({
  title,
  description,
  badge,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sketch-card p-6 ${className}`}>
      {(title || description || badge || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#111111] pb-4 mb-5">
          <div className="space-y-1">
            {badge && <div className="mb-2">{badge}</div>}
            {title && (
              <h3 className="font-sans text-xl font-bold tracking-tight text-[#000000]">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm leading-relaxed text-[#666666] max-w-xl">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// Reusable Hand-drawn Arrow Primitive
export function SketchArrow({
  direction = "right",
  className = "",
}: {
  direction?: "right" | "down" | "curved";
  className?: string;
}) {
  if (direction === "down") {
    return (
      <svg
        width="24"
        height="40"
        viewBox="0 0 24 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M12 4 C14 16, 10 24, 12 34 M6 28 L12 34 L18 28"
          stroke="#111111"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (direction === "curved") {
    return (
      <svg
        width="60"
        height="32"
        viewBox="0 0 60 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <path
          d="M4 8 C20 4, 38 28, 54 20 M46 16 L54 20 L50 26"
          stroke="#111111"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width="48"
      height="24"
      viewBox="0 0 48 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 12 C18 10, 32 14, 42 12 M34 6 L42 12 L34 18"
        stroke="#111111"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Reusable Hand-drawn Wavy Underline
export function SketchUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="12"
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 6 Q 25 10, 50 6 T 100 6 T 150 6 T 198 6"
        stroke="#111111"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
