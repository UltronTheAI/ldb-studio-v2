"use client";

import React from "react";
import { Loader2Icon, DatabaseIcon } from "lucide-react";

interface LoadingSpinnerWidgetProps {
  message?: string;
  subtext?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinnerWidget({
  message = "Loading data from cluster...",
  subtext = "Executing request via authenticated gRPC transport",
  size = "md",
  className = "",
}: LoadingSpinnerWidgetProps) {
  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 select-none text-center space-y-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center p-3 rounded-[10px] bg-[var(--surface-card)] border border-[var(--hairline-strong)] shadow-xs">
        <Loader2Icon
          size={iconSize}
          className="animate-spin text-[var(--text-link)] shrink-0"
        />
      </div>

      <div className="space-y-1">
        <div className="font-sans text-xs font-bold text-[var(--ink)] tracking-wide">
          {message}
        </div>
        {subtext && (
          <div className="font-mono text-[10px] text-[var(--muted)]">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

interface TableSkeletonWidgetProps {
  columns?: number;
  rows?: number;
  message?: string;
  className?: string;
}

export function TableSkeletonWidget({
  columns = 4,
  rows = 5,
  message = "Fetching records from database...",
  className = "",
}: TableSkeletonWidgetProps) {
  return (
    <div
      className={`w-full h-full flex flex-col rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] overflow-hidden shadow-xs select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Header bar with spinner */}
      <div className="h-9 px-4 bg-[var(--canvas-soft)] border-b border-[var(--hairline)] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <Loader2Icon size={13} className="animate-spin text-[var(--text-link)]" />
          <span className="font-semibold text-[var(--ink)]">{message}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)] font-bold uppercase">
          gRPC
        </span>
      </div>

      {/* Skeleton Rows */}
      <div className="flex-1 divide-y divide-[var(--hairline)] overflow-hidden p-2">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="flex items-center gap-4 px-3 py-3 animate-pulse"
          >
            {/* Row number / checkbox placeholder */}
            <div className="w-5 h-4 rounded-[3px] bg-[var(--hairline-strong)] shrink-0 opacity-40" />

            {/* Column cells placeholders */}
            {Array.from({ length: columns }).map((_, cIdx) => {
              const widths = ["w-28", "w-40", "w-20", "w-32", "w-16"];
              const w = widths[(rIdx + cIdx) % widths.length];
              return (
                <div
                  key={cIdx}
                  className={`h-3.5 rounded-[4px] bg-[var(--hairline-strong)] opacity-50 ${w}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CardSkeletonWidgetProps {
  count?: number;
  message?: string;
  className?: string;
}

export function CardSkeletonWidget({
  count = 3,
  message = "Synchronizing cluster state...",
  className = "",
}: CardSkeletonWidgetProps) {
  return (
    <div
      className={`space-y-3 select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] px-1">
        <Loader2Icon size={12} className="animate-spin text-[var(--text-link)]" />
        <span className="font-semibold text-[var(--ink)]">{message}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-xs space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--hairline)]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[var(--hairline-strong)] opacity-60" />
                <div className="w-20 h-4 rounded bg-[var(--hairline-strong)] opacity-60" />
              </div>
              <div className="w-12 h-4 rounded bg-[var(--hairline-strong)] opacity-40" />
            </div>
            <div className="space-y-2">
              <div className="w-full h-3 rounded bg-[var(--hairline-strong)] opacity-30" />
              <div className="w-3/4 h-3 rounded bg-[var(--hairline-strong)] opacity-30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LoadingOverlayWidgetProps {
  message?: string;
  className?: string;
}

export function LoadingOverlayWidget({
  message = "Updating...",
  className = "",
}: LoadingOverlayWidgetProps) {
  return (
    <div
      className={`absolute inset-0 z-20 bg-[var(--canvas)]/60 backdrop-blur-[1px] flex flex-col items-center justify-center select-none ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="p-4 rounded-[8px] bg-[var(--surface-card)] border border-[var(--hairline-strong)] shadow-lg flex items-center gap-3 font-mono text-xs">
        <Loader2Icon size={16} className="animate-spin text-[var(--text-link)]" />
        <span className="font-semibold text-[var(--ink)]">{message}</span>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--hairline)] uppercase font-bold">
          gRPC
        </span>
      </div>
    </div>
  );
}

interface EmptyStateWidgetProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyStateWidget({
  icon: Icon = DatabaseIcon,
  title,
  description,
  action,
  className = "",
}: EmptyStateWidgetProps) {
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-8 select-none text-center space-y-3 ${className}`}
    >
      <div className="p-3.5 rounded-[12px] bg-[var(--surface-strong)] border border-[var(--hairline)] text-[var(--muted)]">
        <Icon size={22} />
      </div>
      <div className="space-y-1 max-w-sm">
        <div className="font-sans text-sm font-bold text-[var(--ink)]">
          {title}
        </div>
        {description && (
          <p className="font-mono text-xs text-[var(--muted)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-primary h-7 px-3 text-xs font-semibold mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
