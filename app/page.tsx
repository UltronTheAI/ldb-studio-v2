import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import type {
  BackupJobRecord,
  BackupSettings,
  ClusterHealthSnapshot,
  ClusterPartitionPlacement,
  ClusterSummary,
  CollectionIndexDefinition,
  CorsSettings,
  Document,
  FindOptions,
  LimitSettings,
  PerformanceSettings,
  PermissionName,
  Principal,
  ReadyStatus,
  RedactedSettingsMap,
  RestoreJobRecord,
  RoleRecord,
  ServerInfo,
  SessionView,
  UserRecord,
} from "@liorandb/driver";

import { connectAction, logoutAction, studioMutationAction } from "./actions";
import { ConnectionPortal } from "./connection-portal";
import { StudioClientEffects } from "./studio-client-effects";
import { ThemeToggle } from "./theme-toggle";
import { StudioShell } from "@/components/studio/StudioShell";
import type { InitialStudioContext } from "@/lib/studio/workspace-types";
import type { DiagnosticEvent } from "@/lib/liorandb/client";
import { withLioranClient } from "@/lib/liorandb/client";
import { mapStudioError } from "@/lib/liorandb/errors";
import {
  prettyJson,
  syntaxHighlightJson,
} from "@/lib/liorandb/json";
import {
  ArchiveIcon,
  BoxesIcon,
  DatabaseIcon,
  HardDriveDownloadIcon,
  KeyRoundIcon,
  NetworkIcon,
  PanelLeftIcon,
  PencilIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  Trash2Icon,
  UsersIcon,
} from "@/lib/lucide";
import { destroyStudioSession, getStudioSession } from "@/lib/liorandb/session";
import {
  LioranDBLogo,
  InteractiveQueryStage,
  EcosystemTilesGrid,
} from "@/lib/sketch-components";

type Section =
  | "overview"
  | "databases"
  | "account"
  | "users"
  | "roles"
  | "cluster"
  | "backups"
  | "settings";

type DataPane = "all" | "browse" | "query" | "write" | "indexes" | "aggregate" | "danger";
type SettingsPane = "general" | "cors" | "performance" | "limits" | "backups";
type SearchValue = string | string[] | undefined;

interface PageProps {
  readonly searchParams: Promise<Record<string, SearchValue>>;
}

interface SectionError {
  readonly title: string;
  readonly message: string;
  readonly authorization: boolean;
}

interface QueryState {
  readonly filter: string;
  readonly projection: string;
  readonly sort: string;
  readonly limit: number;
  readonly skip: number;
}

interface StudioData {
  principal: Principal;
  diagnostics: readonly DiagnosticEvent[];
  live: { state: string; node_id: number } | null;
  ready: ReadyStatus | null;
  serverInfo: ServerInfo | null;
  clusterSummary: ClusterSummary | null;
  databases: readonly string[];
  collections: readonly string[];
  documents: readonly Document[];
  documentCount: number;
  indexes: readonly CollectionIndexDefinition[];
  findByIdsResults: readonly (Document | null)[];
  queryState: QueryState;
  aggregateInput: string;
  idsInput: string;
  aggregateResults: readonly Document[];
  sessions: readonly SessionView[];
  users: readonly UserRecord[];
  selectedUser: UserRecord | null;
  roles: readonly RoleRecord[];
  permissions: readonly PermissionName[];
  selectedRole: RoleRecord | null;
  clusterNodes: ClusterSummary["nodes"];
  clusterPartitions: readonly ClusterPartitionPlacement[];
  clusterHealth: ClusterHealthSnapshot;
  clusterReadiness:
    | {
        current: string;
        transitions: ReadyStatus["transitions"];
      }
    | null;
  backups: readonly BackupJobRecord[];
  selectedBackup: BackupJobRecord | null;
  restoreJob: RestoreJobRecord | null;
  settingsGeneral: RedactedSettingsMap | null;
  settingsCors: CorsSettings | null;
  settingsPerformance: PerformanceSettings | null;
  settingsLimits: LimitSettings | null;
  settingsBackups: BackupSettings | null;
  errors: Partial<Record<Section | "documents", SectionError>>;
}

function firstParam(value: SearchValue, fallback = ""): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function hrefFor(section: Section, params: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams();
  search.set("section", section);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  return `/?${search.toString()}`;
}

function fieldClassName() {
  return "expo-input font-mono text-xs";
}

function editorClassName() {
  return "expo-textarea editor-scroll font-mono text-xs";
}

function labelClassName() {
  return "mb-1.5 block font-sans text-xs font-semibold uppercase tracking-wider text-[var(--ink)]";
}

function formatTimestamp(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestampMs));
}

async function loadStudioData(
  connectionUri: string,
  input: {
    readonly section: Section;
    readonly database: string;
    readonly collection: string;
    readonly userId: string;
    readonly roleId: string;
    readonly backupId: string;
    readonly restoreJobId: string;
    readonly queryState: QueryState;
    readonly aggregateInput: string;
    readonly idsInput: string;
  },
): Promise<StudioData> {
  const empty: StudioData = {
    principal: {
      user_id: "",
      username: "",
      credential_version: 0,
      permissions_version: 0,
      must_change_password: false,
      roles: [],
    },
    diagnostics: [],
    live: null,
    ready: null,
    serverInfo: null,
    clusterSummary: null,
    databases: [],
    collections: [],
    documents: [],
    documentCount: 0,
    indexes: [],
    findByIdsResults: [],
    queryState: input.queryState,
    aggregateInput: input.aggregateInput,
    idsInput: input.idsInput,
    aggregateResults: [],
    sessions: [],
    users: [],
    selectedUser: null,
    roles: [],
    permissions: [],
    selectedRole: null,
    clusterNodes: [],
    clusterPartitions: [],
    clusterHealth: [],
    clusterReadiness: null,
    backups: [],
    selectedBackup: null,
    restoreJob: null,
    settingsGeneral: null,
    settingsCors: null,
    settingsPerformance: null,
    settingsLimits: null,
    settingsBackups: null,
    errors: {},
  };

  return withLioranClient(connectionUri, async (client, diagnostics) => {
    const data: StudioData = {
      ...empty,
      diagnostics,
      principal: await client.me(),
    };

    try {
      data.live = await client.live();
      data.ready = await client.ready();
      data.serverInfo = await client.serverInfo();
    } catch (error) {
      const mapped = mapStudioError(error);
      data.errors.overview = {
        title: mapped.title,
        message: mapped.message,
        authorization: !!mapped.isAuthorizationError,
      };
    }

    try {
      data.clusterSummary = await client.cluster.summary();
    } catch {
      // Allow overview without cluster access.
    }

    try {
      data.databases = await client.listDatabases();
    } catch (error) {
      const mapped = mapStudioError(error);
      data.errors.databases = {
        title: mapped.title,
        message: mapped.message,
        authorization: !!mapped.isAuthorizationError,
      };
    }

    if (input.database) {
      try {
        data.collections = await client.db(input.database).listCollections();
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.databases = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.database && input.collection) {
      try {
        const collection = client.db(input.database).collection<Document>(input.collection);
        const filter = input.queryState.filter.trim()
          ? (JSON.parse(input.queryState.filter) as Document)
          : undefined;
        const options: FindOptions<Document> = {
          limit: input.queryState.limit,
          skip: input.queryState.skip,
          ...(input.queryState.projection.trim()
            ? {
                projection: JSON.parse(input.queryState.projection) as FindOptions<Document>["projection"],
              }
            : {}),
          ...(input.queryState.sort.trim()
            ? {
                sort: JSON.parse(input.queryState.sort) as FindOptions<Document>["sort"],
              }
            : {}),
        };
        data.documents = [...(await collection.find(filter, options).toArray())];
        data.documentCount = await collection.countDocuments(filter);
        data.indexes = await collection.listIndexes();
        if (input.idsInput.trim()) {
          data.findByIdsResults = [
            ...((await collection.findManyByIds(
              JSON.parse(input.idsInput) as readonly unknown[],
            )) as readonly (Document | null)[]),
          ];
        }
        if (input.aggregateInput.trim()) {
          data.aggregateResults = [
            ...(await collection
              .aggregate<Document>(JSON.parse(input.aggregateInput) as Document[])
              .toArray()),
          ];
        }
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.documents = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "account") {
      try {
        data.sessions = await client.listSessions();
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.account = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "users") {
      try {
        data.users = await client.users.list();
        if (input.userId) {
          data.selectedUser = await client.users.get(input.userId);
        }
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.users = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "roles") {
      try {
        data.permissions = await client.roles.listPermissions();
        data.roles = await client.roles.listRoles();
        if (input.roleId) {
          data.selectedRole = await client.roles.getRole(input.roleId);
        }
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.roles = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "cluster") {
      try {
        data.clusterNodes = await client.cluster.nodes();
        data.clusterPartitions = await client.cluster.partitions();
        data.clusterHealth = await client.cluster.health();
        data.clusterReadiness = await client.cluster.readiness();
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.cluster = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "backups") {
      try {
        data.backups = await client.backups.list();
        if (input.backupId) {
          data.selectedBackup = await client.backups.get(input.backupId);
        }
        if (input.restoreJobId) {
          data.restoreJob = await client.backups.getRestoreJob(input.restoreJobId);
        }
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.backups = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    if (input.section === "settings") {
      try {
        data.settingsGeneral = await client.settings.get();
        data.settingsCors = await client.settings.getCors();
        data.settingsPerformance = await client.settings.getPerformance();
        data.settingsLimits = await client.settings.getLimits();
        data.settingsBackups = await client.settings.getBackups();
      } catch (error) {
        const mapped = mapStudioError(error);
        data.errors.settings = {
          title: mapped.title,
          message: mapped.message,
          authorization: !!mapped.isAuthorizationError,
        };
      }
    }

    return data;
  });
}

function Card({
  title,
  children,
  className = "",
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly dark?: boolean;
}) {
  return (
    <section className={`rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 shadow-sm transition hover:shadow-md ${className}`}>
      <div className="mb-4 flex items-center justify-between border-b border-[var(--hairline)] pb-3">
        <h2 className="font-sans text-[18px] font-semibold tracking-tight text-[var(--ink)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function JsonBlock({ value }: { readonly value: unknown }) {
  return (
    <pre
      className="editor-scroll overflow-x-auto rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--canvas-soft)] dark:bg-[#12141a] p-4 font-mono text-xs leading-6 text-[var(--ink)]"
      dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(value) }}
    />
  );
}

function StatTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: "slate" | "cyan" | "sky" | "amber" | "coral";
}) {
  return (
    <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4 transition hover:border-[var(--ink)]">
      <div className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1.5 break-all font-sans text-[20px] font-semibold tracking-tight text-[var(--ink)]">{value}</div>
    </div>
  );
}

function DetailList({
  items,
}: {
  readonly items: readonly { readonly label: string; readonly value: ReactNode }[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3">
          <div className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {item.label}
          </div>
          <div className="mt-1 break-all font-mono text-xs text-[var(--ink)]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function TerminalBlock({
  title,
  lines,
}: {
  readonly title: string;
  readonly lines: readonly string[];
}) {
  return (
    <div className="rounded-[8px] border border-[#282a30] bg-[#171717] text-[#f4f5f8] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#282a30] bg-[#121418] px-4 py-2.5">
        <span className="font-mono text-xs font-semibold text-[#a0a4b0]">
          {title}
        </span>
        <span className="font-mono text-[10px] text-[var(--text-link)] font-medium">[LOG STREAM]</span>
      </div>
      <div className="editor-scroll space-y-1.5 overflow-x-auto p-4 font-mono text-xs leading-6 text-[#d0d3de]">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
          return (
            <div key={`${title}-${index}`} className="break-all">
              {isJson ? (
                <span dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(line) }} />
              ) : (
                <span>{line}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentCard({
  value,
  index,
}: {
  readonly value: Document;
  readonly index: number;
}) {
  const entries = Object.entries(value);
  return (
    <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 transition hover:border-[var(--ink)]">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3">
        <div>
          <div className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Document #{index + 1}
          </div>
          <div className="font-mono text-sm font-semibold text-[#0d74ce]">
            {String(value._id ?? `row-${index + 1}`)}
          </div>
        </div>
        <span className="badge-pill">
          {entries.length} fields
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([key, fieldValue]) => (
          <div key={key} className="rounded-[6px] border border-[var(--hairline)] bg-[var(--canvas-soft)] p-3">
            <div className="font-mono text-[11px] font-semibold text-[#8145b5]">
              {key}
            </div>
            <div className="mt-1 text-sm text-[var(--ink)]">
              {typeof fieldValue === "object" && fieldValue !== null ? (
                <pre
                  className="editor-scroll overflow-x-auto rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-2 font-mono text-xs leading-5 text-[var(--ink)]"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(fieldValue) }}
                />
              ) : (
                <span className={`font-mono text-xs font-semibold ${
                  typeof fieldValue === "number"
                    ? "text-[#d97706]"
                    : typeof fieldValue === "boolean"
                    ? "text-[#dc2626]"
                    : fieldValue === null
                    ? "text-[#64748b] italic"
                    : "text-[var(--text-link)]"
                }`}>
                  {typeof fieldValue === "string" ? `"${fieldValue}"` : String(fieldValue)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueryEditor({
  id,
  name,
  label,
  defaultValue,
  minHeight = "min-h-32",
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly minHeight?: string;
}) {
  return (
    <div>
      <label className={labelClassName()} htmlFor={id}>
        {label}
      </label>
      <textarea id={id} name={name} defaultValue={defaultValue} className={`${editorClassName()} ${minHeight}`} suppressHydrationWarning />
    </div>
  );
}

function SettingsField({
  label,
  hint,
  htmlFor,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly htmlFor?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-4 md:grid-cols-[220px_1fr] md:items-start">
      <div className="space-y-1">
        <label className="block font-sans text-xs font-semibold text-[var(--ink)]" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <p className="text-xs leading-5 text-[var(--body)]">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsTextInput(props: {
  readonly id: string;
  readonly name: string;
  readonly defaultValue?: string | number | null;
  readonly placeholder?: string;
  readonly type?: string;
}) {
  return (
    <input
      id={props.id}
      name={props.name}
      type={props.type ?? "text"}
      defaultValue={props.defaultValue === null || props.defaultValue === undefined ? "" : String(props.defaultValue)}
      placeholder={props.placeholder}
      className={fieldClassName()}
      suppressHydrationWarning
    />
  );
}

function SettingsTextarea(props: {
  readonly id: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly rows?: number;
}) {
  return (
    <textarea
      id={props.id}
      name={props.name}
      defaultValue={props.defaultValue}
      placeholder={props.placeholder}
      rows={props.rows ?? 5}
      className={`${editorClassName()} min-h-28`}
      suppressHydrationWarning
    />
  );
}

function SettingsCheckbox(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultChecked?: boolean;
  readonly hint?: string;
}) {
  return (
    <label htmlFor={props.id} className="flex items-start gap-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3.5 cursor-pointer hover:bg-[var(--canvas-soft)] transition">
      <input id={props.id} name={props.name} type="checkbox" defaultChecked={props.defaultChecked} className="mt-1 h-4 w-4 rounded accent-black dark:accent-white" suppressHydrationWarning />
      <span className="space-y-0.5">
        <span className="block text-sm font-semibold text-[var(--ink)]">{props.label}</span>
        {props.hint ? <span className="block text-xs leading-5 text-[var(--body)]">{props.hint}</span> : null}
      </span>
    </label>
  );
}

function parseSettingEntry(value: string | undefined): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function SettingsSummaryTile({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-4">
      <div className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="mt-1.5 break-all font-sans text-[20px] font-semibold text-[var(--ink)]">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-5 text-[var(--body)]">{hint}</div> : null}
    </div>
  );
}

function SectionAlert({ error }: { readonly error?: SectionError }) {
  if (!error) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[8px] border border-[var(--semantic-error)] bg-[var(--semantic-error)]/10 p-4 text-[var(--ink)]">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-[var(--semantic-error)] font-mono text-xs font-bold text-white">
          ×
        </span>
        <strong className="block text-sm font-semibold text-[var(--semantic-error)]">{error.title}</strong>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--body)] pl-7">{error.message}</p>
    </div>
  );
}

function MutationForm({
  action,
  returnTo,
  children,
  className = "space-y-3",
}: {
  readonly action: string;
  readonly returnTo: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <form action={studioMutationAction} className={className} suppressHydrationWarning>
      <input type="hidden" name="mutation" value={action} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {children}
    </form>
  );
}

function renderDisconnectedState(session: NonNullable<Awaited<ReturnType<typeof getStudioSession>>>, message: string) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="sidebar-scroll flex flex-col border-r border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="mb-8">
            <LioranDBLogo size={26} />
            <h1 className="mt-4 font-sans text-xl font-semibold tracking-tight text-[var(--ink)]">Workspace</h1>
            <p className="mt-1 text-xs leading-5 text-[var(--body)]">
              Session for {session.metadata.host}:{session.metadata.port}
            </p>
          </div>

          <details className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-sm text-[var(--ink)]">
            <summary className="cursor-pointer list-none px-4 py-3 select-none font-semibold">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-[var(--ink)]">
                <span>Stored Context</span>
                <span className="text-[11px] text-[var(--muted)]">Details</span>
              </div>
            </summary>
            <div className="space-y-2 border-t border-[var(--hairline)] px-4 py-3 text-xs font-mono text-[var(--body)]">
              <div>Protocol: {session.metadata.protocol}</div>
              <div>Transport: {session.metadata.transport}</div>
              <div>TLS: {session.metadata.tls ? "enabled" : "disabled"}</div>
              <div>Database: {session.metadata.database ?? "not specified"}</div>
            </div>
          </details>

          <div className="sticky bottom-0 mt-auto pt-6">
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn-secondary w-full"
              >
                Clear Saved Session
              </button>
            </form>
          </div>
        </aside>

        <main className="flex items-center justify-center p-6 md:p-10 bg-[var(--canvas-soft)]">
          <div className="w-full max-w-2xl space-y-6">
            <Card title="Server Unreachable">
              <div className="rounded-[8px] border border-[var(--semantic-error)] bg-[var(--semantic-error)]/10 p-4 font-mono text-xs leading-relaxed text-[var(--semantic-error)]">
                <span className="mr-2 font-bold">[!]</span>
                {message}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StatTile label="Host" value={session.metadata.host} />
                <StatTile label="Port" value={session.metadata.port} />
                <StatTile label="Transport" value={session.metadata.transport} />
                <StatTile label="Scoped Database" value={session.metadata.database ?? "none"} />
              </div>
            </Card>

            <Card title="Troubleshooting Guide">
              <p className="text-sm leading-relaxed text-[var(--body)]">
                The saved Studio session is valid, but the target cluster endpoint is not responding.
                Start your instance or workstation daemon, then reload. If the host changed, clear the saved
                session and reconnect.
              </p>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const section = (firstParam(params.section, "overview") as Section) || "overview";
  const dataPane = (firstParam(params.pane, "all") as DataPane) || "all";
  const errorMessage = firstParam(params.error);
  const database = firstParam(params.database);
  const collection = firstParam(params.collection);
  const userId = firstParam(params.userId);
  const roleId = firstParam(params.roleId);
  const backupId = firstParam(params.backupId);
  const restoreJobId = firstParam(params.restoreJobId);
  const aggregateInput = firstParam(params.aggregate, '[{ "$match": {} }]');
  const idsInput = firstParam(params.ids, "[]");
  const settingsPane = (firstParam(params.settingsPane, "general") as SettingsPane) || "general";
  const queryState: QueryState = {
    filter: firstParam(params.filter, "{}"),
    projection: firstParam(params.projection),
    sort: firstParam(params.sort),
    limit: Number.parseInt(firstParam(params.limit, "50"), 10) || 50,
    skip: Number.parseInt(firstParam(params.skip, "0"), 10) || 0,
  };

  const session = await getStudioSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        {/* Top Navigation Bar: 64px height, Expo Wordmark left, menu center, CTA right */}
        <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--canvas)]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <LioranDBLogo size={28} />
              <nav className="hidden md:flex items-center gap-6 text-[14px] font-medium text-[var(--body)]">
                <a href="#features" className="hover:text-[var(--ink)] transition">
                  Tools
                </a>
                <a href="#workflows" className="hover:text-[var(--ink)] transition">
                  Workflows
                </a>
                <a href="#architecture" className="hover:text-[var(--ink)] transition">
                  EAS &amp; Cluster
                </a>
                <a href="#sandbox" className="hover:text-[var(--ink)] transition">
                  Query Stage
                </a>
                <a href="#ecosystem" className="hover:text-[var(--ink)] transition">
                  Showcase
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <a
                href="#connect"
                className="btn-primary"
              >
                Get Started
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section: Pure white canvas with soft sky-blue gradient wash & Centered Device Mockup */}
        <section className="hero-sky-wash relative pt-16 sm:pt-24 pb-16 overflow-hidden">
          <div className="relative z-10 mx-auto max-w-[1200px] px-6 text-center">

            <h1 className="font-display-mega text-[var(--ink)] max-w-4xl mx-auto">
              Meet your database thinking partner.
            </h1>

            <p className="mt-6 max-w-2xl mx-auto font-body-md text-[var(--body)]">
              A quietly confident developer-platform console and control plane for LioranDB deployments. Browse collections, evaluate live queries, configure granular RBAC security, and inspect Raft cluster topologies with editorial clarity.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#connect"
                className="btn-primary h-10 px-5 text-sm"
              >
                Connect to Studio →
              </a>
              <a
                href="#sandbox"
                className="btn-secondary h-10 px-5 text-sm"
              >
                Try Query Sandbox
              </a>
            </div>
          </div>
        </section>

        {/* Quick Connect & Cluster Control Plane Section */}
        <section id="connect" className="border-t border-[var(--hairline)] bg-[var(--canvas-soft)] py-24">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <div className="badge-pill mb-3">CONNECTION PORTAL</div>
              <h2 className="font-display-lg text-[var(--ink)]">
                Connect your LioranDB cluster
              </h2>
              <p className="mt-2 text-sm text-[var(--body)]">
                Connect with AES-256-GCM session isolation. Direct binary framing without third-party proxies.
              </p>
            </div>
            <ConnectionPortal
              connectAction={connectAction}
              errorMessage={errorMessage}
            />
          </div>
        </section>

        {/* Interactive Query Sandbox Section */}
        <section id="sandbox" className="border-t border-[var(--hairline)] bg-[var(--canvas)] py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <div className="badge-pill mb-3">QUERY ENGINE</div>
              <h2 className="font-display-lg text-[var(--ink)]">
                Interactive Query Stage
              </h2>
              <p className="mt-2 font-body-md text-[var(--body)]">
                Test the LioranDB query evaluation engine directly in your browser. Inspect stage pipelines, index match execution times, and document projections.
              </p>
            </div>

            <InteractiveQueryStage />
          </div>
        </section>

        {/* Feature Grid: 3-up Cards with workflow step icons & code blocks */}
        <section id="features" className="border-t border-[var(--hairline)] bg-[var(--canvas-soft)] py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="text-center max-w-xl mx-auto mb-14">
              <div className="badge-pill mb-3">ARCHITECTURE</div>
              <h2 className="font-display-lg text-[var(--ink)]">
                Built for High-Throughput Workloads
              </h2>
              <p className="mt-2 font-body-md text-[var(--body)]">
                Explore the complete control plane: from low-level Raft consensus logs to schema-agnostic document queries.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Feature Card 1: Data Engine */}
              <div className="expo-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)]">
                      01
                    </div>
                    <span className="font-caption-uppercase text-[var(--muted)]">DATA ENGINE</span>
                  </div>
                  <h3 className="font-title-md text-[var(--ink)]">
                    Collections &amp; Aggregations
                  </h3>
                  <p className="mt-2 font-body-sm text-[var(--body)]">
                    Full document lifecycle management. Inspect nested structures, execute multistage pipelines ($match, $group, $sort), and optimize index coverage.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--hairline)] font-mono text-xs">
                  <div className="p-3 rounded-[8px] bg-[var(--surface-dark)] text-[#f4f5f8]">
                    <span className="text-[#60a5fa]">db.collection</span>
                    <span className="text-white">(</span>
                    <span className="text-[#38bdf8]">&apos;metrics&apos;</span>
                    <span className="text-white">).</span>
                    <span className="text-[#c084fc]">aggregate</span>
                    <span className="text-white">([...])</span>
                  </div>
                </div>
              </div>

              {/* Feature Card 2: RBAC Security */}
              <div className="expo-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)]">
                      02
                    </div>
                    <span className="font-caption-uppercase text-[var(--muted)]">SECURITY</span>
                  </div>
                  <h3 className="font-title-md text-[var(--ink)]">
                    Granular RBAC Governance
                  </h3>
                  <p className="mt-2 font-body-sm text-[var(--body)]">
                    Define custom roles with strict permission matrices across namespaces. Manage operator credentials, rotate passwords, and inspect active sessions.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--hairline)] font-mono text-xs">
                  <div className="p-3 rounded-[8px] bg-[var(--surface-dark)] text-[#f4f5f8]">
                    <span className="text-[#c084fc]">GRANT </span>
                    <span className="text-[#38bdf8]">readWrite </span>
                    <span className="text-[#c084fc]">ON </span>
                    <span className="text-[#60a5fa]">telemetry </span>
                    <span className="text-[#c084fc]">TO </span>
                    <span className="text-[#fbbf24]">svc_analytics</span>
                  </div>
                </div>
              </div>

              {/* Feature Card 3: Cluster Consensus */}
              <div className="expo-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)]">
                      03
                    </div>
                    <span className="font-caption-uppercase text-[var(--muted)]">CONSENSUS</span>
                  </div>
                  <h3 className="font-title-md text-[var(--ink)]">
                    Raft Consensus &amp; Partitions
                  </h3>
                  <p className="mt-2 font-body-sm text-[var(--body)]">
                    Monitor real-time node health, heartbeat latency, log replication lag, partition placements, and snapshot compaction across distributed topologies.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--hairline)] font-mono text-xs">
                  <div className="p-3 rounded-[8px] bg-[var(--surface-dark)] text-[#f4f5f8]">
                    <span className="text-[#60a5fa]">Leader Term: </span>
                    <span className="text-[#fbbf24]">42</span>
                    <span className="text-[#717684]"> • </span>
                    <span className="text-[#60a5fa]">Quorum: 3/3 Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflows / Infrastructure Section */}
        <section id="workflows" className="border-t border-[var(--hairline)] bg-[var(--canvas)] py-24">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="text-center max-w-xl mx-auto mb-14">
              <div className="badge-pill mb-3">INFRASTRUCTURE</div>
              <h2 className="font-display-lg text-[var(--ink)]">
                Engineered for Zero-Compromise Security
              </h2>
              <p className="mt-2 font-body-md text-[var(--body)]">
                LioranDB Studio is built for deterministic reliability, strict session boundaries, and operational safety.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="expo-card p-6">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)] mb-4">
                  01
                </div>
                <h3 className="font-title-sm text-[var(--ink)]">Direct Binary Framing</h3>
                <p className="mt-2 font-body-sm text-[var(--body)]">
                  Low-latency TCP and TLS 1.3 framing powered by @liorandb/driver. No unnecessary HTTP proxy layers.
                </p>
              </div>

              <div className="expo-card p-6">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)] mb-4">
                  02
                </div>
                <h3 className="font-title-sm text-[var(--ink)]">AES-256-GCM Sessions</h3>
                <p className="mt-2 font-body-sm text-[var(--body)]">
                  Connection credentials remain sealed in encrypted httpOnly cookies. Never persisted into browser storage.
                </p>
              </div>

              <div className="expo-card p-6">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)] mb-4">
                  03
                </div>
                <h3 className="font-title-sm text-[var(--ink)]">Automated Snapshots</h3>
                <p className="mt-2 font-body-sm text-[var(--body)]">
                  Trigger point-in-time backup jobs, verify checksum integrity, and initiate coordinated cluster restore pipelines.
                </p>
              </div>

              <div className="expo-card p-6">
                <div className="w-8 h-8 rounded-[8px] bg-[var(--surface-strong)] flex items-center justify-center font-mono text-xs font-semibold text-[var(--ink)] mb-4">
                  04
                </div>
                <h3 className="font-title-sm text-[var(--ink)]">Live Node Diagnostics</h3>
                <p className="mt-2 font-body-sm text-[var(--body)]">
                  Real-time diagnostic event streams, memory footprint telemetry, and connection pool saturation metrics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ecosystem Tiles Section (8-up grid) */}
        <section id="ecosystem" className="border-t border-[var(--hairline)] bg-[var(--canvas-soft)] py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <div className="badge-pill mb-2">ECOSYSTEM</div>
              <h2 className="font-display-md text-[var(--ink)]">
                Integrated into your modern stack
              </h2>
            </div>
            <EcosystemTilesGrid />
          </div>
        </section>

        {/* CTA Band: 96px padding pre-footer band */}
        <section className="border-t border-[var(--hairline)] bg-[var(--canvas)] py-24 text-center">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="font-display-lg text-[var(--ink)]">
              Build faster with LioranDB Studio.
            </h2>
            <p className="mt-4 font-body-md text-[var(--body)]">
              Deploy in seconds, manage with complete visibility, and govern your Raft clusters with confidence.
            </p>
            <div className="mt-8 flex justify-center">
              <a
                href="#connect"
                className="btn-primary h-10 px-6 text-sm"
              >
                Get Started with Studio →
              </a>
            </div>
          </div>
        </section>

        {/* 5-Column Closing Light Footer */}
        <footer className="border-t border-[var(--hairline)] bg-[var(--canvas)] py-16 px-6 sm:px-12 text-[14px] text-[var(--body)]">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-[var(--hairline)]">
              {/* Col 1: Wordmark */}
              <div className="col-span-2 md:col-span-1 space-y-3">
                <LioranDBLogo size={24} />
                <p className="text-xs text-[var(--body)] leading-relaxed">
                  The developer control plane for distributed LioranDB deployments.
                </p>
              </div>

              {/* Col 2: Product */}
              <div className="space-y-3 text-xs">
                <div className="font-caption-uppercase text-[var(--ink)]">Product</div>
                <div className="flex flex-col space-y-2">
                  <a href="#connect" className="hover:text-[var(--ink)] transition">Studio Console</a>
                  <a href="#sandbox" className="hover:text-[var(--ink)] transition">Query Stage</a>
                  <a href="#features" className="hover:text-[var(--ink)] transition">Data Engine</a>
                  <a href="#architecture" className="hover:text-[var(--ink)] transition">Raft Consensus</a>
                </div>
              </div>

              {/* Col 3: Platform */}
              <div className="space-y-3 text-xs">
                <div className="font-caption-uppercase text-[var(--ink)]">Platform</div>
                <div className="flex flex-col space-y-2">
                  <a href="#architecture" className="hover:text-[var(--ink)] transition">EAS Build</a>
                  <a href="#architecture" className="hover:text-[var(--ink)] transition">Driver SDK</a>
                  <a href="#architecture" className="hover:text-[var(--ink)] transition">RBAC Security</a>
                  <a href="#architecture" className="hover:text-[var(--ink)] transition">Snapshots</a>
                </div>
              </div>

              {/* Col 4: Resources */}
              <div className="space-y-3 text-xs">
                <div className="font-caption-uppercase text-[var(--ink)]">Resources</div>
                <div className="flex flex-col space-y-2">
                  <a href="#sandbox" className="hover:text-[var(--ink)] transition">Documentation</a>
                  <a href="#features" className="hover:text-[var(--ink)] transition">API Reference</a>
                  <a href="#ecosystem" className="hover:text-[var(--ink)] transition">Ecosystem</a>
                  <a href="#connect" className="hover:text-[var(--ink)] transition">Cluster Status</a>
                </div>
              </div>

              {/* Col 5: Legal */}
              <div className="space-y-3 text-xs">
                <div className="font-caption-uppercase text-[var(--ink)]">Legal</div>
                <div className="flex flex-col space-y-2">
                  <a href="#" className="hover:text-[var(--ink)] transition">Privacy Policy</a>
                  <a href="#" className="hover:text-[var(--ink)] transition">Terms of Service</a>
                  <a href="#" className="text-[var(--text-link-secondary)] hover:underline">Security</a>
                  <a href="#" className="hover:text-[var(--ink)] transition">Telemetry Notice</a>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--muted)]">
              <div>© {new Date().getFullYear()} LioranDB Studio. All rights reserved.</div>
              <div className="mt-2 sm:mt-0 font-mono text-[11px]">
                Powered by @liorandb/driver • Expo Design System
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  let initialContext: InitialStudioContext;
  let loadErrorMessage = "";
  try {
    initialContext = await withLioranClient(session.connectionUri, async (client) => {
      const principal = await client.me();
      let live = null;
      let ready = null;
      let serverInfo = null;
      let clusterSummary = null;

      try {
        live = await client.live();
        ready = await client.ready();
        serverInfo = await client.serverInfo();
      } catch {
        // Optional
      }

      try {
        clusterSummary = await client.cluster.summary();
      } catch {
        // Optional
      }

      let databases: string[] = [];
      try {
        databases = [...(await client.listDatabases())];
      } catch {
        databases = session.metadata.database ? [session.metadata.database] : ["default"];
      }

      const collectionsMap: Record<string, string[]> = {};
      for (const db of databases) {
        try {
          const cols = await client.db(db).listCollections();
          collectionsMap[db] = [...cols];
        } catch {
          collectionsMap[db] = [];
        }
      }

      return {
        principal,
        host: session.metadata.host,
        port: session.metadata.port,
        protocol: session.metadata.protocol,
        transport: session.metadata.transport,
        tls: session.metadata.tls,
        scopedDatabase: session.metadata.database ?? undefined,
        databases,
        collectionsMap,
        serverInfo,
        live,
        ready,
        clusterSummary,
      };
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    if (mapped.shouldClearSession) {
      await destroyStudioSession(session.id);
      redirect(`/?error=${encodeURIComponent(`${mapped.title}: ${mapped.message}`)}`);
    }
    loadErrorMessage = `${mapped.title}: ${mapped.message}`;
    return renderDisconnectedState(session, loadErrorMessage);
  }

  return <StudioShell initialContext={initialContext} />;
}
