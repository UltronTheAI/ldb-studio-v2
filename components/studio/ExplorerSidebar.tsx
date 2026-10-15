"use client";

import React, { useRef, useState, useEffect } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { DatabaseTree } from "./explorer/DatabaseTree";
import { QueryExplorer } from "./explorer/QueryExplorer";
import { HistoryExplorer } from "./explorer/HistoryExplorer";
import { AdminExplorer } from "./explorer/AdminExplorer";
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
    settings: "PREFERENCES",
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
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="md:hidden fixed inset-0 top-11 bottom-6 left-12 z-30 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      <div
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        className="fixed md:relative top-11 md:top-0 bottom-6 md:bottom-0 left-12 md:left-0 z-40 md:z-auto w-[calc(100vw-48px)] sm:w-80 md:w-[var(--sidebar-width)] flex flex-col h-[calc(100vh-44px-24px)] md:h-full border-r border-[var(--hairline-strong)] bg-[var(--surface-card)] select-none shrink-0 overflow-hidden shadow-2xl md:shadow-none animate-in md:animate-none slide-in-from-left-4 duration-150"
      >
        {/* Sidebar Header */}
        <div className="h-9 px-3 border-b border-[var(--hairline)] flex items-center justify-between shrink-0 bg-[var(--surface-card)]">
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
              title="Close Sidebar"
              className="p-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
            >
              <PanelLeftCloseIcon size={12} />
            </button>
          </div>
        </div>

        {/* Main View Area */}
        <div className="flex-1 overflow-hidden">
          {activeActivity === "explorer" && <DatabaseTree />}
          {activeActivity === "query" && <QueryExplorer />}
          {activeActivity === "history" && <HistoryExplorer />}
          {activeActivity === "admin" && <GovernanceExplorer />}
          {activeActivity === "cluster" && <ClusterExplorer />}
          {activeActivity === "backups" && <BackupExplorer />}
          {activeActivity === "settings" && <AdminExplorer />}
        </div>

        {/* Drag Resize Handle on right edge - desktop only */}
        <div
          onMouseDown={handleMouseDown}
          className={`hidden md:block absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--text-link)] transition ${
            isDragging ? "bg-[var(--text-link)]" : "bg-transparent"
          }`}
        />
      </div>
    </>
  );
}
