"use client";

import React, { useState } from "react";
import type { Document } from "@liorandb/driver";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

interface TreeNodeProps {
  name: string;
  value: unknown;
  depth?: number;
  isLast?: boolean;
}

function getTypeBadge(val: unknown) {
  if (val === null) return <span className="text-[10px] text-[#64748b] italic">null</span>;
  if (Array.isArray(val)) return <span className="text-[10px] text-[#a855f7] font-semibold">[{val.length}]</span>;
  if (typeof val === "object") return <span className="text-[10px] text-[#3b82f6] font-semibold">{"{" + Object.keys(val).length + "}"}</span>;
  if (typeof val === "boolean") return <span className="text-[10px] text-[#ef4444] font-semibold">bool</span>;
  if (typeof val === "number") return <span className="text-[10px] text-[#d97706] font-semibold">num</span>;
  if (typeof val === "string") return <span className="text-[10px] text-[#16a34a]">str</span>;
  return null;
}

function TreeNode({ name, value, depth = 0 }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const [isCopied, setIsCopied] = useState(false);

  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(
      typeof value === "object" ? JSON.stringify(value, null, 2) : String(value),
    );
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  };

  return (
    <div className="font-mono text-xs select-text">
      <div
        onClick={() => isObject && setIsOpen((prev) => !prev)}
        style={{ paddingLeft: `${depth * 16}px` }}
        className={`flex items-center gap-1.5 py-1 px-2 rounded-[4px] hover:bg-[var(--surface-strong)] transition group ${
          isObject ? "cursor-pointer" : ""
        }`}
      >
        {/* Caret */}
        {isObject ? (
          <span className="text-[var(--muted)]">
            {isOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
          </span>
        ) : (
          <span className="w-3" />
        )}

        {/* Key Name */}
        <span className="font-semibold text-[var(--ink)]">{name}:</span>

        {/* Type Badge */}
        {getTypeBadge(value)}

        {/* Scalar Value Preview */}
        {!isObject && (
          <span
            className={`truncate max-w-md ${
              typeof value === "string"
                ? "text-[#16a34a]"
                : typeof value === "number"
                ? "text-[#d97706]"
                : typeof value === "boolean"
                ? "text-[#ef4444]"
                : "text-[var(--muted)]"
            }`}
          >
            {typeof value === "string" ? `"${value}"` : String(value)}
          </span>
        )}

        {/* Copy Node Value */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy value"
          className="opacity-0 group-hover:opacity-100 p-0.5 ml-2 text-[var(--muted)] hover:text-[var(--ink)] rounded"
        >
          {isCopied ? <CheckIcon size={11} className="text-[#16a34a]" /> : <CopyIcon size={11} />}
        </button>
      </div>

      {/* Children if Object or Array */}
      {isObject && isOpen && (
        <div className="border-l border-[var(--hairline)] ml-3">
          {isArray
            ? (value as unknown[]).map((item, idx) => (
                <TreeNode
                  key={idx}
                  name={`[${idx}]`}
                  value={item}
                  depth={depth + 1}
                />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <TreeNode
                  key={k}
                  name={k}
                  value={v}
                  depth={depth + 1}
                />
              ))}
        </div>
      )}
    </div>
  );
}

interface DocumentTreeViewProps {
  documents: Document[];
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}

export function DocumentTreeView({ documents, onEdit, onDelete }: DocumentTreeViewProps) {
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
        const idStr = doc._id !== undefined ? String(doc._id) : `doc-${idx}`;

        return (
          <div
            key={idStr}
            className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs hover:border-[var(--muted)] transition"
          >
            {/* Tree Card Header */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase font-semibold">
                  #{idx + 1}
                </span>
                <span className="font-mono text-xs font-bold text-[var(--text-link)]">
                  {idStr}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Edit Document"
                  onClick={() => onEdit(doc)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--text-link)] hover:bg-[var(--hairline-strong)] transition"
                >
                  <PencilIcon size={12} />
                </button>
                <button
                  type="button"
                  title="Delete Document"
                  onClick={() => onDelete(doc)}
                  className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition"
                >
                  <Trash2Icon size={12} />
                </button>
              </div>
            </div>

            {/* Tree Body */}
            <div className="p-3">
              {Object.entries(doc).map(([key, val]) => (
                <TreeNode key={key} name={key} value={val} depth={0} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
