"use client";

export type StudioRequestPriority = "foreground" | "background";

export interface StudioRequestPolicy {
  readonly ttlMs: number;
  readonly staleWhileRevalidate?: boolean;
  readonly priority?: StudioRequestPriority;
  readonly cache?: boolean;
  readonly force?: boolean;
}

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number;
  lastUsedAt: number;
}

interface QueuedRequest<T> {
  readonly key: string;
  readonly priority: StudioRequestPriority;
  readonly loader: () => Promise<T>;
  readonly policy: StudioRequestPolicy;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
}

export interface StudioRequestDiagnostics {
  hits: number;
  misses: number;
  deduped: number;
  completed: number;
  cancelled: number;
  inFlight: number;
  queued: number;
  lastDurationMs: number | null;
}

const MAX_CACHE_ENTRIES = 80;

/**
 * Small, session-local request coordinator. Server Actions cannot be aborted
 * once they have started, so cancellation here means stale-result suppression
 * plus queue cancellation; this still prevents abandoned views from updating.
 */
export class StudioRequestManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly queue: QueuedRequest<unknown>[] = [];
  private foregroundInFlight = 0;
  private backgroundInFlight = 0;
  private readonly diagnosticsState: StudioRequestDiagnostics = {
    hits: 0,
    misses: 0,
    deduped: 0,
    completed: 0,
    cancelled: 0,
    inFlight: 0,
    queued: 0,
    lastDurationMs: null,
  };

  constructor(private readonly diagnosticsEnabled = false) {}

  getDiagnostics(): StudioRequestDiagnostics {
    return { ...this.diagnosticsState, queued: this.queue.length };
  }

  async request<T>(key: string, loader: () => Promise<T>, policy: StudioRequestPolicy): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    const useCache = policy.cache !== false;

    if (useCache && !policy.force && cached) {
      cached.lastUsedAt = now;
      if (cached.expiresAt > now) {
        this.diagnosticsState.hits += 1;
        this.trace("cache-hit", key);
        return cached.value as T;
      }

      if (policy.staleWhileRevalidate) {
        this.diagnosticsState.hits += 1;
        this.trace("stale-hit", key);
        void this.request(key, loader, { ...policy, force: true, priority: "background" }).catch(() => {});
        return cached.value as T;
      }
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      this.diagnosticsState.deduped += 1;
      this.trace("deduped", key);
      return existing as Promise<T>;
    }

    this.diagnosticsState.misses += 1;
    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        key,
        priority: policy.priority ?? "foreground",
        loader,
        policy,
        resolve,
        reject,
      } as QueuedRequest<unknown>);
      this.queue.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "foreground" ? -1 : 1));
      this.pump();
    });

    this.inFlight.set(key, promise);
    this.diagnosticsState.inFlight += 1;
    promise.finally(() => {
      this.inFlight.delete(key);
      this.diagnosticsState.inFlight = Math.max(0, this.diagnosticsState.inFlight - 1);
    }).catch(() => {});
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private pump(): void {
    const nextIndex = this.queue.findIndex((item) =>
      item.priority === "foreground"
        ? this.foregroundInFlight < 2
        : this.backgroundInFlight < 1,
    );
    if (nextIndex === -1) return;

    const [item] = this.queue.splice(nextIndex, 1);
    if (item.priority === "foreground") this.foregroundInFlight += 1;
    else this.backgroundInFlight += 1;

    void item.loader().then(
      (value) => {
        const durationMs = (value as { durationMs?: unknown } | null)?.durationMs;
        if (typeof durationMs === "number") this.diagnosticsState.lastDurationMs = durationMs;
        if (item.policy.cache !== false && item.policy.ttlMs > 0) {
          this.cache.set(item.key, {
            value,
            expiresAt: Date.now() + item.policy.ttlMs,
            lastUsedAt: Date.now(),
          });
          this.trimCache();
        }
        this.diagnosticsState.completed += 1;
        item.resolve(value);
      },
      (error) => item.reject(error),
    ).finally(() => {
      if (item.priority === "foreground") this.foregroundInFlight -= 1;
      else this.backgroundInFlight -= 1;
      this.pump();
    }).catch(() => {});

    this.pump();
  }

  private trimCache(): void {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)[0];
      if (!oldest) break;
      this.cache.delete(oldest[0]);
    }
  }

  private trace(event: string, key: string): void {
    if (this.diagnosticsEnabled) {
      console.debug(`[studio-data] ${event}`, { operation: key.split('"')[3] ?? "unknown" });
    }
  }
}
