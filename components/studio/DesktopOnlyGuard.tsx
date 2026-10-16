"use client";

import React, { useState } from "react";
import { LioranDBLogo } from "@/lib/sketch-components";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  MonitorIcon,
  LaptopIcon,
  SmartphoneIcon,
  CopyIcon,
  CheckIcon,
  TerminalIcon,
  Table2Icon,
  ActivityIcon,
  ShieldCheckIcon,
} from "lucide-react";

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
}

export function DesktopOnlyGuard({ children }: DesktopOnlyGuardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : "https://studio.liorandb.com";
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => {});
    }
  };

  return (
    <>
      {/* Phone / Small Screen Message (displayed on phones: max-width <= 768px or landscape height <= 520px) */}
      <div className="phone-only-guard min-h-screen w-full flex-col justify-between bg-[var(--canvas)] text-[var(--ink)] p-6 antialiased select-none">
        {/* Top Bar with Brand & Theme Toggle */}
        <header className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
          <LioranDBLogo size={24} />
          <ThemeToggle />
        </header>

        {/* Center Card */}
        <main className="my-auto py-8 flex flex-col items-center text-center max-w-md mx-auto">
          {/* Visual Device Graphics */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] shadow-xs">
              <MonitorIcon size={40} className="text-[var(--ink)]" />
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-card)] border border-[var(--hairline-strong)] text-[var(--text-link)] shadow-xs">
                <LaptopIcon size={14} />
              </div>
            </div>
            <div
              className="absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-500"
              title="Phones not supported"
            >
              <SmartphoneIcon size={12} />
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-[11px] font-mono font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
            Desktop Required
          </div>

          {/* Main Title & Description */}
          <h1 className="font-sans text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Please use desktop to access Studio
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[var(--body)] leading-relaxed">
            LioranDB Studio is a professional database control plane and query IDE designed for desktop and laptop environments. Mobile phones are not supported.
          </p>

          {/* Highlights of Desktop Experience */}
          <div className="mt-6 w-full grid grid-cols-2 gap-2 text-left text-xs">
            <div className="p-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <TerminalIcon size={14} className="text-[var(--text-link)]" />
                <span>Query IDE</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)] leading-tight">
                Multi-tab query editor & aggregations
              </p>
            </div>
            <div className="p-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <Table2Icon size={14} className="text-[var(--text-link)]" />
                <span>Data Inspector</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)] leading-tight">
                High-density table, JSON & tree views
              </p>
            </div>
            <div className="p-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <ActivityIcon size={14} className="text-[var(--text-link)]" />
                <span>Raft Telemetry</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)] leading-tight">
                Cluster consensus & node health
              </p>
            </div>
            <div className="p-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <ShieldCheckIcon size={14} className="text-[var(--text-link)]" />
                <span>RBAC & Security</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted)] leading-tight">
                Roles, permissions & backup schedules
              </p>
            </div>
          </div>

          {/* Copy URL for Desktop */}
          <div className="mt-6 w-full space-y-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="btn-primary w-full h-10 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckIcon size={14} className="text-white" />
                  <span>Link Copied! Open on Computer</span>
                </>
              ) : (
                <>
                  <CopyIcon size={14} />
                  <span>Copy Studio URL for Desktop</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-[var(--muted)]">
              Open or bookmark this link on your computer to get started.
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--hairline)] pt-3 text-center text-[11px] font-mono text-[var(--muted)]">
          LioranDB Studio • Developer Control Plane
        </footer>
      </div>

      {/* Desktop View Surface (active for screens > 768px and height > 520px) */}
      <div className="desktop-only-content min-h-full flex-col flex-1">
        {children}
      </div>
    </>
  );
}
