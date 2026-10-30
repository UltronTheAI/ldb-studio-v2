"use client";

import React from "react";
import type { InitialStudioContext } from "@/lib/studio/workspace-types";
import { WorkspaceProvider, useWorkspace } from "@/lib/studio/workspace-context";
import { TopAppBar } from "./TopAppBar";
import { ActivityBar } from "./ActivityBar";
import { ExplorerSidebar } from "./ExplorerSidebar";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { CollectionWorkspace } from "./collection/CollectionWorkspace";
import { QueryWorkbench } from "./query/QueryWorkbench";
import { AggregationWorkbench } from "./aggregation/AggregationWorkbench";
import { OverviewWorkspace } from "./administration/OverviewWorkspace";
import { AdminWorkspace } from "./administration/AdminWorkspace";
import { ClusterWorkspace } from "./cluster/ClusterWorkspace";
import { ActivityIcon } from "lucide-react";

function EmptyWorkspace({ onOpenOverview }: { onOpenOverview: () => void }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[var(--canvas)] p-6">
      <div className="max-w-sm space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--text-link)] shadow-xs">
          <ActivityIcon size={22} />
        </div>
        <h2 className="text-base font-semibold text-[var(--ink)]">No tabs open</h2>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Open a workspace tab from the explorer, or return to the overview.
        </p>
        <button
          type="button"
          onClick={onOpenOverview}
          className="text-xs font-semibold text-[var(--text-link)] hover:underline"
        >
          Open Overview
        </button>
      </div>
    </div>
  );
}

function StudioWorkspaceMain() {
  const { activeTab, openOverviewTab } = useWorkspace();

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full overflow-hidden bg-[var(--canvas)]">
      {/* Chrome / VS Code style Workspace Tabs */}
      <WorkspaceTabs />

      {/* Active Tab View Surface */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {activeTab ? (
          <>
            {activeTab.type === "collection" && (
              <CollectionWorkspace key={activeTab.id} tab={activeTab} />
            )}
            {activeTab.type === "query" && (
              <QueryWorkbench key={activeTab.id} tab={activeTab} />
            )}
            {activeTab.type === "aggregation" && (
              <AggregationWorkbench key={activeTab.id} tab={activeTab} />
            )}
            {activeTab.type === "indexes" && (
              <CollectionWorkspace
                key={activeTab.id}
                tab={{
                  ...activeTab,
                  collectionState: {
                    ...(activeTab.collectionState || {
                      viewMode: "table",
                      filter: "{}",
                      projection: "",
                      sort: "",
                      limit: 25,
                      skip: 0,
                      page: 1,
                      pageSize: 25,
                      totalDocuments: 0,
                      documents: [],
                      indexes: [],
                    }),
                    subTab: "indexes",
                  },
                }}
              />
            )}
            {activeTab.type === "overview" && <OverviewWorkspace />}
            {activeTab.type === "cluster" && (
              <ClusterWorkspace key={activeTab.id} tab={activeTab} />
            )}
            {activeTab.type === "admin" && (
              <AdminWorkspace key={activeTab.id} tab={activeTab} />
            )}
          </>
        ) : (
          <EmptyWorkspace onOpenOverview={openOverviewTab} />
        )}
      </div>
    </div>
  );
}

export function StudioShell({ initialContext }: { initialContext: InitialStudioContext }) {
  return (
    <WorkspaceProvider initialContext={initialContext}>
      <div className="fixed inset-0 flex flex-col h-dvh w-full overflow-hidden bg-[var(--canvas)] text-[var(--ink)] antialiased select-none font-sans">
        {/* Top Application Bar */}
        <TopAppBar />

        {/* Center IDE Workspace (Activity Bar + Explorer Sidebar + Main Tabs & Content) */}
        <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">
          <ActivityBar />
          <ExplorerSidebar />
          <StudioWorkspaceMain />
        </div>

        {/* Bottom Status Bar */}
        <StatusBar />

        {/* Floating Command Palette Modal */}
        <CommandPalette />
      </div>
    </WorkspaceProvider>
  );
}
