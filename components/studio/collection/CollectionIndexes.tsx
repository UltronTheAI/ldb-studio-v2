"use client";

import React, { useState } from "react";
import type { CollectionIndexDefinition } from "@liorandb/driver";
import { createIndexAction, dropIndexAction } from "@/app/actions";
import {
  BoxesIcon,
  PlusIcon,
  Trash2Icon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react";

interface CollectionIndexesProps {
  database: string;
  collection: string;
  indexes: CollectionIndexDefinition[];
  onRefresh: () => void;
}

export function CollectionIndexes({
  database,
  collection,
  indexes,
  onRefresh,
}: CollectionIndexesProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [isUnique, setIsUnique] = useState(false);
  const [isSparse, setIsSparse] = useState(false);
  const [partialFilter, setPartialFilter] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [dropIndexTarget, setDropIndexTarget] = useState<string | null>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim()) return;

    setIsCreating(true);
    setMessage(null);
    try {
      const fieldsJson = JSON.stringify([
        {
          field: fieldName.trim(),
          direction: direction === "asc" ? "Asc" : "Desc",
        },
      ]);

      const res = await createIndexAction({
        database,
        collection,
        name: indexName.trim() || undefined,
        fieldsJson,
        unique: isUnique,
        sparse: isSparse,
        partialFilterJson: partialFilter.trim() || undefined,
      });

      if (res.ok) {
        setMessage({ text: "Index created successfully." });
        setShowCreateModal(false);
        setIndexName("");
        setFieldName("");
        onRefresh();
      } else {
        setMessage({ text: res.error || "Failed to create index", isError: true });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDropIndex = async () => {
    if (!dropIndexTarget) return;

    setIsDropping(true);
    setMessage(null);
    try {
      const res = await dropIndexAction({
        database,
        collection,
        indexName: dropIndexTarget,
      });

      if (res.ok) {
        setMessage({ text: `Index '${dropIndexTarget}' dropped successfully.` });
        setDropIndexTarget(null);
        onRefresh();
      } else {
        setMessage({ text: res.error || "Failed to drop index", isError: true });
      }
    } finally {
      setIsDropping(false);
    }
  };

  return (
    <div className="w-full h-full p-4 overflow-y-auto editor-scroll space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
            Indexes in {database}.{collection}
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Indexes optimize search queries, enforce uniqueness constraints, and speed up sorting.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn-primary h-8 px-3 text-xs font-semibold flex items-center gap-1.5"
        >
          <PlusIcon size={14} />
          <span>Create Index</span>
        </button>
      </div>

      {/* Status banner */}
      {message && (
        <div
          className={`p-3 rounded-[6px] text-xs font-mono flex items-center gap-2 ${
            message.isError
              ? "bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444]"
              : "bg-[var(--surface-strong)] border border-[var(--hairline-strong)] text-[var(--ink)]"
          }`}
        >
          {message.isError ? <AlertCircleIcon size={14} /> : <CheckIcon size={14} className="text-[var(--text-link)]" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Index Table */}
      <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-left text-xs font-mono">
          <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
            <tr>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                Index Name
              </th>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                Key Fields
              </th>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                Properties
              </th>
              <th className="w-16 px-4 py-2.5 text-center font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {indexes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                  No indexes found for this collection.
                </td>
              </tr>
            ) : (
              indexes.map((idx) => {
                const isPrimary = idx.name === "_id_" || idx.name === "primary";
                return (
                  <tr key={idx.name} className="hover:bg-[var(--surface-strong)] transition">
                    <td className="px-4 py-3 font-semibold text-[var(--ink)] flex items-center gap-2">
                      <BoxesIcon size={13} className="text-[var(--text-link)]" />
                      <span>{idx.name}</span>
                      {isPrimary && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-[var(--text-link)] font-bold uppercase">
                          Default
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[var(--body-strong)]">
                      {idx.fields.map((f, i) => (
                        <span
                          key={i}
                          className="inline-block px-1.5 py-0.5 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)] mr-1.5"
                        >
                          {typeof f === "string" ? f : `${f.field} (${f.direction ?? "Asc"})`}
                        </span>
                      ))}
                    </td>

                    <td className="px-4 py-3 space-x-1.5">
                      {idx.unique && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-strong)] text-[var(--ink)] border border-[var(--hairline-strong)] font-bold uppercase">
                          Unique
                        </span>
                      )}
                      {idx.sparse && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#d97706]/15 text-[#d97706] font-bold uppercase">
                          Sparse
                        </span>
                      )}
                      {idx.partialFilter && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 font-bold uppercase">
                          Partial
                        </span>
                      )}
                      {!idx.unique && !idx.sparse && !idx.partialFilter && (
                        <span className="text-[var(--muted)] text-[11px]">Standard</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => setDropIndexTarget(idx.name)}
                          title="Drop Index"
                          className="p-1 rounded text-[var(--muted)] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition"
                        >
                          <Trash2Icon size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Index Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-2xl space-y-4">
            <h3 className="font-sans text-sm font-bold text-[var(--ink)]">
              Create Index on {collection}
            </h3>

            <form onSubmit={handleCreateIndex} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Field to Index *
                </label>
                <input
                  type="text"
                  placeholder="e.g. email or createdAt"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                    Sort Direction
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as "asc" | "desc")}
                    className="w-full h-8 px-2 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs text-[var(--ink)] focus:outline-none"
                  >
                    <option value="asc">Ascending (1)</option>
                    <option value="desc">Descending (-1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                    Index Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={isUnique}
                    onChange={(e) => setIsUnique(e.target.checked)}
                    className="rounded accent-black"
                  />
                  <span>Unique Constraint</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={isSparse}
                    onChange={(e) => setIsSparse(e.target.checked)}
                    className="rounded accent-black"
                  />
                  <span>Sparse</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink)] mb-1">
                  Partial Filter Expression (Optional JSON)
                </label>
                <input
                  type="text"
                  placeholder='e.g. { "active": true }'
                  value={partialFilter}
                  onChange={(e) => setPartialFilter(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] text-xs font-mono text-[var(--ink)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !fieldName.trim()}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  {isCreating ? "Creating..." : "Build Index"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drop Index Confirmation Modal */}
      {dropIndexTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[#ef4444]/40 bg-[var(--surface-card)] p-5 shadow-2xl space-y-3">
            <h3 className="font-sans text-sm font-bold text-[#ef4444]">Drop Index</h3>
            <p className="text-xs text-[var(--body)]">
              Are you sure you want to drop index{" "}
              <code className="font-mono text-[var(--ink)] font-bold">{dropIndexTarget}</code>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDropIndexTarget(null)}
                className="px-3 py-1.5 rounded-[6px] border border-[var(--hairline-strong)] hover:bg-[var(--surface-strong)] text-xs text-[var(--ink)] font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDropIndex}
                disabled={isDropping}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs font-bold transition"
              >
                {isDropping ? "Dropping..." : "Drop Index"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
