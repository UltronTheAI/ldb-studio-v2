"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Document } from "@liorandb/driver";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type {
  StudioTab,
  DocumentViewMode,
  QueryTabState,
  QueryOperationMode,
} from "@/lib/studio/workspace-types";
import {
  insertOneDocumentAction,
  insertManyDocumentsAction,
  updateOneDocumentAction,
  deleteOneDocumentAction,
  deleteManyDocumentsAction,
} from "@/app/actions";
import type { StudioErrorDescriptor } from "@/lib/liorandb/errors";
import { DocumentTable } from "../collection/DocumentTable";
import { DocumentJsonView } from "../collection/DocumentJsonView";
import { DocumentTreeView } from "../collection/DocumentTreeView";
import { DocumentEditorModal } from "../collection/DocumentEditorModal";
import { QueryInsertModal } from "./QueryInsertModal";
import { TableSkeletonWidget } from "../widgets/LoadingWidget";
import { JsonCodeEditor } from "../widgets/JsonCodeEditor";
import {
  PlayIcon,
  SparklesIcon,
  BookmarkIcon,
  Table2Icon,
  CodeIcon,
  ListTreeIcon,
  ZapIcon,
  AlertCircleIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  TerminalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  FilePlusIcon,
  FilesIcon,
  RefreshCwIcon,
} from "lucide-react";

interface QueryWorkbenchProps {
  tab: StudioTab;
}

const DEFAULT_INSERT_ONE = JSON.stringify(
  {
    name: "New Document",
    status: "active",
    createdAt: new Date().toISOString(),
  },
  null,
  2,
);

const DEFAULT_INSERT_MANY = JSON.stringify(
  [
    {
      name: "Document 1",
      quantity: 10,
      status: "active",
    },
    {
      name: "Document 2",
      quantity: 25,
      status: "pending",
    },
  ],
  null,
  2,
);

export function QueryWorkbench({ tab }: QueryWorkbenchProps) {
  const {
    databases,
    collectionsMap,
    updateTabState,
    addQueryHistory,
    saveDraft,
    setStatusMessage,
    dataClient,
  } = useWorkspace();

  const state = useMemo(
    (): QueryTabState =>
      tab.queryState || {
        queryName: tab.title || "Query 1",
        database: tab.database || databases[0] || "default",
        collection: tab.collection || "collection",
        queryMode: "find",
        filter: "{}",
        projection: "",
        sort: "",
        limit: 50,
        skip: 0,
        rawJson: JSON.stringify({ filter: {}, limit: 50 }, null, 2),
        results: null,
        resultCount: 0,
        viewMode: "table" as DocumentViewMode,
      },
    [tab.queryState, tab.title, tab.database, tab.collection, databases],
  );

  const [queryName, setQueryName] = useState(state.queryName);
  const [selectedDb, setSelectedDb] = useState(state.database);
  const [selectedCol, setSelectedCol] = useState(state.collection);

  // Operation Mode
  const [operationMode, setOperationMode] = useState<QueryOperationMode>(
    state.queryMode || "find",
  );

  // Find Mode State
  const [filterCode, setFilterCode] = useState(state.filter || "{}");
  const [projectionCode, setProjectionCode] = useState(state.projection || "");
  const [sortCode, setSortCode] = useState(state.sort || "");
  const [limitVal, setLimitVal] = useState(state.limit || 50);
  const [skipVal, setSkipVal] = useState(state.skip || 0);

  // Mutation Mode States
  const [insertDocCode, setInsertDocCode] = useState(
    state.insertDocJson || DEFAULT_INSERT_ONE,
  );
  const [insertManyDocsCode, setInsertManyDocsCode] = useState(
    state.insertManyDocsJson || DEFAULT_INSERT_MANY,
  );
  const [deleteOneFilterCode, setDeleteOneFilterCode] = useState(
    state.deleteFilterJson || '{\n  "_id": ""\n}',
  );
  const [deleteManyFilterCode, setDeleteManyFilterCode] = useState(
    '{\n  "status": "deprecated"\n}',
  );

  // Results & Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(tab.error || null);
  const [errorDescriptor, setErrorDescriptor] = useState<StudioErrorDescriptor | null>(null);
  const [mutationSuccessMessage, setMutationSuccessMessage] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(tab.executionDurationMs ?? null);
  const [copiedResults, setCopiedResults] = useState(false);

  const activeQueryIdRef = useRef<number>(0);

  // In-Browser search & filter
  const [browserSearch, setBrowserSearch] = useState("");

  // Modals
  const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeDocForEdit, setActiveDocForEdit] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableCollections = collectionsMap[selectedDb] || [];

  // Sync state back to tab so reload and persistence replay exact query
  const lastStateSyncRef = useRef<string>("");
  useEffect(() => {
    const key = `${selectedDb}:${selectedCol}:${operationMode}:${filterCode}:${projectionCode}:${sortCode}:${limitVal}:${skipVal}:${insertDocCode.length}:${insertManyDocsCode.length}:${deleteOneFilterCode.length}`;
    if (lastStateSyncRef.current === key) return;
    lastStateSyncRef.current = key;

    const timeout = setTimeout(() => {
      updateTabState(tab.id, {
        database: selectedDb,
        collection: selectedCol,
        queryState: {
          ...state,
          queryName,
          database: selectedDb,
          collection: selectedCol,
          queryMode: operationMode,
          filter: filterCode,
          projection: projectionCode,
          sort: sortCode,
          limit: limitVal,
          skip: skipVal,
          insertDocJson: insertDocCode,
          insertManyDocsJson: insertManyDocsCode,
          deleteFilterJson: deleteOneFilterCode,
        },
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [
    selectedDb,
    selectedCol,
    operationMode,
    filterCode,
    projectionCode,
    sortCode,
    limitVal,
    skipVal,
    insertDocCode,
    insertManyDocsCode,
    deleteOneFilterCode,
    queryName,
    tab.id,
    updateTabState,
    state,
  ]);

  // Sync collection when database changes
  const handleDbChange = (newDb: string) => {
    setSelectedDb(newDb);
    const cols = collectionsMap[newDb] || [];
    if (cols.length > 0 && !cols.includes(selectedCol)) {
      setSelectedCol(cols[0]);
    }
  };

  const handleFormatCode = () => {
    try {
      if (operationMode === "find") {
        const parsedFilter = JSON.parse(filterCode);
        setFilterCode(JSON.stringify(parsedFilter, null, 2));
        if (projectionCode.trim()) {
          const parsedProj = JSON.parse(projectionCode);
          setProjectionCode(JSON.stringify(parsedProj, null, 2));
        }
        if (sortCode.trim()) {
          const parsedSort = JSON.parse(sortCode);
          setSortCode(JSON.stringify(parsedSort, null, 2));
        }
      } else if (operationMode === "insertOne") {
        const parsed = JSON.parse(insertDocCode);
        setInsertDocCode(JSON.stringify(parsed, null, 2));
      } else if (operationMode === "insertMany") {
        const parsed = JSON.parse(insertManyDocsCode);
        setInsertManyDocsCode(JSON.stringify(parsed, null, 2));
      } else if (operationMode === "deleteOne") {
        const parsed = JSON.parse(deleteOneFilterCode);
        setDeleteOneFilterCode(JSON.stringify(parsed, null, 2));
      } else if (operationMode === "deleteMany") {
        const parsed = JSON.parse(deleteManyFilterCode);
        setDeleteManyFilterCode(JSON.stringify(parsed, null, 2));
      }
      setErrorMsg(null);
    } catch (err: unknown) {
      setErrorMsg(`Format error: ${(err as Error).message}`);
    }
  };

  const handleResetTemplate = () => {
    if (operationMode === "find") {
      setFilterCode("{}");
      setProjectionCode("");
      setSortCode("");
    } else if (operationMode === "insertOne") {
      setInsertDocCode(DEFAULT_INSERT_ONE);
    } else if (operationMode === "insertMany") {
      setInsertManyDocsCode(DEFAULT_INSERT_MANY);
    } else if (operationMode === "deleteOne") {
      setDeleteOneFilterCode('{\n  "_id": ""\n}');
    } else if (operationMode === "deleteMany") {
      setDeleteManyFilterCode('{\n  "status": "deprecated"\n}');
    }
    setErrorMsg(null);
    setMutationSuccessMessage(null);
  };

  const handleSaveDraft = () => {
    saveDraft({
      id: `draft-${Date.now()}`,
      name: queryName,
      database: selectedDb,
      collection: selectedCol,
      type: operationMode === "find" ? "find" : "mutation",
      content:
        operationMode === "find"
          ? filterCode
          : operationMode === "insertOne"
          ? insertDocCode
          : operationMode === "insertMany"
          ? insertManyDocsCode
          : operationMode === "deleteOne"
          ? deleteOneFilterCode
          : deleteManyFilterCode,
      updatedAt: Date.now(),
    });
    setStatusMessage({ text: `Saved draft '${queryName}'`, tone: "success" });
  };

  // Run Query (Find)
  const handleRunFind = useCallback(
    async (overrideFilter?: string) => {
      const reqId = ++activeQueryIdRef.current;
      setIsRunning(true);
      setErrorMsg(null);
      setErrorDescriptor(null);
      setMutationSuccessMessage(null);

      const activeFilter = overrideFilter ?? filterCode;

      // Validate JSON
      try {
        if (activeFilter.trim()) JSON.parse(activeFilter.trim());
        if (projectionCode.trim()) JSON.parse(projectionCode.trim());
        if (sortCode.trim()) JSON.parse(sortCode.trim());
      } catch (err: unknown) {
        setErrorMsg(`Syntax Error: ${(err as Error).message}`);
        setIsRunning(false);
        return;
      }

      try {
        const res = await dataClient.executeQuery({
          database: selectedDb,
          collection: selectedCol,
          filter: activeFilter,
          projection: projectionCode,
          sort: sortCode,
          limit: limitVal,
          skip: skipVal,
        });

        if (reqId !== activeQueryIdRef.current) return;

        if (res.ok && res.data) {
          setErrorDescriptor(null);
          setDurationMs(res.durationMs ?? null);
          updateTabState(tab.id, {
            title: queryName,
            database: selectedDb,
            collection: selectedCol,
            executionDurationMs: res.durationMs,
            error: null,
            queryState: {
              ...state,
              queryName,
              database: selectedDb,
              collection: selectedCol,
              filter: activeFilter,
              projection: projectionCode,
              sort: sortCode,
              limit: limitVal,
              skip: skipVal,
              results: res.data.documents,
              resultCount: res.data.total,
            },
          });

          // Add to history
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "find",
            querySummary: `find(${activeFilter})`,
            durationMs: res.durationMs ?? 0,
            documentCount: res.data.documents.length,
            success: true,
          });
        } else {
          const error = res.error || "Query failed";
          setErrorMsg(error);
          setErrorDescriptor(res.errorDescriptor ?? null);
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "find",
            querySummary: `find(${activeFilter})`,
            durationMs: res.durationMs ?? 0,
            documentCount: 0,
            success: false,
            error,
          });
        }
      } finally {
        if (reqId === activeQueryIdRef.current) {
          setIsRunning(false);
        }
      }
    },
    [
      filterCode,
      projectionCode,
      sortCode,
      selectedDb,
      selectedCol,
      limitVal,
      skipVal,
      tab.id,
      queryName,
      state,
      updateTabState,
      addQueryHistory,
      dataClient,
    ],
  );

  // Execute Action for the active Operation Mode
  const handleExecute = useCallback(async () => {
    if (operationMode === "find") {
      await handleRunFind();
      return;
    }

    if (operationMode === "insertOne") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(insertDocCode);
      } catch (err: unknown) {
        setErrorMsg(`Syntax Error in Document JSON: ${(err as Error).message}`);
        return;
      }

      if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
        setErrorMsg("Insert One requires a JSON object { ... }, not an array.");
        return;
      }

      setIsRunning(true);
      setErrorMsg(null);
      setMutationSuccessMessage(null);
      try {
        const res = await insertOneDocumentAction({
          database: selectedDb,
          collection: selectedCol,
          documentJson: insertDocCode,
        });

        if (res.ok && res.data) {
          setDurationMs(res.durationMs ?? null);
          const msg = `Inserted 1 document (ID: ${String(res.data.insertedId)}) in ${res.durationMs}ms`;
          setMutationSuccessMessage(msg);
          setStatusMessage({ text: msg, tone: "success" });
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "insert",
            querySummary: `insertOne(${insertDocCode.slice(0, 50)}...)`,
            durationMs: res.durationMs ?? 0,
            documentCount: 1,
            success: true,
          });
          // Refresh browser
          dataClient.invalidateCollection(selectedDb, selectedCol);
          await handleRunFind();
        } else {
          setErrorMsg(res.error || "Failed to insert document");
        }
      } finally {
        setIsRunning(false);
      }
      return;
    }

    if (operationMode === "insertMany") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(insertManyDocsCode);
      } catch (err: unknown) {
        setErrorMsg(`Syntax Error in Documents Array: ${(err as Error).message}`);
        return;
      }

      if (!Array.isArray(parsed)) {
        setErrorMsg("Insert Many requires a JSON array [ { ... }, { ... } ]");
        return;
      }

      if (parsed.length === 0) {
        setErrorMsg("Documents array cannot be empty. Please provide at least one document.");
        return;
      }

      setIsRunning(true);
      setErrorMsg(null);
      setMutationSuccessMessage(null);
      try {
        const res = await insertManyDocumentsAction({
          database: selectedDb,
          collection: selectedCol,
          documentsJson: insertManyDocsCode,
        });

        if (res.ok && res.data) {
          setDurationMs(res.durationMs ?? null);
          const msg = `Successfully inserted ${res.data.insertedCount} documents in ${res.durationMs}ms`;
          setMutationSuccessMessage(msg);
          setStatusMessage({ text: msg, tone: "success" });
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "insert",
            querySummary: `insertMany(${res.data.insertedCount} documents)`,
            durationMs: res.durationMs ?? 0,
            documentCount: res.data.insertedCount,
            success: true,
          });
          // Refresh browser
          dataClient.invalidateCollection(selectedDb, selectedCol);
          await handleRunFind();
        } else {
          setErrorMsg(res.error || "Failed to insert documents");
        }
      } finally {
        setIsRunning(false);
      }
      return;
    }

    if (operationMode === "deleteOne") {
      try {
        JSON.parse(deleteOneFilterCode);
      } catch (err: unknown) {
        setErrorMsg(`Syntax Error in Delete Filter: ${(err as Error).message}`);
        return;
      }

      setIsRunning(true);
      setErrorMsg(null);
      setMutationSuccessMessage(null);
      try {
        const res = await deleteOneDocumentAction({
          database: selectedDb,
          collection: selectedCol,
          filterJson: deleteOneFilterCode,
        });

        if (res.ok && res.data) {
          setDurationMs(res.durationMs ?? null);
          const msg = `Deleted ${res.data.deletedCount} document in ${res.durationMs}ms`;
          setMutationSuccessMessage(msg);
          setStatusMessage({ text: msg, tone: "success" });
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "delete",
            querySummary: `deleteOne(${deleteOneFilterCode})`,
            durationMs: res.durationMs ?? 0,
            documentCount: res.data.deletedCount,
            success: true,
          });
          // Refresh browser
          dataClient.invalidateCollection(selectedDb, selectedCol);
          await handleRunFind();
        } else {
          setErrorMsg(res.error || "Failed to delete document");
        }
      } finally {
        setIsRunning(false);
      }
      return;
    }

    if (operationMode === "deleteMany") {
      try {
        JSON.parse(deleteManyFilterCode);
      } catch (err: unknown) {
        setErrorMsg(`Syntax Error in Delete Filter: ${(err as Error).message}`);
        return;
      }

      setIsRunning(true);
      setErrorMsg(null);
      setMutationSuccessMessage(null);
      try {
        const res = await deleteManyDocumentsAction({
          database: selectedDb,
          collection: selectedCol,
          filterJson: deleteManyFilterCode,
        });

        if (res.ok && res.data) {
          setDurationMs(res.durationMs ?? null);
          const msg = `Deleted ${res.data.deletedCount} documents in ${res.durationMs}ms`;
          setMutationSuccessMessage(msg);
          setStatusMessage({ text: msg, tone: "success" });
          addQueryHistory({
            id: `hist-${Date.now()}`,
            timestamp: Date.now(),
            database: selectedDb,
            collection: selectedCol,
            type: "delete",
            querySummary: `deleteMany(${deleteManyFilterCode})`,
            durationMs: res.durationMs ?? 0,
            documentCount: res.data.deletedCount,
            success: true,
          });
          // Refresh browser
          dataClient.invalidateCollection(selectedDb, selectedCol);
          await handleRunFind();
        } else {
          setErrorMsg(res.error || "Failed to delete documents");
        }
      } finally {
        setIsRunning(false);
      }
    }
  }, [
    operationMode,
    handleRunFind,
    insertDocCode,
    selectedDb,
    selectedCol,
    setStatusMessage,
    addQueryHistory,
    insertManyDocsCode,
    deleteOneFilterCode,
    deleteManyFilterCode,
    dataClient,
  ]);

  // Edit document handler (opens modal)
  const handleOpenEdit = (doc: Document) => {
    setActiveDocForEdit(doc);
    setIsEditModalOpen(true);
  };

  // Save edited document
  const handleSaveEdit = async (docJson: string, isInsert: boolean): Promise<boolean> => {
    if (isInsert) {
      const res = await insertOneDocumentAction({
        database: selectedDb,
        collection: selectedCol,
        documentJson: docJson,
      });
      if (res.ok && res.data) {
        setStatusMessage({
          text: `Document inserted (ID: ${String(res.data.insertedId)})`,
          tone: "success",
        });
        dataClient.invalidateCollection(selectedDb, selectedCol);
        handleRunFind();
        return true;
      }
      setStatusMessage({ text: res.error || "Failed to insert document", tone: "error" });
      return false;
    }

    if (!activeDocForEdit || activeDocForEdit._id === undefined) return false;
    const filterJson = JSON.stringify({ _id: activeDocForEdit._id });
    const parsedUpdate = JSON.parse(docJson) as Document;
    delete parsedUpdate._id; // Remove _id from $set

    const res = await updateOneDocumentAction({
      database: selectedDb,
      collection: selectedCol,
      filterJson,
      updateJson: JSON.stringify({ $set: parsedUpdate }),
    });

    if (res.ok) {
      setStatusMessage({ text: "Document updated successfully", tone: "success" });
      dataClient.invalidateCollection(selectedDb, selectedCol);
      // Update local state directly for responsive feedback
      const updatedDocs = (state.results || []).map((d) =>
        d._id === activeDocForEdit._id ? { ...parsedUpdate, _id: activeDocForEdit._id } : d,
      );
      updateTabState(tab.id, {
        queryState: {
          ...state,
          results: updatedDocs,
        },
      });
      return true;
    }
    setStatusMessage({ text: res.error || "Failed to update document", tone: "error" });
    return false;
  };

  // Delete document handler (opens confirmation)
  const handleOpenDelete = (doc: Document) => {
    setDeleteTarget(doc);
  };

  // Confirm delete single document
  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteTarget._id === undefined) return;
    setIsDeleting(true);
    try {
      const res = await deleteOneDocumentAction({
        database: selectedDb,
        collection: selectedCol,
        filterJson: JSON.stringify({ _id: deleteTarget._id }),
      });

      if (res.ok) {
        setStatusMessage({ text: "Document deleted successfully", tone: "success" });
        dataClient.invalidateCollection(selectedDb, selectedCol);
        const updatedDocs = (state.results || []).filter((d) => d._id !== deleteTarget._id);
        updateTabState(tab.id, {
          queryState: {
            ...state,
            results: updatedDocs,
            resultCount: Math.max(0, (state.resultCount || 1) - 1),
          },
        });
        setDeleteTarget(null);
      } else {
        setStatusMessage({ text: res.error || "Failed to delete document", tone: "error" });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered documents in Document Browser
  const displayedDocuments = useMemo(() => {
    if (!state.results) return [];
    if (!browserSearch.trim()) return state.results;
    const term = browserSearch.toLowerCase();
    return state.results.filter((doc) => {
      try {
        return JSON.stringify(doc).toLowerCase().includes(term);
      } catch {
        return false;
      }
    });
  }, [state.results, browserSearch]);

  const handleCopyResults = () => {
    if (!state.results) return;
    navigator.clipboard.writeText(JSON.stringify(state.results, null, 2));
    setCopiedResults(true);
    setTimeout(() => setCopiedResults(false), 1500);
  };

  const handleExportJson = () => {
    if (!state.results) return;
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(state.results, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${queryName.replace(/\s+/g, "_")}_results.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Keyboard shortcut Ctrl+Enter to execute active mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleExecute]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="min-h-11 px-3 py-1.5 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex flex-wrap items-center justify-between gap-2.5 shrink-0 sticky top-0 z-10 select-none">
        {/* Left: Query Name & Target DB / Collection */}
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <input
            type="text"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            className="w-32 sm:w-44 h-7 px-2 font-bold text-xs rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-[var(--ink)] focus:outline-none focus:border-[var(--text-link)] truncate"
          />

          <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--hairline)]">
            <span className="text-[11px] text-[var(--muted)] font-mono">DB:</span>
            <select
              value={selectedDb}
              onChange={(e) => handleDbChange(e.target.value)}
              className="h-7 px-2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-xs font-mono text-[var(--ink)] focus:outline-none"
            >
              {databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>

            <span className="text-[11px] text-[var(--muted)] font-mono">Col:</span>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="h-7 px-2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-xs font-mono text-[var(--ink)] focus:outline-none max-w-[140px] truncate"
            >
              {availableCollections.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsInsertModalOpen(true)}
            title="Open Document Insertion Modal"
            className="h-7 px-2.5 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5 transition"
          >
            <PlusIcon size={12} className="text-[var(--text-link)]" />
            <span>Add Docs</span>
          </button>

          <button
            type="button"
            onClick={handleFormatCode}
            title="Prettify active JSON"
            className="h-7 px-2 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-medium text-[var(--ink)] flex items-center gap-1 transition"
          >
            <SparklesIcon size={12} />
            <span className="hidden sm:inline">Format</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            title="Save query draft"
            className="h-7 px-2 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-medium text-[var(--ink)] flex items-center gap-1 transition"
          >
            <BookmarkIcon size={12} />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={handleResetTemplate}
            title="Reset code editor"
            className="h-7 px-2 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={isRunning}
            className="btn-primary h-7 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-xs"
          >
            <PlayIcon size={12} className={isRunning ? "animate-spin" : "fill-current"} />
            <span>
              {isRunning
                ? "Running..."
                : operationMode === "find"
                ? "Run Find"
                : operationMode === "insertOne"
                ? "Insert One"
                : operationMode === "insertMany"
                ? "Insert Many"
                : operationMode === "deleteOne"
                ? "Delete One"
                : "Delete Many"}
            </span>
            <kbd className="hidden lg:inline-block text-[9px] font-mono opacity-70 ml-1">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </div>

      {/* Editor & Results Split */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-strong)]">
        {/* Left: Query Specification & Operations */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full min-h-0 bg-[var(--surface-card)] overflow-hidden">
          {/* Operation Selector Pills */}
          <div className="p-2 bg-[var(--canvas-soft)] border-b border-[var(--hairline)] flex items-center justify-between gap-2 select-none overflow-x-auto">
            <div className="flex items-center gap-1 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-0.5">
              {[
                { id: "find", label: "Find", icon: SearchIcon },
                { id: "insertOne", label: "Insert One", icon: FilePlusIcon },
                { id: "insertMany", label: "Insert Many", icon: FilesIcon },
                { id: "deleteOne", label: "Delete One", icon: Trash2Icon },
                { id: "deleteMany", label: "Delete Many", icon: Trash2Icon },
              ].map((op) => {
                const isActive = operationMode === op.id;
                const Icon = op.icon;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setOperationMode(op.id as QueryOperationMode);
                      setErrorMsg(null);
                      setMutationSuccessMessage(null);
                    }}
                    className={`px-2 py-1 rounded-[4px] text-[11px] font-medium flex items-center gap-1 transition ${
                      isActive
                        ? "bg-[var(--canvas-soft)] text-[var(--ink)] font-bold shadow-xs border border-[var(--hairline)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <Icon size={11} className={isActive ? "text-[var(--text-link)]" : ""} />
                    <span>{op.label}</span>
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] font-mono text-[var(--muted)] hidden sm:inline">
              db.{selectedCol}.{operationMode}()
            </span>
          </div>

          {/* Operation Status Banners */}
          {mutationSuccessMessage && (
            <div className="mx-3 mt-3 p-2.5 rounded-[6px] bg-[var(--surface-strong)] border border-[var(--hairline-strong)] text-[var(--ink)] font-mono text-xs flex items-center gap-2">
              <CheckIcon size={14} className="text-[var(--text-link)] shrink-0" />
              <span>{mutationSuccessMessage}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mx-3 mt-3 p-2.5 rounded-[6px] bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] font-mono text-xs flex items-center gap-2">
              <AlertCircleIcon size={14} className="shrink-0" />
              <span className="break-all">{errorMsg}</span>
            </div>
          )}

          {/* Operation Form Area */}
          <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-contain editor-scroll space-y-3 font-mono text-xs">
            {/* 1. FIND MODE */}
            {operationMode === "find" && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                    Filter JSON Object
                  </label>
                  <JsonCodeEditor
                    value={filterCode}
                    onChange={(val) => {
                      setFilterCode(val);
                      setErrorMsg(null);
                    }}
                    rows={6}
                    placeholder='{ "status": "active" }'
                    showLineNumbers
                    showToolbar
                    title="Filter"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Projection (Optional)
                    </label>
                    <JsonCodeEditor
                      value={projectionCode}
                      onChange={(val) => {
                        setProjectionCode(val);
                        setErrorMsg(null);
                      }}
                      rows={3}
                      placeholder='["name", "email"]'
                      showToolbar
                      title="Projection"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Sort (Optional)
                    </label>
                    <JsonCodeEditor
                      value={sortCode}
                      onChange={(val) => {
                        setSortCode(val);
                        setErrorMsg(null);
                      }}
                      rows={3}
                      placeholder='{ "createdAt": -1 }'
                      showToolbar
                      title="Sort"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={limitVal}
                      onChange={(e) => setLimitVal(Number(e.target.value))}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Skip
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={skipVal}
                      onChange={(e) => setSkipVal(Number(e.target.value))}
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 2. INSERT ONE MODE */}
            {operationMode === "insertOne" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                    Document to Insert (Single JSON Object)
                  </label>
                  <span className="text-[10px] text-[var(--muted)]">_id auto-assigned if omitted</span>
                </div>
                <JsonCodeEditor
                  value={insertDocCode}
                  onChange={(val) => {
                    setInsertDocCode(val);
                    setErrorMsg(null);
                  }}
                  rows={12}
                  placeholder='{ "title": "Example", "score": 95 }'
                  showLineNumbers
                  showToolbar
                  title="Insert Document"
                />
              </div>
            )}

            {/* 3. INSERT MANY MODE */}
            {operationMode === "insertMany" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                    Documents Array (JSON Array of Objects)
                  </label>
                  <span className="text-[10px] text-[var(--muted)]">[ {`{...}`}, {`{...}`} ]</span>
                </div>
                <JsonCodeEditor
                  value={insertManyDocsCode}
                  onChange={(val) => {
                    setInsertManyDocsCode(val);
                    setErrorMsg(null);
                  }}
                  rows={12}
                  placeholder='[\n  { "name": "Item A", "count": 1 },\n  { "name": "Item B", "count": 2 }\n]'
                  showLineNumbers
                  showToolbar
                  title="Insert Documents Array"
                />
              </div>
            )}

            {/* 4. DELETE ONE MODE */}
            {operationMode === "deleteOne" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                    Delete One Filter (Matches first document)
                  </label>
                  <span className="text-[10px] text-[#ef4444]">Deletes 1 matching document</span>
                </div>
                <JsonCodeEditor
                  value={deleteOneFilterCode}
                  onChange={(val) => {
                    setDeleteOneFilterCode(val);
                    setErrorMsg(null);
                  }}
                  rows={8}
                  placeholder='{ "_id": "doc-id-here" }'
                  showLineNumbers
                  showToolbar
                  title="Delete Filter"
                />
                <div className="p-3 rounded-[6px] bg-[var(--canvas-soft)] border border-[var(--hairline)] text-xs text-[var(--muted)] space-y-1 font-sans">
                  <div className="font-semibold text-[var(--ink)]">Target Filtering Notice:</div>
                  <p>
                    Executes <code>db.{selectedCol}.deleteOne(filter)</code>. Only the first document matching this filter will be removed.
                  </p>
                </div>
              </div>
            )}

            {/* 5. DELETE MANY MODE */}
            {operationMode === "deleteMany" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                    Delete Many Filter (Matches all documents)
                  </label>
                  <span className="text-[10px] text-[#ef4444] font-bold">Caution: Multi-document deletion</span>
                </div>
                <JsonCodeEditor
                  value={deleteManyFilterCode}
                  onChange={(val) => {
                    setDeleteManyFilterCode(val);
                    setErrorMsg(null);
                  }}
                  rows={8}
                  placeholder='{ "status": "expired" }'
                  showLineNumbers
                  showToolbar
                  title="Delete Many Filter"
                />
                <div className="p-3 rounded-[6px] bg-[#ef4444]/10 border border-[#ef4444]/30 text-xs text-[#ef4444] space-y-1 font-sans">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircleIcon size={13} />
                    <span>Warning: Bulk Deletion</span>
                  </div>
                  <p className="text-[11px] leading-tight">
                    Every document in <code>{selectedCol}</code> that matches this filter will be deleted. Use with care.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Document Browser & Results */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full min-h-0 bg-[var(--canvas)] overflow-hidden">
          {/* Document Browser Toolbar */}
          <div className="min-h-10 px-3 py-1.5 border-b border-[var(--hairline)] bg-[var(--surface-card)] flex flex-wrap items-center justify-between gap-2 select-none shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <span className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Document Browser
              </span>

              {state.results !== null && (
                <span className="text-xs font-mono text-[var(--muted)]">
                  {displayedDocuments.length}
                  {browserSearch ? ` of ${state.results.length}` : ""} doc
                  {displayedDocuments.length === 1 ? "" : "s"}
                </span>
              )}

              {typeof durationMs === "number" && (
                <span className="flex items-center gap-1 text-[#fbbf24] font-mono text-[11px]">
                  <ZapIcon size={11} />
                  <span>{durationMs} ms</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Search Filter in Browser */}
              {state.results && state.results.length > 0 && (
                <div className="relative">
                  <SearchIcon
                    size={11}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                  />
                  <input
                    type="text"
                    value={browserSearch}
                    onChange={(e) => setBrowserSearch(e.target.value)}
                    placeholder="Search docs..."
                    className="w-24 sm:w-32 h-6.5 pl-6 pr-2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-[11px] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--text-link)]"
                  />
                </div>
              )}

              {/* View Mode Toggle: Table | JSON | Tree */}
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
                          queryState: { ...state, viewMode: m.id as DocumentViewMode },
                        })
                      }
                      title={`${m.label} View`}
                      className={`p-1 rounded-[4px] text-xs transition ${
                        isActive
                          ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-xs"
                          : "text-[var(--muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <Icon size={12} />
                    </button>
                  );
                })}
              </div>

              {/* Refresh Document Browser */}
              <button
                type="button"
                onClick={() => handleRunFind()}
                title="Refresh Documents"
                className={`p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition ${
                  isRunning ? "animate-spin text-[var(--text-link)]" : ""
                }`}
              >
                <RefreshCwIcon size={12} />
              </button>

              {/* Add Document shortcut button */}
              <button
                type="button"
                onClick={() => setIsInsertModalOpen(true)}
                title="Add Documents"
                className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
              >
                <PlusIcon size={13} />
              </button>

              {state.results && state.results.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyResults}
                    title="Copy results JSON"
                    className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
                  >
                    {copiedResults ? (
                      <CheckIcon size={12} className="text-[var(--text-link)]" />
                    ) : (
                      <CopyIcon size={12} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    title="Export results"
                    className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
                  >
                    <DownloadIcon size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Results Body / Document Browser Content */}
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            {isRunning ? (
              <TableSkeletonWidget
                columns={4}
                rows={8}
                message={`Querying ${selectedDb}.${selectedCol}...`}
              />
            ) : errorMsg && state.results === null ? (
              <div className="p-4 rounded-[8px] border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircleIcon size={14} />
                    <span>{errorDescriptor?.title || "Execution Error"}</span>
                  </div>
                  {errorDescriptor?.grpcStatus && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[#ef4444]/40 text-[10px] uppercase font-bold text-[#ef4444]">
                      gRPC: {errorDescriptor.grpcStatus}
                    </span>
                  )}
                </div>
                <div className="text-[11px] leading-relaxed break-all pl-5">{errorMsg}</div>
                {errorDescriptor?.suggestion && (
                  <div className="text-[10px] italic opacity-85 pl-5">
                    Suggestion: {errorDescriptor.suggestion}
                  </div>
                )}
              </div>
            ) : state.results === null ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-3 p-6">
                <TerminalIcon size={28} className="text-[var(--muted)]/40" />
                <div className="space-y-1">
                  <p className="font-bold text-[var(--ink)]">Document Browser Ready</p>
                  <p className="text-[11px]">
                    Execute a query or click below to browse documents in {selectedDb}.{selectedCol}.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleRunFind("{}")}
                    className="btn-primary h-7 px-3 text-xs font-bold"
                  >
                    Browse All Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInsertModalOpen(true)}
                    className="h-7 px-3 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                  >
                    + Add Document
                  </button>
                </div>
              </div>
            ) : displayedDocuments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-3 p-6">
                <p>
                  {browserSearch
                    ? `No documents matched the search term "${browserSearch}".`
                    : `No documents found in ${selectedDb}.${selectedCol}.`}
                </p>
                <button
                  type="button"
                  onClick={() => setIsInsertModalOpen(true)}
                  className="btn-primary h-7 px-3 text-xs font-bold flex items-center gap-1"
                >
                  <PlusIcon size={12} />
                  <span>Add First Document</span>
                </button>
              </div>
            ) : (
              <div className="h-full overflow-hidden">
                {state.viewMode === "table" && (
                  <DocumentTable
                    documents={displayedDocuments}
                    onEdit={handleOpenEdit}
                    onDelete={handleOpenDelete}
                  />
                )}
                {state.viewMode === "json" && (
                  <DocumentJsonView
                    documents={displayedDocuments}
                    onEdit={handleOpenEdit}
                    onDelete={handleOpenDelete}
                  />
                )}
                {state.viewMode === "tree" && (
                  <DocumentTreeView
                    documents={displayedDocuments}
                    onEdit={handleOpenEdit}
                    onDelete={handleOpenDelete}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Document Modal */}
      <DocumentEditorModal
        isOpen={isEditModalOpen}
        isInserting={false}
        document={activeDocForEdit}
        database={selectedDb}
        collection={selectedCol}
        onSave={handleSaveEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setActiveDocForEdit(null);
        }}
      />

      {/* Dedicated Add Document (Insert One / Insert Many) Modal */}
      <QueryInsertModal
        isOpen={isInsertModalOpen}
        onClose={() => setIsInsertModalOpen(false)}
        database={selectedDb}
        collection={selectedCol}
        onSuccess={() => {
          dataClient.invalidateCollection(selectedDb, selectedCol);
          handleRunFind();
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#ef4444]">
              <Trash2Icon size={18} />
              <h3 className="font-sans text-sm font-bold text-[var(--ink)]">Delete Document</h3>
            </div>
            <p className="text-xs text-[var(--body)] font-sans leading-relaxed">
              Are you sure you want to permanently delete document:
              <code className="block mt-1.5 p-2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] font-mono text-xs text-[var(--ink)] break-all">
                {String(deleteTarget._id ?? "(no _id)")}
              </code>
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2Icon size={12} />
                <span>{isDeleting ? "Deleting..." : "Delete Document"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
