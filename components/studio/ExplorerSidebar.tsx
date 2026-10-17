"use client";

import React, { useRef, useState, useEffect } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { DatabaseTree } from "./explorer/DatabaseTree";
import { QueryExplorer } from "./explorer/QueryExplorer";
import { HistoryExplorer } from "./explorer/HistoryExplorer";
import { GovernanceExplorer } from "./explorer/GovernanceExplorer";
import { ClusterExplorer } from "./explorer/ClusterExplorer";
import { BackupExplorer } from "./explorer/BackupExplorer";
import {
  RefreshCwIcon,
  PanelLeftCloseIcon,
} from "lucide-react";

export function ExplorerSidebar() {
  const {
    activeActivity,
    sidebarWidth,
    setSidebarWidth,
    isSidebarCollapsed,
    toggleSidebar,
    refreshExplorer,
  } = useWorkspace();

  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dragStartXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      setSidebarWidth(startWidthRef.current + delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setSidebarWidth]);

  if (isSidebarCollapsed) {
    return null;
  }

  const titles: Record<string, string> = {
    explorer: "EXPLORER",
    query: "QUERY WORKBENCH",
    history: "EXECUTION LOG",
    admin: "GOVERNANCE",
    cluster: "CLUSTER TOPOLOGY",
    backups: "BACKUP REPOSITORY",
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshExplorer();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  return (
    <div
      style={{ width: `${sidebarWidth}px` }}
      className="relative flex flex-col h-full min-h-0 border-r border-[var(--hairline-strong)] bg-[var(--surface-card)] select-none shrink-0 overflow-hidden sticky top-0 left-0"
    >
      {/* Sidebar Header */}
      <div className="h-9 px-3 border-b border-[var(--hairline)] flex items-center justify-between shrink-0 bg-[var(--surface-card)] sticky top-0 z-10 select-none">
        <span className="font-sans text-[11px] font-bold tracking-wider uppercase text-[var(--muted)] truncate">
          {titles[activeActivity] || "EXPLORER"}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh Explorer"
            className={`p-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
              isRefreshing ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={12} />
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse Sidebar (Ctrl+B)"
            className="p-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
          >
            <PanelLeftCloseIcon size={12} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeActivity === "explorer" && <DatabaseTree />}
        {activeActivity === "query" && <QueryExplorer />}
        {activeActivity === "history" && <HistoryExplorer />}
        {activeActivity === "admin" && <GovernanceExplorer />}
        {activeActivity === "cluster" && <ClusterExplorer />}
        {activeActivity === "backups" && <BackupExplorer />}
      </div>

      {/* Drag Resize Handle on right edge */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--text-link)] transition ${
          isDragging ? "bg-[var(--text-link)]" : "bg-transparent"
        }`}
      />
    </div>
  );
}
