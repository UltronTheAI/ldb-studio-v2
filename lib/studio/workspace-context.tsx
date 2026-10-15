"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ActivitySection,
  InitialStudioContext,
  QueryHistoryItem,
  SavedQueryDraft,
  StudioTab,
} from "./workspace-types";
import {
  loadQueryHistory,
  loadSavedQueryDrafts,
  loadSavedTabs,
  loadWorkspaceMetadata,
  removeQueryDraftFromStorage,
  saveQueryDraftToStorage,
  saveQueryHistoryItem,
  saveTabsToStorage,
  saveWorkspaceMetadata,
} from "./workspace-storage";
import { listExplorerTreeAction } from "@/app/actions";

export interface WorkspaceContextValue {
  initialContext: InitialStudioContext;
  tabs: StudioTab[];
  activeTab: StudioTab | undefined;
  activeTabId: string;
  activeActivity: ActivitySection;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  expandedDatabases: Record<string, boolean>;
  searchExplorerQuery: string;
  statusMessage: { text: string; tone: "info" | "success" | "error" } | null;
  lastExecutionDurationMs: number | null;
  history: QueryHistoryItem[];
  savedDrafts: SavedQueryDraft[];
  isCommandPaletteOpen: boolean;
  databases: string[];
  collectionsMap: Record<string, string[]>;

  // Actions
  openCollectionTab: (database: string, collection: string) => void;
  openQueryTab: (database?: string, collection?: string, initialFilter?: string) => void;
  openAggregationTab: (database?: string, collection?: string) => void;
  openIndexesTab: (database: string, collection: string) => void;
  openOverviewTab: () => void;
  openClusterTab: () => void;
  openAdminTab: (
    subSection: "users" | "roles" | "backups" | "settings",
    settingsPane?: "general" | "cors" | "performance" | "limits" | "backups",
  ) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  closeAllTabs: () => void;
  reopenClosedTab: () => void;
  setActiveTab: (id: string) => void;
  updateTabState: (id: string, partial: Partial<StudioTab>) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setActiveActivity: (activity: ActivitySection) => void;
  toggleDatabaseExpanded: (db: string) => void;
  setSearchExplorerQuery: (query: string) => void;
  setStatusMessage: (msg: { text: string; tone: "info" | "success" | "error" } | null) => void;
  setLastExecutionDurationMs: (ms: number | null) => void;
  addQueryHistory: (item: QueryHistoryItem) => void;
  saveDraft: (draft: SavedQueryDraft) => void;
  removeDraft: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  refreshExplorer: () => Promise<void>;
  refreshActiveTab: () => void;
  refreshTrigger: number;
  isRestored: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

let queryCounter = 1;

function getDefaultTabs(initialContext: InitialStudioContext): StudioTab[] {
  const overviewTab: StudioTab = {
    id: "tab-overview",
    title: "Overview",
    type: "overview",
  };

  if (
    initialContext.scopedDatabase &&
    initialContext.collectionsMap[initialContext.scopedDatabase]?.length
  ) {
    const firstCol = initialContext.collectionsMap[initialContext.scopedDatabase][0];
    const colTab: StudioTab = {
      id: `tab-col-${initialContext.scopedDatabase}-${firstCol}`,
      title: firstCol,
      type: "collection",
      database: initialContext.scopedDatabase,
      collection: firstCol,
      collectionState: {
        subTab: "documents",
        viewMode: "table",
        filter: "{}",
        projection: "",
        sort: "",
        limit: 50,
        skip: 0,
        page: 1,
        pageSize: 50,
        totalDocuments: 0,
        documents: [],
        indexes: [],
      },
    };
    return [overviewTab, colTab];
  }

  return [overviewTab];
}

export function WorkspaceProvider({
  initialContext,
  children,
}: {
  initialContext: InitialStudioContext;
  children: ReactNode;
}) {
  const isRestoredRef = useRef(false);
  const [isRestored, setIsRestored] = useState(false);

  // Deterministic initial state to match SSR exactly and eliminate hydration mismatches
  const [tabs, setTabs] = useState<StudioTab[]>(() => getDefaultTabs(initialContext));
  const [activeTabId, setActiveTabId] = useState<string>("tab-overview");
  const [closedTabsHistory, setClosedTabsHistory] = useState<StudioTab[]>([]);
  const [activeActivity, setActiveActivity] = useState<ActivitySection>("explorer");
  const [sidebarWidth, setSidebarWidthState] = useState<number>(280);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const db of initialContext.databases) {
      map[db] = true;
    }
    return map;
  });
  const [searchExplorerQuery, setSearchExplorerQuery] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: "info" | "success" | "error";
  } | null>(null);
  const [lastExecutionDurationMs, setLastExecutionDurationMs] = useState<number | null>(null);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedQueryDraft[]>([]);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [databases, setDatabases] = useState<string[]>(initialContext.databases);
  const [collectionsMap, setCollectionsMap] = useState<Record<string, string[]>>(
    initialContext.collectionsMap,
  );
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Restore client-side persisted state from localStorage after mount
  useEffect(() => {
    let ignore = false;
    void Promise.resolve().then(() => {
      if (ignore) return;
      const saved = loadSavedTabs();
      const meta = loadWorkspaceMetadata();

      if (saved.length > 0) {
        setTabs(saved);
        if (meta.activeTabId && saved.some((t) => t.id === meta.activeTabId)) {
          setActiveTabId(meta.activeTabId);
        } else {
          setActiveTabId(saved[0].id);
        }
      }

      if (meta.activeActivity && (meta.activeActivity as string) !== "settings") {
        setActiveActivity(meta.activeActivity);
      }
      if (typeof meta.sidebarWidth === "number") {
        setSidebarWidthState(meta.sidebarWidth);
      }
      if (typeof meta.isSidebarCollapsed === "boolean") {
        setIsSidebarCollapsed(meta.isSidebarCollapsed);
      }
      if (meta.expandedDatabases && Array.isArray(meta.expandedDatabases)) {
        const map: Record<string, boolean> = {};
        for (const db of meta.expandedDatabases) {
          map[db] = true;
        }
        setExpandedDatabases(map);
      }

      setHistory(loadQueryHistory());
      setSavedDrafts(loadSavedQueryDrafts());

      isRestoredRef.current = true;
      setIsRestored(true);
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Save tabs on change (only after client restoration to avoid wiping localStorage with initial default)
  useEffect(() => {
    if (!isRestoredRef.current) return;
    saveTabsToStorage(tabs);
  }, [tabs]);

  // Save workspace metadata on change (only after client restoration)
  useEffect(() => {
    if (!isRestoredRef.current) return;
    saveWorkspaceMetadata({
      activeActivity,
      sidebarWidth,
      isSidebarCollapsed,
      activeTabId,
      expandedDatabases: Object.keys(expandedDatabases).filter((k) => expandedDatabases[k]),
    });
  }, [activeActivity, sidebarWidth, isSidebarCollapsed, activeTabId, expandedDatabases]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const updateTabState = useCallback((id: string, partial: Partial<StudioTab>) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== id) return tab;
        return {
          ...tab,
          ...partial,
          collectionState: partial.collectionState
            ? { ...tab.collectionState, ...partial.collectionState } as StudioTab["collectionState"]
            : tab.collectionState,
          queryState: partial.queryState
            ? { ...tab.queryState, ...partial.queryState } as StudioTab["queryState"]
            : tab.queryState,
          aggregationState: partial.aggregationState
            ? { ...tab.aggregationState, ...partial.aggregationState } as StudioTab["aggregationState"]
            : tab.aggregationState,
          indexesState: partial.indexesState
            ? { ...tab.indexesState, ...partial.indexesState } as StudioTab["indexesState"]
            : tab.indexesState,
          adminState: partial.adminState
            ? { ...tab.adminState, ...partial.adminState } as StudioTab["adminState"]
            : tab.adminState,
        };
      }),
    );
  }, []);

  const openCollectionTab = useCallback(
    (database: string, collection: string) => {
      const tabId = `col-${database}-${collection}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTabId(tabId);
        return;
      }

      const newTab: StudioTab = {
        id: tabId,
        title: collection,
        type: "collection",
        database,
        collection,
        collectionState: {
          subTab: "documents",
          viewMode: "table",
          filter: "{}",
          projection: "",
          sort: "",
          limit: 50,
          skip: 0,
          page: 1,
          pageSize: 50,
          totalDocuments: 0,
          documents: [],
          indexes: [],
        },
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    [tabs],
  );

  const openQueryTab = useCallback(
    (database?: string, collection?: string, initialFilter = "{}") => {
      const targetDb = database || databases[0] || "default";
      const targetCol = collection || collectionsMap[targetDb]?.[0] || "collection";
      const tabId = `query-${Date.now()}-${queryCounter++}`;
      const title = `Query ${queryCounter}`;

      const newTab: StudioTab = {
        id: tabId,
        title,
        type: "query",
        database: targetDb,
        collection: targetCol,
        queryState: {
          queryName: title,
          database: targetDb,
          collection: targetCol,
          queryMode: "find",
          filter: initialFilter,
          projection: "",
          sort: "",
          limit: 50,
          skip: 0,
          rawJson: JSON.stringify({ filter: {}, limit: 50 }, null, 2),
          results: null,
          resultCount: 0,
          viewMode: "table",
        },
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    [databases, collectionsMap],
  );

  const openAggregationTab = useCallback(
    (database?: string, collection?: string) => {
      const targetDb = database || databases[0] || "default";
      const targetCol = collection || collectionsMap[targetDb]?.[0] || "collection";
      const tabId = `agg-${Date.now()}-${queryCounter++}`;
      const title = `Pipeline ${queryCounter}`;

      const newTab: StudioTab = {
        id: tabId,
        title,
        type: "aggregation",
        database: targetDb,
        collection: targetCol,
        aggregationState: {
          name: title,
          database: targetDb,
          collection: targetCol,
          mode: "visual",
          stages: [
            {
              id: "stage-1",
              stageOperator: "$match",
              stageJson: '{\n  "active": true\n}',
              enabled: true,
            },
          ],
          rawPipelineJson: '[\n  {\n    "$match": {\n      "active": true\n    }\n  }\n]',
          results: null,
          resultCount: 0,
          viewMode: "table",
        },
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    [databases, collectionsMap],
  );

  const openIndexesTab = useCallback(
    (database: string, collection: string) => {
      const tabId = `indexes-${database}-${collection}`;
      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        setActiveTabId(tabId);
        return;
      }

      const newTab: StudioTab = {
        id: tabId,
        title: `Indexes: ${collection}`,
        type: "indexes",
        database,
        collection,
        indexesState: {
          database,
          collection,
          indexes: [],
        },
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    [tabs],
  );

  const openOverviewTab = useCallback(() => {
    const tabId = "tab-overview";
    const existing = tabs.find((t) => t.id === tabId);
    if (!existing) {
      setTabs((prev) => [
        {
          id: tabId,
          title: "Overview",
          type: "overview",
        },
        ...prev,
      ]);
    }
    setActiveTabId(tabId);
  }, [tabs]);

  const openClusterTab = useCallback(() => {
    const tabId = "tab-cluster";
    const existing = tabs.find((t) => t.id === tabId);
    if (!existing) {
      setTabs((prev) => [
        ...prev,
        {
          id: tabId,
          title: "Cluster Topology",
          type: "cluster",
        },
      ]);
    }
    setActiveTabId(tabId);
  }, [tabs]);

  const openAdminTab = useCallback(
    (
      subSection: "users" | "roles" | "backups" | "settings",
      settingsPane?: "general" | "cors" | "performance" | "limits" | "backups",
    ) => {
      const tabId = `admin-${subSection}`;
      const titles: Record<string, string> = {
        users: "User Governance",
        roles: "Roles & Permissions",
        backups: "Backup Repository",
        settings: "Studio Settings",
      };

      const existing = tabs.find((t) => t.id === tabId);
      if (existing) {
        if (settingsPane && existing.adminState) {
          updateTabState(tabId, {
            adminState: { ...existing.adminState, settingsPane },
          });
        }
        setActiveTabId(tabId);
        return;
      }

      const newTab: StudioTab = {
        id: tabId,
        title: titles[subSection] || "Administration",
        type: "admin",
        adminState: {
          subSection,
          settingsPane: settingsPane || "general",
        },
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
    },
    [tabs, updateTabState],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        const target = prev[index];
        setClosedTabsHistory((h) => [target, ...h].slice(0, 10));

        const nextTabs = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          if (nextTabs.length > 0) {
            const nextIndex = Math.min(index, nextTabs.length - 1);
            setActiveTabId(nextTabs[nextIndex].id);
          } else {
            // Keep at least one overview tab
            const defaultOverview: StudioTab = {
              id: "tab-overview",
              title: "Overview",
              type: "overview",
            };
            setActiveTabId(defaultOverview.id);
            return [defaultOverview];
          }
        }
        return nextTabs;
      });
    },
    [activeTabId],
  );

  const closeOtherTabs = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const keep = prev.filter((t) => t.id === id);
        setActiveTabId(id);
        return keep.length ? keep : prev;
      });
    },
    [],
  );

  const closeTabsToRight = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        const keep = prev.slice(0, index + 1);
        if (!keep.some((t) => t.id === activeTabId)) {
          setActiveTabId(id);
        }
        return keep;
      });
    },
    [activeTabId],
  );

  const closeAllTabs = useCallback(() => {
    const defaultOverview: StudioTab = {
      id: "tab-overview",
      title: "Overview",
      type: "overview",
    };
    setTabs([defaultOverview]);
    setActiveTabId("tab-overview");
  }, []);

  const reopenClosedTab = useCallback(() => {
    if (closedTabsHistory.length === 0) return;
    const [mostRecent, ...rest] = closedTabsHistory;
    setClosedTabsHistory(rest);
    setTabs((prev) => [...prev, mostRecent]);
    setActiveTabId(mostRecent.id);
  }, [closedTabsHistory]);

  const reorderTabs = useCallback((startIndex: number, endIndex: number) => {
    setTabs((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const setSidebarWidth = useCallback((width: number) => {
    const clamped = Math.max(180, Math.min(500, width));
    setSidebarWidthState(clamped);
  }, []);

  const toggleDatabaseExpanded = useCallback((db: string) => {
    setExpandedDatabases((prev) => ({
      ...prev,
      [db]: !prev[db],
    }));
  }, []);

  const addQueryHistory = useCallback((item: QueryHistoryItem) => {
    setHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)].slice(0, 50));
    saveQueryHistoryItem(item);
  }, []);

  const saveDraft = useCallback((draft: SavedQueryDraft) => {
    setSavedDrafts((prev) => [draft, ...prev.filter((d) => d.id !== draft.id)].slice(0, 30));
    saveQueryDraftToStorage(draft);
  }, []);

  const removeDraft = useCallback((id: string) => {
    setSavedDrafts((prev) => prev.filter((d) => d.id !== id));
    removeQueryDraftFromStorage(id);
  }, []);

  const refreshExplorer = useCallback(async () => {
    const res = await listExplorerTreeAction();
    if (res.ok && res.data) {
      setDatabases(res.data.databases);
      setCollectionsMap(res.data.collectionsMap);
    }
  }, []);

  const refreshActiveTab = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl + Shift + P: Command Palette
      if (modifier && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl + P: Quick Open / Command Palette
      if (modifier && !e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Ctrl + B: Toggle Explorer Sidebar
      if (modifier && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl + W: Close Active Tab
      if (modifier && (e.key === "W" || e.key === "w")) {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }

      // Ctrl + Tab / Ctrl + Shift + Tab: Switch tabs
      if (modifier && e.key === "Tab") {
        e.preventDefault();
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (currentIndex !== -1 && tabs.length > 1) {
          const delta = e.shiftKey ? -1 : 1;
          const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
          setActiveTabId(tabs[nextIndex].id);
        }
        return;
      }

      // Ctrl + R: Refresh current view (safely intercepted without browser page reload)
      if (modifier && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        refreshActiveTab();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, tabs, closeTab, toggleSidebar, refreshActiveTab]);

  return (
    <WorkspaceContext.Provider
      value={{
        initialContext,
        tabs,
        activeTab,
        activeTabId,
        activeActivity,
        sidebarWidth,
        isSidebarCollapsed,
        expandedDatabases,
        searchExplorerQuery,
        statusMessage,
        lastExecutionDurationMs,
        history,
        savedDrafts,
        isCommandPaletteOpen,
        databases,
        collectionsMap,
        openCollectionTab,
        openQueryTab,
        openAggregationTab,
        openIndexesTab,
        openOverviewTab,
        openClusterTab,
        openAdminTab,
        closeTab,
        closeOtherTabs,
        closeTabsToRight,
        closeAllTabs,
        reopenClosedTab,
        setActiveTab: setActiveTabId,
        updateTabState,
        reorderTabs,
        toggleSidebar,
        setSidebarWidth,
        setActiveActivity,
        toggleDatabaseExpanded,
        setSearchExplorerQuery,
        setStatusMessage,
        setLastExecutionDurationMs,
        addQueryHistory,
        saveDraft,
        removeDraft,
        setCommandPaletteOpen,
        refreshExplorer,
        refreshActiveTab,
        refreshTrigger,
        isRestored,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
