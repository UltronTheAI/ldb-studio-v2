"use client";

import React, { useRef, useState } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type { StudioTabType } from "@/lib/studio/workspace-types";
import {
  Table2Icon,
  TerminalIcon,
  GitBranchIcon,
  BoxesIcon,
  ShieldIcon,
  NetworkIcon,
  ActivityIcon,
  XIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

function getTabIcon(type: StudioTabType) {
  switch (type) {
    case "collection":
      return Table2Icon;
    case "query":
      return TerminalIcon;
    case "aggregation":
      return GitBranchIcon;
    case "indexes":
      return BoxesIcon;
    case "admin":
      return ShieldIcon;
    case "cluster":
      return NetworkIcon;
    case "overview":
    default:
      return ActivityIcon;
  }
}

export function WorkspaceTabs() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    openQueryTab,
  } = useWorkspace();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const delta = direction === "left" ? -180 : 180;
    scrollRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="h-9 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center select-none z-10 shrink-0">
      {/* Scrollable Tabs List */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = getTabIcon(tab.type);

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                // Middle click closes tab
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  tabId: tab.id,
                });
              }}
              className={`group relative flex items-center gap-2 h-full px-3 border-r border-[var(--hairline)] cursor-pointer text-xs font-medium transition shrink-0 max-w-[200px] ${
                isActive
                  ? "bg-[var(--canvas)] text-[var(--ink)] font-semibold border-b-2 border-b-[var(--text-link)] shadow-xs"
                  : "bg-[var(--surface-card)] text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
              }`}
            >
              <Icon
                size={13}
                className={isActive ? "text-[var(--text-link)] shrink-0" : "text-[var(--muted)] shrink-0"}
              />

              <span className="truncate">{tab.title}</span>

              {/* Dirty indicator */}
              {tab.isDirty && (
                <span className="text-[var(--accent-warning)] font-bold text-xs shrink-0 leading-none select-none">*</span>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close Tab (Ctrl+W)"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--hairline-strong)] text-[var(--muted)] hover:text-[var(--ink)] transition shrink-0"
              >
                <XIcon size={12} />
              </button>
            </div>
          );
        })}

        {/* New Query Tab Quick Button */}
        <button
          type="button"
          onClick={() => openQueryTab()}
          title="New Query Tab"
          className="h-full px-2.5 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] border-r border-[var(--hairline)] transition shrink-0"
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {/* Tabs Navigation Arrows if overflow */}
      <div className="flex items-center border-l border-[var(--hairline)] px-1 shrink-0 bg-[var(--surface-card)]">
        <button
          type="button"
          onClick={() => handleScroll("left")}
          className="p-1 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] rounded"
        >
          <ChevronLeftIcon size={13} />
        </button>
        <button
          type="button"
          onClick={() => handleScroll("right")}
          className="p-1 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] rounded"
        >
          <ChevronRightIcon size={13} />
        </button>
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-44 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xl py-1 text-xs"
          >
            <button
              type="button"
              onClick={() => {
                closeTab(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] text-[var(--ink)] flex items-center justify-between"
            >
              <span>Close Tab</span>
              <kbd className="text-[10px] text-[var(--muted)] font-mono">Ctrl+W</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                closeOtherTabs(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] text-[var(--ink)]"
            >
              Close Others
            </button>
            <button
              type="button"
              onClick={() => {
                closeTabsToRight(contextMenu.tabId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] text-[var(--ink)]"
            >
              Close to the Right
            </button>
            <div className="h-[1px] bg-[var(--hairline)] my-1" />
            <button
              type="button"
              onClick={() => {
                closeAllTabs();
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] text-[#ef4444]"
            >
              Close All Tabs
            </button>
          </div>
        </>
      )}
    </div>
  );
}
