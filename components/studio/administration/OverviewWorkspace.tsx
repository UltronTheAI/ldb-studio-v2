"use client";

import React, { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { fetchAdminSectionDataAction } from "@/app/actions";
import {
  ServerIcon,
  TerminalIcon,
  ZapIcon,
  ActivityIcon,
  RefreshCwIcon,
} from "lucide-react";
import { CardSkeletonWidget } from "../widgets/LoadingWidget";

export function OverviewWorkspace() {
  const { initialContext, openQueryTab, openAdminTab, databases, collectionsMap, isLocalMode } = useWorkspace();
  const [data, setData] = useState<Record<string, unknown>>({
    serverInfo: initialContext.serverInfo,
    live: initialContext.live,
    ready: initialContext.ready,
    clusterSummary: initialContext.clusterSummary,
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminSectionDataAction("overview");
      if (res.ok && res.data) {
        setData(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore) return;
      setIsLoading(true);
      try {
        const res = await fetchAdminSectionDataAction("overview");
        if (!ignore && res.ok && res.data) {
          setData(res.data);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const totalCollections = Object.values(collectionsMap).reduce(
    (sum, cols) => sum + cols.length,
    0,
  );

  const liveState = (data.live as { state?: string; node_id?: number } | null)?.state ?? "Operational";
  const readyState = (data.ready as { state?: string } | null)?.state ?? "Ready";
  const nodeId = (data.live as { node_id?: number } | null)?.node_id ?? 1;

  return (
    <div className="w-full h-full min-h-0 p-6 overflow-y-auto overscroll-contain editor-scroll space-y-6">
      {/* Overview Top Hero */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-lg font-bold text-[var(--ink)]">
              Cluster Node #{nodeId} Connected
            </h2>
          </div>
          <p className="text-xs text-[var(--muted)] font-mono">
            {initialContext.protocol}://{initialContext.host}:{initialContext.port} • Authenticated as{" "}
            <span className="font-bold text-[var(--ink)]">{initialContext.principal.username}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            title="Refresh Cluster Health"
            className={`p-2 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-[var(--ink)] transition ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => openQueryTab()}
            className="btn-primary h-8 px-3 text-xs font-semibold flex items-center gap-1.5"
          >
            <TerminalIcon size={13} />
            <span>New Query Tab</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {isLoading && !data.live ? (
        <CardSkeletonWidget count={4} message="Fetching live cluster telemetry..." />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Live Node State
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)] flex items-center gap-2">
              <ActivityIcon size={18} className="text-[var(--text-link)]" />
              <span>{liveState}</span>
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Cluster Readiness
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)]">
              {readyState}
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Online Databases
            </div>
            <div className="text-xl font-bold font-mono text-[var(--text-link)]">
              {databases.length}
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Collections
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)]">
              {totalCollections}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Diagnostics Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Profile */}
        <div className="p-5 rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-4">
          <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
            <ServerIcon size={15} className="text-[var(--text-link)]" />
            <span>Endpoint Configuration</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-[6px] bg-[var(--canvas-soft)] border border-[var(--hairline)]">
              <span className="text-[10px] text-[var(--muted)] block">HOST</span>
              <span className="font-semibold text-[var(--ink)]">{initialContext.host}</span>
            </div>
            <div className="p-2.5 rounded-[6px] bg-[var(--canvas-soft)] border border-[var(--hairline)]">
              <span className="text-[10px] text-[var(--muted)] block">PORT</span>
              <span className="font-semibold text-[var(--ink)]">{initialContext.port}</span>
            </div>
            <div className="p-2.5 rounded-[6px] bg-[var(--canvas-soft)] border border-[var(--hairline)]">
              <span className="text-[10px] text-[var(--muted)] block">TRANSPORT</span>
              <span className="font-semibold text-[var(--ink)]">{initialContext.transport}</span>
            </div>
            <div className="p-2.5 rounded-[6px] bg-[var(--canvas-soft)] border border-[var(--hairline)]">
              <span className="text-[10px] text-[var(--muted)] block">TLS ENCRYPTION</span>
              <span className="font-semibold text-[var(--ink)]">
                {initialContext.tls ? "Enabled (TLS 1.3)" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Operations Navigation */}
        <div className="p-5 rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-4">
          <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
            <ZapIcon size={15} className="text-[#fbbf24]" />
            <span>Fast Administration Shortcuts</span>
          </h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => openAdminTab("users")}
              className="p-3 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] text-left transition font-semibold text-[var(--ink)] flex items-center justify-between"
            >
              <span>User Governance</span>
              <span className="text-[var(--muted)] font-mono text-[10px]">RBAC</span>
            </button>
            <button
              type="button"
              onClick={() => openAdminTab("roles")}
              className="p-3 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] text-left transition font-semibold text-[var(--ink)] flex items-center justify-between"
            >
              <span>Role Permissions</span>
              <span className="text-[var(--muted)] font-mono text-[10px]">Grants</span>
            </button>
            {isLocalMode ? (
              <button
                type="button"
                onClick={() => openAdminTab("backups")}
                className="p-3 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] text-left transition font-semibold text-[var(--ink)] flex items-center justify-between cursor-pointer"
              >
                <span>Backups &amp; Snapshots</span>
                <span className="text-[var(--muted)] font-mono text-[10px]">Cold store</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Backup management is disabled. We will bring this feature in a future update."
                className="p-3 rounded-[6px] border border-[var(--hairline)] opacity-40 cursor-not-allowed text-left transition font-semibold text-[var(--ink)] flex items-center justify-between"
              >
                <span>Backups &amp; Snapshots</span>
                <span className="text-[var(--muted)] font-mono text-[10px]">Coming in future</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openAdminTab("settings")}
              className="p-3 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] text-left transition font-semibold text-[var(--ink)] flex items-center justify-between"
            >
              <span>Studio Configuration</span>
              <span className="text-[var(--muted)] font-mono text-[10px]">Tuning</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
