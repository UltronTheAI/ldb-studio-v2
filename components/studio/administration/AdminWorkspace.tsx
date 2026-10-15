"use client";

import React, { useEffect, useState } from "react";
import type { StudioTab } from "@/lib/studio/workspace-types";
import { fetchAdminSectionDataAction, studioMutationAction } from "@/app/actions";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type { UserRecord, RoleRecord, BackupJobRecord, BackupSettings } from "@liorandb/driver";
import {
  UsersIcon,
  ShieldIcon,
  ArchiveIcon,
  SettingsIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  AlertCircleIcon,
  CheckIcon,
  SlidersIcon,
} from "lucide-react";
import { TableSkeletonWidget } from "../widgets/LoadingWidget";
import {
  DEFAULT_MAX_MANUAL_BACKUPS,
  filterManualBackups,
} from "@/lib/studio/backup-policy";

interface AdminWorkspaceProps {
  tab: StudioTab;
}

export function AdminWorkspace({ tab }: AdminWorkspaceProps) {
  const { updateTabState } = useWorkspace();
  const subSection = tab.adminState?.subSection || "users";
  const [settingsPane, setSettingsPane] = useState(tab.adminState?.settingsPane || "general");

  const [data, setData] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // User modal
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Role modal
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

  // Backup modals
  const [showCreateBackupModal, setShowCreateBackupModal] = useState(false);
  const [showBackupPolicyModal, setShowBackupPolicyModal] = useState(false);

  const loadSectionData = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetchAdminSectionDataAction(subSection);
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setMessage({ text: res.error || "Failed to fetch data", isError: true });
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
      setMessage(null);
      try {
        const res = await fetchAdminSectionDataAction(subSection);
        if (!ignore) {
          if (res.ok && res.data) {
            setData(res.data);
          } else {
            setMessage({ text: res.error || "Failed to fetch data", isError: true });
          }
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
  }, [subSection]);

  const users = (data.users as readonly UserRecord[]) || [];
  const roles = (data.roles as readonly RoleRecord[]) || [];
  const backups =
    (data.backups as readonly (BackupJobRecord & {
      id?: string;
      created_at_utc_ms?: number;
    })[]) || [];
  const backupSettings = data.settingsBackups as BackupSettings | undefined;
  const maxManualBackups = (data.maxManualBackups as number) || DEFAULT_MAX_MANUAL_BACKUPS;

  const manualBackups = filterManualBackups(backups);
  const isLimitReached = manualBackups.length >= maxManualBackups;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Section Header */}
      <div className="min-h-11 px-3 py-1.5 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex flex-wrap items-center justify-between gap-2 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          {subSection === "users" && <UsersIcon size={16} className="text-[var(--text-link)] shrink-0" />}
          {subSection === "roles" && <ShieldIcon size={16} className="text-[#a855f7] shrink-0" />}
          {subSection === "backups" && <ArchiveIcon size={16} className="text-[#f59e0b] shrink-0" />}
          {subSection === "settings" && <SettingsIcon size={16} className="text-[var(--ink)] shrink-0" />}
          <h2 className="font-sans text-xs sm:text-sm font-bold text-[var(--ink)] capitalize truncate">
            {subSection === "users" && "User Accounts & Authentication"}
            {subSection === "roles" && "Granular Roles & Access Grants"}
            {subSection === "backups" && "Cluster Backup Repository"}
            {subSection === "settings" && "Studio & Engine Configuration"}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {subSection === "users" && (
            <button
              type="button"
              onClick={() => setShowCreateUserModal(true)}
              className="btn-primary h-7 px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1"
            >
              <PlusIcon size={12} />
              <span>Create User</span>
            </button>
          )}

          {subSection === "roles" && (
            <button
              type="button"
              onClick={() => setShowCreateRoleModal(true)}
              className="btn-primary h-7 px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1"
            >
              <PlusIcon size={12} />
              <span>Create Role</span>
            </button>
          )}

          {subSection === "backups" && (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-[5px] border border-[var(--hairline-strong)] bg-[var(--surface-strong)] text-[var(--muted)]">
              Feature Disabled (Coming in future)
            </span>
          )}

          <button
            type="button"
            onClick={loadSectionData}
            title="Refresh"
            className={`p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={13} />
          </button>
        </div>
      </div>

      {/* Main Admin Content Body */}
      <div className="flex-1 overflow-y-auto editor-scroll p-6">
        {message && (
          <div
            className={`mb-4 p-3 rounded-[6px] text-xs font-mono flex items-center gap-2 ${
              message.isError
                ? "bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]"
                : "bg-[var(--surface-strong)] border border-[var(--hairline-strong)] text-[var(--ink)]"
            }`}
          >
            {message.isError ? <AlertCircleIcon size={14} /> : <CheckIcon size={14} className="text-[var(--text-link)]" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 1. USERS SUBSECTION */}
        {subSection === "users" && (
          isLoading && users.length === 0 ? (
            <TableSkeletonWidget
              columns={4}
              rows={5}
              message="Loading user accounts from auth service..."
            />
          ) : (
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
                  <tr>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Username
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Roles
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      State
                    </th>
                    <th className="px-4 py-2.5 text-center font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {users.length === 0 ? (
                    <tr key="empty-users">
                      <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                        No users returned.
                      </td>
                    </tr>
                  ) : (
                    users.map((u, idx) => {
                      const userId = u.id || u.username || `user-${idx}`;
                      return (
                        <tr key={userId} className="hover:bg-[var(--surface-strong)] transition">
                          <td className="px-4 py-3 font-bold text-[var(--ink)] flex items-center gap-2">
                            <UsersIcon size={13} className="text-[var(--text-link)]" />
                            <span>{u.username}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--body)]">
                            {u.roles?.map((r) => (
                              <span
                                key={r}
                                className="inline-block px-1.5 py-0.5 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] mr-1"
                              >
                                {r}
                              </span>
                            ))}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                u.enabled !== false
                                  ? "bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)]"
                                  : "bg-[#ef4444]/15 text-[#ef4444]"
                              }`}
                            >
                              {u.enabled !== false ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <form action={studioMutationAction} className="inline-block">
                              <input type="hidden" name="action" value="deleteUser" />
                              <input type="hidden" name="userId" value={userId} />
                              <button
                                type="submit"
                                title="Delete User"
                                className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444] transition"
                              >
                                <Trash2Icon size={13} />
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 2. ROLES SUBSECTION */}
        {subSection === "roles" && (
          isLoading && roles.length === 0 ? (
            <TableSkeletonWidget
              columns={3}
              rows={4}
              message="Loading RBAC roles and permissions..."
            />
          ) : (
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
                  <tr>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Role Name
                    </th>
                    <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Permission Grants
                    </th>
                    <th className="px-4 py-2.5 text-center font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {roles.length === 0 ? (
                    <tr key="empty-roles">
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--muted)]">
                        No custom roles created yet.
                      </td>
                    </tr>
                  ) : (
                    roles.map((r, idx) => {
                      const roleId = r.id || r.name || `role-${idx}`;
                      return (
                        <tr key={roleId} className="hover:bg-[var(--surface-strong)] transition">
                          <td className="px-4 py-3 font-bold text-[var(--ink)] flex items-center gap-2">
                            <ShieldIcon size={13} className="text-[#a855f7]" />
                            <span>{r.name}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--body)]">
                            <div className="flex flex-wrap gap-1 max-w-lg">
                              {r.grants?.map((g, i) => (
                                <span
                                  key={`${roleId}-grant-${i}-${g.permission}`}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[var(--ink)]"
                                >
                                  {g.permission}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <form action={studioMutationAction} className="inline-block">
                              <input type="hidden" name="action" value="deleteRole" />
                              <input type="hidden" name="roleId" value={roleId} />
                              <button
                                type="submit"
                                title="Delete Role"
                                className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444] transition"
                              >
                                <Trash2Icon size={13} />
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 3. BACKUPS SUBSECTION (DISABLED) */}
        {subSection === "backups" && (
          <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center flex flex-col items-center justify-center space-y-3 font-sans shadow-xs">
            <div className="w-12 h-12 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] flex items-center justify-center text-[var(--muted)]">
              <ArchiveIcon size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--ink)]">Backup Management Disabled</h3>
              <p className="text-xs text-[var(--muted)] max-w-md">
                The backup tab and options are temporarily disabled. We will bring this feature back in a future update!
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
              Coming in future
            </span>
          </div>
        )}

        {/* 4. SETTINGS SUBSECTION */}
        {subSection === "settings" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-[var(--hairline)] pb-2">
              {[
                { id: "general", label: "General" },
                { id: "cors", label: "CORS Rules" },
                { id: "performance", label: "Performance" },
                { id: "limits", label: "Limits & Caps" },
                { id: "backups", label: "Backup Policy (Disabled)", disabled: true },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={p.disabled}
                  title={
                    p.disabled
                      ? "Backup configuration is disabled. We will bring this feature in a future update."
                      : undefined
                  }
                  onClick={() => {
                    if (p.disabled) return;
                    const newPane = p.id as typeof settingsPane;
                    setSettingsPane(newPane);
                    updateTabState(tab.id, {
                      adminState: {
                        subSection,
                        settingsPane: newPane,
                      },
                    });
                  }}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition ${
                    p.disabled
                      ? "opacity-40 cursor-not-allowed hover:bg-transparent text-[var(--muted)]"
                      : settingsPane === p.id
                      ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-xs"
                      : "text-[var(--body)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="p-5 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs">
              <h3 className="font-sans text-sm font-bold text-[var(--ink)] mb-2 capitalize">
                {settingsPane} Configuration
              </h3>
              <p className="text-xs text-[var(--muted)] mb-4">
                Update server parameters live. Changes are applied directly via the authenticated admin channel.
              </p>

              {settingsPane === "general" && (
                <form action={studioMutationAction} className="space-y-4">
                  <input type="hidden" name="action" value="updateSettingsGui" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                        Node Cluster Label
                      </label>
                      <input
                        name="setting__cluster_label"
                        defaultValue="production_node_1"
                        className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary h-8 px-4 text-xs font-semibold">
                    Save General Settings
                  </button>
                </form>
              )}

              {settingsPane === "cors" && (
                <form action={studioMutationAction} className="space-y-4">
                  <input type="hidden" name="action" value="updateCorsGui" />
                  <div className="space-y-3 text-xs font-mono">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                        Allowed Origins (One per line or comma-separated)
                      </label>
                      <textarea
                        name="allowed_origins"
                        defaultValue="*"
                        rows={3}
                        className="w-full p-2 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary h-8 px-4 text-xs font-semibold">
                    Save CORS Rules
                  </button>
                </form>
              )}

              {settingsPane === "performance" && (
                <form action={studioMutationAction} className="space-y-4">
                  <input type="hidden" name="action" value="updatePerformanceGui" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Controller Interval (ms)
                      </label>
                      <input
                        name="controller_interval_ms"
                        type="number"
                        defaultValue={100}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Query Parallelism Cap
                      </label>
                      <input
                        name="query_parallelism_cap"
                        type="number"
                        defaultValue={8}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Result Batch Size
                      </label>
                      <input
                        name="result_batch_size"
                        type="number"
                        defaultValue={100}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary h-8 px-4 text-xs font-semibold">
                    Save Performance Configuration
                  </button>
                </form>
              )}

              {settingsPane === "limits" && (
                <form action={studioMutationAction} className="space-y-4">
                  <input type="hidden" name="action" value="updateLimitsGui" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Max Reads / Sec
                      </label>
                      <input
                        name="server_max_reads_per_second"
                        type="number"
                        defaultValue={10000}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Max Writes / Sec
                      </label>
                      <input
                        name="server_max_writes_per_second"
                        type="number"
                        defaultValue={5000}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--muted)] mb-1">
                        Max Concurrent Requests
                      </label>
                      <input
                        name="server_max_concurrent_requests"
                        type="number"
                        defaultValue={256}
                        className="w-full h-8 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary h-8 px-4 text-xs font-semibold">
                    Save Limit Configuration
                  </button>
                </form>
              )}

              {settingsPane === "backups" && (
                <div className="p-8 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] text-center space-y-2 font-sans">
                  <div className="text-xs font-bold text-[var(--ink)]">Backup Configuration Disabled</div>
                  <p className="text-[11px] text-[var(--muted)] max-w-sm mx-auto">
                    The backup option is currently disabled. We will bring this feature back in a future update!
                  </p>
                  <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
                    Coming in future
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">Create User Account</h3>
            <form action={studioMutationAction} className="space-y-3 text-xs">
              <input type="hidden" name="action" value="createUser" />
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Username *
                </label>
                <input
                  name="username"
                  required
                  autoFocus
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Password *
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Roles (comma-separated)
                </label>
                <input
                  name="roles"
                  defaultValue="readWrite"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary h-8 px-3 text-xs">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">Create Granular Role</h3>
            <form action={studioMutationAction} className="space-y-3 text-xs">
              <input type="hidden" name="action" value="createRole" />
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Role Name *
                </label>
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="e.g. readAnalytics"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Permission Grants (JSON Array) *
                </label>
                <textarea
                  name="grants"
                  rows={5}
                  required
                  defaultValue={JSON.stringify(
                    [{ permission: "read", scope: { scope_type: "Global" } }],
                    null,
                    2,
                  )}
                  className="w-full p-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none resize-none leading-5"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary h-8 px-3 text-xs">
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Take Backup Modal */}
      {showCreateBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">Take Cluster Node Backup</h3>

            {/* Manual Backups Quota Indicator */}
            <div
              className={`p-2.5 rounded-[6px] text-xs font-mono ${
                isLimitReached
                  ? "bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]"
                  : "bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[var(--body)]"
              }`}
            >
              <div className="flex items-center justify-between font-bold mb-1">
                <span>Manual Backups Quota:</span>
                <span>
                  {manualBackups.length} / {maxManualBackups}
                </span>
              </div>
              {isLimitReached ? (
                <p className="text-[11px] leading-tight font-sans">
                  You have reached the maximum quota of {maxManualBackups} manual backups (excluding automatic backups). Please delete an older manual backup or increase the limit in Backup Policy.
                </p>
              ) : (
                <p className="text-[10px] text-[var(--muted)] leading-tight">
                  {maxManualBackups - manualBackups.length} slots remaining (automatic daily &amp; weekly backups do not count toward this limit).
                </p>
              )}
            </div>

            <form
              action={async (formData) => {
                await studioMutationAction(formData);
                setShowCreateBackupModal(false);
                loadSectionData();
              }}
              className="space-y-3 text-xs"
            >
              <input type="hidden" name="action" value="createBackup" />
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Backup Label (Optional)
                </label>
                <input
                  name="label"
                  autoFocus
                  disabled={isLimitReached}
                  placeholder="e.g. pre-migration-snapshot"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBackupModal(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLimitReached}
                  className="btn-primary h-8 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup Policy & Schedules Modal */}
      {showBackupPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto editor-scroll">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--hairline)]">
              <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <SlidersIcon size={16} className="text-[var(--text-link)]" />
                <span>Automated Backup Schedules (IST)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBackupPolicyModal(false)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Close
              </button>
            </div>

            <form
              action={async (formData) => {
                await studioMutationAction(formData);
                setShowBackupPolicyModal(false);
                loadSectionData();
              }}
              className="space-y-4 text-xs font-mono"
            >
              <input type="hidden" name="action" value="updateBackupSettingsGui" />
              <input type="hidden" name="compression_level" value="6" />
              <input type="hidden" name="verify_after_create" value="true" />
              <input type="hidden" name="require_cluster_complete" value="false" />
              <input type="hidden" name="hourly_enabled" value="false" />
              <input type="hidden" name="hourly_hour" value="0" />
              <input type="hidden" name="hourly_minute" value="0" />
              <input type="hidden" name="hourly_timezone" value="IST" />
              <input type="hidden" name="monthly_enabled" value="false" />
              <input type="hidden" name="monthly_hour" value="0" />
              <input type="hidden" name="monthly_minute" value="0" />
              <input type="hidden" name="monthly_timezone" value="IST" />
              <input type="hidden" name="keep_hourly" value="0" />
              <input type="hidden" name="keep_weekly" value="1" />
              <input type="hidden" name="keep_monthly" value="0" />

              {/* Policy Rules Notice (Non-editable system rules) */}
              <div className="p-3 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span>Cluster Backup Policy</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
                    System Enforced
                  </span>
                </div>
                <div className="text-[11px] text-[var(--muted)] space-y-0.5">
                  <div>• <strong>Manual Backups:</strong> Fixed max 10 snapshots ({manualBackups.length}/10 taken, automated excluded)</div>
                  <div>• <strong>Retention:</strong> Fixed max 3 days per backup</div>
                </div>
              </div>

              {/* 1. Automated Daily Backup (IST) */}
              <div className="p-3 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-sans font-bold text-xs text-[var(--ink)]">
                    <input
                      type="checkbox"
                      name="daily_enabled"
                      defaultChecked={backupSettings?.daily?.enabled ?? false}
                      className="rounded accent-black"
                    />
                    <span>Enable Automated Daily Backup</span>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
                    Daily Schedule (IST)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] mb-1">Execution Hour (0-23 IST)</label>
                    <input
                      name="daily_hour"
                      type="number"
                      min="0"
                      max="23"
                      defaultValue={backupSettings?.daily?.hour ?? 2}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] mb-1">Execution Minute (0-59)</label>
                    <input
                      name="daily_minute"
                      type="number"
                      min="0"
                      max="59"
                      defaultValue={backupSettings?.daily?.minute ?? 0}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>
                </div>
                <input type="hidden" name="daily_timezone" value="IST" />
              </div>

              {/* 2. Automated Weekly Backup (IST) */}
              <div className="p-3 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-sans font-bold text-xs text-[var(--ink)]">
                    <input
                      type="checkbox"
                      name="weekly_enabled"
                      defaultChecked={backupSettings?.weekly?.enabled ?? false}
                      className="rounded accent-black"
                    />
                    <span>Enable Automated Weekly Backup</span>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
                    Weekly Schedule (IST)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] mb-1">Day of Week</label>
                    <select
                      name="weekly_weekday"
                      defaultValue={backupSettings?.weekly?.weekday ?? 0}
                      className="w-full h-8 px-2 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)] focus:outline-none"
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] mb-1">Hour (0-23 IST)</label>
                    <input
                      name="weekly_hour"
                      type="number"
                      min="0"
                      max="23"
                      defaultValue={backupSettings?.weekly?.hour ?? 3}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] mb-1">Minute (0-59)</label>
                    <input
                      name="weekly_minute"
                      type="number"
                      min="0"
                      max="59"
                      defaultValue={backupSettings?.weekly?.minute ?? 0}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>
                </div>
                <input type="hidden" name="weekly_timezone" value="IST" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBackupPolicyModal(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary h-8 px-3 text-xs font-semibold">
                  Save Schedules (IST)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
