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

function StudioWorkspaceMain() {
  const { activeTab } = useWorkspace();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--canvas)]">
      {/* Chrome / VS Code style Workspace Tabs */}
      <WorkspaceTabs />

      {/* Active Tab View Surface */}
      <div className="flex-1 overflow-hidden relative">
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
                      limit: 50,
                      skip: 0,
                      page: 1,
                      pageSize: 50,
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
            {(activeTab.type === "admin" || activeTab.type === "cluster") && (
              <AdminWorkspace key={activeTab.id} tab={activeTab} />
            )}
          </>
        ) : (
          <OverviewWorkspace />
        )}
      </div>
    </div>
  );
}

export function StudioShell({ initialContext }: { initialContext: InitialStudioContext }) {
  return (
    <WorkspaceProvider initialContext={initialContext}>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--ink)] antialiased select-none font-sans">
        {/* Top Application Bar */}
        <TopAppBar />

        {/* Center IDE Workspace (Activity Bar + Explorer Sidebar + Main Tabs & Content) */}
        <div className="flex-1 flex overflow-hidden">
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
