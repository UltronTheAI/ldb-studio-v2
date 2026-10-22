"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { fetchAdminSectionDataAction } from "@/app/actions";
import type { BackupJobRecord, BackupSettings } from "@liorandb/driver";
import {
  ArchiveIcon,
  PlusIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  ClockIcon,
  ShieldIcon,
} from "lucide-react";

export function BackupExplorer() {
  const { openAdminTab, isLocalMode } = useWorkspace();
  const [backups, setBackups] = useState<readonly BackupJobRecord[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminSectionDataAction("backups");
      if (res.ok && res.data) {
        if (Array.isArray(res.data.backups)) {
          setBackups(res.data.backups as readonly BackupJobRecord[]);
        }
        if (res.data.settingsBackups) {
          setSettings(res.data.settingsBackups as BackupSettings);
        }
      }
    } catch {
      // Ignore background errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLocalMode) return;
    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore) return;
      await loadBackups();
    });
    return () => {
      ignore = true;
    };
  }, [loadBackups, isLocalMode]);

  if (!isLocalMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3 font-sans select-none">
        <div className="w-10 h-10 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center justify-center text-[var(--muted)]">
          <ArchiveIcon size={18} />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-[var(--ink)]">Backup Management Disabled</div>
          <p className="text-[11px] text-[var(--muted)] leading-relaxed max-w-[180px]">
            The backup option is currently disabled. We will bring this feature in a future update!
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
          Coming in future
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-4 overflow-y-auto sidebar-scroll">
      {/* Quick Launch Card */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Backup Repository</span>
          <button
            type="button"
            onClick={loadBackups}
            title="Refresh Backups"
            className={`p-0.5 rounded text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={11} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => openAdminTab("backups")}
          className="w-full text-left p-2.5 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center justify-between text-[var(--ink)] font-medium cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ArchiveIcon size={14} className="text-[#f59e0b] shrink-0" />
            <span>Open Backup Manager</span>
          </div>
          <ExternalLinkIcon size={12} className="text-[var(--muted)]" />
        </button>
      </div>

      {/* Snapshot Inventory */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Snapshots ({backups.length})</span>
          <button
            type="button"
            onClick={() => openAdminTab("backups")}
            title="Take Backup in Manager"
            className="flex items-center gap-0.5 text-[10px] text-[var(--text-link)] hover:underline normal-case font-medium cursor-pointer"
          >
            <PlusIcon size={10} />
            <span>Take Backup</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-3 text-[11px] text-[var(--muted)] italic text-center rounded-[6px] border border-[var(--hairline)] bg-[var(--canvas-soft)]">
            {isLoading ? "Loading snapshots..." : "No snapshots recorded"}
          </div>
        ) : (
          backups.map((b, idx) => {
            const bId = b.backup_id || (b as { id?: string }).id || `backup-${idx}`;
            const createdMs =
              (b as { created_at_ms?: number }).created_at_ms ||
              (b as { created_at_utc_ms?: number }).created_at_utc_ms;
            return (
              <button
                key={bId}
                type="button"
                onClick={() => openAdminTab("backups")}
                className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] transition font-mono group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)] truncate max-w-[130px]">
                    {b.label || bId}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-[3px] uppercase bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)]">
                    {b.status || "Complete"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
                  <span>{createdMs ? new Date(createdMs).toLocaleDateString() : "Snapshot"}</span>
                  {b.size_bytes !== null && b.size_bytes !== undefined && (
                    <span>{(b.size_bytes / 1024).toFixed(0)} KB</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Automated Schedules Summary */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Automated Schedules</span>
        </div>

        <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <ClockIcon size={11} />
              <span>Hourly:</span>
            </span>
            <span className="text-[var(--ink)] font-semibold">
              {settings?.hourly?.enabled ? "Active" : "Disabled"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <ClockIcon size={11} />
              <span>Daily:</span>
            </span>
            <span className="text-[var(--ink)] font-semibold">
              {settings?.daily?.enabled ? "Active" : "Disabled"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <ClockIcon size={11} />
              <span>Weekly:</span>
            </span>
            <span className="text-[var(--ink)] font-semibold">
              {settings?.weekly?.enabled ? "Active" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Storage & Safety Card */}
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
          <ShieldIcon size={12} className="text-[#f59e0b]" />
          <span>Safety Protection</span>
        </div>
        <p className="text-[10px] text-[var(--body)] leading-relaxed">
          Safety backups are triggered before destructive restores to guard against accidental data loss.
        </p>
      </div>
    </div>
  );
}
