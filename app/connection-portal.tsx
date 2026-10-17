"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "@/lib/lucide";
import { autoConnectAction } from "./actions";
import { clearWorkspaceState } from "@/lib/studio/workspace-storage";
import { decodeConnectionParam } from "@/lib/studio/url-utils";

export { decodeConnectionParam };

export interface SavedConnection {
  id: string;
  name: string;
  uri: string;
  createdAt: number;
  lastUsedAt?: number;
}

const INITIAL_DEFAULT_CONNECTIONS: SavedConnection[] = [
  {
    id: "conn_cloud_prod",
    name: "Production Cluster (Cloud)",
    uri: "liorandb://admin:password@swaraj.db.liorandb.com:443/default",
    createdAt: 1731300000000,
    lastUsedAt: 1731310000000,
  },
  {
    id: "conn_staging_replica",
    name: "Staging Replica (Raft Follower)",
    uri: "liorandb://operator:secretKey99@staging.db.liorandb.com:443/staging",
    createdAt: 1731305000000,
  },
  {
    id: "conn_local_daemon",
    name: "Local Development Daemon",
    uri: "liorandb://root:localPass@127.0.0.1:8765/dev",
    createdAt: 1731308000000,
  },
];

const STORAGE_KEY = "liorandb_studio_saved_connections_v2";
const LEGACY_STORAGE_KEYS = [
  "liorandb_studio_saved_connections",
  "liorandb_studio_saved_connections_v1",
];

function subscribeConnections(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("liorandb_connections_update", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("liorandb_connections_update", callback);
  };
}

function getConnectionsSnapshot(): string {
  if (typeof window === "undefined") {
    return JSON.stringify(INITIAL_DEFAULT_CONNECTIONS);
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    try {
      const initialJson = JSON.stringify(INITIAL_DEFAULT_CONNECTIONS);
      window.localStorage.setItem(STORAGE_KEY, initialJson);
      return initialJson;
    } catch {
      return JSON.stringify(INITIAL_DEFAULT_CONNECTIONS);
    }
  }
  return raw;
}

function getServerConnectionsSnapshot(): string {
  return JSON.stringify(INITIAL_DEFAULT_CONNECTIONS);
}

function maskConnectionString(uri: string): string {
  try {
    const schemeMatch = uri.match(/^([a-zA-Z0-9+.-]+:\/\/)/);
    if (!schemeMatch) return uri;
    const afterScheme = uri.slice(schemeMatch[0].length);
    const pathIdx = afterScheme.search(/[\/?#]/);
    const authority = pathIdx >= 0 ? afterScheme.slice(0, pathIdx) : afterScheme;
    const pathPart = pathIdx >= 0 ? afterScheme.slice(pathIdx) : "";
    const atIdx = authority.lastIndexOf("@");
    if (atIdx < 0) return uri;
    const userinfo = authority.slice(0, atIdx);
    const hostport = authority.slice(atIdx + 1);
    const colonIdx = userinfo.indexOf(":");
    const username = colonIdx >= 0 ? userinfo.slice(0, colonIdx) : userinfo;
    const maskedUserinfo = username ? `${username}:••••••••` : "••••••••";
    return `${schemeMatch[1]}${maskedUserinfo}@${hostport}${pathPart}`;
  } catch {
    return uri;
  }
}

function parseHostAndDb(uri: string): { host: string; port: string; db: string } {
  try {
    const schemeMatch = uri.match(/^([a-zA-Z0-9+.-]+):\/\//);
    if (!schemeMatch) return { host: "unknown", port: "443", db: "default" };
    const afterScheme = uri.slice(schemeMatch[0].length);
    const pathIdx = afterScheme.search(/[\/?#]/);
    const authority = pathIdx >= 0 ? afterScheme.slice(0, pathIdx) : afterScheme;
    const pathPart = pathIdx >= 0 ? afterScheme.slice(pathIdx) : "";
    const atIdx = authority.lastIndexOf("@");
    const hostport = atIdx >= 0 ? authority.slice(atIdx + 1) : authority;
    const portMatch = hostport.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "443";
    const host = portMatch ? hostport.slice(0, portMatch.index) : hostport;
    const dbMatch = pathPart.match(/^\/([^?#]*)/);
    const db = dbMatch && dbMatch[1] ? dbMatch[1] : "default";
    return { host: host || "unknown", port, db };
  } catch {
    return { host: "unknown", port: "443", db: "default" };
  }
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function renderColoredUri(uri: string, isRevealed: boolean) {
  const display = isRevealed ? uri : maskConnectionString(uri);
  const match = display.match(/^([a-zA-Z0-9+.-]+:\/\/)(?:([^@]+)@)?([^/:?#]+)(?::(\d+))?(?:\/(.*))?$/);
  if (!match) {
    return <span className="text-[#0d74ce] font-medium">{display}</span>;
  }
  const [, scheme, userPass, host, port, db] = match;
  return (
    <span>
      <span className="text-[#0d74ce] font-semibold">{scheme}</span>
      {userPass && (
        <>
          <span className="text-[#8145b5] font-medium">{userPass}</span>
          <span className="text-[var(--muted)]">@</span>
        </>
      )}
      <span className="text-[var(--ink)] font-semibold">{host}</span>
      {port && (
        <>
          <span className="text-[var(--muted)]">:</span>
          <span className="text-[#ab6400] font-semibold">{port}</span>
        </>
      )}
      {db !== undefined && (
        <>
          <span className="text-[var(--muted)]">/</span>
          <span className="text-[#dc2626] font-medium">{db}</span>
        </>
      )}
    </span>
  );
}

export function persistAndActivateConnection(uri: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let currentList: SavedConnection[] = INITIAL_DEFAULT_CONNECTIONS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) currentList = parsed;
      } catch {}
    }

    const existingIndex = currentList.findIndex((c) => c.uri === uri);
    let updated: SavedConnection[];
    if (existingIndex >= 0) {
      updated = currentList.map((c, i) =>
        i === existingIndex ? { ...c, lastUsedAt: Date.now() } : c
      );
    } else {
      const parsed = parseHostAndDb(uri);
      const newEntry: SavedConnection = {
        id: `conn_auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `Connection (${parsed.host})`,
        uri,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };
      updated = [newEntry, ...currentList];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    LEGACY_STORAGE_KEYS.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    });
    window.dispatchEvent(new Event("liorandb_connections_update"));
  } catch (e) {
    console.error("Failed to persist auto-connection:", e);
  }
}

interface ConnectionPortalProps {
  connectAction: (formData: FormData) => Promise<void>;
  errorMessage?: string;
  autoConnectParam?: string;
}

export function ConnectionPortal({
  connectAction,
  errorMessage,
  autoConnectParam,
}: ConnectionPortalProps) {
  const storedJson = useSyncExternalStore(
    subscribeConnections,
    getConnectionsSnapshot,
    getServerConnectionsSnapshot
  );

  const connections = useMemo<SavedConnection[]>(() => {
    if (!storedJson) {
      return INITIAL_DEFAULT_CONNECTIONS;
    }
    try {
      const parsed = JSON.parse(storedJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return INITIAL_DEFAULT_CONNECTIONS;
    } catch {
      return INITIAL_DEFAULT_CONNECTIONS;
    }
  }, [storedJson]);

  // Active view: "saved" | "direct"
  const [activeTab, setActiveTab] = useState<"saved" | "direct">("saved");

  // Filter query for saved connections
  const [filterQuery, setFilterQuery] = useState("");

  // Editor modal/inline state
  const [editingItem, setEditingItem] = useState<SavedConnection | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorName, setEditorName] = useState("");
  const [editorUri, setEditorUri] = useState("");
  const [editorError, setEditorError] = useState("");

  // Direct connection input state
  const [directUri, setDirectUri] = useState(
    "liorandb://admin:password@swaraj.db.liorandb.com:443/default"
  );
  const [saveDirectProfile, setSaveDirectProfile] = useState(true);
  const [directProfileName, setDirectProfileName] = useState("");
  const [showDirectPassword, setShowDirectPassword] = useState(false);

  // Reveal map for masked passwords: { [id]: boolean }
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Copied indicator: { [id]: boolean }
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-connect lifecycle states
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [autoConnectStatus, setAutoConnectStatus] = useState<string | null>(null);
  const [autoConnectError, setAutoConnectError] = useState<string | null>(null);
  const [lastAttemptedUri, setLastAttemptedUri] = useState<string | null>(null);
  const hasHandledAutoConnectRef = useRef<boolean>(false);

  // Hidden form submission ref for instant connect
  const submitFormRef = useRef<HTMLFormElement | null>(null);
  const hiddenUriInputRef = useRef<HTMLInputElement | null>(null);

  const performAutoConnect = async (rawTarget: string) => {
    const decodedUri = decodeConnectionParam(rawTarget);
    setLastAttemptedUri(decodedUri);
    setIsAutoConnecting(true);
    setAutoConnectStatus("Sanitizing address bar and clearing old workspace state...");
    setAutoConnectError(null);

    // 1. Immediately clean address bar if not already cleaned
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("connection")) {
        currentUrl.searchParams.delete("connection");
        window.history.replaceState(
          null,
          "",
          currentUrl.pathname + (currentUrl.search ? currentUrl.search : "") + currentUrl.hash,
        );
      }
    } catch {}

    // 2. Clear client-side workspace state (tabs, cached metadata)
    clearWorkspaceState();

    setAutoConnectStatus("Connecting to cluster and establishing session...");

    try {
      const res = await autoConnectAction({ connectionUri: decodedUri });
      if (!res.ok) {
        setIsAutoConnecting(false);
        setAutoConnectStatus(null);
        setAutoConnectError(res.error || "Failed to establish database connection.");
        return;
      }

      // 3. Persist to saved connections and mark active
      persistAndActivateConnection(decodedUri);
      setAutoConnectStatus("Connected! Initializing Studio...");

      // 4. Navigate cleanly to "/"
      window.location.replace("/");
    } catch (err: unknown) {
      setIsAutoConnecting(false);
      setAutoConnectStatus(null);
      const msg = err instanceof Error ? err.message : String(err);
      setAutoConnectError(msg || "An unexpected error occurred during connection.");
    }
  };

  useEffect(() => {
    if (hasHandledAutoConnectRef.current) return;

    let targetRaw: string | null = null;
    if (typeof window !== "undefined") {
      const windowObj = window as Window & { __liorandb_auto_conn?: string };
      if (windowObj.__liorandb_auto_conn) {
        targetRaw = windowObj.__liorandb_auto_conn;
        delete windowObj.__liorandb_auto_conn;
      }

      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has("connection")) {
          const p = currentUrl.searchParams.get("connection");
          if (p) targetRaw = p;
          currentUrl.searchParams.delete("connection");
          window.history.replaceState(
            null,
            "",
            currentUrl.pathname + (currentUrl.search ? currentUrl.search : "") + currentUrl.hash,
          );
        }
      } catch {}
    }

    if (!targetRaw && autoConnectParam) {
      targetRaw = autoConnectParam;
    }

    if (targetRaw && targetRaw.trim()) {
      hasHandledAutoConnectRef.current = true;
      void performAutoConnect(targetRaw);
    }
  }, [autoConnectParam]);

  const directUriInputId = useId();
  const directProfileNameId = useId();

  // Save changes to localStorage
  const persistConnections = (updated: SavedConnection[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      LEGACY_STORAGE_KEYS.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {}
      });
      window.dispatchEvent(new Event("liorandb_connections_update"));
    } catch (e) {
      console.error("Failed to persist saved connections:", e);
    }
  };

  // Immediate connect handler
  const handleConnectWithUri = (uri: string, idToMarkUsed?: string) => {
    if (idToMarkUsed) {
      const updated = connections.map((c) =>
        c.id === idToMarkUsed ? { ...c, lastUsedAt: Date.now() } : c
      );
      persistConnections(updated);
    }

    if (hiddenUriInputRef.current && submitFormRef.current) {
      hiddenUriInputRef.current.value = uri;
      submitFormRef.current.requestSubmit();
    }
  };

  // Direct form submit handler
  const handleDirectFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!directUri.trim()) {
      e.preventDefault();
      return;
    }

    if (saveDirectProfile) {
      const trimmedUri = directUri.trim();
      const existing = connections.find((c) => c.uri === trimmedUri);
      if (!existing) {
        const newConnection: SavedConnection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name:
            directProfileName.trim() ||
            `Connection (${parseHostAndDb(trimmedUri).host})`,
          uri: trimmedUri,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
        };
        persistConnections([newConnection, ...connections]);
      } else {
        const updated = connections.map((c) =>
          c.id === existing.id ? { ...c, lastUsedAt: Date.now() } : c
        );
        persistConnections(updated);
      }
    }
  };

  // Start editing a profile
  const handleStartEdit = (conn: SavedConnection) => {
    setEditingItem(conn);
    setEditorName(conn.name);
    setEditorUri(conn.uri);
    setEditorError("");
    setIsCreatingNew(false);
  };

  // Start creating a new profile
  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setEditingItem(null);
    setEditorName("");
    setEditorUri("");
    setEditorError("");
  };

  // Cancel edit/create
  const handleCancelEditor = () => {
    setIsCreatingNew(false);
    setEditingItem(null);
    setEditorError("");
  };

  // Save edit/create
  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUri = editorUri.trim();
    const trimmedName = editorName.trim();

    if (!trimmedUri) {
      setEditorError("Connection URI cannot be empty.");
      return;
    }

    if (!trimmedUri.startsWith("liorandb://")) {
      setEditorError("URI must begin with liorandb:// protocol scheme.");
      return;
    }

    if (editingItem) {
      // Update existing
      const updated = connections.map((c) =>
        c.id === editingItem.id
          ? {
              ...c,
              name: trimmedName || editingItem.name,
              uri: trimmedUri,
            }
          : c
      );
      persistConnections(updated);
    } else {
      // Create new
      const newConn: SavedConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName || `Connection (${parseHostAndDb(trimmedUri).host})`,
        uri: trimmedUri,
        createdAt: Date.now(),
      };
      persistConnections([newConn, ...connections]);
    }

    handleCancelEditor();
  };

  // Delete a profile
  const handleDelete = (id: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(`Delete saved connection profile "${name}"?`)
    ) {
      const updated = connections.filter((c) => c.id !== id);
      persistConnections(updated);
    }
  };

  // Delete all profiles
  const handleClearAllProfiles = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete all ${connections.length} saved connection profiles? This action cannot be undone.`
      )
    ) {
      persistConnections([]);
      setFilterQuery("");
    }
  };

  // Copy URI to clipboard
  const handleCopyUri = (id: string, uri: string) => {
    navigator.clipboard.writeText(uri).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Filter connections
  const filteredConnections = connections.filter((conn) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      conn.name.toLowerCase().includes(q) ||
      conn.uri.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 sm:p-10 shadow-sm">
      {/* Hidden form for instant programmatic connection */}
      <form
        ref={submitFormRef}
        action={connectAction}
        className="hidden"
        suppressHydrationWarning
      >
        <input
          ref={hiddenUriInputRef}
          type="hidden"
          name="connectionUri"
          value=""
        />
      </form>
      {isAutoConnecting ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent mb-4" />
          <h3 className="text-base font-semibold text-[var(--ink)]">
            Connecting to LioranDB...
          </h3>
          <p className="mt-2 text-xs text-[var(--body)] font-mono">
            {autoConnectStatus || "Validating credentials and establishing cluster session..."}
          </p>
        </div>
      ) : (
        <>
          {/* Automatic Connection Error Notice */}
          {autoConnectError && (
            <div className="mb-6 rounded-[8px] border border-[var(--semantic-error)] bg-[var(--semantic-error)]/10 p-4">
              <div className="flex items-start gap-3">
                <span className="font-bold text-[var(--semantic-error)] text-base leading-none mt-0.5">[!]</span>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-[var(--semantic-error)] mb-1">
                    Automatic Connection Failed
                  </div>
                  <div className="text-[var(--ink)] font-mono mb-3 break-all">
                    {autoConnectError}
                  </div>
                  <div className="flex items-center gap-3">
                    {lastAttemptedUri && (
                      <button
                        type="button"
                        onClick={() => {
                          if (lastAttemptedUri) {
                            void performAutoConnect(lastAttemptedUri);
                          }
                        }}
                        className="btn-primary text-xs h-7 px-3"
                      >
                        Retry Auto-Connection
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAutoConnectError(null)}
                      className="btn-secondary text-xs h-7 px-3"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card Header & Controls */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div>
          <h2 className="font-sans text-[24px] sm:text-[28px] font-semibold tracking-[-0.84px] text-[var(--ink)]">
            Connect to LioranDB Instance
          </h2>
          <p className="mt-1 text-sm text-[var(--body)]">
            Select a saved connection profile, manage your cluster endpoints, or enter a direct connection URI.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-[8px] bg-[var(--surface-strong)] p-1 border border-[var(--hairline)]">
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "saved"
                ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm font-semibold"
                : "text-[var(--body)] hover:text-[var(--ink)]"
            }`}
          >
            Saved Profiles ({connections.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "direct"
                ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm font-semibold"
                : "text-[var(--body)] hover:text-[var(--ink)]"
            }`}
          >
            Direct Connect
          </button>
        </div>
      </div>

      {/* Global Error Notice if redirected with ?error= */}
      {errorMessage ? (
        <div className="mb-6 space-y-3">
          <div className="rounded-[8px] border border-[var(--semantic-error)] bg-[var(--semantic-error)]/10 p-4 font-mono text-xs text-[var(--semantic-error)]">
            <span className="font-bold mr-2">[ERROR]</span>
            {errorMessage}
          </div>

          {errorMessage.includes("Local database detected") ? (
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-strong)] p-4 text-xs text-[var(--ink)]">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <TerminalIcon size={14} />
                <span>How to connect a local database</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--body)]">
                Hosted Studio cannot connect directly to loopback on your workstation. Run Studio locally:
              </p>
              <div className="mt-2.5 flex items-center justify-between rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 font-mono text-xs">
                <code>liorandb studio</code>
                <span className="text-[11px] text-[var(--muted)]">or npm run dev</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* TAB 1: SAVED CONNECTIONS MANAGER */}
      {activeTab === "saved" && (
        <div className="space-y-6">
          {/* Top Action Bar: Search & Profile Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3.5 flex items-center text-[var(--muted)] pointer-events-none z-10">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Filter saved profiles by name or host..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setFilterQuery("");
                }}
                style={{
                  paddingLeft: "2.5rem",
                  paddingRight: filterQuery ? "2.5rem" : "1rem",
                }}
                className="expo-input !pl-10 text-xs"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  title="Clear filter (Esc)"
                  aria-label="Clear filter"
                  className="absolute inset-y-0 right-3 flex items-center text-[var(--muted)] hover:text-[var(--ink)] transition p-1"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {connections.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllProfiles}
                  className="btn-secondary text-xs h-[44px] text-[var(--muted)] hover:text-[var(--semantic-error)] hover:border-[var(--semantic-error)] transition"
                  title="Delete all saved connection profiles"
                >
                  <Trash2Icon size={14} />
                  <span>Clear All</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStartCreate}
                className="btn-primary h-[44px] shrink-0"
              >
                <PlusIcon size={14} />
                <span>Add New Profile</span>
              </button>
            </div>
          </div>

          {/* Inline Create / Edit Modal / Form */}
          {(isCreatingNew || editingItem) && (
            <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <DatabaseIcon size={16} className="text-[var(--ink)]" />
                  <span className="font-sans text-sm font-semibold text-[var(--ink)]">
                    {editingItem ? `Edit Profile: ${editingItem.name}` : "Save New Connection Profile"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditor}
                  className="rounded-[6px] p-1 text-[var(--muted)] hover:text-[var(--ink)] transition"
                >
                  <XIcon size={14} />
                </button>
              </div>

              {editorError && (
                <div className="mb-4 rounded-[6px] border border-[var(--semantic-error)] bg-[var(--semantic-error)]/10 p-2.5 font-mono text-xs text-[var(--semantic-error)]">
                  {editorError}
                </div>
              )}

              <form onSubmit={handleSaveEditor} className="space-y-4">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-[var(--ink)]">
                    Profile Name / Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Cluster, Analytics Staging, Local Node"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    className="expo-input text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-[var(--ink)]">
                    Connection URI
                  </label>
                  <input
                    type="text"
                    placeholder="liorandb://username:password@host:port/database"
                    value={editorUri}
                    onChange={(e) => setEditorUri(e.target.value)}
                    className="expo-input font-mono text-xs"
                    required
                  />
                  <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                    Format: <code>liorandb://user:pass@host:port/database</code>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditor}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingItem ? "Save Changes" : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Saved Connection Cards */}
          <div className="space-y-3">
            {filteredConnections.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-8 text-center">
                <DatabaseIcon size={24} className="mx-auto text-[var(--muted)]" />
                <h3 className="mt-2 font-sans text-sm font-semibold text-[var(--ink)]">
                  No connection profiles found
                </h3>
                <p className="mt-1 text-xs text-[var(--body)]">
                  {filterQuery
                    ? `No profiles matched "${filterQuery}". Clear the search or add a new profile.`
                    : "You haven't saved any connection profiles yet."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  {filterQuery ? (
                    <button
                      type="button"
                      onClick={() => setFilterQuery("")}
                      className="btn-secondary text-xs"
                    >
                      Clear Filter
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => persistConnections(INITIAL_DEFAULT_CONNECTIONS)}
                      className="btn-secondary text-xs"
                    >
                      Load Sample Profiles
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="btn-primary text-xs"
                  >
                    + Add Profile
                  </button>
                </div>
              </div>
            ) : (
              filteredConnections.map((conn) => {
                const parsed = parseHostAndDb(conn.uri);
                const isRevealed = !!revealedIds[conn.id];
                const isCopied = copiedId === conn.id;

                return (
                  <div
                    key={conn.id}
                    className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4 transition hover:border-[var(--ink)] hover:shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-sm font-semibold text-[var(--ink)]">
                            {conn.name}
                          </span>
                          <span className="badge-pill">
                            {parsed.host}:{parsed.port}
                          </span>
                          {parsed.db && (
                            <span className="text-[11px] font-mono text-[var(--muted)]">
                              /{parsed.db}
                            </span>
                          )}
                        </div>
                        {conn.lastUsedAt && (
                          <div
                            className="mt-1 font-mono text-[11px] text-[var(--muted)]"
                            suppressHydrationWarning
                          >
                            Last connected: {formatTimestamp(conn.lastUsedAt)}
                          </div>
                        )}
                      </div>

                      {/* Primary Actions: Connect, Edit, Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConnectWithUri(conn.uri, conn.id)}
                          className="btn-primary text-xs h-[36px]"
                          title="Connect to this database now"
                        >
                          <span>Connect</span>
                          <ArrowRightIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(conn)}
                          className="flex items-center justify-center h-[36px] w-[36px] rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
                          title="Edit connection profile"
                        >
                          <PencilIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(conn.id, conn.name)}
                          className="flex items-center justify-center h-[36px] w-[36px] rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)] hover:text-[var(--semantic-error)] transition"
                          title="Delete saved connection profile"
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    </div>

                    {/* URI Bar with Reveal & Copy Controls */}
                    <div className="flex items-center justify-between gap-2 rounded-[6px] border border-[var(--hairline)] bg-[var(--canvas-soft)] px-3 py-2 font-mono text-xs">
                      <div className="truncate select-all">
                        {renderColoredUri(conn.uri, isRevealed)}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[var(--muted)]">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedIds((prev) => ({
                              ...prev,
                              [conn.id]: !prev[conn.id],
                            }))
                          }
                          className="p-1 hover:text-[var(--ink)] transition"
                          title={isRevealed ? "Hide credentials" : "Show full URI credentials"}
                        >
                          {isRevealed ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyUri(conn.id, conn.uri)}
                          className="p-1 hover:text-[var(--ink)] transition flex items-center gap-1"
                          title="Copy connection string"
                        >
                          {isCopied ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--semantic-success)]">
                              <CheckIcon size={12} />
                              <span>Copied</span>
                            </span>
                          ) : (
                            <CopyIcon size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDirectUri(conn.uri);
                            setDirectProfileName(conn.name);
                            setActiveTab("direct");
                          }}
                          className="btn-tertiary-text text-xs"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT MANUAL CONNECT FORM */}
      {activeTab === "direct" && (
        <form
          action={connectAction}
          onSubmit={handleDirectFormSubmit}
          className="space-y-5"
          suppressHydrationWarning
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-[var(--ink)]"
                htmlFor={directUriInputId}
              >
                Connection URI
              </label>
              <button
                type="button"
                onClick={() => setShowDirectPassword((prev) => !prev)}
                className="btn-tertiary-text text-xs"
              >
                {showDirectPassword ? (
                  <>
                    <EyeOffIcon size={12} />
                    <span>Mask password</span>
                  </>
                ) : (
                  <>
                    <EyeIcon size={12} />
                    <span>Reveal password</span>
                  </>
                )}
              </button>
            </div>
            <input
              id={directUriInputId}
              name="connectionUri"
              type={showDirectPassword ? "text" : "password"}
              value={directUri}
              onChange={(e) => setDirectUri(e.target.value)}
              placeholder="liorandb://admin:password@swaraj.db.liorandb.com:443/default"
              className="expo-input font-mono text-xs"
              required
              suppressHydrationWarning
            />
          </div>

          {/* Option to automatically save this connection */}
          <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-3.5 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveDirectProfile}
                onChange={(e) => setSaveDirectProfile(e.target.checked)}
                className="h-4 w-4 accent-black dark:accent-white rounded"
              />
              <span className="font-sans text-xs font-medium text-[var(--ink)]">
                Save this connection profile for future sessions
              </span>
            </label>

            {saveDirectProfile && (
              <div>
                <label
                  htmlFor={directProfileNameId}
                  className="block text-[11px] text-[var(--muted)] mb-1"
                >
                  Profile Label (Optional):
                </label>
                <input
                  id={directProfileNameId}
                  type="text"
                  placeholder="e.g. Primary Production Cluster, My Test Replica"
                  value={directProfileName}
                  onChange={(e) => setDirectProfileName(e.target.value)}
                  className="expo-input text-xs h-[36px]"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full h-[44px]"
            suppressHydrationWarning
          >
            <span>Connect to Studio</span>
            <ArrowRightIcon size={16} />
          </button>
        </form>
      )}
    </>
  )}

      {/* Default URI Format Help Guide */}
      <div className="mt-6 rounded-[8px] border border-[var(--hairline)] bg-[var(--canvas-soft)] p-3.5 text-xs text-[var(--body)]">
        <span className="font-semibold text-[var(--ink)]">Default format:</span>{" "}
        <code className="font-mono">liorandb://username:password@host:port/database</code>
        <div className="mt-1 text-[11px] text-[var(--muted)]">
          Database name is optional: <code className="font-mono">liorandb://username:password@host:port</code>
        </div>
      </div>
    </div>
  );
}
