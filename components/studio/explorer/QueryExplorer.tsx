"use client";

import React from "react";
import { useWorkspace } from "@/lib/studio/workspace-context";
import {
  PlusIcon,
  FileCodeIcon,
  Trash2Icon,
  PlayIcon,
} from "lucide-react";

export function QueryExplorer() {
  const { openQueryTab, savedDrafts, removeDraft, databases, collectionsMap } = useWorkspace();

  const handleOpenDraft = (draft: {
    database: string;
    collection: string;
    content: string;
    name: string;
  }) => {
    openQueryTab(draft.database, draft.collection, draft.content);
  };

  return (
    <div className="flex flex-col h-full select-none text-xs p-2 space-y-4 overflow-y-auto sidebar-scroll">
      <div>
        <button
          type="button"
          onClick={() => openQueryTab()}
          className="btn-primary w-full h-8 text-xs font-semibold flex items-center justify-center gap-2"
        >
          <PlusIcon size={14} />
          <span>New Query Editor</span>
        </button>
      </div>

      {/* Saved Drafts */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          Saved Query Drafts ({savedDrafts.length})
        </div>

        {savedDrafts.length === 0 ? (
          <div className="p-3 rounded-[6px] border border-dashed border-[var(--hairline-strong)] text-center text-[11px] text-[var(--muted)]">
            No saved query drafts yet. Save queries from the workbench to reuse them.
          </div>
        ) : (
          savedDrafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => handleOpenDraft(draft)}
              className="group flex items-center justify-between p-2 rounded-[6px] border border-[var(--hairline)] bg-[var(--surface-card)] hover:border-[var(--muted)] hover:bg-[var(--surface-strong)] cursor-pointer transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileCodeIcon size={14} className="text-[var(--text-link)] shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-[var(--ink)] truncate">
                    {draft.name}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] font-mono truncate">
                    {draft.database}.{draft.collection}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDraft(draft.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[#ef4444] transition"
              >
                <Trash2Icon size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Quick Snippets & Presets */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] px-1">
          Query Templates
        </div>
        {[
          {
            label: "Find Active Records",
            filter: '{\n  "status": "active"\n}',
          },
          {
            label: "Numeric Range Filter",
            filter: '{\n  "age": { "$gte": 18, "$lte": 65 }\n}',
          },
          {
            label: "Text Regex Search",
            filter: '{\n  "email": { "$regex": "@gmail\\\\.com$" }\n}',
          },
          {
            label: "Array Membership ($in)",
            filter: '{\n  "role": { "$in": ["admin", "editor"] }\n}',
          },
        ].map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            onClick={() => openQueryTab(databases[0], collectionsMap[databases[0]]?.[0], tpl.filter)}
            className="w-full text-left p-2 rounded-[6px] border border-[var(--hairline)] hover:bg-[var(--surface-strong)] hover:border-[var(--muted)] transition flex items-center justify-between"
          >
            <span className="font-medium text-xs text-[var(--body-strong)]">{tpl.label}</span>
            <PlayIcon size={11} className="text-[var(--muted)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
