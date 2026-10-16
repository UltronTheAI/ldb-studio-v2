import {
  ClientClosedError,
  ConfigurationError,
  ConnectionError,
  DnsResolutionError,
  LioranDBClient,
  TlsError,
  type TransportResponseDiagnostics,
} from "@liorandb/driver";
import { validateConnectionTarget } from "./connection";

export interface DiagnosticEvent {
  readonly durationMs: number;
  readonly transport: string;
  readonly operation: string;
  readonly ok: boolean;
  readonly statusCode: number | null;
  readonly requestId: string | null;
}

export interface ClientExecutionOptions {
  readonly allowLocal?: boolean;
  readonly sessionId?: string;
}

interface PooledClient {
  readonly client: LioranDBClient;
  readonly sessionId: string;
  readonly connectionUri: string;
  lastUsedAt: number;
  inFlight: number;
  readonly activeDiagnostics: Set<DiagnosticEvent[]>;
}

// Session-isolated connection pool to avoid gRPC channel churn and connection storms.
// Each active user session gets its own dedicated client instance with complete credential separation.
const clientPool = new Map<string, PooledClient>();
const MAX_POOLED_CLIENTS = 20;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function isFatalConnectionError(error: unknown): boolean {
  return (
    error instanceof ConnectionError ||
    error instanceof DnsResolutionError ||
    error instanceof TlsError ||
    error instanceof ClientClosedError
  );
}

function sweepIdleClients(): void {
  const now = Date.now();
  for (const [sessionId, entry] of clientPool.entries()) {
    if (entry.inFlight === 0 && now - entry.lastUsedAt > IDLE_TIMEOUT_MS) {
      clientPool.delete(sessionId);
      void entry.client.close().catch(() => {});
    }
  }
}

// Background sweep for idle connections (unref to avoid hanging tests or processes)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(sweepIdleClients, 60_000);
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}

// Process shutdown cleanup
if (typeof process !== "undefined" && typeof process.once === "function") {
  const onShutdown = () => {
    void closeAllPooledClients();
  };
  process.once("SIGTERM", onShutdown);
  process.once("SIGINT", onShutdown);
}

export async function evictLioranClient(sessionId?: string): Promise<void> {
  if (!sessionId) return;
  const entry = clientPool.get(sessionId);
  if (entry) {
    clientPool.delete(sessionId);
    await entry.client.close().catch(() => {});
  }
}

export async function closeAllPooledClients(): Promise<void> {
  const entries = Array.from(clientPool.values());
  clientPool.clear();
  await Promise.allSettled(entries.map((entry) => entry.client.close().catch(() => {})));
}

export function getClientPoolStats(): { size: number; activeSessions: string[] } {
  return {
    size: clientPool.size,
    activeSessions: Array.from(clientPool.keys()),
  };
}

export async function createLioranClient(
  connectionUri: string,
  diagnostics?: DiagnosticEvent[],
  options?: { readonly allowLocal?: boolean },
): Promise<LioranDBClient> {
  // Validate the target address before attempting any network connection
  validateConnectionTarget(connectionUri, options);

  const client = new LioranDBClient(connectionUri, {
    logoutOnClose: false,
    transport: "grpc",
    allowHttpFallback: false,
    grpcChannels: 2, // Bounded channels per client to prevent channel storms on the container
  });

  if (client.options.transport !== "grpc" || client.options.allowHttpFallback !== false) {
    throw new ConfigurationError(
      "LioranDB Studio enforces exclusive gRPC transport with HTTP fallback disabled.",
    );
  }

  if (diagnostics) {
    client.setResponseObserver((event: TransportResponseDiagnostics) => {
      diagnostics.push({
        durationMs: event.durationMS,
        transport: event.transport,
        operation: event.operation,
        ok: event.ok,
        statusCode: event.grpcStatusCode ?? event.httpStatus ?? null,
        requestId: event.requestId ?? null,
      });
    });
  }

  await client.connect();
  return client;
}

export async function withLioranClient<T>(
  connectionUri: string,
  callback: (client: LioranDBClient, diagnostics: DiagnosticEvent[]) => Promise<T>,
  options?: ClientExecutionOptions | string,
): Promise<T> {
  const diagnostics: DiagnosticEvent[] = [];
  const sessionId = typeof options === "string" ? options : options?.sessionId;
  const executionOptions = typeof options === "string" ? undefined : options;

  // If no sessionId is provided (e.g. testing credentials in connectAction before session creation),
  // use a transient connection that is closed upon completion.
  if (!sessionId) {
    const client = await createLioranClient(connectionUri, diagnostics, executionOptions);
    try {
      return await callback(client, diagnostics);
    } finally {
      await client.close().catch(() => {});
    }
  }

  // Pooled connection path with strict session/tenant isolation
  sweepIdleClients();

  let entry = clientPool.get(sessionId);

  // If cached client has mismatched URI or became disconnected, evict it
  if (entry && (entry.connectionUri !== connectionUri || !entry.client.isConnected())) {
    clientPool.delete(sessionId);
    void entry.client.close().catch(() => {});
    entry = undefined;
  }

  if (!entry) {
    // Evict oldest idle client if pool is full
    if (clientPool.size >= MAX_POOLED_CLIENTS) {
      let oldestKey: string | null = null;
      let oldestTime = Number.POSITIVE_INFINITY;
      for (const [key, item] of clientPool.entries()) {
        if (item.inFlight === 0 && item.lastUsedAt < oldestTime) {
          oldestTime = item.lastUsedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        const evicted = clientPool.get(oldestKey);
        clientPool.delete(oldestKey);
        void evicted?.client.close().catch(() => {});
      }
    }

    validateConnectionTarget(connectionUri, executionOptions);

    const client = new LioranDBClient(connectionUri, {
      logoutOnClose: false,
      transport: "grpc",
      allowHttpFallback: false,
      grpcChannels: 2, // Bounded channels per client to prevent channel storms on the container
    });

    if (client.options.transport !== "grpc" || client.options.allowHttpFallback !== false) {
      throw new ConfigurationError(
        "LioranDB Studio enforces exclusive gRPC transport with HTTP fallback disabled.",
      );
    }

    const activeDiagnostics = new Set<DiagnosticEvent[]>();

    client.setResponseObserver((event: TransportResponseDiagnostics) => {
      const diag: DiagnosticEvent = {
        durationMs: event.durationMS,
        transport: event.transport,
        operation: event.operation,
        ok: event.ok,
        statusCode: event.grpcStatusCode ?? event.httpStatus ?? null,
        requestId: event.requestId ?? null,
      };
      for (const diagList of activeDiagnostics) {
        diagList.push(diag);
      }
    });

    await client.connect();

    entry = {
      client,
      sessionId,
      connectionUri,
      lastUsedAt: Date.now(),
      inFlight: 0,
      activeDiagnostics,
    };
    clientPool.set(sessionId, entry);
  }

  entry.lastUsedAt = Date.now();
  entry.inFlight += 1;
  entry.activeDiagnostics.add(diagnostics);

  try {
    return await callback(entry.client, diagnostics);
  } catch (error) {
    if (isFatalConnectionError(error)) {
      clientPool.delete(sessionId);
      void entry.client.close().catch(() => {});
    }
    throw error;
  } finally {
    entry.activeDiagnostics.delete(diagnostics);
    entry.inFlight = Math.max(0, entry.inFlight - 1);
    entry.lastUsedAt = Date.now();
  }
}
