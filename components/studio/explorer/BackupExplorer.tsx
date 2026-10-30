"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { ArchiveIcon, ExternalLinkIcon } from "lucide-react";

export function BackupExplorer() {
  const { openAdminTab, isLocalMode } = useWorkspace();
  if (!isLocalMode) return <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[var(--muted)]">Backup management is disabled for this connection.</div>;
  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-4 overflow-y-auto sidebar-scroll">
      <div className="space-y-1">
        <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Backup Repository</div>
        <button type="button" onClick={() => openAdminTab("backups")} className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] transition flex items-center justify-between text-[var(--ink)] font-medium">
          <span className="flex items-center gap-2"><ArchiveIcon size={14} className="text-[#f59e0b]" />Open Backup Manager</span><ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
      </div>
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[11px] leading-relaxed text-[var(--body)]">Snapshot inventory and schedules are fetched only after the backup manager is opened.</div>
    </div>
  );
}
