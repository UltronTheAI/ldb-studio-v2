"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { StudioTab } from "@/lib/studio/workspace-types";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { fetchAdminSectionDataAction } from "@/app/actions";
import type {
  NodeConfigView,
  ClusterPartitionPlacement,
  PartitionHealthView,
  ClusterSummary,
  ReadyStatus,
} from "@liorandb/driver";
import {
  NetworkIcon,
  ServerIcon,
  CpuIcon,
  LayersIcon,
  RefreshCwIcon,
  ActivityIcon,
  ShieldCheckIcon,
  RadioIcon,
  DatabaseIcon,
  TerminalIcon,
} from "lucide-react";

interface ClusterWorkspaceProps {
  tab?: StudioTab;
}

export function ClusterWorkspace({ tab }: ClusterWorkspaceProps) {
  const { initialContext, openQueryTab } = useWorkspace();
  const [nodes, setNodes] = useState<readonly NodeConfigView[]>([]);
  const [partitions, setPartitions] = useState<readonly ClusterPartitionPlacement[]>([]);
  const [healthSnapshots, setHealthSnapshots] = useState<readonly PartitionHealthView[]>([]);
  const [readiness, setReadiness] = useState<ReadyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const loadClusterData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSectionDataAction("cluster");
      if (res.ok && res.data) {
        if (Array.isArray(res.data.clusterNodes)) {
          setNodes(res.data.clusterNodes as readonly NodeConfigView[]);
        }
        if (Array.isArray(res.data.clusterPartitions)) {
          setPartitions(res.data.clusterPartitions as readonly ClusterPartitionPlacement[]);
        }
        if (Array.isArray(res.data.clusterHealth)) {
          setHealthSnapshots(res.data.clusterHealth as readonly PartitionHealthView[]);
        }
        if (res.data.clusterReadiness) {
          setReadiness(res.data.clusterReadiness as ReadyStatus);
        }
      } else {
        setError(res.error || "Unable to inspect cluster state");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cluster inspection failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore) return;
      await loadClusterData();
    });
    return () => {
      ignore = true;
    };
  }, [loadClusterData]);

  // Fallback to initialContext.clusterSummary if available and nodes list is empty
  const clusterSummary = initialContext.clusterSummary as ClusterSummary | null;
  const activeNodes = nodes.length > 0 ? nodes : (clusterSummary?.nodes || []);
  const currentNodeId = initialContext.live?.node_id ?? clusterSummary?.node_id ?? 0;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Header */}
      <div className="h-11 px-4 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <NetworkIcon size={16} className="text-[var(--text-link)]" />
          <h2 className="font-sans text-sm font-bold text-[var(--ink)]">
            {tab?.title || "Cluster Consensus & Topology Map"}
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
            Protocol v{clusterSummary?.protocol_version ?? 1}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadClusterData}
            title="Refresh Cluster Topology"
            className={`p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => openQueryTab()}
            className="btn-primary h-7 px-3 text-xs font-semibold flex items-center gap-1"
          >
            <TerminalIcon size={12} />
            <span>Open Query Tab</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto editor-scroll p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-[6px] text-xs font-mono bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* High-level Consensus Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Active Nodes
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)] flex items-center gap-2">
              <ServerIcon size={18} className="text-[var(--text-link)]" />
              <span>{Math.max(activeNodes.length, 1)} Registered</span>
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Partition Shards
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)] flex items-center gap-2">
              <LayersIcon size={18} className="text-[#a855f7]" />
              <span>{partitions.length > 0 ? partitions.length : (clusterSummary?.partitions ?? 1)}</span>
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Readiness State
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)] flex items-center gap-2">
              <ActivityIcon size={18} className="text-[var(--text-link)]" />
              <span>{readiness?.state || clusterSummary?.state || "Ready"}</span>
            </div>
          </div>

          <div className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Quorum &amp; Transport
            </div>
            <div className="text-xl font-bold font-mono text-[var(--ink)] flex items-center gap-2">
              <RadioIcon size={18} className="text-[#f59e0b]" />
              <span>{initialContext.transport.toUpperCase()} (gRPC)</span>
            </div>
          </div>
        </div>

        {/* 1. Raft Nodes Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <ServerIcon size={15} className="text-[var(--text-link)]" />
              <span>Raft Consensus Nodes</span>
            </h3>
            <span className="text-xs text-[var(--muted)] font-mono">
              Connected via Node #{currentNodeId}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeNodes.length === 0 ? (
              <div className="p-5 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs font-mono text-[var(--muted)]">
                Node #0: {initialContext.host}:{initialContext.port} (Leader)
              </div>
            ) : (
              activeNodes.map((n) => {
                const isCurrent = n.id === currentNodeId;
                const isSelected = selectedNodeId === n.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => setSelectedNodeId(n.id)}
                    className={`p-4 rounded-[10px] border cursor-pointer transition ${
                      isSelected
                        ? "border-[var(--text-link)] bg-[var(--surface-strong)] ring-1 ring-[var(--text-link)]"
                        : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--hairline)] mb-2.5">
                      <div className="flex items-center gap-2">
                        <CpuIcon size={14} className="text-[var(--text-link)]" />
                        <span className="font-mono text-sm font-bold text-[var(--ink)]">
                          Node #{n.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)] font-bold uppercase">
                            This Endpoint
                          </span>
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] bg-[var(--text-link)]/10 text-[var(--text-link)] font-bold uppercase">
                          {isCurrent ? "Active Leader" : "Follower"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)]">Listen Addr:</span>
                        <span className="font-semibold text-[var(--ink)]">{n.listen_addr}</span>
                      </div>
                      {n.public_addr && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--muted)]">Public Addr:</span>
                          <span className="text-[var(--body)]">{n.public_addr}</span>
                        </div>
                      )}
                      {n.metrics_addr && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--muted)]">Metrics Addr:</span>
                          <span className="text-[var(--body)]">{n.metrics_addr}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Partition Placements Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <LayersIcon size={15} className="text-[#a855f7]" />
              <span>Partition Placements &amp; Replica Sharding</span>
            </h3>
            <span className="text-xs text-[var(--muted)] font-mono">
              {partitions.length} partitions distributed
            </span>
          </div>

          <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
                <tr>
                  <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                    Partition ID
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                    Primary Leader Node
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                    Replica Placements
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                    Replication Factor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)]">
                {partitions.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 font-bold text-[var(--ink)]">Partition 0</td>
                    <td className="px-4 py-3 text-[var(--body)]">Node #{currentNodeId}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">Standalone (1 copy)</td>
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">1x</td>
                  </tr>
                ) : (
                  partitions.map((p) => (
                    <tr key={p.partition} className="hover:bg-[var(--surface-strong)] transition">
                      <td className="px-4 py-3 font-bold text-[var(--ink)] flex items-center gap-2">
                        <DatabaseIcon size={12} className="text-[var(--text-link)]" />
                        <span>Partition {p.partition}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--body)]">
                        <span className="font-bold text-[var(--ink)]">Node #{p.leader}</span>
                        {p.leader === currentNodeId && (
                          <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded-[3px] bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
                            Local
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--body)]">
                        {p.replicas.length > 0 ? (
                          p.replicas.map((r) => (
                            <span
                              key={r}
                              className="inline-block px-1.5 py-0.5 rounded-[4px] bg-[var(--canvas-soft)] border border-[var(--hairline)] mr-1 font-mono text-[11px]"
                            >
                              Node #{r}
                            </span>
                          ))
                        ) : (
                          <span className="text-[var(--muted)] italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--ink)]">
                        {p.replicas.length + 1}x
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Partition Telemetry & WAL Health */}
        {healthSnapshots.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <ShieldCheckIcon size={15} className="text-[var(--text-link)]" />
              <span>Partition Log Sequence &amp; WAL Diagnostics</span>
            </h3>

            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
                  <tr>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Partition
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Role
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Leader LSN
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Replica Acked LSN
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      WAL Disk
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Checkpoint Lag
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {healthSnapshots.map((h) => (
                    <tr key={h.partition} className="hover:bg-[var(--surface-strong)] transition">
                      <td className="px-4 py-3 font-bold text-[var(--ink)]">
                        Partition {h.partition}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] uppercase bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)]">
                          {h.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--body)] font-semibold">
                        {h.leader_latest_lsn}
                      </td>
                      <td className="px-4 py-3 text-[var(--body)]">
                        {h.replica_acked_lsn}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {(h.wal_disk_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-4 py-3 text-[var(--body)]">
                        {h.flush_lag_lsn === 0 ? "In Sync" : `${h.flush_lag_lsn} LSN lag`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
