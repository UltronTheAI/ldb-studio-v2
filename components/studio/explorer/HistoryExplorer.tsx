"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { clearQueryHistory } from "@/lib/studio/workspace-storage";
import { ClockIcon } from "lucide-react";

export function HistoryExplorer() {
  const { history, openQueryTab } = useWorkspace();

  const handleClear = () => {
    clearQueryHistory();
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-3 overflow-y-auto sidebar-scroll">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Past Executions ({history.length})
        </span>
        {history.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-[var(--muted)] hover:text-[#ef4444] transition"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="p-4 rounded-[6px] border border-dashed border-[var(--hairline-strong)] text-center text-[11px] text-[var(--muted)]">
          No query execution history yet. Runs from the workbench or collection workspace will appear here.
        </div>
      ) : (
        <div className="space-y-1.5">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => openQueryTab(item.database, item.collection, item.querySummary)}
              className="p-2.5 rounded-[6px] border border-[var(--hairline)] bg-[var(--surface-card)] hover:border-[var(--muted)] hover:bg-[var(--surface-strong)] cursor-pointer transition space-y-1"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px] font-bold text-[var(--ink)] truncate">
                  {item.database}.{item.collection}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--muted)] shrink-0 font-mono">
                  <ClockIcon size={10} />
                  {item.durationMs}ms
                </span>
              </div>

              <div className="font-mono text-[11px] text-[var(--body)] truncate bg-[var(--canvas-soft)] px-1.5 py-0.5 rounded border border-[var(--hairline)]">
                {item.querySummary}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-0.5">
                <span className="flex items-center gap-1">
                  {item.success ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-link)]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  )}
                  {item.success ? `${item.documentCount} docs` : "Failed"}
                </span>
                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
