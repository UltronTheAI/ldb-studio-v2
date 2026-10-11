"use client";

import { useState } from "react";
import { syntaxHighlightJson } from "@/lib/liorandb/json";

// LioranDB Studio Logo mark: Database cluster node glyph
export function LioranDBLogo({
  size = 28,
  showText = true,
  className = "",
}: {
  size?: number;
  showText?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 text-[#000000]"
        aria-hidden="true"
      >
        {/* Sketched 3-layer database cylinder */}
        <ellipse cx="16" cy="8" rx="12" ry="5" stroke="currentColor" strokeWidth="2.5" fill="#FFFFFF" />
        <path d="M4 8v7c0 2.76 5.37 5 12 5s12-2.24 12-5V8" stroke="currentColor" strokeWidth="2.5" />
        <path d="M4 15v7c0 2.76 5.37 5 12 5s12-2.24 12-5v-7" stroke="currentColor" strokeWidth="2.5" />
        {/* Core spark in the middle */}
        <circle cx="16" cy="15" r="2" fill="currentColor" />
      </svg>
      {showText && (
        <div className="flex items-center gap-2">
          <span className="font-sans text-xl font-bold tracking-tight text-[#000000]">
            LioranDB
          </span>
          <span className="rounded-[4px] border border-[#111111] bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#111111]">
            STUDIO
          </span>
        </div>
      )}
    </div>
  );
}

// Sketched Technical Architecture Illustration: Distributed LioranDB Cluster & Storage Engine
export function LioranDBClusterIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`relative w-full max-w-xl mx-auto ${className}`}>
      <div className="sketch-card p-5 sm:p-6 bg-white shadow-[4px_4px_0px_#111111]">
        {/* Top Terminal Chrome */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-white" />
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-white" />
            <span className="h-3 w-3 rounded-full border-2 border-[#111111] bg-[#111111]" />
          </div>
          <div className="font-mono text-xs font-bold tracking-wider text-[#111111] uppercase">
            LIORANDB CLUSTER TOPOLOGY • RAFT v2.0
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#111111]">
            <span className="h-2 w-2 rounded-full bg-[#111111] animate-pulse" />
            READY
          </div>
        </div>

        {/* Distributed Nodes Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative">
          {/* Node 1: Leader */}
          <div className="relative rounded-[7px] border-2 border-[#111111] bg-white p-3.5 flex flex-col justify-between min-h-[160px] shadow-[2px_2px_0px_#111111]">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="border border-[#111111] px-1.5 py-0.5 rounded bg-[#111111] text-white font-bold">
                NODE 1
              </span>
              <span className="font-bold text-[#111111]">RAFT LEADER</span>
            </div>

            <div className="my-auto py-2 font-mono text-xs space-y-1">
              <div className="text-[#111111] font-bold">status: active_leader</div>
              <div className="text-[#666666]">term: 42 • commit: 104,281</div>
              <div className="text-[#666666]">partitions: [p0, p1, p2]</div>
            </div>

            <div className="border-t border-[#111111] pt-2 flex items-center justify-between font-mono text-[10px] text-[#666666]">
              <span>storage: 4.2 GB</span>
              <span className="font-bold text-[#111111]">IOPS: 12.8k</span>
            </div>
          </div>

          {/* Node 2: Follower */}
          <div className="relative rounded-[7px] border-2 border-[#111111] bg-white p-3.5 flex flex-col justify-between min-h-[160px] shadow-[2px_2px_0px_#111111]">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="border border-[#111111] px-1.5 py-0.5 rounded bg-white text-[#111111] font-bold">
                NODE 2
              </span>
              <span className="text-[#666666]">REPLICA</span>
            </div>

            <div className="my-auto py-2 font-mono text-xs space-y-1">
              <div className="text-[#111111] font-bold">status: synchronous</div>
              <div className="text-[#666666]">lag: 0.12ms • read-ready</div>
              <div className="text-[#666666]">partitions: [p0_r, p1_r]</div>
            </div>

            <div className="border-t border-[#111111] pt-2 flex items-center justify-between font-mono text-[10px] text-[#666666]">
              <span>storage: 4.2 GB</span>
              <span className="font-bold text-[#111111]">HEALTHY</span>
            </div>
          </div>

          {/* Center Replication Path Arrow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
              <path
                d="M4 12 H36 M28 6 L36 12 L28 18"
                stroke="#111111"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Live Query Console Snippet */}
        <div className="mt-4 rounded-[7px] border-2 border-[#111111] bg-[#FAFAFA] p-3 font-mono text-xs text-[#111111]">
          <div className="flex items-center justify-between text-[11px] text-[#666666] border-b border-[#D0D0D0] pb-1.5 mb-2">
            <span className="text-[#059669] font-bold">$ lioran-cli --eval</span>
            <span className="text-[#D97706] font-bold">0.42ms execution</span>
          </div>
          <div className="text-sm font-semibold">
            <span className="text-[#2563EB] font-bold">db</span>
            <span className="text-[#111111]">.</span>
            <span className="text-[#7C3AED] font-bold">users</span>
            <span className="text-[#111111]">.</span>
            <span className="text-[#2563EB] font-bold">find</span>
            <span className="text-[#111111]">(&#123; </span>
            <span className="text-[#7C3AED] font-semibold">status</span>
            <span className="text-[#111111]">: </span>
            <span className="text-[#059669] font-semibold">&quot;active&quot;</span>
            <span className="text-[#111111]"> &#125;).</span>
            <span className="text-[#2563EB] font-bold">sort</span>
            <span className="text-[#111111]">(&#123; </span>
            <span className="text-[#7C3AED] font-semibold">created_at</span>
            <span className="text-[#111111]">: </span>
            <span className="text-[#D97706] font-bold">-1</span>
            <span className="text-[#111111]"> &#125;)</span>
          </div>
          <div className="text-[11px] mt-1.5">
            <span className="text-[#64748B] font-bold">=&gt; </span>
            <span className="text-[#059669] font-bold">250 documents matched</span>
            <span className="text-[#64748B]"> • compound index </span>
            <code className="text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-1 py-0.5 rounded text-[10px]">idx_status_created</code>
            <span className="text-[#059669] font-bold"> hit</span>
          </div>
        </div>

        {/* Bottom Control Metrics */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-[#111111] pt-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="border border-[#111111] px-2 py-0.5 rounded bg-white font-bold text-[#111111]">
              TLS 1.3
            </span>
            <span className="text-[#666666] hidden sm:inline">AES-256-GCM Session</span>
          </div>
          <div className="font-bold text-[#111111]">
            ZERO DEPENDENCIES
          </div>
        </div>
      </div>
    </div>
  );
}

// Interactive Live Query Playground for LioranDB Studio Landing Page
export function InteractiveQueryStage() {
  const [activeTab, setActiveTab] = useState<"find" | "aggregate" | "indexes">("find");
  const [queryInput, setQueryInput] = useState('{\n  "status": "active",\n  "tier": "enterprise"\n}');

  const sampleResults = {
    find: [
      { _id: "usr_9918", username: "alex.dev", status: "active", tier: "enterprise", latency_ms: 0.38 },
      { _id: "usr_9924", username: "swaraj.db", status: "active", tier: "enterprise", latency_ms: 0.41 },
    ],
    aggregate: [
      { _id: "enterprise", total_users: 1420, avg_storage_mb: 256.4 },
      { _id: "pro", total_users: 8940, avg_storage_mb: 48.2 },
    ],
    indexes: [
      { name: "_id_", fields: ["_id: 1"], unique: true, buildState: "ready" },
      { name: "idx_status_tier", fields: ["status: 1", "tier: 1"], unique: false, buildState: "ready" },
    ],
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-[10px] border-2 border-[#111111] bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#111111]">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#111111] pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#666666]">
            <span>LIORANDB STUDIO</span>
            <span>/</span>
            <span className="font-bold text-[#111111]">LIVE QUERY ENGINE</span>
          </div>
          <h3 className="font-sans text-xl font-bold tracking-tight text-[#000000] mt-0.5">
            Real-time Driver Sandbox
          </h3>
        </div>

        {/* Query Engine Tabs */}
        <div className="flex rounded-[5px] border-2 border-[#111111] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setActiveTab("find");
              setQueryInput('{\n  "status": "active",\n  "tier": "enterprise"\n}');
            }}
            className={`px-3 py-1 font-mono text-xs font-bold ${
              activeTab === "find" ? "bg-[#000000] text-white" : "bg-white text-[#111111]"
            }`}
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("aggregate");
              setQueryInput('[\n  { "$match": { "status": "active" } },\n  { "$group": { "_id": "$tier", "count": { "$sum": 1 } } }\n]');
            }}
            className={`px-3 py-1 font-mono text-xs font-bold border-l-2 border-[#111111] ${
              activeTab === "aggregate" ? "bg-[#000000] text-white" : "bg-white text-[#111111]"
            }`}
          >
            Aggregate
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("indexes");
              setQueryInput('[\n  { "field": "status", "direction": "asc" },\n  { "field": "created_at", "direction": "desc" }\n]');
            }}
            className={`px-3 py-1 font-mono text-xs font-bold border-l-2 border-[#111111] ${
              activeTab === "indexes" ? "bg-[#000000] text-white" : "bg-white text-[#111111]"
            }`}
          >
            Indexes
          </button>
        </div>
      </div>

      {/* Editor & Output Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Editor Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs text-[#666666]">
            <span>INPUT FILTER / PIPELINE</span>
            <span className="font-bold text-[#111111]">JSON</span>
          </div>
          <textarea
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            rows={7}
            className="w-full rounded-[7px] border-2 border-[#111111] bg-white p-3 font-mono text-xs text-[#111111] shadow-[2px_2px_0px_#111111] focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#666666]">Target: default.users</span>
            <button
              type="button"
              className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Run Query →
            </button>
          </div>
        </div>

        {/* Results Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs text-[#666666]">
            <span>OUTPUT RESULTS</span>
            <span className="font-bold text-[#059669]">2 matched • <span className="text-[#D97706]">0.38ms</span></span>
          </div>
          <pre
            className="editor-scroll h-[175px] overflow-auto rounded-[7px] border-2 border-[#111111] bg-white p-3 font-mono text-xs leading-5 text-[#111111] shadow-[2px_2px_0px_#111111]"
            dangerouslySetInnerHTML={{
              __html: syntaxHighlightJson(sampleResults[activeTab]),
            }}
          />
          <div className="font-mono text-[11px] text-[#059669] text-right font-medium">
            ✓ Result streamed directly from @liorandb/driver
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Hand-drawn Wavy Underline
export function SketchUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      width="100%"
      height="12"
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 6 Q 25 10, 50 6 T 100 6 T 150 6 T 198 6"
        stroke="#111111"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
