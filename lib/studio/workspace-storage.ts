import type {
  StudioTab,
  QueryHistoryItem,
  SavedQueryDraft,
  WorkspaceMetadata,
} from "./workspace-types";

const TABS_STORAGE_KEY = "liorandb_studio_tabs_v1";
const METADATA_STORAGE_KEY = "liorandb_studio_metadata_v1";
const HISTORY_STORAGE_KEY = "liorandb_studio_query_history_v1";
const DRAFTS_STORAGE_KEY = "liorandb_studio_saved_drafts_v1";

export type WorkspaceStorageScope = string;

function scopedStorageKey(baseKey: string, scope?: WorkspaceStorageScope): string {
  return scope ? `${baseKey}:${encodeURIComponent(scope)}` : baseKey;
}

/**
 * Strips heavy data buffers (such as loaded documents) and any potential
 * credentials before serializing tabs to localStorage.
 */
function sanitizeTabForStorage(tab: StudioTab): StudioTab {
  return {
    id: tab.id,
    title: tab.title,
    type: tab.type,
    database: tab.database,
    collection: tab.collection,
    isDirty: tab.isDirty,
    executionDurationMs: undefined,
    lastExecutedAt: undefined,
    collectionState: tab.collectionState
      ? {
          subTab: tab.collectionState.subTab,
          viewMode: tab.collectionState.viewMode,
          filter: tab.collectionState.filter,
          projection: tab.collectionState.projection,
          sort: tab.collectionState.sort,
          limit: tab.collectionState.limit,
          skip: tab.collectionState.skip,
          page: tab.collectionState.page,
          pageSize: tab.collectionState.pageSize,
          totalDocuments: 0,
          documents: [], // Don't persist large document buffers
          indexes: [],
        }
      : undefined,
    queryState: tab.queryState
      ? {
          ...tab.queryState,
          results: null, // Don't persist query results
        }
      : undefined,
    aggregationState: tab.aggregationState
      ? {
          ...tab.aggregationState,
          results: null,
        }
      : undefined,
    indexesState: tab.indexesState,
    adminState: tab.adminState,
  };
}

export function loadSavedTabs(scope?: WorkspaceStorageScope): StudioTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedStorageKey(TABS_STORAGE_KEY, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioTab[];
    if (Array.isArray(parsed)) {
      // Clear stale lastExecutedAt and totalDocuments if documents array is empty
      return parsed.map((tab) => {
        if (
          tab.type === "collection" &&
          (!tab.collectionState?.documents || tab.collectionState.documents.length === 0)
        ) {
          return {
            ...tab,
            lastExecutedAt: undefined,
            executionDurationMs: undefined,
            collectionState: tab.collectionState
              ? {
                  ...tab.collectionState,
                  totalDocuments: 0,
                  documents: [],
                }
              : undefined,
          };
        }
        return tab;
      });
    }
  } catch {
    // Ignore corrupt storage
  }
  return [];
}

export function hasSavedTabs(scope?: WorkspaceStorageScope): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(scopedStorageKey(TABS_STORAGE_KEY, scope)) !== null;
  } catch {
    return false;
  }
}

export function saveTabsToStorage(tabs: StudioTab[], scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = tabs.slice(0, 20).map(sanitizeTabForStorage);
    localStorage.setItem(scopedStorageKey(TABS_STORAGE_KEY, scope), JSON.stringify(sanitized));
  } catch {
    // Storage quota or serialization issue
  }
}

export function loadWorkspaceMetadata(scope?: WorkspaceStorageScope): Partial<WorkspaceMetadata> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(scopedStorageKey(METADATA_STORAGE_KEY, scope));
    if (!raw) return {};
    return JSON.parse(raw) as Partial<WorkspaceMetadata>;
  } catch {
    return {};
  }
}

export function saveWorkspaceMetadata(
  metadata: Partial<WorkspaceMetadata>,
  scope?: WorkspaceStorageScope,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadWorkspaceMetadata(scope);
    localStorage.setItem(
      scopedStorageKey(METADATA_STORAGE_KEY, scope),
      JSON.stringify({ ...current, ...metadata }),
    );
  } catch {
    // Ignore
  }
}

export function loadQueryHistory(scope?: WorkspaceStorageScope): QueryHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedStorageKey(HISTORY_STORAGE_KEY, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueryHistoryItem[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveQueryHistoryItem(item: QueryHistoryItem, scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadQueryHistory(scope);
    const updated = [item, ...current.filter((i) => i.id !== item.id)].slice(0, 50);
    localStorage.setItem(scopedStorageKey(HISTORY_STORAGE_KEY, scope), JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function clearQueryHistory(scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(scopedStorageKey(HISTORY_STORAGE_KEY, scope));
}

export function loadSavedQueryDrafts(scope?: WorkspaceStorageScope): SavedQueryDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedStorageKey(DRAFTS_STORAGE_KEY, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedQueryDraft[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveQueryDraftToStorage(draft: SavedQueryDraft, scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadSavedQueryDrafts(scope);
    const filtered = current.filter((d) => d.id !== draft.id);
    const updated = [draft, ...filtered].slice(0, 30);
    localStorage.setItem(scopedStorageKey(DRAFTS_STORAGE_KEY, scope), JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function removeQueryDraftFromStorage(id: string, scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadSavedQueryDrafts(scope);
    const updated = current.filter((d) => d.id !== id);
    localStorage.setItem(scopedStorageKey(DRAFTS_STORAGE_KEY, scope), JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

/**
 * Clears connection-specific cached state (tabs, metadata) when switching
 * database connections, ensuring stale tabs or queries from a previous database
 * are not restored into a newly connected database.
 */
export function clearWorkspaceState(scope?: WorkspaceStorageScope): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(scopedStorageKey(TABS_STORAGE_KEY, scope));
    localStorage.removeItem(scopedStorageKey(METADATA_STORAGE_KEY, scope));
  } catch {
    // Ignore storage quota or access errors
  }
}

