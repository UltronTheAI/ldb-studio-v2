"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { redeemStudioHandoffAction } from "@/app/actions";
import { clearWorkspaceState } from "@/lib/studio/workspace-storage";
import { LioranDBLogo } from "@/lib/sketch-components";
import { ThemeToggle } from "@/app/theme-toggle";
import { CheckIcon, DatabaseIcon, ShieldIcon, XIcon } from "@/lib/lucide";

export function HandoffConnectionScene() {
  const [status, setStatus] = useState<"connecting" | "success" | "failed">("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [, startTransition] = useTransition();
  const startedRef = useRef(false);

  const redeem = (token: string) => {
    setStatus("connecting");
    setErrorMessage("");
    clearWorkspaceState();
    startTransition(() => {
      void redeemStudioHandoffAction({ token }).then((result) => {
        if (result.ok) {
          setStatus("success");
          window.setTimeout(() => window.location.replace("/"), 450);
          return;
        }
        setStatus("failed");
        setErrorMessage(
          result.error ||
            "Studio could not complete the Dashboard handoff. Return to Dashboard and open Studio again.",
        );
      });
    });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("handoff")?.trim() || "";
    url.searchParams.delete("handoff");
    window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);

    if (!token) {
      setStatus("failed");
      setErrorMessage("This Studio handoff is missing or invalid. Return to Dashboard and open Studio again.");
      return;
    }

    redeem(token);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--canvas)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <LioranDBLogo size={28} />
            <div className="hidden items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] px-3 py-1 font-mono text-[11px] text-[var(--muted)] sm:flex">
              <span className={`h-2 w-2 rounded-full ${status === "connecting" ? "animate-pulse bg-[#0d74ce]" : status === "success" ? "bg-[#10b981]" : "bg-[var(--semantic-error)]"}`} />
              <span>{status === "connecting" ? "CONNECTING FROM DASHBOARD" : status === "success" ? "CONNECTED" : "HANDOFF FAILED"}</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="hero-sky-wash flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[620px]">
          {status === "connecting" && (
            <div className="rounded-[16px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 text-center shadow-xl">
              <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-[#0d74ce]/10 opacity-75" />
                <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-[#0d74ce]/20 border-t-[#0d74ce]" />
                <DatabaseIcon size={24} className="absolute text-[#0d74ce]" />
              </div>
              <h1 className="font-sans text-[22px] font-semibold tracking-tight">Verifying Dashboard handoff…</h1>
              <p className="mt-2 text-sm text-[var(--body)]">Studio is securely exchanging the one-time handoff and authenticating the assigned database on the server.</p>
              <div className="mt-7 flex items-center justify-center gap-2 text-xs text-[#0d74ce]">
                <ShieldIcon size={14} /> Credentials remain server-side.
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-[16px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 text-center shadow-xl">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#10b981]/15 text-[#10b981]"><CheckIcon size={32} strokeWidth={2.5} /></div>
              <h1 className="font-sans text-[22px] font-semibold tracking-tight">Opening Studio…</h1>
              <p className="mt-2 text-sm text-[var(--body)]">Your authorized database workspace is loading.</p>
            </div>
          )}

          {status === "failed" && (
            <div className="rounded-[16px] border border-[var(--semantic-error)]/30 bg-[var(--surface-card)] p-8 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--semantic-error)]/15 text-[var(--semantic-error)]"><XIcon size={24} strokeWidth={2.5} /></div>
                <div className="flex-1">
                  <h1 className="font-sans text-[20px] font-semibold tracking-tight">Studio handoff failed</h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--body)]" aria-live="polite">{errorMessage}</p>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap justify-end gap-2">
                <a href="https://app.liorandb.com/" rel="noreferrer noopener" className="btn-primary text-xs">Return to Dashboard for a new handoff</a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
