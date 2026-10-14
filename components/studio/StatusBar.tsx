"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import {
  DatabaseIcon,
  ZapIcon,
  LayersIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  CommandIcon,
} from "lucide-react";

export function StatusBar() {
  const {
    initialContext,
    activeTab,
    tabs,
    lastExecutionDurationMs,
    statusMessage,
    setCommandPaletteOpen,
  } = useWorkspace();

  // Extract document counts from active tab if collection or query
  let totalDocs: number | null = null;
  let loadedDocs: number | null = null;

  if (activeTab?.type === "collection" && activeTab.collectionState) {
    totalDocs = activeTab.collectionState.totalDocuments;
    loadedDocs = activeTab.collectionState.documents.length;
  } else if (activeTab?.type === "query" && activeTab.queryState) {
    totalDocs = activeTab.queryState.resultCount;
    loadedDocs = activeTab.queryState.results?.length ?? null;
  }

  const duration =
    activeTab?.executionDurationMs ?? lastExecutionDurationMs;

  return (
    <footer className="h-6 border-t border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-[#9aa0a6] px-3 flex items-center justify-between text-[11px] font-mono select-none shrink-0 z-20">
      {/* Left: Connection State */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-white font-medium">
          <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
          <span>Connected</span>
        </div>

        <span className="hidden sm:inline text-[#555a64]">•</span>

        <div className="hidden sm:flex items-center gap-1 text-[#b0b4ba]">
          <span>{initialContext.host}:{initialContext.port}</span>
          <span className="text-[10px] text-[#717684]">({initialContext.transport})</span>
        </div>
      </div>

      {/* Center: Context & Document Counts */}
      <div className="flex items-center gap-3 truncate mx-2">
        {activeTab?.database && (
          <div className="hidden md:flex items-center gap-1 text-[#b0b4ba]">
            <DatabaseIcon size={11} className="text-[#3b82f6]" />
            <span className="font-semibold text-white">{activeTab.database}</span>
            {activeTab.collection && (
              <>
                <span className="text-[#555a64]">/</span>
                <span className="text-[#60a5fa]">{activeTab.collection}</span>
              </>
            )}
          </div>
        )}

        {totalDocs !== null && (
          <div className="flex items-center gap-1 text-[#b0b4ba]">
            <span>{totalDocs} total docs</span>
            {loadedDocs !== null && loadedDocs !== totalDocs && (
              <span className="text-[#717684]">({loadedDocs} loaded)</span>
            )}
          </div>
        )}

        {typeof duration === "number" && (
          <div className="hidden sm:flex items-center gap-1 text-[#fbbf24]">
            <ZapIcon size={11} />
            <span>{duration} ms</span>
          </div>
        )}

        {/* Transient Status Message */}
        {statusMessage && (
          <div
            className={`flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] ${
              statusMessage.tone === "error"
                ? "bg-[#ef4444]/20 text-[#ef4444]"
                : statusMessage.tone === "success"
                ? "bg-[#16a34a]/20 text-[#22c55e]"
                : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {statusMessage.tone === "error" ? (
              <AlertCircleIcon size={10} />
            ) : (
              <CheckCircle2Icon size={10} />
            )}
            <span className="truncate max-w-[200px]">{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Right: Tabs Count & Quick Palette Trigger */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1 text-[#717684]">
          <LayersIcon size={11} />
          <span>{tabs.length} tabs open</span>
        </div>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-1 hover:text-white transition cursor-pointer"
          title="Open Command Palette (Ctrl+Shift+P)"
        >
          <CommandIcon size={11} />
          <span className="hidden sm:inline">Ctrl+P</span>
        </button>
      </div>
    </footer>
  );
}
