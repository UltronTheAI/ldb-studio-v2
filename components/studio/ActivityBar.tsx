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
  disabled?: boolean;
}

export function ActivityBar() {
  const {
    activeActivity,
    setActiveActivity,
    isSidebarCollapsed,
    toggleSidebar,
    openQueryTab,
    openAdminTab,
    openClusterTab,
    activeTab,
    isLocalMode,
  } = useWorkspace();

  const activities = React.useMemo(() => {
    const list: ActivityItem[] = [
      { id: "explorer", label: "Database Explorer", icon: DatabaseIcon },
      { id: "query", label: "Query Workbench", icon: TerminalIcon },
      { id: "history", label: "Execution History", icon: HistoryIcon },
      { id: "admin", label: "Governance & RBAC", icon: ShieldIcon },
      { id: "cluster", label: "Cluster Topology", icon: NetworkIcon },
    ];
    if (isLocalMode) {
      list.push({
        id: "backups",
        label: "Backup Management",
        icon: ArchiveIcon,
      });
    }
    return list;
  }, [isLocalMode]);

  const handleActivityClick = (item: ActivityItem) => {
    if (item.disabled) return;
    const id = item.id;
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
    <aside className="w-12 h-full min-h-0 border-r border-[var(--hairline-strong)] bg-[var(--canvas-soft)] flex flex-col items-center py-2 select-none z-20 shrink-0 justify-between text-[var(--muted)] sticky top-0 left-0">
      {/* Top Activities */}
      <div className="flex flex-col items-center gap-1 w-full">
        {activities.map((item) => {
          const isActive = activeActivity === item.id && !isSidebarCollapsed;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => handleActivityClick(item)}
              title={
                item.disabled
                  ? "Backup Management (Disabled - We will bring it in the future)"
                  : `${item.label} (Click to switch)`
              }
              className={`relative w-10 h-10 rounded-[6px] flex items-center justify-center transition cursor-pointer ${
                item.disabled
                  ? "opacity-35 cursor-not-allowed hover:bg-transparent"
                  : isActive
                  ? "text-[var(--ink)] bg-[var(--surface-strong)] shadow-xs"
                  : "hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
              }`}
            >
              {isActive && !item.disabled && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-[var(--text-link)] rounded-r" />
              )}
              <Icon size={18} />
            </button>
          );
        })}

        {/* Quick New Query Action Button */}
        <div className="w-6 h-[1px] bg-[var(--hairline-strong)] my-1" />
        <button
          type="button"
          onClick={() => openQueryTab()}
          title="New Query Editor Tab"
          className="w-10 h-10 rounded-[6px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition cursor-pointer"
        >
          <PlusIcon size={18} />
        </button>
      </div>

      {/* Bottom Activities: Settings & Sidebar Toggle */}
      <div className="flex flex-col items-center gap-1 w-full">
        <button
          type="button"
          onClick={() => {
            openAdminTab("settings");
          }}
          title="Studio Settings"
          className={`w-10 h-10 rounded-[6px] flex items-center justify-center transition cursor-pointer ${
            activeTab?.type === "admin" && activeTab?.adminState?.subSection === "settings"
              ? "text-[var(--ink)] bg-[var(--surface-strong)] shadow-xs"
              : "hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
          }`}
        >
          <SettingsIcon size={18} />
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? "Show Sidebar (Ctrl+B)" : "Hide Sidebar (Ctrl+B)"}
          className="w-10 h-10 rounded-[6px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition cursor-pointer"
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
