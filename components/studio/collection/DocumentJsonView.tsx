"use client";

import React, { useState } from "react";
import type { Document } from "@liorandb/driver";
import { syntaxHighlightJson } from "@/lib/liorandb/json";
import { CopyIcon, CheckIcon, PencilIcon, Trash2Icon } from "lucide-react";

interface DocumentJsonViewProps {
  documents: Document[];
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}

export function DocumentJsonView({ documents, onEdit, onDelete }: DocumentJsonViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (documents.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-[var(--muted)] font-mono">
        No documents found in this view.
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto editor-scroll space-y-3 p-1">
      {documents.map((doc, idx) => {
        const idStr = doc._id !== undefined ? String(doc._id) : `row-${idx}`;
        const jsonStr = JSON.stringify(doc, null, 2);

        return (
          <div
            key={idStr}
            className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs hover:border-[var(--muted)] transition"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase font-semibold">
                  #{idx + 1}
                </span>
                <span className="font-mono text-xs font-bold text-[var(--text-link)]">
                  _id: {idStr}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Copy Document JSON"
                  onClick={() => handleCopy(jsonStr, idStr)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hairline-strong)] transition"
                >
                  {copiedId === idStr ? (
                    <CheckIcon size={13} className="text-[var(--text-link)]" />
                  ) : (
                    <CopyIcon size={13} />
                  )}
                </button>
                <button
                  type="button"
                  title="Edit Document"
                  onClick={() => onEdit(doc)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--text-link)] hover:bg-[var(--hairline-strong)] transition"
                >
                  <PencilIcon size={13} />
                </button>
                <button
                  type="button"
                  title="Delete Document"
                  onClick={() => onDelete(doc)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition"
                >
                  <Trash2Icon size={13} />
                </button>
              </div>
            </div>

            {/* Syntax Highlighted JSON Body */}
            <pre
              className="p-3 font-mono text-xs leading-5 overflow-x-auto editor-scroll text-[var(--ink)]"
              dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(doc) }}
            />
          </div>
        );
      })}
    </div>
  );
}
