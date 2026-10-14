"use client";

import React, { useState } from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import type {
  StudioTab,
  AggregationStage,
  DocumentViewMode,
} from "@/lib/studio/workspace-types";
import { executeAggregationAction } from "@/app/actions";
import { DocumentTable } from "../collection/DocumentTable";
import { DocumentJsonView } from "../collection/DocumentJsonView";
import { DocumentTreeView } from "../collection/DocumentTreeView";
import {
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  Table2Icon,
  CodeIcon,
  ListTreeIcon,
  ZapIcon,
  AlertCircleIcon,
  CheckIcon,
  DownloadIcon,
  CopyIcon,
  LayersIcon,
} from "lucide-react";

interface AggregationWorkbenchProps {
  tab: StudioTab;
}

const SUPPORTED_OPERATORS = [
  "$match",
  "$group",
  "$sort",
  "$project",
  "$limit",
  "$skip",
  "$unwind",
  "$lookup",
  "$count",
];

export function AggregationWorkbench({ tab }: AggregationWorkbenchProps) {
  const { databases, collectionsMap, updateTabState, addQueryHistory } =
    useWorkspace();

  const state = tab.aggregationState || {
    name: tab.title || "Pipeline 1",
    database: tab.database || databases[0] || "default",
    collection: tab.collection || "collection",
    mode: "visual",
    stages: [
      {
        id: "stage-1",
        stageOperator: "$match",
        stageJson: '{\n  "status": "active"\n}',
        enabled: true,
      },
    ],
    rawPipelineJson: '[\n  {\n    "$match": {\n      "status": "active"\n    }\n  }\n]',
    results: null,
    resultCount: 0,
    viewMode: "table" as DocumentViewMode,
  };

  const [pipelineName, setPipelineName] = useState(state.name);
  const [selectedDb, setSelectedDb] = useState(state.database);
  const [selectedCol, setSelectedCol] = useState(state.collection);
  const [mode, setMode] = useState<"visual" | "raw">(state.mode);
  const [stages, setStages] = useState<AggregationStage[]>(state.stages);
  const [rawJson, setRawJson] = useState(state.rawPipelineJson);

  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(tab.error || null);
  const [durationMs, setDurationMs] = useState<number | null>(tab.executionDurationMs ?? null);
  const [copiedResults, setCopiedResults] = useState(false);

  const availableCollections = collectionsMap[selectedDb] || [];

  // Generate full raw pipeline JSON from enabled stages
  const compilePipelineJson = (currentStages: AggregationStage[]): string => {
    const pipelineArray = currentStages
      .filter((s) => s.enabled)
      .map((s) => {
        try {
          const body = JSON.parse(s.stageJson);
          return { [s.stageOperator]: body };
        } catch {
          return { [s.stageOperator]: {} };
        }
      });
    return JSON.stringify(pipelineArray, null, 2);
  };

  const handleAddStage = () => {
    const newStage: AggregationStage = {
      id: `stage-${Date.now()}`,
      stageOperator: "$match",
      stageJson: '{\n  \n}',
      enabled: true,
    };
    const nextStages = [...stages, newStage];
    setStages(nextStages);
    setRawJson(compilePipelineJson(nextStages));
  };

  const handleRemoveStage = (id: string) => {
    const nextStages = stages.filter((s) => s.id !== id);
    setStages(nextStages);
    setRawJson(compilePipelineJson(nextStages));
  };

  const handleToggleStage = (id: string) => {
    const nextStages = stages.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setStages(nextStages);
    setRawJson(compilePipelineJson(nextStages));
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const nextStages = [...stages];
    const [moved] = nextStages.splice(index, 1);
    nextStages.splice(newIndex, 0, moved);
    setStages(nextStages);
    setRawJson(compilePipelineJson(nextStages));
  };

  const handleUpdateStage = (id: string, operator: string, json: string) => {
    const nextStages = stages.map((s) =>
      s.id === id ? { ...s, stageOperator: operator, stageJson: json } : s,
    );
    setStages(nextStages);
    setRawJson(compilePipelineJson(nextStages));
  };

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setErrorMsg(null);

    const pipelinePayload = mode === "visual" ? compilePipelineJson(stages) : rawJson;

    try {
      JSON.parse(pipelinePayload);
    } catch (err: unknown) {
      setErrorMsg(`Pipeline syntax error: ${(err as Error).message}`);
      setIsRunning(false);
      return;
    }

    try {
      const res = await executeAggregationAction({
        database: selectedDb,
        collection: selectedCol,
        pipelineJson: pipelinePayload,
      });

      if (res.ok && res.data) {
        setDurationMs(res.durationMs ?? null);
        updateTabState(tab.id, {
          title: pipelineName,
          database: selectedDb,
          collection: selectedCol,
          executionDurationMs: res.durationMs,
          error: null,
          aggregationState: {
            ...state,
            name: pipelineName,
            database: selectedDb,
            collection: selectedCol,
            mode,
            stages,
            rawPipelineJson: pipelinePayload,
            results: res.data.documents,
            resultCount: res.data.documents.length,
          },
        });

        addQueryHistory({
          id: `hist-${Date.now()}`,
          timestamp: Date.now(),
          database: selectedDb,
          collection: selectedCol,
          type: "aggregate",
          querySummary: `aggregate([${stages.length} stages])`,
          durationMs: res.durationMs ?? 0,
          documentCount: res.data.documents.length,
          success: true,
        });
      } else {
        const error = res.error || "Aggregation pipeline failed";
        setErrorMsg(error);
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--canvas)] text-[var(--ink)] overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-3 border-b border-[var(--hairline-strong)] bg-[var(--surface-card)] flex items-center justify-between gap-3 shrink-0 select-none">
        {/* Left: Name and Scope */}
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="text"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            className="w-32 sm:w-44 h-7 px-2 font-bold text-xs rounded bg-[var(--canvas-soft)] border border-[var(--hairline-strong)] text-[var(--ink)] focus:outline-none focus:border-[var(--text-link)] truncate"
          />

          <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--hairline)]">
            <span className="text-[11px] text-[var(--muted)] font-mono">DB:</span>
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
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

        {/* Right: Mode Switcher & Run */}
        <div className="flex items-center gap-2">
          {/* Visual vs Raw JSON toggle */}
          <div className="flex items-center rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-0.5">
            <button
              type="button"
              onClick={() => setMode("visual")}
              className={`px-2 py-0.5 rounded-[4px] text-xs font-medium transition ${
                mode === "visual"
                  ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-xs font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Stage Cards
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={`px-2 py-0.5 rounded-[4px] text-xs font-medium transition ${
                mode === "raw"
                  ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-xs font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Raw Pipeline
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunPipeline}
            disabled={isRunning}
            className="btn-primary h-7 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <PlayIcon size={12} className={isRunning ? "animate-spin" : "fill-current"} />
            <span>{isRunning ? "Running..." : "Run Pipeline"}</span>
          </button>
        </div>
      </div>

      {/* Split: Pipeline Editor Half and Results Half */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-strong)]">
        {/* Stages Editor Half */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full bg-[var(--surface-card)] overflow-hidden">
          <div className="p-2.5 bg-[var(--canvas-soft)] border-b border-[var(--hairline)] flex items-center justify-between text-xs font-semibold text-[var(--muted)] select-none">
            <span>PIPELINE STAGES ({stages.filter((s) => s.enabled).length} ACTIVE)</span>
            {mode === "visual" && (
              <button
                type="button"
                onClick={handleAddStage}
                className="btn-primary h-6 px-2 text-[11px] flex items-center gap-1"
              >
                <PlusIcon size={12} />
                <span>Add Stage</span>
              </button>
            )}
          </div>

          <div className="flex-1 p-3 overflow-y-auto editor-scroll">
            {mode === "visual" ? (
              <div className="space-y-3">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className={`rounded-[8px] border transition overflow-hidden shadow-xs ${
                      stage.enabled
                        ? "border-[var(--hairline-strong)] bg-[var(--surface-card)]"
                        : "border-[var(--hairline)] bg-[var(--canvas-soft)]/50 opacity-60"
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="px-3 py-1.5 bg-[var(--canvas-soft)] border-b border-[var(--hairline)] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stage.enabled}
                            onChange={() => handleToggleStage(stage.id)}
                            className="rounded accent-black"
                          />
                          <span className="text-[10px] font-mono text-[var(--muted)] font-bold">
                            #{idx + 1}
                          </span>
                        </label>

                        {/* Stage Operator Dropdown */}
                        <select
                          value={stage.stageOperator}
                          onChange={(e) =>
                            handleUpdateStage(stage.id, e.target.value, stage.stageJson)
                          }
                          className="h-6 px-2 rounded bg-[var(--surface-card)] border border-[var(--hairline-strong)] text-xs font-mono font-bold text-[var(--text-link)] focus:outline-none"
                        >
                          {SUPPORTED_OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Stage Order & Delete Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(idx, "up")}
                          className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-20"
                        >
                          <ChevronUpIcon size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === stages.length - 1}
                          onClick={() => handleMoveStage(idx, "down")}
                          className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-20"
                        >
                          <ChevronDownIcon size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStage(stage.id)}
                          className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444]"
                        >
                          <Trash2Icon size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Stage JSON Body */}
                    <div className="p-2">
                      <textarea
                        value={stage.stageJson}
                        onChange={(e) =>
                          handleUpdateStage(stage.id, stage.stageOperator, e.target.value)
                        }
                        rows={4}
                        className="w-full p-2 rounded-[4px] border border-[var(--hairline)] bg-[var(--surface-dark)] text-white text-xs font-mono leading-5 focus:outline-none focus:border-[var(--text-link)] resize-y editor-scroll"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={16}
                className="w-full h-full p-3 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-white font-mono text-xs leading-5 focus:outline-none focus:border-[var(--text-link)] resize-none editor-scroll"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        {/* Pipeline Results Half */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full bg-[var(--canvas)] overflow-hidden">
          <div className="h-9 px-3 border-b border-[var(--hairline)] bg-[var(--surface-card)] flex items-center justify-between select-none shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                PIPELINE OUTPUT
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
                          aggregationState: { ...state, viewMode: m.id as DocumentViewMode },
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
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-3">
            {errorMsg ? (
              <div className="p-4 rounded-[8px] border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444] font-mono text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircleIcon size={14} />
                  <span>Aggregation Error</span>
                </div>
                <div className="text-[11px] leading-relaxed break-all pl-5">{errorMsg}</div>
              </div>
            ) : state.results === null ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-2">
                <LayersIcon size={28} className="text-[var(--muted)]/40" />
                <p>Add stages and press &quot;Run Pipeline&quot; to aggregate {selectedDb}.{selectedCol}.</p>
              </div>
            ) : state.results.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-xs text-[var(--muted)] font-mono space-y-2">
                <p>Pipeline completed successfully with 0 output documents.</p>
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
