"use client";

import type { Document, FindOptions } from "@liorandb/driver";
import {
  executeAggregationAction,
  executeQueryAction,
  fetchAdminSectionDataAction,
  fetchCollectionDocumentsAction,
  fetchCollectionIndexesAction,
  listDatabaseCollectionsAction,
  listDatabasesAction,
} from "@/app/actions";
import { StudioRequestManager } from "./request-manager";
import { studioQueryKey, type StudioCacheScope } from "./query-keys";

const TTL = {
  explorer: 45_000,
  indexes: 60_000,
  overview: 30_000,
  admin: 15_000,
  documents: 5_000,
};

export class StudioDataClient {
  private readonly manager: StudioRequestManager;

  constructor(private readonly scope: StudioCacheScope) {
    const diagnostics = typeof window !== "undefined" && window.localStorage.getItem("liorandb_studio_diagnostics") === "1";
    this.manager = new StudioRequestManager(diagnostics);
  }

  listDatabases(force = false) {
    return this.manager.request(
      studioQueryKey(this.scope, "databases"),
      () => listDatabasesAction(),
      { ttlMs: TTL.explorer, staleWhileRevalidate: true, priority: "foreground", force },
    );
  }

  listCollections(database: string, force = false) {
    return this.manager.request(
      studioQueryKey(this.scope, "collections", [database]),
      () => listDatabaseCollectionsAction({ database }),
      { ttlMs: TTL.explorer, staleWhileRevalidate: true, priority: "foreground", force },
    );
  }

  fetchDocuments(params: {
    database: string;
    collection: string;
    filter?: string;
    projection?: string;
    sort?: string;
    limit?: number;
    skip?: number;
  }, force = false) {
    const key = studioQueryKey(this.scope, "documents", [params.database, params.collection, params.filter ?? "", params.projection ?? "", params.sort ?? "", params.limit ?? 25, params.skip ?? 0]);
    return this.manager.request(key, () => fetchCollectionDocumentsAction(params), {
      ttlMs: TTL.documents,
      priority: "foreground",
      force,
    });
  }

  fetchIndexes(database: string, collection: string, force = false) {
    const key = studioQueryKey(this.scope, "indexes", [database, collection]);
    return this.manager.request(key, () => fetchCollectionIndexesAction({ database, collection }), {
      ttlMs: TTL.indexes,
      staleWhileRevalidate: true,
      priority: "foreground",
      force,
    });
  }

  fetchAdmin(section: string, params?: { settingsPane?: string }, force = false) {
    const key = studioQueryKey(this.scope, "admin", [section, params?.settingsPane ?? ""]);
    return this.manager.request(key, () => fetchAdminSectionDataAction(section, params), {
      ttlMs: section === "overview" ? TTL.overview : TTL.admin,
      staleWhileRevalidate: true,
      priority: "foreground",
      force,
    });
  }

  executeQuery(params: Parameters<typeof executeQueryAction>[0]) {
    return this.manager.request(
      studioQueryKey(this.scope, "query", [params.database, params.collection, params.filter ?? "", params.projection ?? "", params.sort ?? "", params.limit ?? 50, params.skip ?? 0]),
      () => executeQueryAction(params),
      { ttlMs: 0, cache: false, priority: "foreground" },
    );
  }

  executeAggregation(params: Parameters<typeof executeAggregationAction>[0]) {
    return this.manager.request(
      studioQueryKey(this.scope, "aggregation", [params.database, params.collection, params.pipelineJson]),
      () => executeAggregationAction(params),
      { ttlMs: 0, cache: false, priority: "foreground" },
    );
  }

  invalidateCollection(database: string, collection: string, includeIndexes = false): void {
    const documentPrefix = studioQueryKey(this.scope, "documents", [database, collection]).slice(0, -1);
    this.manager.invalidatePrefix(documentPrefix);
    if (includeIndexes) this.manager.invalidate(studioQueryKey(this.scope, "indexes", [database, collection]));
  }
}

export type StudioDocumentParams = Parameters<StudioDataClient["fetchDocuments"]>[0];
export type StudioFindOptions = FindOptions<Document>;
