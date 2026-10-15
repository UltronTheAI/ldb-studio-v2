import type {
  Document,
  CollectionIndexDefinition,
  Principal,
  ServerInfo,
  ReadyStatus,
  ClusterSummary,
} from "@liorandb/driver";

export type StudioTabType =
  | "collection"
  | "query"
  | "aggregation"
  | "indexes"
  | "overview"
  | "admin"
  | "cluster";

export type CollectionSubTab = "documents" | "query" | "aggregation" | "indexes" | "schema";

export type DocumentViewMode = "table" | "json" | "tree";

export type ActivitySection =
  | "explorer"
  | "query"
  | "history"
  | "admin"
  | "cluster"
  | "backups"
  | "settings";

export interface AggregationStage {
  id: string;
  stageOperator: string;
  stageJson: string;
  enabled: boolean;
  comment?: string;
}

export interface CollectionTabState {
  subTab: CollectionSubTab;
  viewMode: DocumentViewMode;
  filter: string;
  projection: string;
  sort: string;
  limit: number;
  skip: number;
  page: number;
  pageSize: number;
  totalDocuments: number;
  documents: Document[];
  indexes: CollectionIndexDefinition[];
  schemaFields?: SchemaFieldSummary[];
  selectedDocument?: Document | null;
  editingDocument?: Document | null;
  isInserting?: boolean;
}

export type QueryOperationMode = "find" | "insertOne" | "insertMany" | "deleteOne" | "deleteMany" | "raw";

export interface QueryTabState {
  queryName: string;
  database: string;
  collection: string;
  queryMode: QueryOperationMode;
  filter: string;
  projection: string;
  sort: string;
  limit: number;
  skip: number;
  rawJson: string;
  insertDocJson?: string;
  insertManyDocsJson?: string;
  deleteFilterJson?: string;
  results: Document[] | null;
  resultCount: number;
  viewMode: DocumentViewMode;
}

export interface AggregationTabState {
  name: string;
  database: string;
  collection: string;
  mode: "visual" | "raw";
  stages: AggregationStage[];
  rawPipelineJson: string;
  results: Document[] | null;
  resultCount: number;
  viewMode: DocumentViewMode;
}

export interface IndexesTabState {
  database: string;
  collection: string;
  indexes: CollectionIndexDefinition[];
}

export interface AdminTabState {
  subSection: "users" | "roles" | "backups" | "settings";
  settingsPane?: "general" | "cors" | "performance" | "limits" | "backups";
}

export interface StudioTab {
  id: string;
  title: string;
  type: StudioTabType;
  database?: string;
  collection?: string;
  isDirty?: boolean;
  isLoading?: boolean;
  error?: string | null;
  executionDurationMs?: number | null;
  lastExecutedAt?: number | null;

  // Specific state slices
  collectionState?: CollectionTabState;
  queryState?: QueryTabState;
  aggregationState?: AggregationTabState;
  indexesState?: IndexesTabState;
  adminState?: AdminTabState;
}

export interface SchemaFieldSummary {
  path: string;
  types: string[];
  presencePercentage: number;
  sampleValues: unknown[];
}

export interface QueryHistoryItem {
  id: string;
  timestamp: number;
  database: string;
  collection: string;
  type: "find" | "aggregate" | "insert" | "delete" | "mutation";
  querySummary: string;
  durationMs: number;
  documentCount: number;
  success: boolean;
  error?: string;
}

export interface SavedQueryDraft {
  id: string;
  name: string;
  database: string;
  collection: string;
  type: "find" | "aggregate" | "mutation";
  content: string;
  updatedAt: number;
}

export interface WorkspaceMetadata {
  openTabIds: string[];
  activeTabId: string;
  activeActivity: ActivitySection;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  expandedDatabases: string[];
}

export interface InitialStudioContext {
  principal: Principal;
  host: string;
  port: number | string;
  protocol: string;
  transport: string;
  tls: boolean;
  scopedDatabase?: string;
  databases: string[];
  collectionsMap: Record<string, string[]>;
  serverInfo?: ServerInfo | null;
  live?: { state: string; node_id: number } | null;
  ready?: ReadyStatus | null;
  clusterSummary?: ClusterSummary | null;
}
