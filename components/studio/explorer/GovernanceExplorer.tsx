"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { fetchAdminSectionDataAction } from "@/app/actions";
import type { UserRecord, RoleRecord } from "@liorandb/driver";
import {
  UsersIcon,
  ShieldIcon,
  PlusIcon,
  RefreshCwIcon,
  LockIcon,
} from "lucide-react";

export function GovernanceExplorer() {
  const { openAdminTab, initialContext } = useWorkspace();
  const [users, setUsers] = useState<readonly UserRecord[]>([]);
  const [roles, setRoles] = useState<readonly RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetchAdminSectionDataAction("users"),
        fetchAdminSectionDataAction("roles"),
      ]);
      if (usersRes.ok && usersRes.data?.users) {
        setUsers(usersRes.data.users as readonly UserRecord[]);
      }
      if (rolesRes.ok && rolesRes.data?.roles) {
        setRoles(rolesRes.data.roles as readonly RoleRecord[]);
      }
    } catch {
      // Ignore partial background errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(async () => {
      if (ignore) return;
      await loadData();
    });
    return () => {
      ignore = true;
    };
  }, [loadData]);

  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-4 overflow-y-auto sidebar-scroll">
      {/* Quick Access Tabs */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Governance Workspaces</span>
          <button
            type="button"
            onClick={loadData}
            title="Refresh Governance Data"
            className={`p-0.5 rounded text-[var(--muted)] hover:text-[var(--ink)] ${
              isLoading ? "animate-spin text-[var(--text-link)]" : ""
            }`}
          >
            <RefreshCwIcon size={11} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => openAdminTab("users")}
          className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center justify-between text-[var(--ink)] font-medium"
        >
          <div className="flex items-center gap-2">
            <UsersIcon size={14} className="text-[var(--text-link)] shrink-0" />
            <span>User Accounts</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openAdminTab("roles")}
          className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center justify-between text-[var(--ink)] font-medium"
        >
          <div className="flex items-center gap-2">
            <ShieldIcon size={14} className="text-[#a855f7] shrink-0" />
            <span>Roles &amp; RBAC Grants</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)]">
            {roles.length}
          </span>
        </button>
      </div>

      {/* Users Directory Tree */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>Users Directory</span>
          <button
            type="button"
            disabled
            title="User creation is disabled. Governance is currently view-only."
            className="flex items-center gap-0.5 text-[10px] text-[var(--muted)] opacity-50 cursor-not-allowed normal-case font-medium"
          >
            <PlusIcon size={10} />
            <span>Add</span>
          </button>
        </div>

        {users.length === 0 ? (
          <div className="p-2 text-[11px] text-[var(--muted)] italic">
            {isLoading ? "Loading users..." : "No users found"}
          </div>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => openAdminTab("users")}
              className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 truncate">
                <UsersIcon size={12} className="text-[var(--muted)] group-hover:text-[var(--ink)] shrink-0" />
                <span className="font-mono text-xs text-[var(--ink)] truncate">{u.username}</span>
              </div>
              <div className="flex items-center gap-1">
                {u.roles?.slice(0, 1).map((r) => (
                  <span
                    key={r}
                    className="text-[9px] font-mono px-1 py-0.2 rounded-[3px] bg-[var(--canvas-soft)] text-[var(--muted)] border border-[var(--hairline)]"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Roles & Permissions Tree */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          <span>RBAC Roles</span>
          <button
            type="button"
            disabled
            title="Role creation is disabled. Governance is currently view-only."
            className="flex items-center gap-0.5 text-[10px] text-[var(--muted)] opacity-50 cursor-not-allowed normal-case font-medium"
          >
            <PlusIcon size={10} />
            <span>Add</span>
          </button>
        </div>

        {roles.length === 0 ? (
          <div className="p-2 text-[11px] text-[var(--muted)] italic">
            {isLoading ? "Loading roles..." : "No roles found"}
          </div>
        ) : (
          roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openAdminTab("roles")}
              className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--surface-strong)] transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 truncate">
                <ShieldIcon size={12} className="text-[#a855f7] shrink-0" />
                <span className="font-mono text-xs text-[var(--ink)] truncate">{r.name}</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--muted)]">
                {r.grants?.length ?? 0} grants
              </span>
            </button>
          ))
        )}
      </div>

      {/* Active Principal Context */}
      <div className="p-2.5 rounded-[8px] bg-[var(--canvas-soft)] border border-[var(--hairline)] space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
          <LockIcon size={12} className="text-[var(--text-link)]" />
          <span>Security Context</span>
        </div>
        <div className="text-[10px] font-mono text-[var(--body)] space-y-0.5">
          <div>Principal: <strong className="text-[var(--ink)]">{initialContext.principal.username}</strong></div>
          <div>Encryption: <span className="text-[var(--ink)]">{initialContext.tls ? "TLS 1.3 Active" : "Plaintext"}</span></div>
          <div>Transport: <span className="text-[var(--ink)] font-semibold">{initialContext.transport}</span></div>
        </div>
      </div>
    </div>
  );
}
