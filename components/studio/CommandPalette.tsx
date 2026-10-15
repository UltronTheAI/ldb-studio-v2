"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { logoutAction } from "@/app/actions";
import {
  SearchIcon,
  DatabaseIcon,
  Table2Icon,
  TerminalIcon,
  GitBranchIcon,
  ShieldIcon,
  UsersIcon,
  NetworkIcon,
  ArchiveIcon,
  SettingsIcon,
  XIcon,
  MoonIcon,
  RefreshCwIcon,
  PowerIcon,
  CommandIcon,
} from "lucide-react";

interface PaletteCommand {
  id: string;
  title: string;
  category: "Navigation" | "Workspace" | "Database" | "System";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useWorkspace();
  if (!isCommandPaletteOpen) return null;
  return <CommandPaletteDialog onClose={() => setCommandPaletteOpen(false)} />;
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const {
    databases,
    collectionsMap,
    openCollectionTab,
    openQueryTab,
    openAggregationTab,
    openOverviewTab,
    openClusterTab,
    openAdminTab,
    closeTab,
    closeAllTabs,
    reopenClosedTab,
    activeTabId,
    toggleSidebar,
    refreshExplorer,
    refreshActiveTab,
  } = useWorkspace();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Construct command list dynamically
  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: "new-query",
        title: "New Query Workbench Tab",
        category: "Workspace",
        icon: TerminalIcon,
        action: () => openQueryTab(),
        shortcut: "Ctrl+N",
      },
      {
        id: "new-agg",
        title: "New Aggregation Pipeline Tab",
        category: "Workspace",
        icon: GitBranchIcon,
        action: () => openAggregationTab(),
      },
      {
        id: "refresh-all",
        title: "Refresh All Collections and Workspace",
        category: "Workspace",
        icon: RefreshCwIcon,
        action: () => {
          refreshExplorer();
          refreshActiveTab();
        },
        shortcut: "Ctrl+R",
      },
      {
        id: "toggle-sidebar",
        title: "Toggle Explorer Sidebar",
        category: "Workspace",
        icon: CommandIcon,
        action: () => toggleSidebar(),
        shortcut: "Ctrl+B",
      },
      {
        id: "close-active-tab",
        title: "Close Active Tab",
        category: "Workspace",
        icon: XIcon,
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        },
        shortcut: "Ctrl+W",
      },
      {
        id: "reopen-closed-tab",
        title: "Reopen Closed Tab",
        category: "Workspace",
        icon: RefreshCwIcon,
        action: () => reopenClosedTab(),
      },
      {
        id: "close-all-tabs",
        title: "Close All Tabs",
        category: "Workspace",
        icon: XIcon,
        action: () => closeAllTabs(),
      },
      {
        id: "nav-overview",
        title: "Go to System Overview",
        category: "Navigation",
        icon: DatabaseIcon,
        action: () => openOverviewTab(),
      },
      {
        id: "nav-cluster",
        title: "Go to Cluster Topology & Health",
        category: "Navigation",
        icon: NetworkIcon,
        action: () => openClusterTab(),
      },
      {
        id: "nav-users",
        title: "Go to User Governance",
        category: "Navigation",
        icon: UsersIcon,
        action: () => openAdminTab("users"),
      },
      {
        id: "nav-roles",
        title: "Go to Roles & Permissions",
        category: "Navigation",
        icon: ShieldIcon,
        action: () => openAdminTab("roles"),
      },
      {
        id: "nav-backups",
        title: "Go to Backups Repository",
        category: "Navigation",
        icon: ArchiveIcon,
        action: () => openAdminTab("backups"),
      },
      {
        id: "nav-settings",
        title: "Go to Studio Settings",
        category: "Navigation",
        icon: SettingsIcon,
        action: () => openAdminTab("settings"),
      },
    ];

    // Add collections dynamically
    for (const db of databases) {
      const cols = collectionsMap[db] || [];
      for (const col of cols) {
        list.push({
          id: `open-col-${db}-${col}`,
          title: `Open Collection: ${db}.${col}`,
          category: "Database",
          icon: Table2Icon,
          action: () => openCollectionTab(db, col),
        });
      }
    }

    // Toggle Theme
    list.push({
      id: "toggle-theme",
      title: "Toggle Light / Dark Mode",
      category: "System",
      icon: MoonIcon,
      action: () => {
        const isDark = document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem("liorandb_theme", isDark ? "dark" : "light");
        } catch {
          // Ignore
        }
      },
    });

    // Disconnect
    list.push({
      id: "disconnect",
      title: "Disconnect Active Session",
      category: "System",
      icon: PowerIcon,
      action: () => logoutAction(),
    });

    return list;
  }, [
    databases,
    collectionsMap,
    activeTabId,
    openQueryTab,
    openAggregationTab,
    openCollectionTab,
    openOverviewTab,
    openClusterTab,
    openAdminTab,
    closeTab,
    closeAllTabs,
    reopenClosedTab,
    toggleSidebar,
    refreshExplorer,
    refreshActiveTab,
  ]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          selected.action();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands, selectedIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-2xl overflow-hidden flex flex-col max-h-[460px] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-3.5 border-b border-[var(--hairline)]">
          <SearchIcon size={16} className="text-[var(--muted)] mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search collections..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-11 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[10px] font-mono text-[var(--muted)] shrink-0">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto sidebar-scroll p-1.5">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted)]">
              No matching commands or collections.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-[6px] cursor-pointer text-xs transition ${
                    isSelected
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={15}
                      className={isSelected ? "text-white" : "text-[var(--muted)]"}
                    />
                    <span className="font-medium truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[var(--canvas-soft)] text-[var(--muted)] border border-[var(--hairline)]"
                      }`}
                    >
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          isSelected ? "text-white" : "text-[var(--muted)]"
                        }`}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
