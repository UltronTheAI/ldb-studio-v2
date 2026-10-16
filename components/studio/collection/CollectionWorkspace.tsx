"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Document } from "@liorandb/driver";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type {
  StudioTab,
  CollectionSubTab,
  DocumentViewMode,
  CollectionTabState,
} from "@/lib/studio/workspace-types";
import {
  fetchCollectionDocumentsAction,
  fetchCollectionIndexesAction,
  insertOneDocumentAction,
  updateOneDocumentAction,
  deleteOneDocumentAction,
} from "@/app/actions";
import type { StudioErrorDescriptor } from "@/lib/liorandb/errors";
import { DocumentTable } from "./DocumentTable";
import { DocumentJsonView } from "./DocumentJsonView";
import { DocumentTreeView } from "./DocumentTreeView";
import { DocumentEditorModal } from "./DocumentEditorModal";
import { CollectionIndexes } from "./CollectionIndexes";
import { CollectionSchema } from "./CollectionSchema";
import { TableSkeletonWidget, LoadingOverlayWidget } from "../widgets/LoadingWidget";
import {
  Table2Icon,
  CodeIcon,
  ListTreeIcon,
  SearchIcon,
  PlusIcon,
  RefreshCwIcon,
  DownloadIcon,
  SlidersHorizontalIcon,
  BoxesIcon,
  SparklesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZapIcon,
  Trash2Icon,
  AlertCircleIcon,
} from "lucide-react";

interface CollectionWorkspaceProps {
  tab: StudioTab;
}

export function CollectionWorkspace({ tab }: CollectionWorkspaceProps) {
  const { updateTabState, addQueryHistory, setStatusMessage, refreshTrigger } = useWorkspace();

  const database = tab.database || "default";
  const collection = tab.collection || "collection";
  const state = useMemo(
    (): CollectionTabState =>
      tab.collectionState || {
        subTab: "documents" as CollectionSubTab,
        viewMode: "table" as DocumentViewMode,
        filter: "{}",
        projection: "",
        sort: "",
        limit: 50,
        skip: 0,
        page: 1,
        pageSize: 50,
        totalDocuments: 0,
        documents: [],
        indexes: [],
      },
    [tab.collectionState],
  );

  const [hasFetched, setHasFetched] = useState(state.documents.length > 0);
  const [filterInput, setFilterInput] = useState(state.filter || "{}");
  const [projectionInput, setProjectionInput] = useState(state.projection || "");
  const [sortInput, setSortInput] = useState(state.sort || "");
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(!hasFetched);
  const [isIndexesLoading, setIsIndexesLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<StudioErrorDescriptor | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(tab.executionDurationMs ?? null);

  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [activeDocForEdit, setActiveDocForEdit] = useState<Document | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stateRef = useRef(state);
  const filterInputRef = useRef(filterInput);
  const projectionInputRef = useRef(projectionInput);
  const sortInputRef = useRef(sortInput);

  useEffect(() => {
    stateRef.current = state;
    filterInputRef.current = filterInput;
    projectionInputRef.current = projectionInput;
    sortInputRef.current = sortInput;
  }, [state, filterInput, projectionInput, sortInput]);

  const activeRequestIdRef = useRef<number>(0);
  const loadedKeyRef = useRef<string>("");
  const loadedIndexesKeyRef = useRef<string>("");
  const prevRefreshTriggerRef = useRef(refreshTrigger);

  // Load documents
  const loadDocuments = useCallback(
    async (overrideParams?: {
      filter?: string;
      projection?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const currentState = stateRef.current;
      const activeFilter = overrideParams?.filter ?? filterInputRef.current;
      const activeProjection = overrideParams?.projection ?? projectionInputRef.current;
      const activeSort = overrideParams?.sort ?? sortInputRef.current;
      const activePage = overrideParams?.page ?? currentState.page;
      const activePageSize = overrideParams?.pageSize ?? currentState.pageSize;
      const skip = (activePage - 1) * activePageSize;

      const reqId = ++activeRequestIdRef.current;
      setIsLoading(true);
      setErrorInfo(null);

      try {
        const res = await fetchCollectionDocumentsAction({
          database,
          collection,
          filter: activeFilter,
          projection: activeProjection,
          sort: activeSort,
          limit: activePageSize,
          skip,
        });

        // Drop stale responses if a newer request has started
        if (reqId !== activeRequestIdRef.current) {
          return;
        }

        if (res.ok && res.data) {
          setErrorInfo(null);
          setHasFetched(true);
          updateTabState(tab.id, {
            executionDurationMs: res.durationMs,
            lastExecutedAt: Date.now(),
            collectionState: {
              ...currentState,
              filter: activeFilter,
              projection: activeProjection,
              sort: activeSort,
              page: activePage,
              pageSize: activePageSize,
              limit: activePageSize,
              skip,
              documents: res.data.documents,
              totalDocuments: res.data.total,
              indexes: res.data.indexes.length > 0 ? res.data.indexes : currentState.indexes,
            },
          });
          setExecutionTime(res.durationMs ?? null);

          // Record in history if filter was active
          if (activeFilter.trim() && activeFilter.trim() !== "{}") {
            addQueryHistory({
              id: `hist-${Date.now()}`,
              timestamp: Date.now(),
              database,
              collection,
              type: "find",
              querySummary: `find(${activeFilter})`,
              durationMs: res.durationMs ?? 0,
              documentCount: res.data.documents.length,
              success: true,
            });
          }
        } else {
          setHasFetched(true);
          const desc: StudioErrorDescriptor = res.errorDescriptor ?? {
            code: "QUERY_FAILED",
            category: "server-overloaded",
            title: "Query Failed",
            message: res.error || "Failed to load collection documents",
          };
          setErrorInfo(desc);
          setStatusMessage({ text: res.error || "Failed to load collection documents", tone: "error" });
        }
      } catch (err: unknown) {
        if (reqId !== activeRequestIdRef.current) return;
        setHasFetched(true);
        const message = (err as Error).message;
        setErrorInfo({
          code: "CLIENT_REQUEST_ERROR",
          category: "network",
          title: "Client Request Error",
          message,
        });
        setStatusMessage({ text: message, tone: "error" });
      } finally {
        if (reqId === activeRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      database,
      collection,
      tab.id,
      updateTabState,
      addQueryHistory,
      setStatusMessage,
    ],
  );

  // On-demand index loading when switching to Indexes tab (loaded once per collection view)
  const loadIndexes = useCallback(
    async (force = false) => {
      const currentKey = `${tab.id}:${database}:${collection}`;
      if (!force && loadedIndexesKeyRef.current === currentKey) {
        return;
      }
      loadedIndexesKeyRef.current = currentKey;
      setIsIndexesLoading(true);

      try {
        const res = await fetchCollectionIndexesAction({ database, collection });
        if (res.ok && res.data) {
          updateTabState(tab.id, {
            collectionState: {
              ...stateRef.current,
              indexes: res.data.indexes,
            },
          });
        }
      } catch {
        // Non-fatal
      } finally {
        setIsIndexesLoading(false);
      }
    },
    [database, collection, tab.id, updateTabState],
  );

  useEffect(() => {
    if (state.subTab === "indexes") {
      void loadIndexes();
    }
  }, [state.subTab, loadIndexes]);

  // Initial load automatically on start/mount or when collection/tab changes, or on explicit refresh
  useEffect(() => {
    const currentKey = `${tab.id}:${database}:${collection}`;
    const isNew = loadedKeyRef.current !== currentKey;
    const isRefresh = refreshTrigger > 0 && refreshTrigger !== prevRefreshTriggerRef.current;

    if (isNew || isRefresh || !hasFetched) {
      loadedKeyRef.current = currentKey;
      prevRefreshTriggerRef.current = refreshTrigger;
      void loadDocuments();
    }
  }, [tab.id, database, collection, refreshTrigger, loadDocuments, hasFetched]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDocuments({ page: 1, filter: filterInput });
  };

  const handleResetFilter = () => {
    setFilterInput("{}");
    setProjectionInput("");
    setSortInput("");
    loadDocuments({ filter: "{}", projection: "", sort: "", page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    loadDocuments({ page: newPage });
  };

  const handlePageSizeChange = (newSize: number) => {
    loadDocuments({ page: 1, pageSize: newSize });
  };

  const handleExportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(state.documents, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${database}_${collection}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSaveDocument = async (docJson: string, isInsert: boolean): Promise<boolean> => {
    if (isInsert) {
      const res = await insertOneDocumentAction({
        database,
        collection,
        documentJson: docJson,
      });
      if (res.ok) {
        setStatusMessage({ text: "Document inserted successfully", tone: "success" });
        loadDocuments();
        return true;
      }
      setStatusMessage({ text: res.error || "Failed to insert document", tone: "error" });
      return false;
    } else {
      if (!activeDocForEdit || activeDocForEdit._id === undefined) return false;
      const filterJson = JSON.stringify({ _id: activeDocForEdit._id });
      const parsedUpdate = JSON.parse(docJson) as Document;
      delete parsedUpdate._id; // Remove _id from $set

      const res = await updateOneDocumentAction({
        database,
        collection,
        filterJson,
        updateJson: JSON.stringify({ $set: parsedUpdate }),
      });

      if (res.ok) {
        setStatusMessage({ text: "Document updated successfully", tone: "success" });
        loadDocuments();
        return true;
      }
      setStatusMessage({ text: res.error || "Failed to update document", tone: "error" });
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteTarget._id === undefined) return;
    setIsDeleting(true);
    try {
      const res = await deleteOneDocumentAction({
        database,
        collection,
        filterJson: JSON.stringify({ _id: deleteTarget._id }),
      });
      if (res.ok) {
        setStatusMessage({ text: "Document deleted", tone: "success" });
        setDeleteTarget(null);
        loadDocuments();
      } else {
        setStatusMessage({ text: res.error || "Failed to delete document", tone: "error" });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(state.totalDocuments / state.pageSize) || 1;
  const startItem = (state.page - 1) * state.pageSize + 1;
  const endItem = Math.min(state.page * state.pageSize, state.totalDocuments);

  return (
    <div className="flex flex-col h-full bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Fast Query Filter Bar */}
      <div className="border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3 space-y-2 shrink-0">
        <form onSubmit={handleFilterSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[var(--text-link)] select-none">
              FILTER
            </span>
            <input
              type="text"
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder='{ "field": "value" }'
              className="w-full h-8 pl-18 pr-3 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--text-link)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowOptions((prev) => !prev)}
            title="Advanced projection and sort options"
            className={`h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-medium flex items-center gap-1.5 transition ${
              showOptions || projectionInput || sortInput
                ? "bg-[var(--surface-strong)] border-[var(--ink)] text-[var(--ink)]"
                : "text-[var(--body)]"
            }`}
          >
            <SlidersHorizontalIcon size={13} />
            <span className="hidden sm:inline">Options</span>
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary h-8 px-3.5 text-xs font-semibold flex items-center gap-1.5"
          >
            <SearchIcon size={13} />
            <span>Find</span>
          </button>

          {(filterInput !== "{}" || projectionInput || sortInput) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--muted)] hover:text-[var(--ink)] transition"
            >
              Reset
            </button>
          )}
        </form>

        {/* Collapsible Advanced Options: Projection & Sort */}
        {showOptions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs animate-in fade-in duration-100">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--muted)] mb-1">
                Projection (Fields to include/exclude)
              </label>
              <input
                type="text"
                placeholder='["name", "email"] or { "password": 0 }'
                value={projectionInput}
                onChange={(e) => setProjectionInput(e.target.value)}
                className="w-full h-7 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--muted)] mb-1">
                Sort (Order specification)
              </label>
              <input
                type="text"
                placeholder='{ "createdAt": -1, "email": 1 }'
                value={sortInput}
                onChange={(e) => setSortInput(e.target.value)}
                className="w-full h-7 px-2 rounded-[4px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tabs Bar: Documents | Query | Aggregations | Indexes | Schema */}
      <div className="h-9 px-3 border-b border-[var(--hairline)] bg-[var(--surface-card)] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-1 h-full">
          {[
            { id: "documents", label: "Documents", icon: Table2Icon },
            { id: "indexes", label: "Indexes", icon: BoxesIcon },
            { id: "schema", label: "Schema", icon: SparklesIcon },
          ].map((item) => {
            const isActive = state.subTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  updateTabState(tab.id, {
                    collectionState: { ...state, subTab: item.id as CollectionSubTab },
                  })
                }
                className={`flex items-center gap-1.5 h-full px-3 text-xs font-semibold border-b-2 transition ${
                  isActive
                    ? "border-b-[var(--text-link)] text-[var(--text-link)]"
                    : "border-b-transparent text-[var(--body)] hover:text-[var(--ink)]"
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side controls for Documents sub-tab */}
        {state.subTab === "documents" && (
          <div className="flex items-center gap-2">
            {/* View Mode Switcher: Table | JSON | Tree */}
            <div className="flex items-center rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-0.5">
              {[
                { id: "table", label: "Table", icon: Table2Icon },
                { id: "json", label: "JSON", icon: CodeIcon },
                { id: "tree", label: "Tree", icon: ListTreeIcon },
              ].map((m) => {
                const isActive = state.viewMode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      updateTabState(tab.id, {
                        collectionState: { ...state, viewMode: m.id as DocumentViewMode },
                      })
                    }
                    title={`${m.label} View`}
                    className={`p-1 rounded-[4px] text-xs transition ${
                      isActive
                        ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <Icon size={13} />
                  </button>
                );
              })}
            </div>

            {/* Actions: Insert, Refresh, Export */}
            <button
              type="button"
              onClick={() => {
                setIsInserting(true);
                setActiveDocForEdit(null);
                setIsEditorOpen(true);
              }}
              className="btn-primary h-7 px-2.5 text-xs font-semibold flex items-center gap-1"
            >
              <PlusIcon size={12} />
              <span>Insert</span>
            </button>

            <button
              type="button"
              onClick={() => loadDocuments()}
              title="Refresh Documents"
              className={`p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
                isLoading ? "animate-spin text-[var(--text-link)]" : ""
              }`}
            >
              <RefreshCwIcon size={13} />
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              title="Export loaded documents to JSON"
              className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
            >
              <DownloadIcon size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Main Sub-Tab Content */}
      <div className="flex-1 overflow-hidden p-3">
        {state.subTab === "documents" && (
          <div className="flex flex-col h-full">
            <div className="relative flex-1 overflow-hidden">
              {errorInfo ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-200">
                  <div className="max-w-md w-full rounded-[10px] border border-[var(--semantic-error)] bg-[var(--surface-card)] p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-[var(--semantic-error)]/10 flex items-center justify-center text-[var(--semantic-error)]">
                        <AlertCircleIcon size={22} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-sans text-sm font-bold text-[var(--semantic-error)]">
                        {errorInfo.title}
                      </h4>
                      <p className="font-mono text-xs text-[var(--body)] leading-relaxed">
                        {errorInfo.message}
                      </p>
                    </div>
                    {errorInfo.grpcStatus && (
                      <div className="inline-block px-2.5 py-1 rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] font-mono text-[10px] text-[var(--muted)]">
                        gRPC: {errorInfo.grpcStatus}
                      </div>
                    )}
                    {errorInfo.suggestion && (
                      <p className="text-[11px] text-[var(--muted)] italic">
                        {errorInfo.suggestion}
                      </p>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => loadDocuments()}
                        className="btn-primary h-8 px-4 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <RefreshCwIcon size={13} />
                        <span>Try Again</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (!hasFetched || isLoading) && state.documents.length === 0 ? (
                <TableSkeletonWidget
                  columns={5}
                  rows={8}
                  message={`Fetching documents from ${collection}...`}
                />
              ) : state.documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-200">
                  <div className="max-w-sm rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 shadow-xs space-y-3">
                    <div className="h-10 w-10 mx-auto rounded-full bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] flex items-center justify-center text-[var(--muted)]">
                      <BoxesIcon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--ink)]">
                        {filterInput.trim() && filterInput.trim() !== "{}"
                          ? "No matching documents"
                          : "Empty Collection"}
                      </h4>
                      <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
                        {filterInput.trim() && filterInput.trim() !== "{}"
                          ? `No documents matched filter: ${filterInput}`
                          : `The collection '${collection}' contains zero documents.`}
                      </p>
                    </div>
                    {filterInput.trim() && filterInput.trim() !== "{}" ? (
                      <button
                        type="button"
                        onClick={handleResetFilter}
                        className="btn-secondary h-7 px-3 text-xs"
                      >
                        Reset Filter
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsInserting(true);
                          setActiveDocForEdit(null);
                          setIsEditorOpen(true);
                        }}
                        className="btn-primary h-7 px-3 text-xs font-semibold inline-flex items-center gap-1.5 mx-auto"
                      >
                        <PlusIcon size={12} />
                        <span>Insert Document</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {state.viewMode === "table" && (
                    <DocumentTable
                      documents={state.documents}
                      onEdit={(doc) => {
                        setActiveDocForEdit(doc);
                        setIsInserting(false);
                        setIsEditorOpen(true);
                      }}
                      onDelete={(doc) => setDeleteTarget(doc)}
                    />
                  )}
                  {state.viewMode === "json" && (
                    <DocumentJsonView
                      documents={state.documents}
                      onEdit={(doc) => {
                        setActiveDocForEdit(doc);
                        setIsInserting(false);
                        setIsEditorOpen(true);
                      }}
                      onDelete={(doc) => setDeleteTarget(doc)}
                    />
                  )}
                  {state.viewMode === "tree" && (
                    <DocumentTreeView
                      documents={state.documents}
                      onEdit={(doc) => {
                        setActiveDocForEdit(doc);
                        setIsInserting(false);
                        setIsEditorOpen(true);
                      }}
                      onDelete={(doc) => setDeleteTarget(doc)}
                    />
                  )}
                  {isLoading && state.documents.length > 0 && (
                    <LoadingOverlayWidget message={`Querying ${collection}...`} />
                  )}
                </>
              )}
            </div>

            {/* Pagination & Status Footer */}
            <div className="h-10 pt-2 border-t border-[var(--hairline)] flex items-center justify-between text-xs font-mono text-[var(--body)] select-none shrink-0">
              <div className="flex items-center gap-3">
                {!hasFetched || isLoading ? (
                  <span className="text-[var(--muted)]">Loading documents...</span>
                ) : state.totalDocuments > 0 ? (
                  <span>
                    Showing {startItem} - {endItem} of {state.totalDocuments}
                  </span>
                ) : (
                  <span>0 documents</span>
                )}

                {typeof executionTime === "number" && (
                  <span className="flex items-center gap-1 text-[#fbbf24]">
                    <ZapIcon size={11} />
                    <span>{executionTime} ms</span>
                  </span>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--muted)]">Rows:</span>
                  <select
                    value={state.pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="h-6 px-1.5 rounded bg-[var(--surface-card)] border border-[var(--hairline-strong)] text-xs text-[var(--ink)] focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={state.page <= 1 || isLoading}
                    onClick={() => handlePageChange(state.page - 1)}
                    className="p-1 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] disabled:opacity-30 disabled:pointer-events-none text-[var(--ink)]"
                  >
                    <ChevronLeftIcon size={13} />
                  </button>
                  <span className="px-2 font-bold text-[var(--ink)]">
                    {state.page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={state.page >= totalPages || isLoading}
                    onClick={() => handlePageChange(state.page + 1)}
                    className="p-1 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] disabled:opacity-30 disabled:pointer-events-none text-[var(--ink)]"
                  >
                    <ChevronRightIcon size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.subTab === "indexes" && (
          <CollectionIndexes
            database={database}
            collection={collection}
            indexes={state.indexes}
            isLoading={isIndexesLoading}
            onRefresh={() => loadIndexes(true)}
          />
        )}

        {state.subTab === "schema" && (
          <CollectionSchema
            documents={state.documents}
            database={database}
            collection={collection}
            isLoading={!hasFetched || isLoading}
          />
        )}
      </div>

      {/* Document Insert / Edit Modal */}
      <DocumentEditorModal
        isOpen={isEditorOpen}
        isInserting={isInserting}
        document={activeDocForEdit}
        database={database}
        collection={collection}
        onSave={handleSaveDocument}
        onClose={() => {
          setIsEditorOpen(false);
          setActiveDocForEdit(null);
        }}
      />

      {/* Delete Document Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[#ef4444]/40 bg-[var(--surface-card)] p-5 shadow-2xl space-y-3">
            <h3 className="font-sans text-sm font-bold text-[#ef4444] flex items-center gap-1.5">
              <Trash2Icon size={16} />
              <span>Delete Document</span>
            </h3>
            <p className="text-xs text-[var(--body)]">
              Are you sure you want to permanently delete document with ID:{" "}
              <code className="font-mono text-[var(--ink)] font-bold">
                {String(deleteTarget._id ?? "unknown")}
              </code>
              ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold transition"
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
