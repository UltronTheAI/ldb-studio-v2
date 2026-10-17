"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { fetchAdminSectionDataAction } from "@/app/actions";
import type {
  NodeConfigView,
  ClusterPartitionPlacement,
  ClusterSummary,
  ReadyStatus,
} from "@liorandb/driver";
import {
  NetworkIcon,
  ServerIcon,
  LayersIcon,
  RefreshCwIcon,
  CpuIcon,
  ExternalLinkIcon,
  DatabaseIcon,
} from "lucide-react";

export function ClusterExplorer() {
  const { openClusterTab, initialContext } = useWorkspace();
  const [nodes, setNodes] = useState<readonly NodeConfigView[]>([]);
  const [partitions, setPartitions] = useState<readonly ClusterPartitionPlacement[]>([]);
  const [readiness, setReadiness] = useState<ReadyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadClusterData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminSectionDataAction("cluster");
      if (res.ok && res.data) {
        if (Array.isArray(res.data.clusterNodes)) {
          setNodes(res.data.clusterNodes as readonly NodeConfigView[]);
        }
        if (Array.isArray(res.data.clusterPartitions)) {
          setPartitions(res.data.clusterPartitions as readonly ClusterPartitionPlacement[]);
        }
        if (res.data.clusterReadiness) {
          setReadiness(res.data.clusterReadiness as ReadyStatus);
        }
      }
    } catch {
      // Ignore background errors
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

  const clusterSummary = initialContext.clusterSummary as ClusterSummary | null;
  const activeNodes = nodes.length > 0 ? nodes : (clusterSummary?.nodes || []);
  const currentNodeId = initialContext.live?.node_id ?? clusterSummary?.node_id ?? 0;

  return (
    <div className="flex flex-col h-full min-h-0 select-none text-xs p-2 space-y-4 overflow-y-auto overscroll-contain sidebar-scroll">
      {/* Topology Action Card */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Consensus &amp; Topology</span>
          <button
            type="button"
            onClick={loadClusterData}
            title="Refresh Cluster State"
            className={`p-0.5 rounded text-[var(--muted)] hover:text-[var(--ink)] ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={11} />
          </button>
        </div>

        <button
          type="button"
          onClick={openClusterTab}
          className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center justify-between text-[var(--ink)] font-medium"
        >
          <div className="flex items-center gap-2">
            <NetworkIcon size={14} className="text-[var(--text-link)] shrink-0" />
            <span>Open Topology Map</span>
          </div>
          <ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
      </div>

      {/* Cluster Health Summary Tile */}
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1 text-xs font-mono">
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">Status:</span>
          <span className="font-bold text-[var(--ink)]">
            {readiness?.state || clusterSummary?.state || "Ready"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">Leader Node:</span>
          <span className="font-semibold text-[var(--text-link)]">Node #{currentNodeId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--muted)]">Transport:</span>
          <span className="text-[var(--body)]">{initialContext.transport.toUpperCase()}</span>
        </div>
      </div>

      {/* Raft Nodes Tree */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Cluster Nodes ({Math.max(activeNodes.length, 1)})</span>
        </div>

        {activeNodes.length === 0 ? (
          <button
            type="button"
            onClick={openClusterTab}
            className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between font-mono"
          >
            <div className="flex items-center gap-2 truncate">
              <ServerIcon size={12} className="text-[var(--text-link)] shrink-0" />
              <span className="text-xs text-[var(--ink)]">Node #0</span>
            </div>
            <span className="text-[9px] px-1 py-0.2 rounded-[3px] bg-[var(--text-link)]/10 text-[var(--text-link)] font-bold uppercase">
              Leader
            </span>
          </button>
        ) : (
          activeNodes.map((n) => {
            const isLeader = n.id === currentNodeId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={openClusterTab}
                className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between font-mono group"
              >
                <div className="flex items-center gap-2 truncate">
                  <CpuIcon size={12} className="text-[var(--muted)] group-hover:text-[var(--ink)] shrink-0" />
                  <span className="text-xs text-[var(--ink)] truncate">Node #{n.id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--muted)] truncate max-w-[100px]">
                    {n.listen_addr}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded-[3px] bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)] font-bold uppercase">
                    {isLeader ? "Leader" : "Follower"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Partitions List */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Partitions ({partitions.length > 0 ? partitions.length : 1})</span>
        </div>

        {partitions.length === 0 ? (
          <button
            type="button"
            onClick={openClusterTab}
            className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between font-mono"
          >
            <div className="flex items-center gap-2">
              <DatabaseIcon size={12} className="text-[#a855f7] shrink-0" />
              <span className="text-xs text-[var(--ink)]">Partition 0</span>
            </div>
            <span className="text-[10px] text-[var(--muted)]">Leader #0</span>
          </button>
        ) : (
          partitions.map((p) => (
            <button
              key={p.partition}
              type="button"
              onClick={openClusterTab}
              className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between font-mono group"
            >
              <div className="flex items-center gap-2">
                <LayersIcon size={12} className="text-[#a855f7] shrink-0" />
                <span className="text-xs text-[var(--ink)]">p{p.partition}</span>
              </div>
              <span className="text-[10px] text-[var(--muted)]">
                Leader #{p.leader} ({p.replicas.length + 1}x)
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
