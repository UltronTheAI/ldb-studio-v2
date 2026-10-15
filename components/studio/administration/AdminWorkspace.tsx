"use client";

import React, { useEffect, useState } from "react";
import type { StudioTab } from "@/lib/studio/workspace-types";
import { fetchAdminSectionDataAction, studioMutationAction } from "@/app/actions";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type { UserRecord, RoleRecord, BackupJobRecord } from "@liorandb/driver";
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
} from "lucide-react";
import { TableSkeletonWidget } from "../widgets/LoadingWidget";

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

  // Backup modal
  const [showCreateBackupModal, setShowCreateBackupModal] = useState(false);

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
            <button
              type="button"
              onClick={() => setShowCreateBackupModal(true)}
              className="btn-primary h-7 px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1"
            >
              <PlusIcon size={12} />
              <span>Take Backup</span>
            </button>
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
      <div className="flex-1 overflow-y-auto editor-scroll p-3 sm:p-6">
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
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-x-auto editor-scroll shadow-xs">
              <table className="w-full min-w-[500px] border-collapse text-left text-xs font-mono">
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
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-x-auto editor-scroll shadow-xs">
              <table className="w-full min-w-[500px] border-collapse text-left text-xs font-mono">
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

        {/* 3. BACKUPS SUBSECTION */}
        {subSection === "backups" && (
          isLoading && backups.length === 0 ? (
            <TableSkeletonWidget
              columns={4}
              rows={4}
              message="Loading backup repository and snapshots..."
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-x-auto editor-scroll shadow-xs">
                <table className="w-full min-w-[550px] border-collapse text-left text-xs font-mono">
                  <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
                    <tr>
                      <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                        Backup Label / ID
                      </th>
                      <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                        Created Timestamp
                      </th>
                      <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-center font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hairline)]">
                    {backups.length === 0 ? (
                      <tr key="empty-backups">
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                          No backups found.
                        </td>
                      </tr>
                    ) : (
                      backups.map((b, idx) => {
                        const backupId = b.backup_id || b.id || `backup-${idx}`;
                        const createdAt = b.created_at_ms || b.created_at_utc_ms;
                        return (
                          <tr key={backupId} className="hover:bg-[var(--surface-strong)] transition">
                            <td className="px-4 py-3 font-bold text-[var(--ink)] flex items-center gap-2">
                              <ArchiveIcon size={13} className="text-[#f59e0b]" />
                              <span>{b.label || backupId}</span>
                            </td>
                            <td className="px-4 py-3 text-[var(--body)]">
                              {createdAt ? new Date(createdAt).toLocaleString() : "Unknown"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)]">
                                {b.status || "Complete"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <form action={studioMutationAction} className="inline-block">
                                <input type="hidden" name="action" value="deleteBackup" />
                                <input type="hidden" name="backupId" value={backupId} />
                                <button
                                  type="submit"
                                  title="Delete Backup"
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
            </div>
          )
        )}

        {/* 4. SETTINGS SUBSECTION */}
        {subSection === "settings" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--hairline)] pb-2">
              {[
                { id: "general", label: "General" },
                { id: "cors", label: "CORS Rules" },
                { id: "performance", label: "Performance" },
                { id: "limits", label: "Limits & Caps" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const newPane = p.id as typeof settingsPane;
                    setSettingsPane(newPane);
                    updateTabState(tab.id, {
                      adminState: {
                        subSection,
                        settingsPane: newPane,
                      },
                    });
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-[6px] text-xs font-semibold transition ${
                    settingsPane === p.id
                      ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-xs"
                      : "text-[var(--body)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="p-3.5 sm:p-5 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
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
                    Save Resource Caps
                  </button>
                </form>
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
            <form action={studioMutationAction} className="space-y-3 text-xs">
              <input type="hidden" name="action" value="createBackup" />
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Backup Label (Optional)
                </label>
                <input
                  name="label"
                  autoFocus
                  placeholder="e.g. pre-migration-snapshot"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
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
                <button type="submit" className="btn-primary h-8 px-3 text-xs">
                  Create Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
