"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type { ActivitySection } from "@/lib/studio/workspace-types";
import {
  DatabaseIcon,
  TerminalIcon,
  HistoryIcon,
  ShieldIcon,
  NetworkIcon,
  ArchiveIcon,
  SettingsIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
} from "lucide-react";

interface ActivityItem {
  id: ActivitySection;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const ACTIVITIES: ActivityItem[] = [
  { id: "explorer", label: "Database Explorer", icon: DatabaseIcon },
  { id: "query", label: "Query Workbench", icon: TerminalIcon },
  { id: "history", label: "Execution History", icon: HistoryIcon },
  { id: "admin", label: "Governance & RBAC", icon: ShieldIcon },
  { id: "cluster", label: "Cluster Topology", icon: NetworkIcon },
  { id: "backups", label: "Backup Management", icon: ArchiveIcon },
];

export function ActivityBar() {
  const {
    activeActivity,
    setActiveActivity,
    isSidebarCollapsed,
    toggleSidebar,
    openQueryTab,
    openAdminTab,
    openClusterTab,
  } = useWorkspace();

  const handleActivityClick = (id: ActivitySection) => {
    if (activeActivity === id && !isSidebarCollapsed) {
      // Toggle collapse if clicking the currently active one
      toggleSidebar();
    } else {
      setActiveActivity(id);
      if (isSidebarCollapsed) {
        toggleSidebar();
      }
    }

    // Proactively launch relevant views if appropriate
    if (id === "admin") {
      openAdminTab("users");
    } else if (id === "cluster") {
      openClusterTab();
    } else if (id === "backups") {
      openAdminTab("backups");
    }
  };

  return (
    <aside className="w-12 border-r border-[var(--hairline-strong)] bg-[var(--surface-dark)] flex flex-col items-center py-2 select-none z-20 shrink-0 justify-between text-[#8a8f98]">
      {/* Top Activities */}
      <div className="flex flex-col items-center gap-1 w-full">
        {ACTIVITIES.map((item) => {
          const isActive = activeActivity === item.id && !isSidebarCollapsed;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleActivityClick(item.id)}
              title={`${item.label} (Click to switch)`}
              className={`relative w-10 h-10 rounded-[6px] flex items-center justify-center transition ${
                isActive
                  ? "text-white bg-[#252830]"
                  : "hover:text-[#e4e7eb] hover:bg-[#1a1d24]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--text-link)] rounded-r" />
              )}
              <Icon size={18} />
            </button>
          );
        })}

        {/* Quick New Query Action Button */}
        <div className="w-6 h-[1px] bg-[#2a2d36] my-1" />
        <button
          type="button"
          onClick={() => openQueryTab()}
          title="New Query Editor Tab"
          className="w-10 h-10 rounded-[6px] flex items-center justify-center text-[#8a8f98] hover:text-white hover:bg-[#1a1d24] transition"
        >
          <PlusIcon size={18} />
        </button>
      </div>

      {/* Bottom Activities: Settings & Sidebar Toggle */}
      <div className="flex flex-col items-center gap-1 w-full">
        <button
          type="button"
          onClick={() => {
            setActiveActivity("settings");
            if (isSidebarCollapsed) toggleSidebar();
            openAdminTab("settings");
          }}
          title="Studio Settings"
          className={`w-10 h-10 rounded-[6px] flex items-center justify-center transition ${
            activeActivity === "settings"
              ? "text-white bg-[#252830]"
              : "hover:text-[#e4e7eb] hover:bg-[#1a1d24]"
          }`}
        >
          <SettingsIcon size={18} />
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? "Show Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
          className="w-10 h-10 rounded-[6px] flex items-center justify-center text-[#8a8f98] hover:text-white hover:bg-[#1a1d24] transition"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpenIcon size={18} />
          ) : (
            <PanelLeftCloseIcon size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}
