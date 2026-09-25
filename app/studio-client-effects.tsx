"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SCROLL_STATE_KEY = "liorandb-studio-scroll-y";

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
  const [dismissedToastKey, setDismissedToastKey] = useState<string | null>(null);

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

  const toastKey = toastFromUrl ? `${toastFromUrl.tone}:${toastFromUrl.message}` : null;
  const activeToast = toastKey && toastKey !== dismissedToastKey ? toastFromUrl : null;

  useEffect(() => {
    if (!activeToast || !toastKey) {
      return;
    }

    const clearTimer = window.setTimeout(() => {
      setDismissedToastKey(toastKey);
      const nextUrl = buildUrlWithoutTransientParams(
        pathname,
        new URLSearchParams(searchParams.toString()),
        window.location.hash,
      );
      router.replace(nextUrl, { scroll: false });
    }, 5000);

    return () => window.clearTimeout(clearTimer);
  }, [activeToast, pathname, router, searchParams, toastKey]);

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

  if (!activeToast) {
    return null;
  }

  const isError = activeToast.tone === "error";

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] max-w-md">
      <div
        className="flex items-center gap-3 rounded-xl border border-[#38342f] bg-[#181715] px-4 py-3.5 text-sm text-[#faf9f5] shadow-[0_12px_32px_rgba(20,20,19,0.3)] backdrop-blur"
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            isError ? "bg-[#c64545]" : "bg-[#5db872]"
          }`}
        />
        <div className="font-medium leading-5">{activeToast.message}</div>
      </div>
    </div>
  );
}
