"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { NetworkIcon, ExternalLinkIcon } from "lucide-react";

export function ClusterExplorer() {
  const { openClusterTab } = useWorkspace();
  return (
    <div className="flex flex-col h-full min-h-0 select-none text-xs p-2 space-y-4 overflow-y-auto overscroll-contain sidebar-scroll">
      <div className="space-y-1">
        <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Consensus &amp; Topology</div>
        <button type="button" onClick={openClusterTab} className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] transition flex items-center justify-between text-[var(--ink)] font-medium">
          <span className="flex items-center gap-2"><NetworkIcon size={14} className="text-[var(--text-link)]" />Open Topology Map</span><ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
      </div>
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[11px] leading-relaxed text-[var(--body)]">Cluster health, node topology, partitions, and readiness are fetched only after the topology map is opened.</div>
    </div>
  );
}
