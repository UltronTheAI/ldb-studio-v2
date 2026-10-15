"use client";

import React, { useState } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { LioranDBLogo } from "@/lib/sketch-components";
import { ThemeToggle } from "@/app/theme-toggle";
import { logoutAction } from "@/app/actions";
import {
  SearchIcon,
  RefreshCwIcon,
  PowerIcon,
  DatabaseIcon,
  ChevronRightIcon,
} from "lucide-react";

export function TopAppBar() {
  const {
    initialContext,
    activeTab,
    setCommandPaletteOpen,
    refreshExplorer,
    refreshActiveTab,
  } = useWorkspace();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await refreshExplorer();
      refreshActiveTab();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <header className="h-11 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div
          className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-[var(--hairline)] shrink-0"
          title="LioranDB Studio"
        >
          <LioranDBLogo size={20} showText={false} />
          <span className="font-sans text-xs font-bold tracking-wider text-[var(--ink)]">
            LS
          </span>
        </div>

        {/* Mobile active context indicator */}
        <div className="flex md:hidden items-center gap-1 text-[11px] font-mono text-[var(--ink)] truncate max-w-[140px]">
          <span className="truncate">{activeTab?.title || "Studio"}</span>
        </div>

        {/* Connection status badge */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--surface-strong)] text-[11px] font-mono text-[var(--body)] border border-[var(--hairline)] shrink-0"
          title={`${initialContext.host}:${initialContext.port}`}
        >
          <span className="font-semibold text-[var(--ink)]">
            {initialContext.host && initialContext.host.length > 3
              ? `${initialContext.host.slice(0, 3)}...`
              : initialContext.host || "..."}
          </span>
          {initialContext.tls && (
            <span className="text-[9px] px-1 py-0.2 bg-[var(--surface-card)] text-[var(--ink)] font-bold rounded uppercase border border-[var(--hairline-strong)]">
              TLS
            </span>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[var(--muted)] pl-2">
          <DatabaseIcon size={12} className="text-[var(--muted)]" />
          <span className="font-mono text-[var(--ink)] font-medium">
            {activeTab?.database || initialContext.scopedDatabase || "cluster"}
          </span>
          {activeTab?.collection && (
            <>
              <ChevronRightIcon size={12} className="text-[var(--muted)]" />
              <span className="font-mono text-[var(--text-link)] font-semibold">
                {activeTab.collection}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-3 hidden sm:block">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-7 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] text-[var(--muted)] flex items-center justify-between text-xs transition"
        >
          <span className="flex items-center gap-2 text-[11px]">
            <SearchIcon size={13} className="text-[var(--muted)]" />
            <span>Search collections, queries, commands...</span>
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--hairline)] text-[10px] font-mono text-[var(--muted)] shadow-xs">
            Ctrl+P
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Theme, Account & Logout */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          title="Search commands (Ctrl+P)"
          className="sm:hidden p-1.5 rounded-[6px] text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
        >
          <SearchIcon size={14} />
        </button>

        <button
          type="button"
          onClick={handleRefreshAll}
          title="Refresh workspace (Ctrl+R)"
          className={`p-1.5 rounded-[6px] text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
            isRefreshing ? "animate-spin text-[var(--text-link)]" : ""
          }`}
        >
          <RefreshCwIcon size={14} />
        </button>

        <ThemeToggle showLabel={false} className="p-1.5 hover:bg-[var(--surface-strong)]" />

        {/* Account Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAccountDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] transition"
          >
            <div className="w-5 h-5 rounded-[4px] bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center font-bold text-[10px]">
              {initialContext.principal.username.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-xs hidden lg:inline max-w-[80px] truncate">
              {initialContext.principal.username}
            </span>
          </button>

          {showAccountDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAccountDropdown(false)}
              />
              <div className="absolute right-0 mt-1 w-56 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-lg py-1.5 z-50 text-xs">
                <div className="px-3 py-2 border-b border-[var(--hairline)] space-y-0.5">
                  <div className="font-bold text-[var(--ink)]">
                    {initialContext.principal.username}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] font-mono">
                    Roles: {initialContext.principal.roles.join(", ") || "admin"}
                  </div>
                </div>

                <div className="px-3 py-2 border-b border-[var(--hairline)] text-[11px] font-mono text-[var(--body)] space-y-1">
                  <div>Host: {initialContext.host}</div>
                  <div>Port: {initialContext.port}</div>
                  <div>Transport: {initialContext.transport}</div>
                </div>

                <form action={logoutAction} className="p-1">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-[#ef4444] hover:bg-[#ef4444]/10 transition font-medium"
                  >
                    <PowerIcon size={13} />
                    <span>Disconnect Session</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
