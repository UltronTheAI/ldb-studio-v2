"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import {
  DatabaseIcon,
  ZapIcon,
  LayersIcon,
  AlertCircleIcon,
  CheckIcon,
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
  let hasMoreDocs = false;

  if (activeTab?.type === "collection" && activeTab.collectionState) {
    totalDocs = activeTab.collectionState.totalIsExact ? activeTab.collectionState.totalDocuments : null;
    loadedDocs = activeTab.collectionState.documents.length;
    hasMoreDocs = Boolean(activeTab.collectionState.hasNextPage);
  } else if (activeTab?.type === "query" && activeTab.queryState) {
    totalDocs = activeTab.queryState.resultCount;
    loadedDocs = activeTab.queryState.results?.length ?? null;
  }

  const duration =
    activeTab?.executionDurationMs ?? lastExecutionDurationMs;

  return (
    <footer className="h-6 border-t border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-[var(--muted)] px-3 flex items-center justify-between text-[11px] font-mono select-none shrink-0 z-20">
      {/* Left: Connection State */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-[var(--ink)] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block shrink-0" />
          <span>Connected</span>
        </div>

        <span className="hidden sm:inline text-[var(--hairline-strong)]">•</span>

        <div className="hidden sm:flex items-center gap-1 text-[var(--body)]">
          <span>{initialContext.host}:{initialContext.port}</span>
          <span className="text-[10px] text-[var(--muted)]">({initialContext.transport})</span>
        </div>
      </div>

      {/* Center: Context & Document Counts */}
      <div className="flex items-center gap-3 truncate mx-2">
        {activeTab?.database && (
          <div className="hidden md:flex items-center gap-1 text-[var(--body)]">
            <DatabaseIcon size={11} className="text-[var(--text-link)] shrink-0" />
            <span className="font-semibold text-[var(--ink)]">{activeTab.database}</span>
            {activeTab.collection && (
              <>
                <span className="text-[var(--muted)]">/</span>
                <span className="text-[var(--text-link)] font-medium">{activeTab.collection}</span>
              </>
            )}
          </div>
        )}

        {totalDocs !== null && (
          <div className="flex items-center gap-1 text-[var(--body)]">
            <span>{totalDocs} total docs</span>
            {loadedDocs !== null && loadedDocs !== totalDocs && (
              <span className="text-[var(--muted)]">({loadedDocs} loaded)</span>
            )}
          </div>
        )}
        {totalDocs === null && hasMoreDocs && loadedDocs !== null && (
          <div className="flex items-center gap-1 text-[var(--body)]">
            <span>{loadedDocs}+ docs loaded</span>
          </div>
        )}

        {typeof duration === "number" && (
          <div className="hidden sm:flex items-center gap-1 text-[var(--accent-warning)]">
            <ZapIcon size={11} />
            <span>{duration} ms</span>
          </div>
        )}

        {/* Transient Status Message */}
        {statusMessage && (
          <div
            className={`flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] border ${
              statusMessage.tone === "error"
                ? "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20"
                : statusMessage.tone === "success"
                ? "bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20"
                : "bg-[var(--text-link)]/10 text-[var(--text-link)] border-[var(--text-link)]/20"
            }`}
          >
            {statusMessage.tone === "error" ? (
              <AlertCircleIcon size={10} />
            ) : (
              <CheckIcon size={10} />
            )}
            <span className="truncate max-w-[200px]">{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Right: Tabs Count & Quick Palette Trigger */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1 text-[var(--muted)]">
          <LayersIcon size={11} />
          <span>{tabs.length} tabs open</span>
        </div>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] px-1.5 py-0.5 rounded transition cursor-pointer"
          title="Open Command Palette (Ctrl+Shift+P)"
        >
          <CommandIcon size={11} />
          <span className="hidden sm:inline">Ctrl+P</span>
        </button>
      </div>
    </footer>
  );
}
