"use client";

import React, { useState } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import {
  createCollectionAction,
  dropCollectionAction,
  createDatabaseAction,
  dropDatabaseAction,
} from "@/app/actions";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  Table2Icon,
  PlusIcon,
  MoreVerticalIcon,
  Trash2Icon,
  SearchIcon,
  BoxesIcon,
  TerminalIcon,
  LockIcon,
} from "lucide-react";
import { isProtectedDatabase } from "@/lib/liorandb/protection";


export function DatabaseTree() {
  const {
    databases,
    collectionsMap,
    expandedDatabases,
    toggleDatabaseExpanded,
    searchExplorerQuery,
    setSearchExplorerQuery,
    openCollectionTab,
    openQueryTab,
    openIndexesTab,
    activeTab,
    refreshExplorer,
    setStatusMessage,
  } = useWorkspace();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "database" | "collection";
    database: string;
    collection?: string;
  } | null>(null);

  const [createColModalDb, setCreateColModalDb] = useState<string | null>(null);
  const [newColName, setNewColName] = useState("");
  const [isCreatingCol, setIsCreatingCol] = useState(false);

  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState("");
  const [isCreatingDb, setIsCreatingDb] = useState(false);

  const [dropModal, setDropModal] = useState<{
    type: "database" | "collection";
    database: string;
    collection?: string;
  } | null>(null);
  const [dropConfirmText, setDropConfirmText] = useState("");
  const [isDropping, setIsDropping] = useState(false);

  // Filter databases and collections based on search query
  const query = searchExplorerQuery.toLowerCase().trim();
  const filteredDatabases = databases.filter((db) => {
    if (!query) return true;
    if (db.toLowerCase().includes(query)) return true;
    const cols = collectionsMap[db] || [];
    return cols.some((col) => col.toLowerCase().includes(query));
  });

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createColModalDb || !newColName.trim()) return;
    setIsCreatingCol(true);
    try {
      const res = await createCollectionAction({
        databaseName: createColModalDb,
        collectionName: newColName.trim(),
      });
      if (res.ok) {
        setStatusMessage({
          text: `Collection '${newColName.trim()}' created in '${createColModalDb}'`,
          tone: "success",
        });
        await refreshExplorer();
        openCollectionTab(createColModalDb, newColName.trim());
        setCreateColModalDb(null);
        setNewColName("");
      } else {
        setStatusMessage({ text: res.error || "Failed to create collection", tone: "error" });
      }
    } finally {
      setIsCreatingCol(false);
    }
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDbName.trim()) return;
    setIsCreatingDb(true);
    try {
      const res = await createDatabaseAction({ databaseName: newDbName.trim() });
      if (res.ok) {
        setStatusMessage({
          text: `Database '${newDbName.trim()}' created`,
          tone: "success",
        });
        await refreshExplorer();
        setShowCreateDbModal(false);
        setNewDbName("");
      } else {
        setStatusMessage({ text: res.error || "Failed to create database", tone: "error" });
      }
    } finally {
      setIsCreatingDb(false);
    }
  };

  const handleConfirmDrop = async () => {
    if (!dropModal) return;
    if (dropModal.type === "database" && isProtectedDatabase(dropModal.database)) {
      setStatusMessage({
        text: "The 'default' database is protected and cannot be dropped.",
        tone: "error",
      });
      setDropModal(null);
      setDropConfirmText("");
      return;
    }
    setIsDropping(true);
    try {
      if (dropModal.type === "database") {
        const res = await dropDatabaseAction({
          databaseName: dropModal.database,
          confirmation: dropConfirmText,
        });
        if (res.ok) {
          setStatusMessage({ text: `Database '${dropModal.database}' dropped`, tone: "success" });
          await refreshExplorer();
          setDropModal(null);
          setDropConfirmText("");
        } else {
          setStatusMessage({ text: res.error || "Failed to drop database", tone: "error" });
        }
      } else if (dropModal.type === "collection" && dropModal.collection) {
        const res = await dropCollectionAction({
          databaseName: dropModal.database,
          collectionName: dropModal.collection,
          confirmation: dropConfirmText,
        });
        if (res.ok) {
          setStatusMessage({
            text: `Collection '${dropModal.collection}' dropped from '${dropModal.database}'`,
            tone: "success",
          });
          await refreshExplorer();
          setDropModal(null);
          setDropConfirmText("");
        } else {
          setStatusMessage({ text: res.error || "Failed to drop collection", tone: "error" });
        }
      }
    } finally {
      setIsDropping(false);
    }
  };

  return (
    <div className="flex flex-col h-full select-none text-xs">
      {/* Search Bar & Create DB Action */}
      <div className="p-2 border-b border-[var(--hairline)] flex items-center gap-1.5">
        <div className="relative flex-1">
          <SearchIcon
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Filter explorer..."
            value={searchExplorerQuery}
            onChange={(e) => setSearchExplorerQuery(e.target.value)}
            className="w-full h-7 pl-7 pr-2 rounded-[5px] bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreateDbModal(true)}
          title="Create Database"
          className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto sidebar-scroll py-1.5">
        {filteredDatabases.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--muted)]">
            {searchExplorerQuery ? "No matching databases or collections." : "No databases found."}
          </div>
        ) : (
          filteredDatabases.map((db) => {
            const isExpanded = expandedDatabases[db] ?? true;
            const cols = (collectionsMap[db] || []).filter((c) =>
              query ? c.toLowerCase().includes(query) || db.toLowerCase().includes(query) : true,
            );
            const isDbActive = activeTab?.database === db;

            return (
              <div key={db} className="group/db">
                {/* Database Node */}
                <div
                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer rounded-[4px] mx-1 transition ${
                    isDbActive
                      ? "bg-[var(--surface-strong)] text-[var(--ink)] font-semibold"
                      : "text-[var(--body-strong)] hover:bg-[var(--surface-strong)]"
                  }`}
                  onClick={() => toggleDatabaseExpanded(db)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      type: "database",
                      database: db,
                    });
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[var(--muted)]">
                      {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                    </span>
                    <DatabaseIcon size={13} className="text-[#3b82f6] shrink-0" />
                    <span className="font-mono text-xs truncate">{db}</span>
                    {isProtectedDatabase(db) && (
                      <span title="Protected System Database" className="text-[var(--muted)] opacity-60 shrink-0">
                        <LockIcon size={11} />
                      </span>
                    )}
                  </div>

                  {/* Actions & Badge */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-[var(--muted)] px-1 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--hairline)]">
                      {cols.length}
                    </span>
                    <button
                      type="button"
                      title="Add Collection"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCreateColModalDb(db);
                      }}
                      className="opacity-0 group-hover/db:opacity-100 p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition"
                    >
                      <PlusIcon size={13} />
                    </button>
                    <button
                      type="button"
                      title="Options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          type: "database",
                          database: db,
                        });
                      }}
                      className="opacity-0 group-hover/db:opacity-100 p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition"
                    >
                      <MoreVerticalIcon size={13} />
                    </button>
                  </div>
                </div>

                {/* Collections Children */}
                {isExpanded && (
                  <div className="ml-5 pl-2 border-l border-[var(--hairline)] py-0.5 space-y-0.5">
                    {cols.length === 0 ? (
                      <div className="py-1 px-2 text-[11px] text-[var(--muted)] italic">
                        Empty database
                      </div>
                    ) : (
                      cols.map((col) => {
                        const isColActive =
                          activeTab?.database === db && activeTab?.collection === col;
                        return (
                          <div
                            key={col}
                            className={`group/col flex items-center justify-between px-2 py-1 rounded-[4px] cursor-pointer transition ${
                              isColActive
                                ? "bg-[var(--primary)] text-[var(--on-primary)] font-medium shadow-xs"
                                : "text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                            }`}
                            onClick={() => openCollectionTab(db, col)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                type: "collection",
                                database: db,
                                collection: col,
                              });
                            }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Table2Icon
                                size={12}
                                className={isColActive ? "text-white" : "text-[var(--muted)]"}
                              />
                              <span className="font-mono text-xs truncate">{col}</span>
                            </div>

                            {/* Collection Quick Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 shrink-0">
                              <button
                                type="button"
                                title="Query Collection"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQueryTab(db, col);
                                }}
                                className={`p-0.5 hover:text-white rounded ${
                                  isColActive ? "text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"
                                }`}
                              >
                                <TerminalIcon size={12} />
                              </button>
                              <button
                                type="button"
                                title="Indexes"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openIndexesTab(db, col);
                                }}
                                className={`p-0.5 hover:text-white rounded ${
                                  isColActive ? "text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"
                                }`}
                              >
                                <BoxesIcon size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-44 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xl py-1 text-xs"
          >
            {contextMenu.type === "database" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCreateColModalDb(contextMenu.database);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] flex items-center gap-2 text-[var(--ink)]"
                >
                  <PlusIcon size={13} />
                  <span>Create Collection...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openQueryTab(contextMenu.database);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] flex items-center gap-2 text-[var(--ink)]"
                >
                  <TerminalIcon size={13} />
                  <span>New Query Workbench</span>
                </button>
                <div className="h-[1px] bg-[var(--hairline)] my-1" />
                {isProtectedDatabase(contextMenu.database) ? (
                  <div
                    className="w-full text-left px-3 py-1.5 text-[var(--muted)] flex items-center gap-2 cursor-not-allowed select-none opacity-60"
                    title="The 'default' database is protected and cannot be dropped."
                  >
                    <LockIcon size={13} />
                    <span>Protected Database</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDropModal({ type: "database", database: contextMenu.database });
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#ef4444]/10 text-[#ef4444] flex items-center gap-2 font-medium"
                  >
                    <Trash2Icon size={13} />
                    <span>Drop Database...</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.collection) {
                      openCollectionTab(contextMenu.database, contextMenu.collection);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] flex items-center gap-2 text-[var(--ink)] font-medium"
                >
                  <Table2Icon size={13} />
                  <span>Open Collection</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.collection) {
                      openQueryTab(contextMenu.database, contextMenu.collection);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] flex items-center gap-2 text-[var(--ink)]"
                >
                  <TerminalIcon size={13} />
                  <span>Query in Workbench</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (contextMenu.collection) {
                      openIndexesTab(contextMenu.database, contextMenu.collection);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--surface-strong)] flex items-center gap-2 text-[var(--ink)]"
                >
                  <BoxesIcon size={13} />
                  <span>Manage Indexes</span>
                </button>
                <div className="h-[1px] bg-[var(--hairline)] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setDropModal({
                      type: "collection",
                      database: contextMenu.database,
                      collection: contextMenu.collection,
                    });
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#ef4444]/10 text-[#ef4444] flex items-center gap-2 font-medium"
                >
                  <Trash2Icon size={13} />
                  <span>Drop Collection...</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Create Database Modal */}
      {showCreateDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">Create Database</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Specify a valid name using alphanumeric characters, dash, or underscore.
            </p>
            <form onSubmit={handleCreateDatabase} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Database Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. production_db"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  pattern="[A-Za-z0-9_.-]+"
                  required
                  autoFocus
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDbModal(false);
                    setNewDbName("");
                  }}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDb || !newDbName.trim()}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  {isCreatingDb ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Collection Modal */}
      {createColModalDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
              Create Collection in &apos;{createColModalDb}&apos;
            </h3>
            <form onSubmit={handleCreateCollection} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. users"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  pattern="[A-Za-z0-9_.-]+"
                  required
                  autoFocus
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateColModalDb(null);
                    setNewColName("");
                  }}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCol || !newColName.trim()}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  {isCreatingCol ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Destructive Drops */}
      {dropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[#ef4444]/40 bg-[var(--surface-card)] p-5 shadow-2xl space-y-3">
            {dropModal.type === "database" && isProtectedDatabase(dropModal.database) ? (
              <>
                <div className="flex items-center gap-2 text-[var(--muted)]">
                  <LockIcon size={18} />
                  <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
                    Protected Database
                  </h3>
                </div>
                <p className="text-xs text-[var(--body)] leading-relaxed">
                  The <code className="font-mono text-[#ef4444] bg-[#ef4444]/10 px-1 py-0.5 rounded">{dropModal.database}</code> database is a protected system database and cannot be dropped or deleted.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDropModal(null);
                      setDropConfirmText("");
                    }}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[#ef4444]">
                  <Trash2Icon size={18} />
                  <h3 className="font-sans text-sm font-bold">
                    Drop {dropModal.type === "database" ? "Database" : "Collection"}
                  </h3>
                </div>
                <p className="text-xs text-[var(--body)] leading-relaxed">
                  This action is <span className="font-bold text-[#ef4444]">permanent</span> and cannot
                  be undone. All documents in{" "}
                  <code className="font-mono text-[#ef4444] bg-[#ef4444]/10 px-1 py-0.5 rounded">
                    {dropModal.type === "database"
                      ? dropModal.database
                      : `${dropModal.database}.${dropModal.collection}`}
                  </code>{" "}
                  will be permanently destroyed.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                    Type{" "}
                    <span className="font-mono text-[#ef4444]">
                      {dropModal.type === "database" ? dropModal.database : dropModal.collection}
                    </span>{" "}
                    to confirm:
                  </label>
                  <input
                    type="text"
                    value={dropConfirmText}
                    onChange={(e) => setDropConfirmText(e.target.value)}
                    autoFocus
                    className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#ef4444]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDropModal(null);
                      setDropConfirmText("");
                    }}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDrop}
                    disabled={
                      isDropping ||
                      dropConfirmText !==
                        (dropModal.type === "database" ? dropModal.database : dropModal.collection)
                    }
                    className="px-4 py-1.5 rounded-[6px] bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition"
                  >
                    {isDropping ? "Dropping..." : "Drop Permanently"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
