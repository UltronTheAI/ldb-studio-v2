"use client";

import React from "react";
import { ArchiveIcon } from "lucide-react";

export function BackupExplorer() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3 font-sans select-none">
      <div className="w-10 h-10 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center justify-center text-[var(--muted)]">
        <ArchiveIcon size={18} />
      </div>
      <div className="space-y-1">
        <div className="text-xs font-bold text-[var(--ink)]">Backup Management Disabled</div>
        <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-[180px]">
          The backup option is currently disabled. We will bring this feature in a future update!
        </p>
      </div>
      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
        Coming in future
      </span>
    </div>
  );
}
