"use client";

import { useState } from "react";
import { syntaxHighlightJson } from "@/lib/liorandb/json";

// Expo / LioranDB Modern Geometric Logo Mark
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
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="flex items-center justify-center rounded-[8px] bg-[#000000] text-white dark:bg-[#ffffff] dark:text-[#000000] shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Geometric Expo-inspired chevron & node cluster */}
          <path d="M4 7l8-4 8 4M4 12l8 4 8-4M4 17l8 4 8-4" />
        </svg>
      </div>
      {showText && (
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[17px] font-semibold tracking-[-0.3px] text-[var(--ink)]">
            LioranDB
          </span>
          <span className="font-sans text-[12px] font-medium text-[var(--muted)] tracking-tight">
            Studio
          </span>
        </div>
      )}
    </div>
  );
}

// Device Mockup Hero: Centered MacBook + iPhone composite showing real dev surfaces
// (The brand's visual signature chrome over the sky-blue gradient wash)
export function ExpoDeviceMockupHero({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<"query" | "cluster" | "schema">("query");

  return (
    <div className={`relative w-full max-w-[1000px] mx-auto select-none ${className}`}>
      {/* MacBook Pro Chassis Mockup */}
      <div className="relative rounded-[16px] border border-[var(--hairline-strong)] bg-[#1e2025] dark:bg-[#12141a] p-2.5 pb-0 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
        {/* Screen Bezel Top Bar (Web / App Window Chrome) */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d3039] bg-[#17191e] rounded-t-[10px]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-4 px-2.5 py-0.5 rounded-[6px] bg-[#22252c] text-[11px] font-mono text-[#a0a4b0]">
              <span className="text-[#3b82f6]">https://</span>
              <span>studio.liorandb.internal/cluster/production</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#9094a2]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse" />
            <span className="text-[#e2e4ea] font-medium">RAFT LEADER • TERM 42</span>
          </div>
        </div>

        {/* MacBook Screen Content: Real Studio Dev Surface */}
        <div className="bg-[#121418] text-[#f4f5f8] rounded-b-[6px] p-4 sm:p-6 overflow-hidden">
          {/* Surface Header & Navigation */}
          <div className="flex items-center justify-between border-b border-[#232630] pb-3 mb-4">
            <div className="flex items-center gap-4">
              <span className="text-[14px] font-semibold text-white">Production Cluster</span>
              <div className="flex items-center gap-1 bg-[#1c1f26] p-0.5 rounded-[6px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("query")}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition ${
                    activeTab === "query"
                      ? "bg-[#282d38] text-white shadow-sm"
                      : "text-[#8d92a0] hover:text-white"
                  }`}
                >
                  Query Runner
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("cluster")}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition ${
                    activeTab === "cluster"
                      ? "bg-[#282d38] text-white shadow-sm"
                      : "text-[#8d92a0] hover:text-white"
                  }`}
                >
                  Raft Topology
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("schema")}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-[5px] transition ${
                    activeTab === "schema"
                      ? "bg-[#282d38] text-white shadow-sm"
                      : "text-[#8d92a0] hover:text-white"
                  }`}
                >
                  Indexes (6)
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3 text-[12px] font-mono text-[#8d92a0]">
              <span>commit: <strong className="text-white">104,281</strong></span>
              <span>p99: <strong className="text-[#38bdf8]">0.38ms</strong></span>
            </div>
          </div>

          {/* Tab View Contents */}
          {activeTab === "query" && (
            <div className="grid md:grid-cols-12 gap-4">
              {/* Query Editor Pane */}
              <div className="md:col-span-7 bg-[#181a20] border border-[#262933] rounded-[8px] p-3.5 font-mono text-[12px]">
                <div className="flex items-center justify-between text-[11px] text-[#717684] pb-2 border-b border-[#232630] mb-2.5">
                  <span>db.collection(&apos;users&apos;).find(...)</span>
                  <span className="text-[#3b82f6]">JSON Filter</span>
                </div>
                <div className="space-y-1 text-[#d8dbe2] leading-relaxed">
                  <div>
                    <span className="text-[#818cf8]">&#123;</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[#c084fc]">&quot;status&quot;</span>
                    <span className="text-[#717684]">: </span>
                    <span className="text-[#38bdf8]">&quot;active&quot;</span>
                    <span className="text-[#717684]">,</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[#c084fc]">&quot;tier&quot;</span>
                    <span className="text-[#717684]">: </span>
                    <span className="text-[#38bdf8]">&quot;enterprise&quot;</span>
                    <span className="text-[#717684]">,</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[#c084fc]">&quot;latency_ms&quot;</span>
                    <span className="text-[#717684]">: </span>
                    <span className="text-[#818cf8]">&#123; </span>
                    <span className="text-[#60a5fa]">&quot;$lte&quot;</span>
                    <span className="text-[#717684]">: </span>
                    <span className="text-[#fbbf24]">1.0</span>
                    <span className="text-[#818cf8]"> &#125;</span>
                  </div>
                  <div>
                    <span className="text-[#818cf8]">&#125;</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#232630] flex items-center justify-between text-[11px]">
                  <span className="text-[#717684]">Index: idx_status_tier (Covered)</span>
                  <span className="px-2 py-0.5 rounded bg-[#000000] text-white border border-[#3b82f6]/40 font-sans text-[11px]">
                    Executed in 0.38ms
                  </span>
                </div>
              </div>

              {/* Live Output Pane */}
              <div className="md:col-span-5 bg-[#181a20] border border-[#262933] rounded-[8px] p-3.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-[11px] text-[#717684] pb-2 border-b border-[#232630] mb-2.5">
                  <span>Streamed Documents (2)</span>
                  <span className="text-[#38bdf8]">✓ 200 OK</span>
                </div>
                <div className="space-y-2 text-[#c6c9d2]">
                  <div className="p-2 rounded bg-[#13151a] border border-[#22252e]">
                    <div className="text-[#60a5fa] font-bold">_id: &quot;usr_9918&quot;</div>
                    <div className="text-[#9ea3b0]">username: &quot;alex.dev&quot;</div>
                    <div className="text-[#38bdf8]">status: &quot;active&quot;</div>
                  </div>
                  <div className="p-2 rounded bg-[#13151a] border border-[#22252e]">
                    <div className="text-[#60a5fa] font-bold">_id: &quot;usr_9924&quot;</div>
                    <div className="text-[#9ea3b0]">username: &quot;swaraj.db&quot;</div>
                    <div className="text-[#38bdf8]">status: &quot;active&quot;</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "cluster" && (
            <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
              <div className="p-3 bg-[#181a20] border border-[#3b82f6]/40 rounded-[8px]">
                <div className="text-[#3b82f6] font-bold">NODE 01 (LEADER)</div>
                <div className="text-[#9ea3b0] mt-1">Host: 10.0.1.12:8765</div>
                <div className="text-[#d8dbe2] mt-2">Partitions: [p0, p1, p2]</div>
                <div className="text-[#717684] mt-1">Raft Term: 42 • Lag: 0ms</div>
              </div>
              <div className="p-3 bg-[#181a20] border border-[#262933] rounded-[8px]">
                <div className="text-[#60a5fa] font-bold">NODE 02 (FOLLOWER)</div>
                <div className="text-[#9ea3b0] mt-1">Host: 10.0.1.14:8765</div>
                <div className="text-[#d8dbe2] mt-2">Partitions: [p0_r, p1_r]</div>
                <div className="text-[#717684] mt-1">Replication: Sync (0.12ms)</div>
              </div>
              <div className="p-3 bg-[#181a20] border border-[#262933] rounded-[8px]">
                <div className="text-[#60a5fa] font-bold">NODE 03 (FOLLOWER)</div>
                <div className="text-[#9ea3b0] mt-1">Host: 10.0.1.16:8765</div>
                <div className="text-[#d8dbe2] mt-2">Partitions: [p1_r, p2_r]</div>
                <div className="text-[#717684] mt-1">Replication: Sync (0.18ms)</div>
              </div>
            </div>
          )}

          {activeTab === "schema" && (
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="p-3 bg-[#181a20] border border-[#262933] rounded-[8px]">
                <div className="text-white font-bold">idx_status_tier</div>
                <div className="text-[#717684] mt-1">Fields: status: 1, tier: 1</div>
                <div className="text-[#3b82f6] mt-1">Index type: Compound B-Tree</div>
              </div>
              <div className="p-3 bg-[#181a20] border border-[#262933] rounded-[8px]">
                <div className="text-white font-bold">_id_</div>
                <div className="text-[#717684] mt-1">Fields: _id: 1 (Unique)</div>
                <div className="text-[#3b82f6] mt-1">Primary key hash</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MacBook Bottom Base & Notch */}
      <div className="relative mx-auto w-[104%] -left-[2%] h-3 rounded-b-[14px] bg-[#2d3038] dark:bg-[#1e2028] shadow-md flex items-center justify-center">
        <div className="w-16 h-1 rounded-full bg-[#181a20]" />
      </div>

      {/* Layered iPhone Mockup (Expo Go / Client Simulator) */}
      <div className="hidden sm:block absolute -right-4 -bottom-6 w-[220px] rounded-[32px] border-[4px] border-[#2d3038] bg-[#0c0d12] p-2 shadow-[0_25px_50px_rgba(0,0,0,0.35)] z-20">
        {/* Dynamic Island */}
        <div className="mx-auto w-16 h-3 rounded-full bg-black mb-2" />

        {/* Screen Content */}
        <div className="rounded-[22px] bg-[#14161f] p-3 text-white font-sans overflow-hidden">
          {/* Mobile App Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#232734]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
              <span className="text-[10px] font-mono text-[#a0a4b4]">Expo Go</span>
            </div>
            <span className="text-[9px] font-mono text-[#717688]">v2.0</span>
          </div>

          {/* Real-time sync badge */}
          <div className="mt-2.5 p-2 rounded-[8px] bg-[#1c202d] border border-[#2c3144]">
            <div className="text-[10px] font-semibold text-white">Live Client Sync</div>
            <div className="text-[9px] text-[#9da3b4] mt-0.5 font-mono">
              @liorandb/driver
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono">
              <span className="text-[#38bdf8]">Connected</span>
              <span className="text-[#38bdf8]">0.4ms</span>
            </div>
          </div>

          {/* Live Mobile Row items */}
          <div className="mt-2 space-y-1.5">
            <div className="p-1.5 rounded-[6px] bg-[#181a24] text-[9px]">
              <div className="font-semibold text-[#f1f3f8]">alex.dev</div>
              <div className="text-[#717688] font-mono">Session: active</div>
            </div>
            <div className="p-1.5 rounded-[6px] bg-[#181a24] text-[9px]">
              <div className="font-semibold text-[#f1f3f8]">swaraj.db</div>
              <div className="text-[#717688] font-mono">Session: active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep backward compatible alias for existing imports
export const LioranDBClusterIllustration = ExpoDeviceMockupHero;

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
    <div className="w-full max-w-4xl mx-auto rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 sm:p-8 shadow-sm">
      {/* Console Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
            <span>LIORANDB STUDIO</span>
            <span>/</span>
            <span className="font-semibold text-[var(--ink)]">QUERY STAGE</span>
          </div>
          <h3 className="font-sans text-[20px] font-semibold tracking-tight text-[var(--ink)] mt-1">
            Real-time Driver Sandbox
          </h3>
        </div>

        {/* Query Engine Tabs */}
        <div className="flex p-0.5 rounded-[8px] bg-[var(--surface-strong)] border border-[var(--hairline)]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("find");
              setQueryInput('{\n  "status": "active",\n  "tier": "enterprise"\n}');
            }}
            className={`px-3 py-1.5 font-sans text-xs font-medium rounded-[6px] transition ${
              activeTab === "find"
                ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm font-semibold"
                : "text-[var(--body)] hover:text-[var(--ink)]"
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
            className={`px-3 py-1.5 font-sans text-xs font-medium rounded-[6px] transition ${
              activeTab === "aggregate"
                ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm font-semibold"
                : "text-[var(--body)] hover:text-[var(--ink)]"
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
            className={`px-3 py-1.5 font-sans text-xs font-medium rounded-[6px] transition ${
              activeTab === "indexes"
                ? "bg-[var(--surface-card)] text-[var(--ink)] shadow-sm font-semibold"
                : "text-[var(--body)] hover:text-[var(--ink)]"
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
          <div className="flex items-center justify-between font-mono text-xs text-[var(--muted)]">
            <span>INPUT FILTER / PIPELINE</span>
            <span className="font-semibold text-[var(--ink)]">JSON</span>
          </div>
          <textarea
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            rows={7}
            className="expo-textarea font-mono text-xs"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-xs text-[var(--body)]">Target: default.users</span>
            <button
              type="button"
              className="btn-primary"
            >
              Run Query →
            </button>
          </div>
        </div>

        {/* Results Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-xs text-[var(--muted)]">
            <span>STREAMED OUTPUT</span>
            <span className="font-semibold text-[var(--ink)]">2 matched • <span className="text-[#d97706]">0.38ms</span></span>
          </div>
          <pre
            className="editor-scroll h-[175px] overflow-auto rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-strong)] dark:bg-[#12141a] p-3 font-mono text-xs leading-5 text-[var(--ink)]"
            dangerouslySetInnerHTML={{
              __html: syntaxHighlightJson(sampleResults[activeTab]),
            }}
          />
          <div className="font-mono text-[11px] text-[var(--text-link)] text-right font-medium">
            ✓ Result streamed directly from @liorandb/driver
          </div>
        </div>
      </div>
    </div>
  );
}

// Subtle separator / decorative underline replacement
export function SketchUnderline({ className = "" }: { className?: string }) {
  return (
    <div className={`h-[2px] w-16 bg-[var(--primary)] rounded-full ${className}`} />
  );
}

// 8-up Ecosystem Tiles Grid specified in DESIGN.md
export function EcosystemTilesGrid() {
  const tiles = [
    { name: "TypeScript", role: "Typed Driver SDK", symbol: "TS" },
    { name: "React Native", role: "Mobile Client", symbol: "RN" },
    { name: "Sentry", role: "Error Tracing", symbol: "SN" },
    { name: "Node.js", role: "Server Runtime", symbol: "JS" },
    { name: "Next.js", role: "Fullstack App", symbol: "NX" },
    { name: "Docker", role: "Containers", symbol: "DK" },
    { name: "Kubernetes", role: "Cluster Orchestration", symbol: "K8" },
    { name: "Tailwind CSS", role: "Design Tokens", symbol: "TW" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
      {tiles.map((tile) => (
        <div
          key={tile.name}
          className="flex flex-col items-center justify-center p-3 h-[84px] rounded-[8px] bg-[var(--surface-card)] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] transition text-center group"
        >
          <div className="w-8 h-8 rounded-[6px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-bold text-[var(--ink)] group-hover:bg-[var(--primary)] group-hover:text-[var(--on-primary)] transition">
            {tile.symbol}
          </div>
          <span className="mt-2 text-[11px] font-medium text-[var(--ink)] truncate max-w-full">
            {tile.name}
          </span>
        </div>
      ))}
    </div>
  );
}
