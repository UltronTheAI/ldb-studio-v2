"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { UsersIcon, ShieldIcon, LockIcon, ExternalLinkIcon } from "lucide-react";

export function GovernanceExplorer() {
  const { openAdminTab, initialContext } = useWorkspace();
  return (
    <div className="flex flex-col h-full min-h-0 select-none text-xs p-2 space-y-4 overflow-y-auto overscroll-contain sidebar-scroll">
      <div className="space-y-1">
        <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Governance Workspaces</div>
        <button type="button" onClick={() => openAdminTab("users")} className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] transition flex items-center justify-between text-[var(--ink)] font-medium">
          <span className="flex items-center gap-2"><UsersIcon size={14} className="text-[var(--text-link)]" />User Accounts</span><ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
        <button type="button" onClick={() => openAdminTab("roles")} className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] transition flex items-center justify-between text-[var(--ink)] font-medium">
          <span className="flex items-center gap-2"><ShieldIcon size={14} className="text-[#a855f7]" />Roles &amp; RBAC Grants</span><ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
      </div>
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]"><LockIcon size={12} className="text-[var(--text-link)]" />Security Context</div>
        <div className="text-[10px] font-mono text-[var(--body)] space-y-0.5"><div>Principal: <strong className="text-[var(--ink)]">{initialContext.principal.username}</strong></div><div>Data loads when a governance workspace is opened.</div></div>
      </div>
    </div>
  );
}
