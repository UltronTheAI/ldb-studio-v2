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
    return <span className="text-[#2563EB] font-semibold">{display}</span>;
  }
  const [, scheme, userPass, host, port, db] = match;
  return (
    <span>
      <span className="text-[#2563EB] font-bold">{scheme}</span>
      {userPass && (
        <>
          <span className="text-[#7C3AED] font-semibold">{userPass}</span>
          <span className="text-[#64748B]">@</span>
        </>
      )}
      <span className="text-[#059669] font-bold">{host}</span>
      {port && (
        <>
          <span className="text-[#64748B]">:</span>
          <span className="text-[#D97706] font-bold">{port}</span>
        </>
      )}
      {db !== undefined && (
        <>
          <span className="text-[#64748B]">/</span>
          <span className="text-[#DC2626] font-semibold">{db}</span>
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
    <div className="sketch-card p-6 sm:p-10">
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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#111111] pb-5">
        <div>
          <h2 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#000000]">
            Connect to LioranDB Instance
          </h2>
          <p className="mt-1 text-sm text-[#666666]">
            Select a saved connection profile, manage your cluster bookmarks, or enter a direct connection URI.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-[7px] border-2 border-[#111111] bg-[#FAFAFA] p-1 font-mono text-xs font-bold shadow-[2px_2px_0px_#111111]">
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`rounded px-3 py-1.5 transition ${
              activeTab === "saved"
                ? "bg-[#000000] text-white"
                : "text-[#111111] hover:bg-white"
            }`}
          >
            Saved Profiles ({connections.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`rounded px-3 py-1.5 transition ${
              activeTab === "direct"
                ? "bg-[#000000] text-white"
                : "text-[#111111] hover:bg-white"
            }`}
          >
            Direct Connect
          </button>
        </div>
      </div>

      {/* Global Error Notice if redirected with ?error= */}
      {errorMessage ? (
        <div className="mb-6 space-y-3">
          <div className="rounded-[7px] border-2 border-[#111111] bg-white p-4 font-mono text-xs text-[#111111] shadow-[2px_2px_0px_#111111]">
            <span className="font-bold mr-2">[× ERROR]</span>
            {errorMessage}
          </div>

          {errorMessage.includes("Local database detected") ? (
            <div className="rounded-[7px] border-2 border-[#111111] bg-white p-4 text-xs text-[#111111] shadow-[2px_2px_0px_#111111]">
              <div className="flex items-center gap-1.5 font-bold uppercase font-mono">
                <TerminalIcon size={14} />
                <span>How to connect a local database</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">
                Hosted Studio cannot connect directly to loopback on your workstation. Run Studio locally:
              </p>
              <div className="mt-2.5 flex items-center justify-between rounded border border-[#111111] bg-[#FAFAFA] px-3 py-2 font-mono text-xs">
                <code>liorandb studio</code>
                <span className="text-[11px] text-[#666666]">or npm run dev</span>
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
              <span className="absolute inset-y-0 left-3 flex items-center text-[#666666]">
                <SearchIcon size={14} />
              </span>
              <input
                type="text"
                placeholder="Filter saved profiles by name or host..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full rounded-[7px] border-2 border-[#111111] bg-white pl-9 pr-3 py-2 font-mono text-xs text-[#111111] shadow-[2px_2px_0px_#111111] placeholder:text-[#999999] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleStartCreate}
              className="sketch-btn-primary flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider shrink-0"
            >
              <PlusIcon size={14} />
              <span>Add New Profile</span>
            </button>
          </div>

          {/* Inline Create / Edit Modal / Form */}
          {(isCreatingNew || editingItem) && (
            <div className="rounded-[7px] border-2 border-[#111111] bg-[#FAFAFA] p-5 shadow-[3px_3px_0px_#111111]">
              <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <DatabaseIcon size={16} />
                  <span className="font-sans text-sm font-bold text-[#000000]">
                    {editingItem ? `Edit Profile: ${editingItem.name}` : "Save New Connection Profile"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEditor}
                  className="rounded border border-[#111111] p-1 text-[#666666] hover:bg-white hover:text-black"
                >
                  <XIcon size={14} />
                </button>
              </div>

              {editorError && (
                <div className="mb-4 rounded border border-[#111111] bg-white p-2.5 font-mono text-xs font-bold text-[#000000]">
                  [×] {editorError}
                </div>
              )}

              <form onSubmit={handleSaveEditor} className="space-y-4">
                <div>
                  <label className="block mb-1 font-mono text-xs font-bold text-[#111111]">
                    Profile Name / Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Cluster, Analytics Staging, Local Node"
                    value={editorName}
                    onChange={(e) => setEditorName(e.target.value)}
                    className="w-full rounded-[7px] border-2 border-[#111111] bg-white px-3.5 py-2 font-mono text-xs text-[#111111] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 font-mono text-xs font-bold text-[#111111]">
                    Connection URI
                  </label>
                  <input
                    type="text"
                    placeholder="liorandb://username:password@host:port/database"
                    value={editorUri}
                    onChange={(e) => setEditorUri(e.target.value)}
                    className="w-full rounded-[7px] border-2 border-[#111111] bg-white px-3.5 py-2 font-mono text-xs text-[#111111] focus:outline-none"
                    required
                  />
                  <div className="mt-1 font-mono text-[11px] text-[#666666]">
                    Format: <code>liorandb://user:pass@host:port/database</code>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditor}
                    className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider"
                  >
                    {editingItem ? "Save Changes" : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Saved Connection Cards */}
          <div className="space-y-3.5">
            {filteredConnections.length === 0 ? (
              <div className="rounded-[7px] border-2 border-dashed border-[#111111] bg-[#FAFAFA] p-8 text-center">
                <DatabaseIcon size={24} className="mx-auto text-[#666666]" />
                <h3 className="mt-2 font-sans text-base font-bold text-[#000000]">
                  No connection profiles found
                </h3>
                <p className="mt-1 text-xs text-[#666666]">
                  {filterQuery
                    ? `No profiles matched "${filterQuery}". Clear the search or add a new profile.`
                    : "You haven't saved any connection profiles yet."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  {filterQuery ? (
                    <button
                      type="button"
                      onClick={() => setFilterQuery("")}
                      className="sketch-btn-secondary px-3 py-1.5 text-xs font-bold uppercase"
                    >
                      Clear Filter
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => persistConnections(INITIAL_DEFAULT_CONNECTIONS)}
                      className="sketch-btn-secondary px-3 py-1.5 text-xs font-bold uppercase"
                    >
                      Load Sample Profiles
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="sketch-btn-primary px-3 py-1.5 text-xs font-bold uppercase"
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
                    className="rounded-[7px] border-2 border-[#111111] bg-white p-4 shadow-[2px_2px_0px_#111111] transition hover:shadow-[3px_3px_0px_#111111]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E0E0E0] pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-sans text-base font-bold text-[#000000]">
                            {conn.name}
                          </span>
                          <span className="rounded border border-[#111111] bg-[#FAFAFA] px-1.5 py-0.5 font-mono text-[10px] text-[#111111]">
                            {parsed.host}:{parsed.port}
                          </span>
                          {parsed.db && (
                            <span className="rounded border border-[#111111] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#666666]">
                              db: {parsed.db}
                            </span>
                          )}
                        </div>
                        {conn.lastUsedAt && (
                          <div
                            className="mt-1 font-mono text-[10px] text-[#888888]"
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
                          className="sketch-btn-primary flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider"
                          title="Connect to this database now"
                        >
                          <span>Connect</span>
                          <ArrowRightIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(conn)}
                          className="rounded-[5px] border-2 border-[#111111] bg-white p-1.5 text-[#111111] shadow-[1px_1px_0px_#111111] hover:bg-[#FAFAFA]"
                          title="Edit connection profile"
                        >
                          <PencilIcon size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(conn.id, conn.name)}
                          className="rounded-[5px] border-2 border-[#111111] bg-white p-1.5 text-[#111111] shadow-[1px_1px_0px_#111111] hover:bg-[#FAFAFA]"
                          title="Delete saved connection profile"
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    </div>

                    {/* URI Bar with Reveal & Copy Controls */}
                    <div className="flex items-center justify-between gap-2 rounded border border-[#111111] bg-[#FAFAFA] px-3 py-2 font-mono text-xs">
                      <div className="truncate select-all">
                        {renderColoredUri(conn.uri, isRevealed)}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[#666666]">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedIds((prev) => ({
                              ...prev,
                              [conn.id]: !prev[conn.id],
                            }))
                          }
                          className="p-1 hover:text-black"
                          title={isRevealed ? "Hide credentials" : "Show full URI credentials"}
                        >
                          {isRevealed ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyUri(conn.id, conn.uri)}
                          className="p-1 hover:text-black flex items-center gap-1"
                          title="Copy connection string"
                        >
                          {isCopied ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-black">
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
                          className="ml-1 text-[11px] underline underline-offset-2 hover:text-black"
                        >
                          Inspect URI
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
                className="font-mono text-xs font-bold uppercase tracking-wider text-[#111111]"
                htmlFor={directUriInputId}
              >
                Connection URI
              </label>
              <button
                type="button"
                onClick={() => setShowDirectPassword((prev) => !prev)}
                className="flex items-center gap-1 font-mono text-[11px] text-[#666666] hover:text-black"
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
              className="w-full rounded-[7px] border-2 border-[#111111] bg-white px-3.5 py-2.5 font-mono text-sm text-[#111111] shadow-[2px_2px_0px_#111111] placeholder:text-[#888888] focus:outline-none"
              required
              suppressHydrationWarning
            />
          </div>

          {/* Option to automatically save this connection */}
          <div className="rounded-[7px] border border-[#111111] bg-[#FAFAFA] p-3.5 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveDirectProfile}
                onChange={(e) => setSaveDirectProfile(e.target.checked)}
                className="h-4 w-4 accent-black rounded border-2 border-[#111111]"
              />
              <span className="font-sans text-xs font-bold text-[#111111]">
                Save this connection profile for future sessions
              </span>
            </label>

            {saveDirectProfile && (
              <div>
                <label
                  htmlFor={directProfileNameId}
                  className="block font-mono text-[11px] text-[#666666] mb-1"
                >
                  Profile Label (Optional):
                </label>
                <input
                  id={directProfileNameId}
                  type="text"
                  placeholder="e.g. Primary Production Cluster, My Test Replica"
                  value={directProfileName}
                  onChange={(e) => setDirectProfileName(e.target.value)}
                  className="w-full rounded border border-[#111111] bg-white px-3 py-1.5 font-mono text-xs text-[#111111] focus:outline-none"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="sketch-btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold uppercase tracking-wider"
            suppressHydrationWarning
          >
            <span>Connect to Studio</span>
            <ArrowRightIcon size={16} />
          </button>
        </form>
      )}

      {/* Default URI Format Help Guide */}
      <div className="mt-6 rounded-[7px] border border-[#111111] bg-[#FAFAFA] p-3.5 text-xs text-[#666666]">
        <span className="font-bold text-[#111111]">Default format:</span>{" "}
        <code className="font-mono text-[#000000]">liorandb://username:password@host:port/database</code>
        <div className="mt-1 text-[11px]">
          (Database name optional: <code className="font-mono text-[#000000]">liorandb://username:password@host:port</code>)
        </div>
      </div>
    </div>
  );
}
