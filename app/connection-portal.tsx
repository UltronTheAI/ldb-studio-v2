"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

export interface SavedConnection {
  id: string;
  name: string;
  uri: string;
  createdAt: number;
  lastUsedAt?: number;
}

const STORAGE_KEY = "liorandb_studio_saved_connections_v2";

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
    return "";
  }
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerConnectionsSnapshot(): string {
  return "";
}

function maskConnectionString(uri: string): string {
  try {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:••••••••@");
  } catch {
    return uri;
  }
}

function parseHostAndDb(uri: string): { host: string; port: string; db: string } {
  try {
    const match = uri.match(/^[a-zA-Z0-9+.-]+:\/\/(?:[^@]+@)?([^/:?#]+)(?::(\d+))?(?:\/([^?#]*))?/);
    if (!match) {
      return { host: "unknown", port: "443", db: "default" };
    }
    return {
      host: match[1] || "unknown",
      port: match[2] || "443",
      db: match[3] || "default",
    };
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
      <span className="text-[#16a34a] font-semibold">{host}</span>
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

interface ConnectionPortalProps {
  connectAction: (formData: FormData) => Promise<void>;
  errorMessage?: string;
}

export function ConnectionPortal({
  connectAction,
  errorMessage,
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
      if (Array.isArray(parsed) && parsed.length > 0) {
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

  // Hidden form submission ref for instant connect
  const submitFormRef = useRef<HTMLFormElement | null>(null);
  const hiddenUriInputRef = useRef<HTMLInputElement | null>(null);

  const directUriInputId = useId();
  const directProfileNameId = useId();

  // Save changes to localStorage
  const persistConnections = (updated: SavedConnection[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
          {/* Top Action Bar: Search & New Profile Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-[var(--muted)] pointer-events-none">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Filter saved profiles by name or host..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="expo-input pl-9 text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleStartCreate}
              className="btn-primary shrink-0"
            >
              <PlusIcon size={14} />
              <span>Add New Profile</span>
            </button>
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
