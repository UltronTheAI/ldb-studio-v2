import { describe, it } from "node:test";
import assert from "node:assert";
import type { StudioTab, QueryHistoryItem, SavedQueryDraft } from "../lib/studio/workspace-types";
import type { CollectionIndexDefinition } from "@liorandb/driver";
import {
  saveTabsToStorage,
  loadSavedTabs,
  saveQueryHistoryItem,
  loadQueryHistory,
  saveQueryDraftToStorage,
  loadSavedQueryDrafts,
  removeQueryDraftFromStorage,
  clearQueryHistory,
} from "../lib/studio/workspace-storage";

describe("LioranDB Studio IDE Workspace & State Management", () => {
  // In-memory mock for localStorage in Node test environment
  const mockStorage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    },
  };

  if (typeof globalThis.localStorage === "undefined") {
    Object.defineProperty(globalThis, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  }

  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
  }

  describe("Workspace Tabs Sanitization & Persistence", () => {
    it("strips heavy document buffers when persisting collection tabs", () => {
      mockLocalStorage.clear();

      const tabsToSave: StudioTab[] = [
        {
          id: "tab-col-1",
          title: "orders",
          type: "collection",
          database: "app_db",
          collection: "orders",
          isDirty: false,
          collectionState: {
            subTab: "documents",
            viewMode: "table",
            filter: '{"status": "shipped"}',
            projection: '{"_id": 1, "status": 1}',
            sort: '{"createdAt": -1}',
            limit: 50,
            skip: 0,
            page: 1,
            pageSize: 50,
            totalDocuments: 1250,
            documents: [
              { _id: "order-1", status: "shipped", total: 99.95 },
              { _id: "order-2", status: "shipped", total: 42.0 },
            ],
            indexes: [{ name: "_id_", fields: [{ field: "_id", direction: "asc" }] } as unknown as CollectionIndexDefinition],
          },
        },
      ];

      saveTabsToStorage(tabsToSave);

      const loadedTabs = loadSavedTabs();
      assert.strictEqual(loadedTabs.length, 1);
      assert.strictEqual(loadedTabs[0].id, "tab-col-1");
      assert.strictEqual(loadedTabs[0].title, "orders");
      assert.strictEqual(loadedTabs[0].collectionState?.filter, '{"status": "shipped"}');
      assert.strictEqual(loadedTabs[0].collectionState?.totalDocuments, 1250);

      // Verify documents were sanitized and stripped from persistence
      assert.strictEqual(loadedTabs[0].collectionState?.documents.length, 0);
    });

    it("strips query results buffers from query tabs when persisting", () => {
      mockLocalStorage.clear();

      const queryTab: StudioTab = {
        id: "tab-query-1",
        title: "Active Users Query",
        type: "query",
        database: "app_db",
        collection: "users",
        queryState: {
          queryName: "Active Users Query",
          database: "app_db",
          collection: "users",
          queryMode: "find",
          filter: '{"active": true}',
          projection: "",
          sort: '{"lastLogin": -1}',
          limit: 20,
          skip: 0,
          rawJson: "{}",
          results: [
            { _id: "u-1", name: "Alice", active: true },
            { _id: "u-2", name: "Bob", active: true },
          ],
          resultCount: 2,
          viewMode: "json",
        },
      };

      saveTabsToStorage([queryTab]);
      const loaded = loadSavedTabs();
      assert.strictEqual(loaded.length, 1);
      assert.strictEqual(loaded[0].queryState?.results, null);
      assert.strictEqual(loaded[0].queryState?.filter, '{"active": true}');
    });
  });

  describe("Query History Management", () => {
    it("persists execution history and caps maximum records to 50", () => {
      mockLocalStorage.clear();

      const items: QueryHistoryItem[] = [];
      for (let i = 0; i < 60; i++) {
        items.push({
          id: `hist-${i}`,
          timestamp: Date.now() + i,
          database: "analytics",
          collection: "events",
          type: "find",
          querySummary: `find({"event": "click_${i}"})`,
          durationMs: 12 + (i % 5),
          documentCount: 10,
          success: true,
        });
      }

      for (const item of items) {
        saveQueryHistoryItem(item);
      }
      const loaded = loadQueryHistory();
      assert.strictEqual(loaded.length, 50);
      assert.strictEqual(loaded[0].id, "hist-59");
    });

    it("allows clearing history cleanly", () => {
      clearQueryHistory();
      const loaded = loadQueryHistory();
      assert.strictEqual(loaded.length, 0);
    });
  });

  describe("Saved Query Drafts Management", () => {
    it("saves, retrieves, updates, and deletes drafts", () => {
      mockLocalStorage.clear();

      const draft: SavedQueryDraft = {
        id: "draft-1",
        name: "Monthly Revenue Aggregation",
        database: "finance",
        collection: "invoices",
        type: "aggregate",
        content: '[{ "$match": { "paid": true } }]',
        updatedAt: Date.now(),
      };

      saveQueryDraftToStorage(draft);
      let drafts = loadSavedQueryDrafts();
      assert.strictEqual(drafts.length, 1);
      assert.strictEqual(drafts[0].name, "Monthly Revenue Aggregation");

      // Update existing draft
      saveQueryDraftToStorage({
        ...draft,
        content: '[{ "$match": { "paid": true, "year": 2026 } }]',
      });
      drafts = loadSavedQueryDrafts();
      assert.strictEqual(drafts.length, 1);
      assert.ok(drafts[0].content.includes("2026"));

      // Remove draft
      removeQueryDraftFromStorage("draft-1");
      drafts = loadSavedQueryDrafts();
      assert.strictEqual(drafts.length, 0);
    });
  });
});
