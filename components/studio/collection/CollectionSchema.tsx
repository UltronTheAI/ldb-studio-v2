"use client";

import React, { useMemo } from "react";
import type { Document } from "@liorandb/driver";
import { SparklesIcon, FileCode2Icon, LayersIcon } from "lucide-react";

interface CollectionSchemaProps {
  documents: Document[];
  database: string;
  collection: string;
}

interface InferredField {
  name: string;
  types: Record<string, number>;
  count: number;
  sampleValues: unknown[];
}

function detectValueType(val: unknown): string {
  if (val === null) return "Null";
  if (Array.isArray(val)) return "Array";
  if (typeof val === "boolean") return "Boolean";
  if (typeof val === "number") return "Number";
  if (typeof val === "string") {
    // Check if ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return "Date";
    return "String";
  }
  if (typeof val === "object") return "Object";
  return "Unknown";
}

export function CollectionSchema({ documents, database, collection }: CollectionSchemaProps) {
  const fields = useMemo(() => {
    if (documents.length === 0) return [];

    const fieldMap: Record<string, InferredField> = {};

    for (const doc of documents) {
      for (const [key, val] of Object.entries(doc)) {
        if (!fieldMap[key]) {
          fieldMap[key] = {
            name: key,
            types: {},
            count: 0,
            sampleValues: [],
          };
        }

        const f = fieldMap[key];
        f.count += 1;
        const type = detectValueType(val);
        f.types[type] = (f.types[type] || 0) + 1;

        if (f.sampleValues.length < 3 && val !== undefined && val !== null) {
          f.sampleValues.push(val);
        }
      }
    }

    return Object.values(fieldMap).sort((a, b) => {
      if (a.name === "_id") return -1;
      if (b.name === "_id") return 1;
      return b.count - a.count;
    });
  }, [documents]);

  if (documents.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-[var(--muted)] font-mono">
        Load or query documents first to infer collection schema.
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 overflow-y-auto editor-scroll space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans text-sm font-bold text-[var(--ink)] flex items-center gap-2">
            <SparklesIcon size={14} className="text-[#a855f7]" />
            <span>Schema Analysis: {database}.{collection}</span>
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Automatically analyzed from the loaded sample of {documents.length} document{documents.length === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="text-xs font-mono text-[var(--muted)] px-2 py-1 rounded bg-[var(--surface-strong)]">
          {fields.length} distinct fields detected
        </div>
      </div>

      {/* Fields Breakdown Table */}
      <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-left text-xs font-mono">
          <thead className="bg-[var(--canvas-soft)] border-b border-[var(--hairline)]">
            <tr>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px] w-48">
                Field Path
              </th>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px] w-52">
                Type Distribution
              </th>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px] w-44">
                Presence
              </th>
              <th className="px-4 py-2.5 font-bold text-[var(--ink)] uppercase tracking-wider text-[11px]">
                Sample Values
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {fields.map((f) => {
              const presencePercent = Math.round((f.count / documents.length) * 100);

              return (
                <tr key={f.name} className="hover:bg-[var(--surface-strong)] transition">
                  {/* Field Name */}
                  <td className="px-4 py-3 font-semibold text-[var(--ink)]">
                    <span className={f.name === "_id" ? "text-[var(--text-link)]" : ""}>
                      {f.name}
                    </span>
                  </td>

                  {/* Types */}
                  <td className="px-4 py-3 space-x-1.5">
                    {Object.entries(f.types).map(([type, count]) => {
                      const percent = Math.round((count / f.count) * 100);
                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)]"
                        >
                          <span
                            className={
                              type === "String"
                                ? "text-[#16a34a] font-bold"
                                : type === "Number"
                                ? "text-[#d97706] font-bold"
                                : type === "Boolean"
                                ? "text-[#ef4444] font-bold"
                                : type === "Date"
                                ? "text-[#0d74ce] font-bold"
                                : "text-[var(--ink)] font-bold"
                            }
                          >
                            {type}
                          </span>
                          <span className="text-[var(--muted)]">{percent}%</span>
                        </span>
                      );
                    })}
                  </td>

                  {/* Presence Bar */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--body)]">
                          {f.count}/{documents.length}
                        </span>
                        <span className="font-bold text-[var(--ink)]">{presencePercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface-strong)] overflow-hidden">
                        <div
                          style={{ width: `${presencePercent}%` }}
                          className={`h-full rounded-full ${
                            presencePercent === 100 ? "bg-[#16a34a]" : "bg-[var(--text-link)]"
                          }`}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Samples */}
                  <td className="px-4 py-3 text-[var(--body)] truncate max-w-xs">
                    {f.sampleValues.map((s, i) => (
                      <span
                        key={i}
                        className="inline-block mr-1.5 text-[11px] truncate max-w-[140px] px-1 rounded bg-[var(--canvas-soft)] border border-[var(--hairline)]"
                      >
                        {typeof s === "object" ? JSON.stringify(s) : String(s)}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
