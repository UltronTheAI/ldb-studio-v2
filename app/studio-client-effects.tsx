"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SCROLL_STATE_KEY = "liorandb-studio-scroll-y";

type ToastTone = "notice" | "error";

interface ToastState {
  readonly tone: ToastTone;
  readonly message: string;
}

function buildUrlWithoutTransientParams(
  pathname: string,
  searchParams: URLSearchParams,
  hash: string,
): string {
  const next = new URLSearchParams(searchParams);
  next.delete("notice");
  next.delete("error");
  const query = next.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function StudioClientEffects() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastFromUrl = useMemo(() => {
    const error = searchParams.get("error");
    if (error) {
      return { tone: "error" as const, message: error };
    }
    const notice = searchParams.get("notice");
    if (notice) {
      return { tone: "notice" as const, message: notice };
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (!toastFromUrl) {
      return;
    }

    setToast(toastFromUrl);

    const clearTimer = window.setTimeout(() => {
      setToast(null);
      const nextUrl = buildUrlWithoutTransientParams(
        pathname,
        new URLSearchParams(searchParams.toString()),
        window.location.hash,
      );
      router.replace(nextUrl, { scroll: false });
    }, 5000);

    return () => window.clearTimeout(clearTimer);
  }, [pathname, router, searchParams, toastFromUrl]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(SCROLL_STATE_KEY);
    if (!saved) {
      return;
    }

    const y = Number.parseFloat(saved);
    if (!Number.isFinite(y)) {
      window.sessionStorage.removeItem(SCROLL_STATE_KEY);
      return;
    }

    const restore = () => window.scrollTo({ top: y, behavior: "auto" });
    restore();
    const raf = window.requestAnimationFrame(restore);
    const timeout = window.setTimeout(() => {
      restore();
      window.sessionStorage.removeItem(SCROLL_STATE_KEY);
    }, 80);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    const saveScroll = () => {
      window.sessionStorage.setItem(SCROLL_STATE_KEY, String(window.scrollY));
    };

    const onSubmit = () => saveScroll();
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (!anchor.href) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      saveScroll();
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!toast) {
    return null;
  }

  const toneClassName =
    toast.tone === "error"
      ? "border-rose-500/40 bg-rose-500/15 text-rose-100"
      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] max-w-md">
      <div
        className={`rounded-xl border px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur ${toneClassName}`}
      >
        <div className="text-sm font-medium">{toast.message}</div>
      </div>
    </div>
  );
}
