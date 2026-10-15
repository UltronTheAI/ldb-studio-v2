"use client";

import React, { useState } from "react";
import {
  XIcon,
  SparklesIcon,
  FilePlusIcon,
  FilesIcon,
  AlertCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { insertOneDocumentAction, insertManyDocumentsAction } from "@/app/actions";
import { useWorkspace } from "@/lib/studio/workspace-context";
import { JsonCodeEditor } from "../widgets/JsonCodeEditor";

interface QueryInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  database: string;
  collection: string;
  onSuccess: () => void;
}

const DEFAULT_ONE_DOC = JSON.stringify(
  {
    name: "New Document",
    status: "active",
    createdAt: new Date().toISOString(),
  },
  null,
  2,
);

const DEFAULT_MANY_DOCS = JSON.stringify(
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

export function QueryInsertModal({
  isOpen,
  onClose,
  database,
  collection,
  onSuccess,
}: QueryInsertModalProps) {
  const { setStatusMessage } = useWorkspace();
  const [insertMode, setInsertMode] = useState<"one" | "many">("one");
  const [oneDocJson, setOneDocJson] = useState(DEFAULT_ONE_DOC);
  const [manyDocsJson, setManyDocsJson] = useState(DEFAULT_MANY_DOCS);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFormat = () => {
    try {
      if (insertMode === "one") {
        const parsed = JSON.parse(oneDocJson);
        if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
          throw new Error("Insert One requires a JSON object, not an array or primitive.");
        }
        setOneDocJson(JSON.stringify(parsed, null, 2));
      } else {
        const parsed = JSON.parse(manyDocsJson);
        if (!Array.isArray(parsed)) {
          throw new Error("Insert Many requires a JSON array: [ { ... }, { ... } ]");
        }
        setManyDocsJson(JSON.stringify(parsed, null, 2));
      }
      setErrorMsg(null);
    } catch (err: unknown) {
      setErrorMsg(`Format Error: ${(err as Error).message}`);
    }
  };

  const handleResetTemplate = () => {
    if (insertMode === "one") {
      setOneDocJson(DEFAULT_ONE_DOC);
    } else {
      setManyDocsJson(DEFAULT_MANY_DOCS);
    }
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (insertMode === "one") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(oneDocJson);
      } catch (err: unknown) {
        setErrorMsg(`Invalid JSON: ${(err as Error).message}`);
        return;
      }

      if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
        setErrorMsg("Insert One requires a single JSON object { ... }");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await insertOneDocumentAction({
          database,
          collection,
          documentJson: oneDocJson,
        });

        if (res.ok && res.data) {
          setStatusMessage({
            text: `Document inserted successfully (ID: ${String(res.data.insertedId)})`,
            tone: "success",
          });
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to insert document");
        }
      } catch (err: unknown) {
        setErrorMsg((err as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(manyDocsJson);
      } catch (err: unknown) {
        setErrorMsg(`Invalid JSON array: ${(err as Error).message}`);
        return;
      }

      if (!Array.isArray(parsed)) {
        setErrorMsg("Insert Many requires an array of JSON objects [ { ... }, { ... } ]");
        return;
      }

      if (parsed.length === 0) {
        setErrorMsg("Array cannot be empty. Please provide at least one document.");
        return;
      }

      for (let i = 0; i < parsed.length; i++) {
        if (typeof parsed[i] !== "object" || parsed[i] === null || Array.isArray(parsed[i])) {
          setErrorMsg(`Document at index ${i} must be a valid JSON object.`);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const res = await insertManyDocumentsAction({
          database,
          collection,
          documentsJson: manyDocsJson,
        });

        if (res.ok && res.data) {
          setStatusMessage({
            text: `Successfully inserted ${res.data.insertedCount} documents`,
            tone: "success",
          });
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || "Failed to insert documents");
        }
      } catch (err: unknown) {
        setErrorMsg((err as Error).message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[6px] bg-[var(--surface-strong)] text-[var(--text-link)] border border-[var(--hairline)]">
              {insertMode === "one" ? <FilePlusIcon size={16} /> : <FilesIcon size={16} />}
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
                {insertMode === "one" ? "Insert Single Document" : "Insert Multiple Documents"}
              </h3>
              <p className="font-mono text-[11px] text-[var(--muted)]">
                {database}.{collection}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTemplate}
              title="Reset to template"
              className="p-1.5 rounded border border-[var(--hairline)] hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--ink)] text-xs flex items-center gap-1 transition"
            >
              <RotateCcwIcon size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleFormat}
              title="Prettify JSON"
              className="px-2 py-1 rounded border border-[var(--hairline)] hover:bg-[var(--surface-strong)] text-[var(--ink)] text-xs flex items-center gap-1 font-medium transition"
            >
              <SparklesIcon size={12} />
              <span>Format</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)] transition"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        {/* Tab switch: Insert One vs Insert Many */}
        <div className="px-4 py-2 border-b border-[var(--hairline)] bg-[var(--surface-card)] flex items-center justify-between">
          <div className="flex items-center rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setInsertMode("one");
                setErrorMsg(null);
              }}
              className={`px-3 py-1 rounded-[4px] flex items-center gap-1.5 transition ${
                insertMode === "one"
                  ? "bg-[var(--surface-card)] text-[var(--ink)] font-bold shadow-xs"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              <FilePlusIcon size={12} />
              <span>Insert One</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInsertMode("many");
                setErrorMsg(null);
              }}
              className={`px-3 py-1 rounded-[4px] flex items-center gap-1.5 transition ${
                insertMode === "many"
                  ? "bg-[var(--surface-card)] text-[var(--ink)] font-bold shadow-xs"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              <FilesIcon size={12} />
              <span>Insert Many</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-[var(--muted)]">
            {insertMode === "one" ? "Single JSON Object" : "Array of Objects [ ... ]"}
          </span>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-[6px] bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono flex items-center gap-2">
            <AlertCircleIcon size={14} className="shrink-0" />
            <span className="leading-tight break-all">{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 overflow-hidden space-y-3">
          <div className="flex-1 flex flex-col min-h-0">
            <JsonCodeEditor
              value={insertMode === "one" ? oneDocJson : manyDocsJson}
              onChange={(val) => {
                if (insertMode === "one") {
                  setOneDocJson(val);
                } else {
                  setManyDocsJson(val);
                }
                setErrorMsg(null);
              }}
              rows={14}
              showLineNumbers
              showToolbar
              title={insertMode === "one" ? "Document JSON" : "Documents JSON Array"}
              badge={insertMode === "one" ? "Single Object" : "Array"}
              className="flex-1 w-full min-h-0"
              onFormat={handleFormat}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--hairline)]">
            <span className="text-[11px] text-[var(--muted)]">
              {insertMode === "one"
                ? "Auto-generates _id if omitted."
                : "Inserts all objects in transaction or atomic batch."}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary h-8 px-4 text-xs font-bold flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin inline-block mr-1">⏳</span>
                    <span>Inserting...</span>
                  </>
                ) : (
                  <span>{insertMode === "one" ? "Insert Document" : "Insert All"}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
