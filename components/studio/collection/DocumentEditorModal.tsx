"use client";

import React, { useState } from "react";
import type { Document } from "@liorandb/driver";
import {
  XIcon,
  AlertCircleIcon,
  SparklesIcon,
  LayersIcon,
} from "lucide-react";

interface DocumentEditorModalProps {
  isOpen: boolean;
  isInserting: boolean;
  document: Document | null;
  database: string;
  collection: string;
  onSave: (docJson: string, isInsert: boolean) => Promise<boolean>;
  onClose: () => void;
}

function getInitialJsonText(isInserting: boolean, document: Document | null): string {
  if (isInserting) {
    if (document) {
      const copy = { ...document };
      delete copy._id;
      return JSON.stringify(copy, null, 2);
    }
    return JSON.stringify(
      {
        status: "active",
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }
  if (document) {
    return JSON.stringify(document, null, 2);
  }
  return "";
}

export function DocumentEditorModal(props: DocumentEditorModalProps) {
  if (!props.isOpen) return null;

  return (
    <DocumentEditorDialog
      key={props.document?._id ? String(props.document._id) : props.isInserting ? "insert" : "edit"}
      {...props}
    />
  );
}

function DocumentEditorDialog({
  isInserting,
  document,
  database,
  collection,
  onSave,
  onClose,
}: DocumentEditorModalProps) {
  const [jsonText, setJsonText] = useState(() => getInitialJsonText(isInserting, document));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setValidationError(null);
    } catch (err: unknown) {
      setValidationError((err as Error).message);
    }
  };

  const handleDuplicate = () => {
    try {
      const parsed = JSON.parse(jsonText) as Document;
      delete parsed._id;
      setJsonText(JSON.stringify(parsed, null, 2));
      setValidationError(null);
    } catch {
      // Ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(jsonText);
    } catch (err: unknown) {
      setValidationError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSave(jsonText, isInserting);
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
          <div>
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
              {isInserting ? "Insert Document" : "Edit Document"}
            </h3>
            <p className="font-mono text-xs text-[var(--muted)]">
              {database}.{collection}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isInserting && (
              <button
                type="button"
                onClick={handleDuplicate}
                title="Clone without _id to insert as new document"
                className="px-2 py-1 text-xs rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-[var(--ink)] flex items-center gap-1 font-medium transition"
              >
                <LayersIcon size={12} />
                <span>Clone as New</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleFormat}
              title="Prettify JSON"
              className="px-2 py-1 text-xs rounded border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-[var(--ink)] flex items-center gap-1 font-medium transition"
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

        {/* Validation Error Banner */}
        {validationError && (
          <div className="px-4 py-2 bg-[#ef4444]/15 border-b border-[#ef4444]/30 text-[#ef4444] text-xs font-mono flex items-center gap-2">
            <AlertCircleIcon size={14} className="shrink-0" />
            <span className="truncate">{validationError}</span>
          </div>
        )}

        {/* Editor Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setValidationError(null);
              }}
              rows={16}
              autoFocus
              className="w-full flex-1 p-3 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] text-white font-mono text-xs leading-5 focus:outline-none focus:border-[var(--text-link)] editor-scroll resize-none"
              spellCheck={false}
            />
          </div>

          {/* Footer Controls */}
          <div className="px-4 py-3 bg-[var(--canvas-soft)] border-t border-[var(--hairline)] flex items-center justify-between">
            <div className="text-[11px] text-[var(--muted)] font-mono">
              Valid JSON format required. Keys must be double-quoted.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary h-8 px-4 text-xs font-semibold"
              >
                {isSaving ? "Saving..." : isInserting ? "Insert Document" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
