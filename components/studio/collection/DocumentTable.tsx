"use client";

import React, { useState, useMemo } from "react";
import type { Document } from "@liorandb/driver";
import { syntaxHighlightJson } from "@/lib/liorandb/json";
import {
  CopyIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";

interface DocumentTableProps {
  documents: Document[];
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}

export function DocumentTable({ documents, onEdit, onDelete }: DocumentTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});

  // Compute all unique columns across documents
  const columns = useMemo(() => {
    const colSet = new Set<string>();
    // Ensure _id is first
    colSet.add("_id");

    for (const doc of documents) {
      for (const key of Object.keys(doc)) {
        colSet.add(key);
      }
    }
    return Array.from(colSet);
  }, [documents]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleCellExpand = (cellKey: string) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey],
    }));
  };

  if (documents.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-[var(--muted)] font-mono">
        No documents found in this view.
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto editor-scroll border border-[var(--hairline-strong)] rounded-[8px] bg-[var(--surface-card)]">
      <table className="w-full border-collapse text-left text-xs font-mono select-text">
        {/* Sticky Header */}
        <thead className="sticky top-0 z-10 bg-[var(--canvas-soft)] border-b border-[var(--hairline-strong)] shadow-xs">
          <tr>
            <th className="w-12 px-2 py-2 text-center text-[10px] font-bold text-[var(--muted)] uppercase border-r border-[var(--hairline)]">
              #
            </th>
            <th className="w-20 px-2 py-2 text-center text-[10px] font-bold text-[var(--muted)] uppercase border-r border-[var(--hairline)]">
              Actions
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-[11px] font-bold text-[var(--ink)] tracking-wider border-r border-[var(--hairline)] min-w-[120px] max-w-[280px] truncate"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={col === "_id" ? "text-[var(--text-link)]" : "text-[var(--ink)]"}>
                    {col}
                  </span>
                  {col === "_id" && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-[var(--text-link)] uppercase font-semibold">
                      PK
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Rows */}
        <tbody className="divide-y divide-[var(--hairline)]">
          {documents.map((doc, rowIdx) => {
            const rawId = doc._id !== undefined ? String(doc._id) : `row-${rowIdx}`;

            return (
              <tr
                key={rawId}
                className="hover:bg-[var(--surface-strong)]/70 transition group"
              >
                {/* Row Index */}
                <td className="px-2 py-2 text-center text-[10px] text-[var(--muted)] border-r border-[var(--hairline)] select-none">
                  {rowIdx + 1}
                </td>

                {/* Row Actions */}
                <td className="px-1.5 py-1 text-center border-r border-[var(--hairline)] whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      title="Copy Document JSON"
                      onClick={() => handleCopy(JSON.stringify(doc, null, 2), `doc-${rawId}`)}
                      className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hairline-strong)] transition"
                    >
                      {copiedId === `doc-${rawId}` ? (
                        <CheckIcon size={12} className="text-[var(--text-link)]" />
                      ) : (
                        <CopyIcon size={12} />
                      )}
                    </button>
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
                </td>

                {/* Values for each column */}
                {columns.map((col) => {
                  const val = doc[col];
                  const cellKey = `${rawId}-${col}`;
                  const isExpanded = expandedCells[cellKey] ?? false;

                  return (
                    <td
                      key={col}
                      className="px-3 py-2 border-r border-[var(--hairline)] text-xs align-top max-w-[280px]"
                    >
                      {val === undefined ? (
                        <span className="text-[var(--muted)]/50 italic text-[11px]">—</span>
                      ) : val === null ? (
                        <span className="text-[#64748b] italic text-[11px]">null</span>
                      ) : typeof val === "boolean" ? (
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            val
                              ? "bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)]"
                              : "bg-[#ef4444]/15 text-[#ef4444]"
                          }`}
                        >
                          {String(val)}
                        </span>
                      ) : typeof val === "number" ? (
                        <span className="text-[#d97706] font-semibold">{val}</span>
                      ) : typeof val === "string" ? (
                        <span
                          className={`break-all ${
                            col === "_id"
                              ? "text-[var(--text-link)] font-semibold"
                              : "text-[var(--ink)]"
                          }`}
                        >
                          {val}
                        </span>
                      ) : typeof val === "object" ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleCellExpand(cellKey)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] text-[var(--body-strong)] hover:border-[var(--muted)] transition"
                          >
                            {isExpanded ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />}
                            <span>
                              {Array.isArray(val)
                                ? `Array(${val.length})`
                                : `Object(${Object.keys(val).length})`}
                            </span>
                          </button>
                          {isExpanded && (
                            <pre
                              className="mt-1 p-2 rounded bg-[var(--surface-dark)] border border-[var(--hairline-strong)] text-[10px] leading-relaxed overflow-x-auto max-h-36 editor-scroll font-mono"
                              dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(val) }}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--ink)]">{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
