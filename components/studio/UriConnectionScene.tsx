"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ThemeToggle } from "@/app/theme-toggle";
import { autoConnectAction } from "@/app/actions";
import { persistAndActivateConnection } from "@/app/connection-portal";
import { clearWorkspaceState } from "@/lib/studio/workspace-storage";
import { decodeConnectionParam } from "@/lib/studio/url-utils";
import { LioranDBLogo } from "@/lib/sketch-components";
import {
  CheckIcon,
  DatabaseIcon,
  InfoIcon,
  ShieldIcon,
  XIcon,
} from "@/lib/lucide";
import type { StudioErrorDescriptor } from "@/lib/liorandb/errors";

export interface UriConnectionSceneProps {
  readonly initialUri?: string | null;
  readonly onClose?: () => void;
}

interface ParsedTarget {
  scheme: string;
  host: string;
  port: string;
  database: string;
  username: string;
  maskedUri: string;
}

function parseUriForDisplay(uri: string): ParsedTarget {
  try {
    const schemeMatch = uri.match(/^([a-zA-Z0-9+.-]+):\/\//);
    if (!schemeMatch) {
      return {
        scheme: "liorandb://",
        host: "cluster-endpoint",
        port: "443",
        database: "default",
        username: "",
        maskedUri: uri,
      };
    }

    const scheme = schemeMatch[1];
    const afterScheme = uri.slice(schemeMatch[0].length);
    const pathIdx = afterScheme.search(/[\/?#]/);
    const authority = pathIdx >= 0 ? afterScheme.slice(0, pathIdx) : afterScheme;
    const pathPart = pathIdx >= 0 ? afterScheme.slice(pathIdx) : "";

    // The credentials and host are separated by the LAST '@' in the authority
    const atIdx = authority.lastIndexOf("@");
    let userinfo = "";
    let hostport = authority;
    if (atIdx >= 0) {
      userinfo = authority.slice(0, atIdx);
      hostport = authority.slice(atIdx + 1);
    }

    const colonIdx = userinfo.indexOf(":");
    const username = colonIdx >= 0 ? userinfo.slice(0, colonIdx) : userinfo;
    const hasPassword = colonIdx >= 0;

    const portMatch = hostport.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "443";
    const host = portMatch ? hostport.slice(0, portMatch.index) : hostport;

    const dbMatch = pathPart.match(/^\/([^?#]*)/);
    const database = dbMatch && dbMatch[1] ? dbMatch[1] : "default";

    const userPart = username
      ? `${username}${hasPassword ? ":••••••••" : ""}@`
      : "";
    const maskedUri = `${scheme}://${userPart}${host}${port ? `:${port}` : ""}/${database}`;

    return {
      scheme: `${scheme}://`,
      host: host || "cluster-endpoint",
      port,
      database,
      username,
      maskedUri,
    };
  } catch {
    return {
      scheme: "liorandb://",
      host: "cluster-endpoint",
      port: "443",
      database: "default",
      username: "",
      maskedUri: uri.replace(/:[^@]+@/, ":••••••••@"),
    };
  }
}

const CONNECTION_STEPS = [
  "Validating connection URI & target endpoint security",
  "Establishing secure gRPC transport channel",
  "Authenticating principal credentials & permissions",
  "Initializing database cluster workspace session",
];

export function UriConnectionScene({ initialUri, onClose }: UriConnectionSceneProps) {
  const [activeUri, setActiveUri] = useState<string | null>(() => {
    return initialUri ? decodeConnectionParam(initialUri) : null;
  });
  const [status, setStatus] = useState<"connecting" | "success" | "failed">("connecting");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDescriptor, setErrorDescriptor] = useState<StudioErrorDescriptor | null>(null);
  const [targetInfo, setTargetInfo] = useState<ParsedTarget | null>(() => {
    return initialUri ? parseUriForDisplay(decodeConnectionParam(initialUri)) : null;
  });
  const [isPending, startTransition] = useTransition();

  const hasTriggeredRef = useRef<boolean>(false);

  // Helper to safely navigate back to home
  const handleClose = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("uri");
        url.searchParams.delete("connection");
        url.searchParams.delete("url");
        window.history.replaceState(null, "", url.pathname);
      } catch {
        // Ignore
      }
    }
    if (onClose) {
      onClose();
    } else {
      window.location.replace("/");
    }
  }, [onClose]);

  // Main connection execution logic
  const executeConnect = useCallback(async (uriToConnect: string) => {
    setStatus("connecting");
    setCurrentStep(0);
    setErrorMessage("");
    setErrorDescriptor(null);

    // Evict previous database tabs and session caches to prevent state pollution
    clearWorkspaceState();

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < CONNECTION_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const result = await autoConnectAction({ connectionUri: uriToConnect });

      clearInterval(stepInterval);

      if (result.ok) {
        setCurrentStep(CONNECTION_STEPS.length - 1);
        setStatus("success");
        // Persist connection in saved list and mark active
        persistAndActivateConnection(uriToConnect);

        // Transition to connected Studio shell
        setTimeout(() => {
          window.location.replace("/");
        }, 550);
      } else {
        setStatus("failed");
        setErrorMessage(
          result.errorDescriptor?.message ||
            result.error ||
            "Failed to establish connection with the database cluster."
        );
        setErrorDescriptor(result.errorDescriptor ?? null);
      }
    } catch (err) {
      clearInterval(stepInterval);
      setStatus("failed");
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message || "An unexpected network or system error occurred.");
    }
  }, []);

  // Initialization: detect URI, scrub address bar, and initiate connection
  useEffect(() => {
    if (hasTriggeredRef.current) return;

    let candidateUri: string | null = initialUri ?? null;

    if (typeof window !== "undefined") {
      const win = window as unknown as { __liorandb_auto_conn?: string };
      if (!candidateUri && win.__liorandb_auto_conn) {
        candidateUri = win.__liorandb_auto_conn;
        delete win.__liorandb_auto_conn;
      }

      if (!candidateUri) {
        const searchParams = new URLSearchParams(window.location.search);
        candidateUri =
          searchParams.get("uri") ||
          searchParams.get("connection") ||
          searchParams.get("url");
      }

      // Immediately scrub the sensitive URI parameter from the browser address bar
      try {
        const url = new URL(window.location.href);
        let removed = false;
        for (const param of ["uri", "connection", "url"]) {
          if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            removed = true;
          }
        }
        if (removed) {
          window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
        }
      } catch {
        // Ignore
      }
    }

    if (!candidateUri) {
      return;
    }

    const decoded = decodeConnectionParam(candidateUri);
    setActiveUri(decoded);
    setTargetInfo(parseUriForDisplay(decoded));
    hasTriggeredRef.current = true;

    startTransition(() => {
      executeConnect(decoded);
    });
  }, [initialUri, executeConnect]);

  // If no URI is present in state, render nothing (allows mounting as dormant detector)
  if (!activeUri) {
    return null;
  }

  const handleRetry = () => {
    if (!activeUri) return;
    startTransition(() => {
      executeConnect(activeUri);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--canvas)] text-[var(--ink)] overflow-y-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <LioranDBLogo size={28} />
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] px-3 py-1 font-mono text-[11px] text-[var(--muted)]">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "connecting"
                    ? "bg-[#0d74ce] animate-pulse"
                    : status === "success"
                    ? "bg-[#10b981]"
                    : "bg-[var(--semantic-error)]"
                }`}
              />
              <span>
                {status === "connecting"
                  ? "CONNECTING VIA URI"
                  : status === "success"
                  ? "CONNECTED"
                  : "CONNECTION FAILED"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition"
              title="Close and return to Home"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12 hero-sky-wash">
        <div className="w-full max-w-[620px]">
          {/* Connecting State */}
          {status === "connecting" && (
            <div className="rounded-[16px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 shadow-xl transition-all">
              {/* Spinner & Header */}
              <div className="text-center">
                <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                  {/* Subtle pulsing outer ring */}
                  <div className="absolute inset-0 rounded-full bg-[#0d74ce]/10 animate-ping opacity-75" />
                  {/* Primary spinner */}
                  <div className="h-14 w-14 rounded-full border-[3px] border-[#0d74ce]/20 border-t-[#0d74ce] animate-spin" />
                  <DatabaseIcon size={24} className="absolute text-[#0d74ce]" />
                </div>

                <h1 className="font-sans text-[22px] font-semibold tracking-tight text-[var(--ink)]">
                  Connecting to LioranDB
                </h1>
                <p className="mt-2 text-sm text-[var(--body)]">
                  Establishing authenticated gRPC session from requested URI...
                </p>
              </div>

              {/* Progress Steps */}
              <div className="mt-8 space-y-3 rounded-[12px] border border-[var(--hairline)] bg-[var(--canvas-soft)] p-4">
                {CONNECTION_STEPS.map((stepLabel, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div
                      key={stepLabel}
                      className={`flex items-center gap-3 text-xs transition-opacity duration-200 ${
                        isCurrent
                          ? "text-[var(--ink)] font-semibold"
                          : isDone
                          ? "text-[#0d74ce]"
                          : "text-[var(--muted)] opacity-60"
                      }`}
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {isDone ? (
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0d74ce] text-white">
                            <CheckIcon size={11} strokeWidth={2.5} />
                          </div>
                        ) : isCurrent ? (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-[#0d74ce] border-t-transparent animate-spin" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-[var(--hairline-strong)]" />
                        )}
                      </div>
                      <span className="flex-1 font-mono">{stepLabel}</span>
                    </div>
                  );
                })}
              </div>

              {/* Target Details Card */}
              {targetInfo && (
                <div className="mt-6 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-card)] p-4 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                    <span>Target Cluster</span>
                    <span className="flex items-center gap-1 text-[#0d74ce]">
                      <ShieldIcon size={12} /> Credentials Masked
                    </span>
                  </div>
                  <div className="font-mono text-[12px] text-[var(--ink)] break-all bg-[var(--canvas-soft)] p-2.5 rounded-[6px] border border-[var(--hairline)]">
                    {targetInfo.maskedUri}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[var(--body)]">
                    <div>
                      Host: <span className="font-semibold text-[var(--ink)] font-mono">{targetInfo.host}</span>
                    </div>
                    <div>
                      Port: <span className="font-semibold text-[var(--ink)] font-mono">{targetInfo.port}</span>
                    </div>
                    <div>
                      Database: <span className="font-semibold text-[var(--ink)] font-mono">{targetInfo.database}</span>
                    </div>
                    <div>
                      Scheme: <span className="font-semibold text-[var(--ink)] font-mono">{targetInfo.scheme}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cancel Button */}
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary text-xs h-9 px-4"
                >
                  Cancel Connection
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="rounded-[16px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 shadow-xl text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]">
                <CheckIcon size={32} strokeWidth={2.5} />
              </div>
              <h1 className="font-sans text-[22px] font-semibold tracking-tight text-[var(--ink)]">
                Connected Successfully
              </h1>
              <p className="mt-2 text-sm text-[var(--body)]">
                Session authenticated. Loading Studio workspace...
              </p>
              <div className="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
                <div className="h-full w-full bg-[#10b981] animate-pulse" />
              </div>
            </div>
          )}

          {/* Failed State */}
          {status === "failed" && (
            <div className="rounded-[16px] border border-[var(--semantic-error)]/30 bg-[var(--surface-card)] p-8 shadow-xl">
              {/* Error Header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--semantic-error)]/15 text-[var(--semantic-error)]">
                  <XIcon size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-sans text-[20px] font-semibold tracking-tight text-[var(--ink)]">
                      {errorDescriptor?.title || "Connection Failed"}
                    </h1>
                    {errorDescriptor?.code && (
                      <span className="rounded-[4px] bg-[var(--semantic-error)]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--semantic-error)]">
                        {errorDescriptor.code}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--body)]">
                    Unable to connect to the requested LioranDB cluster.
                  </p>
                </div>
              </div>

              {/* Error Details Box */}
              <div className="mt-6 rounded-[10px] border border-[var(--semantic-error)]/30 bg-[var(--semantic-error)]/5 p-4 text-xs text-[var(--ink)]">
                <div className="font-semibold text-[var(--semantic-error)] mb-1 flex items-center gap-1.5">
                  <InfoIcon size={14} /> Error Reason
                </div>
                <div className="font-mono text-xs leading-relaxed text-[var(--ink)] break-words">
                  {errorMessage || "Connection timed out or host is unreachable."}
                </div>

                {errorDescriptor?.suggestion && (
                  <div className="mt-3 pt-3 border-t border-[var(--semantic-error)]/20 text-xs text-[var(--body)]">
                    <span className="font-semibold text-[var(--ink)]">Suggestion: </span>
                    {errorDescriptor.suggestion}
                  </div>
                )}
              </div>

              {/* Target Details (Masked) */}
              {targetInfo && (
                <div className="mt-4 rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas-soft)] p-3 text-xs">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                    Target Endpoint
                  </div>
                  <div className="font-mono text-xs text-[var(--ink)] break-all">
                    {targetInfo.maskedUri}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isPending}
                  className="btn-primary w-full sm:flex-1 text-sm flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Retrying...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                        <path d="M16 21h5v-5" />
                      </svg>
                      <span>Retry Connection</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary w-full sm:flex-1 text-sm flex items-center justify-center gap-2"
                >
                  <XIcon size={16} />
                  <span>Close &amp; Go Back</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
