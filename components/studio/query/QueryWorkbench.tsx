"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type { StudioTab, DocumentViewMode, QueryTabState } from "@/lib/studio/workspace-types";
import { executeQueryAction } from "@/app/actions";
import { DocumentTable } from "../collection/DocumentTable";
import { DocumentJsonView } from "../collection/DocumentJsonView";
import { DocumentTreeView } from "../collection/DocumentTreeView";
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
} from "lucide-react";

interface QueryWorkbenchProps {
  tab: StudioTab;
}

export function QueryWorkbench({ tab }: QueryWorkbenchProps) {
  const {
    databases,
    collectionsMap,
    updateTabState,
    addQueryHistory,
    saveDraft,
    setStatusMessage,
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
  const [filterCode, setFilterCode] = useState(state.filter || "{}");
  const [projectionCode, setProjectionCode] = useState(state.projection || "");
  const [sortCode, setSortCode] = useState(state.sort || "");
  const [limitVal, setLimitVal] = useState(state.limit || 50);
  const [skipVal, setSkipVal] = useState(state.skip || 0);

  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(tab.error || null);
  const [durationMs, setDurationMs] = useState<number | null>(tab.executionDurationMs ?? null);
  const [copiedResults, setCopiedResults] = useState(false);

  const availableCollections = collectionsMap[selectedDb] || [];

  // Sync state back to tab so reload and persistence replay exact query
  const lastStateSyncRef = useRef<string>("");
  useEffect(() => {
    const key = `${selectedDb}:${selectedCol}:${filterCode}:${projectionCode}:${sortCode}:${limitVal}:${skipVal}`;
    if (lastStateSyncRef.current === key) return;
    lastStateSyncRef.current = key;

    const timeout = setTimeout(() => {
      updateTabState(tab.id, {
        database: selectedDb,
        collection: selectedCol,
        queryState: {
          ...state,
          database: selectedDb,
          collection: selectedCol,
          filter: filterCode,
          projection: projectionCode,
          sort: sortCode,
          limit: limitVal,
          skip: skipVal,
        },
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [selectedDb, selectedCol, filterCode, projectionCode, sortCode, limitVal, skipVal, tab.id, updateTabState, state]);

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
      setErrorMsg(null);
    } catch (err: unknown) {
      setErrorMsg(`Format error: ${(err as Error).message}`);
    }
  };

  const handleClearCode = () => {
    setFilterCode("{}");
    setProjectionCode("");
    setSortCode("");
    setErrorMsg(null);
  };

  const handleSaveDraft = () => {
    saveDraft({
      id: `draft-${Date.now()}`,
      name: queryName,
      database: selectedDb,
      collection: selectedCol,
      type: "find",
      content: filterCode,
      updatedAt: Date.now(),
    });
    setStatusMessage({ text: `Saved draft '${queryName}'`, tone: "success" });
  };

  const handleRunQuery = useCallback(async () => {
    setIsRunning(true);
    setErrorMsg(null);

    // Validate JSON
    try {
      if (filterCode.trim()) JSON.parse(filterCode.trim());
      if (projectionCode.trim()) JSON.parse(projectionCode.trim());
      if (sortCode.trim()) JSON.parse(sortCode.trim());
    } catch (err: unknown) {
      setErrorMsg(`Syntax Error: ${(err as Error).message}`);
      setIsRunning(false);
      return;
    }

    try {
      const res = await executeQueryAction({
        database: selectedDb,
        collection: selectedCol,
        filter: filterCode,
        projection: projectionCode,
        sort: sortCode,
        limit: limitVal,
        skip: skipVal,
      });

      if (res.ok && res.data) {
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
            filter: filterCode,
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
          querySummary: `find(${filterCode})`,
          durationMs: res.durationMs ?? 0,
          documentCount: res.data.documents.length,
          success: true,
        });
      } else {
        const error = res.error || "Query failed";
        setErrorMsg(error);
        addQueryHistory({
          id: `hist-${Date.now()}`,
          timestamp: Date.now(),
          database: selectedDb,
          collection: selectedCol,
          type: "find",
          querySummary: `find(${filterCode})`,
          durationMs: res.durationMs ?? 0,
          documentCount: 0,
          success: false,
          error,
        });
      }
    } finally {
      setIsRunning(false);
    }
  }, [
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
  ]);

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

  // Keyboard shortcut Ctrl+Enter to run query
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunQuery();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunQuery]);

  return (
    <div className="flex flex-col h-full bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="h-11 px-3 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center justify-between gap-3 shrink-0 select-none">
        {/* Left: Query Name & Target DB / Collection */}
        <div className="flex items-center gap-2 min-w-0">
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

            <span className="text-[11px] text-[var(--muted)] font-mono">Collection:</span>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="h-7 px-2 rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-xs font-mono text-[var(--ink)] focus:outline-none"
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFormatCode}
            title="Prettify query JSON"
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
            onClick={handleClearCode}
            title="Clear editor"
            className="h-7 px-2 rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleRunQuery}
            disabled={isRunning}
            className="btn-primary h-7 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <PlayIcon size={12} className={isRunning ? "animate-spin" : "fill-current"} />
            <span>{isRunning ? "Running..." : "Run"}</span>
            <kbd className="hidden lg:inline-block text-[9px] font-mono opacity-70 ml-1">
              Ctrl+Enter
            </kbd>
          </button>
        </div>
      </div>

      {/* Editor & Results Split (Horizontal / Vertical Split) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-strong)]">
        {/* Editor Half */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full bg-[var(--surface-card)] overflow-hidden">
          <div className="p-2 bg-[var(--canvas-soft)] border-b border-[var(--hairline)] flex items-center justify-between text-xs font-semibold text-[var(--muted)] select-none">
            <span>QUERY SPECIFICATION (MQL / JSON)</span>
            <span className="text-[10px] font-mono">db.{selectedCol}.find()</span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto editor-scroll space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                Filter JSON Object
              </label>
              <textarea
                value={filterCode}
                onChange={(e) => {
                  setFilterCode(e.target.value);
                  setErrorMsg(null);
                }}
                rows={6}
                placeholder='{ "status": "active" }'
                className="w-full p-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-white text-xs leading-5 focus:outline-none focus:border-[var(--text-link)] resize-y editor-scroll"
                spellCheck={false}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                  Projection (Optional)
                </label>
                <textarea
                  value={projectionCode}
                  onChange={(e) => {
                    setProjectionCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  rows={3}
                  placeholder='["name", "email"]'
                  className="w-full p-2 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-white text-xs leading-5 focus:outline-none focus:border-[var(--text-link)] resize-y editor-scroll"
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                  Sort (Optional)
                </label>
                <textarea
                  value={sortCode}
                  onChange={(e) => {
                    setSortCode(e.target.value);
                    setErrorMsg(null);
                  }}
                  rows={3}
                  placeholder='{ "createdAt": -1 }'
                  className="w-full p-2 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-white text-xs leading-5 focus:outline-none focus:border-[var(--text-link)] resize-y editor-scroll"
                  spellCheck={false}
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
          </div>
        </div>

        {/* Results Half */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full bg-[var(--canvas)] overflow-hidden">
          {/* Results Toolbar */}
          <div className="h-9 px-3 border-b border-[var(--hairline)] bg-[var(--surface-card)] flex items-center justify-between select-none shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                RESULTS
              </span>

              {state.results !== null && (
                <span className="text-xs font-mono text-[var(--ink)] font-semibold">
                  {state.results.length} document{state.results.length === 1 ? "" : "s"}
                </span>
              )}

              {typeof durationMs === "number" && (
                <span className="flex items-center gap-1 text-[#fbbf24] font-mono text-xs">
                  <ZapIcon size={12} />
                  <span>{durationMs} ms</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                      <Icon size={13} />
                    </button>
                  );
                })}
              </div>

              {state.results && state.results.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyResults}
                    title="Copy results JSON"
                    className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
                  >
                    {copiedResults ? (
                      <CheckIcon size={13} className="text-[var(--text-link)]" />
                    ) : (
                      <CopyIcon size={13} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    title="Export results"
                    className="p-1.5 rounded-[5px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
                  >
                    <DownloadIcon size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Results Body / Error Banner */}
          <div className="flex-1 overflow-hidden p-3">
            {errorMsg ? (
              <div className="p-4 rounded-[8px] border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] font-mono text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircleIcon size={14} />
                  <span>Query Execution Error</span>
                </div>
                <div className="text-[11px] leading-relaxed break-all pl-5">{errorMsg}</div>
              </div>
            ) : state.results === null ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-2">
                <TerminalIcon size={28} className="text-[var(--muted)]/40" />
                <p>Press &quot;Run&quot; or Ctrl+Enter to execute the query against {selectedDb}.{selectedCol}.</p>
              </div>
            ) : state.results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-2">
                <p>No documents matched the specified filter.</p>
              </div>
            ) : (
              <div className="h-full overflow-hidden">
                {state.viewMode === "table" && (
                  <DocumentTable
                    documents={state.results}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
                {state.viewMode === "json" && (
                  <DocumentJsonView
                    documents={state.results}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
                {state.viewMode === "tree" && (
                  <DocumentTreeView
                    documents={state.results}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
