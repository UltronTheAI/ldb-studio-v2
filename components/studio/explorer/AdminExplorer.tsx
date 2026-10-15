"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import {
  UsersIcon,
  ShieldIcon,
  NetworkIcon,
  ArchiveIcon,
  SlidersIcon,
  GlobeIcon,
  CpuIcon,
  HardDriveIcon,
  ActivityIcon,
} from "lucide-react";

export function AdminExplorer() {
  const { openAdminTab, openClusterTab, openOverviewTab } = useWorkspace();

  const adminSections = [
    {
      id: "overview",
      label: "System Health & Diagnostics",
      icon: ActivityIcon,
      action: () => openOverviewTab(),
    },
  ];

  const settingsPanes = [
    {
      id: "general",
      label: "General Settings",
      icon: SlidersIcon,
      action: () => openAdminTab("settings", "general"),
    },
    {
      id: "cors",
      label: "CORS Cross-Origin Rules",
      icon: GlobeIcon,
      action: () => openAdminTab("settings", "cors"),
    },
    {
      id: "performance",
      label: "Engine & Compaction Performance",
      icon: CpuIcon,
      action: () => openAdminTab("settings", "performance"),
    },
    {
      id: "limits",
      label: "Throttling & Resource Caps",
      icon: HardDriveIcon,
      action: () => openAdminTab("settings", "limits"),
    },
  ];

  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-4 overflow-y-auto sidebar-scroll">
      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          System Diagnostics
        </div>
        {adminSections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={sec.action}
              className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center gap-2.5 text-[var(--ink)] font-medium"
            >
              <Icon size={14} className="text-[var(--text-link)] shrink-0" />
              <span className="truncate">{sec.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          Server Configuration
        </div>
        {settingsPanes.map((pane) => {
          const Icon = pane.icon;
          return (
            <button
              key={pane.id}
              type="button"
              onClick={pane.action}
              className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center gap-2.5 text-[var(--body-strong)]"
            >
              <Icon size={14} className="text-[var(--muted)] shrink-0" />
              <span className="truncate">{pane.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
