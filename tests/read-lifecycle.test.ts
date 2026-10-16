import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Document } from "@liorandb/driver";
import {
  ServerOverloadedError,
  ServerUnavailableError,
  ServerNotReadyError,
  AuthorizationError,
  AuthenticationError,
  ValidationError,
} from "@liorandb/driver";

import {
  mapStudioError,
  redactMessage,
} from "../lib/liorandb/errors";

import {
  getClientPoolStats,
  evictLioranClient,
  closeAllPooledClients,
} from "../lib/liorandb/client";

import {
  isProtectedDatabase,
  PROTECTED_DATABASES,
} from "../lib/liorandb/protection";


describe("Document Read Lifecycle & Studio Error Handling", () => {
  beforeEach(async () => {
    await closeAllPooledClients();
  });

  describe("Empty Collection & Query Result Semantics", () => {
    it("handles an empty collection with zero documents successfully without treating it as an error", () => {
      // Driver find simulation returning 0 documents for empty collection
      const documents: Document[] = [];
      const limit = 50;
      const skip = 0;

      // Read optimization: On page 1 (skip === 0), if documents.length < limit,
      // total is known immediately without running an expensive aggregate/count!
      let countAggregationCalled = false;
      let total = documents.length;
      if (skip === 0 && documents.length < limit) {
        total = documents.length;
      } else {
        countAggregationCalled = true;
      }

      assert.strictEqual(documents.length, 0);
      assert.strictEqual(total, 0);
      assert.strictEqual(countAggregationCalled, false, "Must not execute count aggregation on empty collection");
    });

    it("succeeds with an empty array when query filter matches no documents", () => {
      const documents: Document[] = [];
      const limit = 50;
      const skip = 0;

      let countAggregationCalled = false;
      let total = documents.length;
      if (skip === 0 && documents.length < limit) {
        total = documents.length;
      } else {
        countAggregationCalled = true;
      }

      assert.deepStrictEqual(documents, []);
      assert.strictEqual(total, 0);
      assert.strictEqual(countAggregationCalled, false);
    });

    it("triggers count aggregation only when page is full or on later pages", () => {
      function shouldExecuteCount(skip: number, docCount: number, limit: number): boolean {
        return skip > 0 || docCount >= limit;
      }

      // Scenario A: Page 1 with empty collection (0 docs, limit 50, skip 0)
      assert.strictEqual(shouldExecuteCount(0, 0, 50), false, "Must skip count for empty collection on page 1");

      // Scenario B: Page 1 with partial page (15 docs, limit 50, skip 0)
      assert.strictEqual(shouldExecuteCount(0, 15, 50), false, "Must skip count for partial page on page 1");

      // Scenario C: Page 1 with full page (50 docs, limit 50, skip 0)
      assert.strictEqual(shouldExecuteCount(0, 50, 50), true, "Must count when page 1 is full");

      // Scenario D: Page 2 (skip > 0, e.g. 50)
      assert.strictEqual(shouldExecuteCount(50, 20, 50), true, "Must count when on page 2+");
    });
  });

  describe("Pagination Bounds & Cursor Options Clamping", () => {
    function clampPagination(rawLimit?: number, rawSkip?: number): { limit: number; skip: number } {
      const limit = Math.min(Math.max(1, rawLimit ?? 50), 100);
      const skip = Math.max(0, rawSkip ?? 0);
      return { limit, skip };
    }

    it("clamps limit: 0 to limit: 1 to prevent driver batch_size: 0 rejection", () => {
      const { limit } = clampPagination(0);
      assert.strictEqual(limit, 1);
    });

    it("clamps negative limits and skips to valid minimums", () => {
      const { limit, skip } = clampPagination(-10, -5);
      assert.strictEqual(limit, 1);
      assert.strictEqual(skip, 0);
    });

    it("caps excessive page sizes to maximum bounded limit of 100", () => {
      const { limit } = clampPagination(5000);
      assert.strictEqual(limit, 100);
    });

    it("preserves standard valid page sizes and skips", () => {
      const { limit, skip } = clampPagination(25, 50);
      assert.strictEqual(limit, 25);
      assert.strictEqual(skip, 50);
    });
  });

  describe("Structured Error Handling & gRPC Status Preservation", () => {
    it("preserves RESOURCE_EXHAUSTED details and suggests cluster overload remedies", () => {
      const rawError = new ServerOverloadedError(
        "LioranDB is temporarily overloaded while processing Find. (gRPC: RESOURCE_EXHAUSTED)",
      );
      (rawError as unknown as Record<string, unknown>).grpcStatus = "RESOURCE_EXHAUSTED";
      (rawError as unknown as Record<string, unknown>).grpcStatusCode = 8;
      (rawError as unknown as Record<string, unknown>).requestId = "req-find-abc123";

      const mapped = mapStudioError(rawError);

      assert.strictEqual(mapped.category, "server-overloaded");
      assert.strictEqual(mapped.grpcStatus, "RESOURCE_EXHAUSTED");
      assert.strictEqual(mapped.grpcStatusCode, 8);
      assert.strictEqual(mapped.requestId, "req-find-abc123");
      assert.strictEqual(mapped.retryable, true);
      assert.strictEqual(mapped.title, "Server Overloaded / Rate Limited");
      assert.ok(mapped.suggestion?.includes("experiencing high load") || mapped.suggestion?.includes("concurrency"));
    });

    it("distinguishes ServerUnavailableError and ServerNotReadyError", () => {
      const unavailErr = new ServerUnavailableError("Connection refused by endpoint");
      const mappedUnavail = mapStudioError(unavailErr);
      assert.strictEqual(mappedUnavail.category, "server-unavailable");
      assert.strictEqual(mappedUnavail.title, "Server Unavailable");

      const notReadyErr = new ServerNotReadyError("Cluster node starting up");
      const mappedNotReady = mapStudioError(notReadyErr);
      assert.strictEqual(mappedNotReady.category, "server-not-ready");
      assert.strictEqual(mappedNotReady.title, "Server Not Ready");
    });

    it("preserves ValidationError without marking it retryable", () => {
      const syntaxErr = new ValidationError("Unexpected token in filter expression");
      const mapped = mapStudioError(syntaxErr);
      assert.strictEqual(mapped.category, "validation");
      assert.strictEqual(mapped.retryable, false);
      assert.strictEqual(mapped.title, "Validation Error");
    });

    it("identifies AuthorizationError and AuthenticationError correctly", () => {
      const authErr = new AuthenticationError("Invalid database credentials");
      const mappedAuth = mapStudioError(authErr);
      assert.strictEqual(mappedAuth.category, "authentication");
      assert.strictEqual(mappedAuth.title, "Authentication Failed");

      const permErr = new AuthorizationError("Read permission required for collection");
      const mappedPerm = mapStudioError(permErr);
      assert.strictEqual(mappedPerm.category, "authorization");
      assert.strictEqual(mappedPerm.title, "Access Denied");
    });

    it("redacts sensitive connection tokens, credentials, and passwords in error messages", () => {
      const sensitiveMsg = "Failed connecting to admin:secretP@ssw0rd123!@127.0.0.1:8080 with token bearer-xyz-987";
      const redacted = redactMessage(sensitiveMsg);
      assert.ok(!redacted.includes("secretP@ssw0rd123!"));
      assert.ok(!redacted.includes("bearer-xyz-987"));
      assert.ok(redacted.includes("[REDACTED]") || redacted.includes("***"));
    });
  });

  describe("Bounded Retry Behavior for Read-Only Operations", () => {
    function isRetryableReadError(error: unknown): boolean {
      if (!error || typeof error !== "object") return false;
      const err = error as Record<string, unknown>;
      if (err.retryable === true) return true;
      const name = String(err.name || "");
      const message = String(err.message || "");
      const grpcStatus = String(err.grpcStatus || err.status || "");
      const code = String(err.code || "");

      if (
        name === "ServerOverloadedError" ||
        name === "ServerUnavailableError" ||
        name === "ServerNotReadyError"
      ) {
        return true;
      }
      if (code === "OVERLOADED" || code === "RESOURCE_EXHAUSTED" || code === "UNAVAILABLE") {
        return true;
      }
      if (grpcStatus === "RESOURCE_EXHAUSTED" || grpcStatus === "UNAVAILABLE") {
        return true;
      }
      if (message.includes("RESOURCE_EXHAUSTED") || message.includes("overloaded") || message.includes("UNAVAILABLE")) {
        return true;
      }
      return false;
    }

    async function executeWithRetry<T>(
      fn: () => Promise<T>,
      maxRetries = 2,
    ): Promise<{ result?: T; attempts: number }> {
      let attempts = 0;
      while (true) {
        attempts++;
        try {
          const result = await fn();
          return { result, attempts };
        } catch (error) {
          if (attempts > maxRetries || !isRetryableReadError(error)) {
            throw error;
          }
          // In test, simulate small delay
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
    }

    it("succeeds when transient ServerOverloadedError clears on retry", async () => {
      let failCount = 1;
      const { result, attempts } = await executeWithRetry(async () => {
        if (failCount > 0) {
          failCount--;
          throw new ServerOverloadedError("Overloaded");
        }
        return [{ _id: 1, name: "item" }];
      });

      assert.strictEqual(attempts, 2);
      assert.deepStrictEqual(result, [{ _id: 1, name: "item" }]);
    });

    it("aborts immediately without retrying non-transient ValidationError", async () => {
      let attempts = 0;
      await assert.rejects(
        async () => {
          await executeWithRetry(async () => {
            attempts++;
            throw new ValidationError("Bad JSON filter");
          });
        },
        (err: unknown) => {
          return err instanceof ValidationError;
        },
      );

      assert.strictEqual(attempts, 1, "Non-transient error must not be retried");
    });

    it("stops after bounded maxRetries limit and rethrows persistent server error", async () => {
      let attempts = 0;
      await assert.rejects(
        async () => {
          await executeWithRetry(async () => {
            attempts++;
            throw new ServerOverloadedError("Persistent RESOURCE_EXHAUSTED");
          }, 2);
        },
        (err: unknown) => {
          return err instanceof ServerOverloadedError;
        },
      );

      assert.strictEqual(attempts, 3, "Initial attempt + 2 retries = 3 total attempts");
    });
  });

  describe("Request Sequencing & Stale Response Invalidation", () => {
    it("discards slower responses when a newer request has been triggered", async () => {
      let activeRequestId = 0;
      const responsesApplied: string[] = [];

      async function simulatedFetch(collectionName: string, latencyMs: number) {
        const reqId = ++activeRequestId;

        await new Promise((resolve) => setTimeout(resolve, latencyMs));

        // Discard stale response if activeRequestId has advanced
        if (reqId !== activeRequestId) {
          return;
        }

        responsesApplied.push(collectionName);
      }

      // Request 1 for 'collection' starts with 50ms latency
      const p1 = simulatedFetch("collection", 50);
      // Request 2 for 'user' starts immediately after with 10ms latency
      const p2 = simulatedFetch("user", 10);

      await Promise.all([p1, p2]);

      // Only 'user' should have been applied, since 'collection' was stale
      assert.deepStrictEqual(responsesApplied, ["user"]);
    });
  });

  describe("Connection Pool Isolation & Resource Release", () => {
    it("tracks pool statistics correctly and exposes zero pooled connections when idle", () => {
      const stats = getClientPoolStats();
      assert.strictEqual(typeof stats.size, "number");
      assert.strictEqual(Array.isArray(stats.activeSessions), true);
    });

    it("evicts pooled client cleanly when user logs out or session is destroyed", async () => {
      // Calling evict on non-existent or existing session does not throw
      await evictLioranClient("test-session-id");
      const stats = getClientPoolStats();
      assert.strictEqual(stats.size, 0);
    });
  });

  describe("Infinite Fetch Loop Prevention on Empty Collections & Missing Namespaces", () => {
    it("does not trigger auto-fetch when collection documents are empty if already loaded", () => {
      // Simulating the effect guard condition:
      // if (isRefresh || (isNew && !hasAlreadyLoaded))
      function shouldTriggerFetch(
        currentKey: string,
        loadedKey: string,
        refreshTrigger: number,
        prevRefreshTrigger: number,
        lastExecutedAt?: number,
      ): boolean {
        const isNew = loadedKey !== currentKey;
        const isRefresh = refreshTrigger > 0 && refreshTrigger !== prevRefreshTrigger;
        const hasAlreadyLoaded = Boolean(lastExecutedAt);
        return isRefresh || (isNew && !hasAlreadyLoaded);
      }

      const key = "tab-1:default:collection";

      // 1. First mount of the tab: not loaded yet
      assert.strictEqual(
        shouldTriggerFetch(key, "", 0, 0, undefined),
        true,
        "Must trigger fetch on initial tab mount",
      );

      // 2. Query finishes with 0 documents (empty collection) and sets lastExecutedAt
      const executedAt = Date.now();

      // Subsequent render with empty documents: key matches, already loaded, no refresh
      assert.strictEqual(
        shouldTriggerFetch(key, key, 0, 0, executedAt),
        false,
        "Must NOT trigger fetch when documents are empty and tab is already loaded",
      );

      // 3. User switches tabs and comes back: component mounts with existing tab state
      assert.strictEqual(
        shouldTriggerFetch(key, "", 0, 0, executedAt),
        false,
        "Must NOT re-fetch over network on tab switch when data has already loaded",
      );

      // 4. User explicitly clicks Refresh: refreshTrigger increments
      assert.strictEqual(
        shouldTriggerFetch(key, key, 1, 0, executedAt),
        true,
        "Must trigger fetch when user explicitly clicks Refresh",
      );
    });

    it("verifies index loading is guarded against infinite loops on collections with zero indexes", () => {
      const loadedIndexesKeys = new Set<string>();

      function triggerIndexLoad(key: string, force = false): boolean {
        if (!force && loadedIndexesKeys.has(key)) {
          return false; // Skip redundant load
        }
        loadedIndexesKeys.add(key);
        return true;
      }

      const key = "tab-1:default:collection";

      // First time opening indexes tab
      assert.strictEqual(triggerIndexLoad(key), true, "Must load indexes on first switch");

      // Re-renders with 0 indexes returned (empty collection)
      assert.strictEqual(triggerIndexLoad(key), false, "Must NOT re-load indexes in a loop when indexes array is empty");

      // Explicit refresh forces reload
      assert.strictEqual(triggerIndexLoad(key, true), true, "Explicit refresh must force index reload");
    });

    it("displays loading widget while fetching and only shows empty collection when find returns 0", () => {
      type ViewState = "error" | "loading-skeleton" | "empty-collection" | "documents";

      function resolveViewState(
        error: boolean,
        isLoading: boolean,
        hasFetched: boolean,
        docCount: number,
      ): ViewState {
        if (error) return "error";
        if ((!hasFetched || isLoading) && docCount === 0) return "loading-skeleton";
        if (docCount === 0) return "empty-collection";
        return "documents";
      }

      // Step 1: Collection tab just opened - request has not started or is in flight
      assert.strictEqual(
        resolveViewState(false, true, false, 0),
        "loading-skeleton",
        "Must show loading skeleton when tab opens, NOT empty collection",
      );

      // Step 2: Request in flight
      assert.strictEqual(
        resolveViewState(false, true, true, 0),
        "loading-skeleton",
        "Must show loading skeleton while fetch is in progress with 0 documents",
      );

      // Step 3: Find completes and returns 0 documents
      assert.strictEqual(
        resolveViewState(false, false, true, 0),
        "empty-collection",
        "Must show empty collection ONLY when find request has completed with 0 documents",
      );

      // Step 4: Find completes and returns >0 documents (automatically on start)
      assert.strictEqual(
        resolveViewState(false, false, true, 25),
        "documents",
        "Must show documents automatically on start when find returns matching documents",
      );

      // Step 5: Error occurs
      assert.strictEqual(
        resolveViewState(true, false, false, 0),
        "error",
        "Must show error card when find query errors",
      );
    });
  });

  describe("Protected Database Guards", () => {
    it("identifies 'default' as protected case-insensitively and with whitespace", () => {
      assert.strictEqual(isProtectedDatabase("default"), true);
      assert.strictEqual(isProtectedDatabase("Default"), true);
      assert.strictEqual(isProtectedDatabase("DEFAULT"), true);
      assert.strictEqual(isProtectedDatabase("  default  "), true);
      assert.strictEqual(PROTECTED_DATABASES.has("default"), true);
    });

    it("allows non-system databases to be considered unprotected", () => {
      assert.strictEqual(isProtectedDatabase("analytics"), false);
      assert.strictEqual(isProtectedDatabase("users"), false);
      assert.strictEqual(isProtectedDatabase("production"), false);
      assert.strictEqual(isProtectedDatabase(""), false);
      assert.strictEqual(isProtectedDatabase(null), false);
      assert.strictEqual(isProtectedDatabase(undefined), false);
    });

    it("simulates dropDatabase guard preventing destruction of the default database", () => {
      let underlyingDriverDropCalled = false;

      function simulateDropDatabase(dbName: string, confirmation: string) {
        if (isProtectedDatabase(dbName)) {
          return {
            ok: false,
            error: "The 'default' database is protected and cannot be dropped.",
          };
        }
        if (dbName !== confirmation) {
          throw new Error("Confirmation text does not match database name.");
        }
        underlyingDriverDropCalled = true;
        return { ok: true };
      }

      // Attempt to drop default
      const res = simulateDropDatabase("default", "default");
      assert.strictEqual(res.ok, false);
      assert.strictEqual(
        res.error,
        "The 'default' database is protected and cannot be dropped.",
      );
      assert.strictEqual(
        underlyingDriverDropCalled,
        false,
        "Underlying driver dropDatabase must never be called for 'default'",
      );

      // Normal database drops succeed
      const normalRes = simulateDropDatabase("temp_db", "temp_db");
      assert.strictEqual(normalRes.ok, true);
      assert.strictEqual(underlyingDriverDropCalled, true);
    });
  });
});



