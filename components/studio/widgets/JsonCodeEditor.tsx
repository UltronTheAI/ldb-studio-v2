"use client";

import React, { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { syntaxHighlightJson } from "@/lib/liorandb/json";
import { SparklesIcon, CopyIcon, CheckIcon, AlertCircleIcon, CheckCircle2Icon } from "lucide-react";

export interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string | number;
  maxHeight?: string | number;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  showToolbar?: boolean;
  title?: string;
  badge?: string;
  error?: string | null;
  onFormat?: () => void;
}

export function JsonCodeEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  minHeight,
  maxHeight,
  className = "",
  autoFocus = false,
  disabled = false,
  readOnly = false,
  showLineNumbers = false,
  showToolbar = false,
  title,
  badge,
  error,
  onFormat,
}: JsonCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Synchronize scrolling between textarea, highlighted pre, and line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  }, []);

  // Update scroll on value change
  useEffect(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
    }
  }, [value]);

  // Syntax highlighted HTML with newline padding fix
  const highlightedHtml = useMemo(() => {
    if (!value) return "";
    // Ensure trailing newline renders visual line in <pre>
    const textToHighlight = value.endsWith("\n") ? value + " " : value;
    return syntaxHighlightJson(textToHighlight);
  }, [value]);

  // Line numbers calculation
  const lineCount = useMemo(() => {
    if (!value) return 1;
    return value.split("\n").length;
  }, [value]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);
  }, [lineCount]);

  // Format JSON handler
  const handleFormatJson = useCallback(() => {
    if (onFormat) {
      onFormat();
      return;
    }
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
    } catch {
      // Ignore if not valid JSON yet
    }
  }, [value, onChange, onFormat]);

  // Copy handler
  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  // JSON validity check
  const jsonStatus = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return { valid: true, error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Syntax error";
      return { valid: false, error: msg };
    }
  }, [value]);

  // Smart keyboard shortcuts: Tab indentation and bracket matching
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || disabled) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 1. Tab key -> Insert 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const updated = value.substring(0, start) + "  " + value.substring(end);
      onChange(updated);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
      return;
    }

    // 2. Enter inside { } or [ ] -> Expand with 2 space indent
    if (e.key === "Enter") {
      const before = value.substring(0, start);
      const after = value.substring(start);
      if (
        (before.endsWith("{") && after.startsWith("}")) ||
        (before.endsWith("[") && after.startsWith("]"))
      ) {
        e.preventDefault();
        const updated = before + "\n  \n" + after;
        onChange(updated);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 3;
          }
        });
        return;
      }
    }

    // 3. Auto-close brackets and quotes
    const PAIRS: Record<string, string> = {
      "{": "}",
      "[": "]",
      "(": ")",
      '"': '"',
    };

    if (PAIRS[e.key] && start === end) {
      const closeChar = PAIRS[e.key];
      const after = value.substring(start);

      // If typing closing quote when cursor is right in front of one, skip over it
      if (e.key === '"' && after.startsWith('"')) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        return;
      }

      e.preventDefault();
      const updated = value.substring(0, start) + e.key + closeChar + value.substring(end);
      onChange(updated);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
        }
      });
      return;
    }

    // Skip over closing character if already present
    if ((e.key === "}" || e.key === "]" || e.key === ")") && start === end) {
      const after = value.substring(start);
      if (after.startsWith(e.key)) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        return;
      }
    }

    // 4. Backspace paired characters
    if (e.key === "Backspace" && start === end && start > 0) {
      const prevChar = value[start - 1];
      const nextChar = value[start];
      if (
        (prevChar === "{" && nextChar === "}") ||
        (prevChar === "[" && nextChar === "]") ||
        (prevChar === "(" && nextChar === ")") ||
        (prevChar === '"' && nextChar === '"')
      ) {
        e.preventDefault();
        const updated = value.substring(0, start - 1) + value.substring(start + 1);
        onChange(updated);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start - 1;
          }
        });
      }
    }
  };

  const calculatedMinHeight = minHeight ?? (rows ? `${rows * 20 + 20}px` : "120px");

  return (
    <div
      className={`relative flex flex-col font-mono text-xs rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-dark)] overflow-hidden focus-within:border-[var(--text-link)] transition-colors shadow-xs ${className}`}
    >
      {/* Optional Top Toolbar */}
      {(showToolbar || title || badge) && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-dark-elevated)] border-b border-white/5 select-none shrink-0">
          <div className="flex items-center gap-2">
            {title && (
              <span className="font-sans text-[11px] font-bold text-white uppercase tracking-wider">
                {title}
              </span>
            )}
            {badge && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[var(--muted)] font-mono">
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* JSON validation pill */}
            {jsonStatus && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  jsonStatus.valid
                    ? "bg-[#22c55e]/15 text-[#4ade80]"
                    : "bg-[#f59e0b]/15 text-[#fbbf24]"
                }`}
                title={jsonStatus.error || "Valid JSON"}
              >
                {jsonStatus.valid ? (
                  <>
                    <CheckCircle2Icon size={10} />
                    <span>Valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircleIcon size={10} />
                    <span>Incomplete</span>
                  </>
                )}
              </span>
            )}

            {/* Format button */}
            <button
              type="button"
              onClick={handleFormatJson}
              title="Format JSON (Shift+Alt+F)"
              disabled={disabled || readOnly || !jsonStatus?.valid}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-[var(--muted)] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              <SparklesIcon size={11} className="text-[#facc15]" />
              <span>Format</span>
            </button>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy JSON"
              disabled={!value}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-[var(--muted)] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              {copied ? (
                <CheckIcon size={11} className="text-[#4ade80]" />
              ) : (
                <CopyIcon size={11} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="relative flex-1 flex overflow-hidden min-h-0">
        {/* Line Numbers Column */}
        {showLineNumbers && (
          <div
            ref={lineNumbersRef}
            aria-hidden="true"
            className="select-none py-2.5 px-2 text-right text-[11px] text-[var(--muted)]/40 bg-[var(--surface-dark-elevated)] border-r border-white/5 font-mono leading-5 overflow-hidden shrink-0"
            style={{ minWidth: lineCount >= 100 ? "3.2rem" : "2.4rem" }}
          >
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>
        )}

        {/* Editor Area with Syntax Highlighted Pre + Transparent Textarea */}
        <div className="relative flex-1 h-full min-h-0 overflow-hidden">
          {/* Syntax Highlighted Backdrop */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 m-0 py-2.5 px-3 pointer-events-none select-none font-mono text-xs leading-5 whitespace-pre-wrap break-all overflow-hidden text-[#e2e8f0]"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "12px",
              lineHeight: "20px",
              letterSpacing: "0px",
              tabSize: 2,
            }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />

          {/* Interactive Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            autoFocus={autoFocus}
            disabled={disabled}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="relative block w-full h-full m-0 py-2.5 px-3 font-mono text-xs leading-5 whitespace-pre-wrap break-all bg-transparent text-transparent caret-white selection:bg-[var(--text-link)]/35 focus:outline-none resize-none editor-scroll placeholder:text-[var(--muted)]/40"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "12px",
              lineHeight: "20px",
              letterSpacing: "0px",
              tabSize: 2,
              minHeight: calculatedMinHeight,
              maxHeight: maxHeight,
            }}
          />
        </div>
      </div>

      {/* Error Footer if provided */}
      {error && (
        <div className="px-3 py-1 bg-[#ef4444]/15 border-t border-[#ef4444]/30 text-[#f87171] text-[11px] font-mono flex items-center gap-1.5 shrink-0">
          <AlertCircleIcon size={12} className="shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </div>
  );
}
