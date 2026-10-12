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
  ExpoDeviceMockupHero,
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
  readonly tone?: "slate" | "cyan" | "emerald" | "amber" | "coral";
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
        <span className="font-mono text-[10px] text-[#22c55e] font-medium">[LOG STREAM]</span>
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
                    : "text-[#16a34a]"
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
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--semantic-error)] font-mono text-xs font-bold text-white">
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
            {/* Headline in display-mega */}
            <div className="inline-flex items-center gap-2 mb-6 badge-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              <span>Studio 2.0 • Developer Control Plane</span>
            </div>

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

            {/* Signature Feature: Device Mockup Card (MacBook + iPhone composite over gradient sky wash) */}
            <div className="mt-14 sm:mt-20">
              <ExpoDeviceMockupHero />
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
                    <span className="text-[#4ade80]">&apos;metrics&apos;</span>
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
                    <span className="text-[#4ade80]">readWrite </span>
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
                    <span className="text-[#22c55e]">Quorum: 3/3 Healthy</span>
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

  let studioData: StudioData;
  let loadErrorMessage = "";
  try {
    studioData = await loadStudioData(session.connectionUri, {
      section,
      database,
      collection,
      userId,
      roleId,
      backupId,
      restoreJobId,
      queryState,
      aggregateInput,
      idsInput,
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

  const currentHref = hrefFor(section, {
    database,
    collection,
    pane: dataPane,
    userId,
    roleId,
    backupId,
    restoreJobId,
    limit: String(queryState.limit),
    skip: String(queryState.skip),
    filter: queryState.filter,
    projection: queryState.projection,
    sort: queryState.sort,
    aggregate: aggregateInput,
    ids: idsInput,
    settingsPane,
  });
  const dataWorkspaceId = "data-workspace";
  const dataWorkspaceHref = `${currentHref}#${dataWorkspaceId}`;

  const navItems: {
    readonly section: Section;
    readonly label: string;
    readonly icon: (props: { readonly size?: number; readonly className?: string }) => ReactNode;
  }[] = [
    { section: "overview", label: "Overview", icon: PanelLeftIcon },
    { section: "databases", label: "Data", icon: DatabaseIcon },
    { section: "account", label: "Account", icon: KeyRoundIcon },
    { section: "users", label: "Users", icon: UsersIcon },
    { section: "roles", label: "Roles", icon: ShieldIcon },
    { section: "cluster", label: "Cluster", icon: NetworkIcon },
    { section: "backups", label: "Backups", icon: ArchiveIcon },
    { section: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const collectionTabs = [
    { key: "all", label: "All", icon: PanelLeftIcon },
    { key: "browse", label: "Browse", icon: DatabaseIcon },
    { key: "query", label: "Query", icon: SearchIcon },
    { key: "write", label: "Write", icon: PencilIcon },
    { key: "indexes", label: "Indexes", icon: BoxesIcon },
    { key: "aggregate", label: "Aggregate", icon: HardDriveDownloadIcon },
    { key: "danger", label: "Danger", icon: Trash2Icon },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--surface-card)] text-[var(--ink)]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="sidebar-scroll flex flex-col border-r border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="mb-6">
            <LioranDBLogo size={24} />
            <h1 className="mt-3 font-sans text-2xl font-bold tracking-tight text-[#000000]">
              Workspace
            </h1>
            <p className="mt-1 text-xs leading-5 text-[#666666]">
              User: <span className="font-bold text-[#111111]">{studioData.principal.username}</span> • {session.metadata.host}:{session.metadata.port}
            </p>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = section === item.section;
              return (
                <Link
                  key={item.section}
                  href={hrefFor(item.section, { database, collection, pane: dataPane })}
                  className={`flex items-center gap-3 rounded-[8px] px-3.5 py-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                      : "text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <span className={active ? "text-white" : "text-[#111111]"}>
                    {item.icon({ size: 16 })}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <details className="mt-6 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-xs text-[var(--ink)]">
            <summary className="cursor-pointer list-none px-3.5 py-2.5 select-none font-semibold">
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-[var(--muted)]">
                <span>Active Context</span>
                <span className="text-[11px] text-[var(--muted)]">Details</span>
              </div>
            </summary>
            <div className="space-y-1.5 border-t border-[var(--hairline)] px-3.5 py-2.5 text-xs font-mono text-[var(--body)]">
              <div>Protocol: {session.metadata.protocol}</div>
              <div>Transport: {session.metadata.transport}</div>
              <div>TLS: {session.metadata.tls ? "enabled" : "disabled"}</div>
              <div>Database: {session.metadata.database ?? "not specified"}</div>
            </div>
          </details>

          <div className="sticky bottom-0 mt-auto pt-6 space-y-2">
            <ThemeToggle showLabel={true} className="w-full py-2" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn-secondary w-full py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Floor */}
        <main className="space-y-6 overflow-hidden bg-[var(--canvas-soft)] p-6 md:p-8">
          <StudioClientEffects />

          {/* Section Breadcrumb & Header Bar */}
          <div className="rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div>
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                LIORANDB STUDIO / {section}
              </div>
              <h2 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-[var(--ink)]">
                {section === "databases"
                  ? `${database || "Data"}${collection ? ` / ${collection}` : ""}`
                  : navItems.find((item) => item.section === section)?.label}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-[var(--surface-strong)] text-xs font-mono text-[var(--body)]">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                <span>{session.metadata.host}:{session.metadata.port}</span>
              </div>
              <ThemeToggle showLabel={false} />
            </div>
          </div>

          {section === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="System Status">
                <SectionAlert error={studioData.errors.overview} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatTile label="Live State" value={studioData.live?.state ?? "Unavailable"} />
                  <StatTile label="Ready State" value={studioData.ready?.state ?? "Unavailable"} />
                  <StatTile label="Principal" value={studioData.principal.username} />
                  <StatTile label="Cluster Node" value={studioData.live?.node_id ?? "Unknown"} />
                </div>
              </Card>

              <Card title="Connection Details">
                <DetailList
                  items={[
                    { label: "Host", value: session.metadata.host },
                    { label: "Port", value: session.metadata.port },
                    { label: "Protocol", value: session.metadata.protocol },
                    { label: "Transport", value: session.metadata.transport },
                    { label: "TLS", value: session.metadata.tls ? "Enabled" : "Disabled" },
                    { label: "Scoped Database", value: session.metadata.database ?? "Not specified" },
                    { label: "Server Service", value: studioData.serverInfo?.service ?? "Unavailable" },
                    { label: "Architecture", value: studioData.serverInfo?.architecture ?? "Unavailable" },
                  ]}
                />
              </Card>

              <Card title="Readiness Transitions" className="xl:col-span-2">
                <TerminalBlock
                  title="Readiness Timeline"
                  lines={
                    studioData.ready?.transitions.length
                      ? studioData.ready.transitions.map((transition) => prettyJson(transition))
                      : ["No readiness transitions returned by the server."]
                  }
                />
              </Card>

              <Card title="Driver Diagnostics" className="xl:col-span-2">
                <TerminalBlock
                  title="Captured Diagnostic Events"
                  lines={
                    studioData.diagnostics.length
                      ? studioData.diagnostics.map((item) => prettyJson(item))
                      : ["No driver diagnostics captured for this session."]
                  }
                />
              </Card>
            </div>
          ) : null}

          {section === "databases" ? (
            <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
              <Card title="Databases">
                <SectionAlert error={studioData.errors.databases} />
                <MutationForm action="createDatabase" returnTo={currentHref}>
                  <label className={labelClassName()} htmlFor="databaseName">
                    Create Database
                  </label>
                  <input
                    id="databaseName"
                    name="databaseName"
                    className={fieldClassName()}
                    placeholder="testdb"
                    pattern="[A-Za-z0-9_.-]+"
                    title="Use only letters, numbers, underscore, dash, or dot."
                    required
                  />
                  <button className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create Database
                  </button>
                </MutationForm>

                <div className="mt-6 space-y-2">
                  <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#666666]">
                    Available Databases
                  </div>
                  {studioData.databases.map((name) => (
                    <Link
                      key={name}
                      href={`${hrefFor("databases", { database: name, pane: dataPane })}#${dataWorkspaceId}`}
                      scroll={false}
                      className={`block rounded-[8px] border border-[var(--hairline-strong)] px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                        database === name
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                          : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                      }`}
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card title={database ? `Collections in ${database}` : "Collections"}>
                  {database ? (
                    <>
                      <MutationForm action="createCollection" returnTo={currentHref}>
                        <input type="hidden" name="databaseName" value={database} />
                        <label className={labelClassName()} htmlFor="collectionName">
                          Create Collection
                        </label>
                        <input
                          id="collectionName"
                          name="collectionName"
                          className={fieldClassName()}
                          placeholder="users"
                          pattern="[A-Za-z0-9_.-]+"
                          title="Use only letters, numbers, underscore, dash, or dot."
                          required
                        />
                        <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Create Collection
                        </button>
                      </MutationForm>

                      <div className="mt-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {studioData.collections.map((name) => (
                          <Link
                            key={name}
                            href={`${hrefFor("databases", {
                              database,
                              collection: name,
                              pane: dataPane,
                              filter: queryState.filter,
                              projection: queryState.projection,
                              sort: queryState.sort,
                              limit: String(queryState.limit),
                              skip: String(queryState.skip),
                              aggregate: aggregateInput,
                              ids: idsInput,
                            })}#${dataWorkspaceId}`}
                            scroll={false}
                            className={`break-all rounded-[8px] border border-[var(--hairline-strong)] px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                              collection === name
                                ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                                : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                            }`}
                          >
                            {name}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[#666666]">Select a database to browse collections.</p>
                  )}
                </Card>

                {database && collection ? (
                  <>
                    <div id={dataWorkspaceId} className="flex flex-wrap gap-1.5 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-1.5 shadow-sm">
                      {collectionTabs.map((item) => (
                        <Link
                          key={item.key}
                          href={`${hrefFor("databases", {
                            database,
                            collection,
                            pane: item.key,
                            filter: queryState.filter,
                            projection: queryState.projection,
                            sort: queryState.sort,
                            limit: String(queryState.limit),
                            skip: String(queryState.skip),
                            aggregate: aggregateInput,
                            ids: idsInput,
                          })}#${dataWorkspaceId}`}
                          scroll={false}
                          className={`inline-flex items-center gap-2 rounded-[6px] px-3.5 py-2 text-xs font-medium transition ${
                            dataPane === item.key
                              ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm font-semibold"
                              : "text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                          }`}
                        >
                          <span>{item.icon({ size: 14 })}</span>
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    <Card title={`${database}.${collection}`}>
                      <SectionAlert error={studioData.errors.documents} />
                      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <StatTile label="Database" value={database} />
                        <StatTile label="Collection" value={collection} />
                        <StatTile label="Matched Count" value={studioData.documentCount} />
                        <StatTile label="Loaded Rows" value={studioData.documents.length} />
                        <StatTile label="Indexes" value={studioData.indexes.length} />
                      </div>

                      {(dataPane === "all" || dataPane === "browse") ? (
                        <div className="space-y-4">
                          <TerminalBlock
                            title="Collection Summary"
                            lines={[
                              `$ use ${database}.${collection}`,
                              `countDocuments(${queryState.filter || "{}"}) => ${studioData.documentCount}`,
                              `listIndexes() => ${studioData.indexes.length}`,
                              `loaded documents => ${studioData.documents.length}`,
                            ]}
                          />
                          {studioData.documents.length ? (
                            studioData.documents.map((document, index) => (
                              <DocumentCard
                                key={`${index}-${JSON.stringify(document._id ?? index)}`}
                                value={document}
                                index={index}
                              />
                            ))
                          ) : (
                            <div className="rounded-[8px] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-12 text-center text-sm font-mono text-[#666666]">
                              No documents matched the current query.
                            </div>
                          )}
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "query") ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <form className="space-y-4 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm" action={dataWorkspaceHref}>
                            <input type="hidden" name="section" value="databases" />
                            <input type="hidden" name="database" value={database} />
                            <input type="hidden" name="collection" value={collection} />
                            <input type="hidden" name="pane" value="query" />
                            <QueryEditor id="filter" name="filter" label="Filter JSON" defaultValue={queryState.filter} />
                            <div className="grid gap-4 md:grid-cols-2">
                              <QueryEditor id="projection" name="projection" label="Projection" defaultValue={queryState.projection} minHeight="min-h-28" />
                              <QueryEditor id="sort" name="sort" label="Sort" defaultValue={queryState.sort} minHeight="min-h-28" />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className={labelClassName()} htmlFor="limit">
                                  Limit
                                </label>
                                <input id="limit" name="limit" type="number" min="1" max="100" defaultValue={queryState.limit} className={fieldClassName()} />
                              </div>
                              <div>
                                <label className={labelClassName()} htmlFor="skip">
                                  Skip
                                </label>
                                <input id="skip" name="skip" type="number" min="0" defaultValue={queryState.skip} className={fieldClassName()} />
                              </div>
                            </div>
                            <button className="btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                              Execute Query
                            </button>
                          </form>

                          <div className="space-y-4">
                            <form className="space-y-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm" action={dataWorkspaceHref}>
                              <input type="hidden" name="section" value="databases" />
                              <input type="hidden" name="database" value={database} />
                              <input type="hidden" name="collection" value={collection} />
                              <input type="hidden" name="pane" value="query" />
                              <input type="hidden" name="filter" value={queryState.filter} />
                              <input type="hidden" name="projection" value={queryState.projection} />
                              <input type="hidden" name="sort" value={queryState.sort} />
                              <input type="hidden" name="limit" value={String(queryState.limit)} />
                              <input type="hidden" name="skip" value={String(queryState.skip)} />
                              <label className={labelClassName()} htmlFor="ids">
                                findManyByIds() Input JSON
                              </label>
                              <textarea id="ids" name="ids" defaultValue={studioData.idsInput} className={`${editorClassName()} min-h-32`} />
                              <button className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Resolve IDs
                              </button>
                            </form>

                            <TerminalBlock
                              title="Query Execution Summary"
                              lines={[
                                `$ find ${queryState.filter || "{}"}`,
                                `countDocuments => ${studioData.documentCount}`,
                                `findManyByIds hits => ${studioData.findByIdsResults.filter(Boolean).length}`,
                              ]}
                            />
                            {studioData.findByIdsResults.length ? <JsonBlock value={studioData.findByIdsResults} /> : null}
                          </div>
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "write") ? (
                        <div className="grid gap-6 xl:grid-cols-3">
                          <Card title="Insert">
                            <MutationForm action="insertOne" returnTo={dataWorkspaceHref}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="document">
                                Insert One JSON Object
                              </label>
                              <textarea id="document" name="document" defaultValue={'{\n  "_id": "example",\n  "status": "active"\n}'} className={`${editorClassName()} min-h-40`} />
                              <label className={labelClassName()} htmlFor="idempotencyKey">
                                Idempotency Key
                              </label>
                              <input id="idempotencyKey" name="idempotencyKey" className={fieldClassName()} />
                              <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Insert One
                              </button>
                            </MutationForm>

                            <MutationForm action="insertMany" returnTo={dataWorkspaceHref} className="mt-6 space-y-3">
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="documents">
                                Insert Many JSON Array
                              </label>
                              <textarea id="documents" name="documents" defaultValue={'[\n  { "_id": "a" },\n  { "_id": "b" }\n]'} className={`${editorClassName()} min-h-40`} />
                              <button className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Insert Many
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Update">
                            <MutationForm action="updateOne" returnTo={dataWorkspaceHref}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="updateFilter">
                                Filter
                              </label>
                              <textarea id="updateFilter" name="filter" defaultValue={'{ "_id": "example" }'} className={`${editorClassName()} min-h-28`} />
                              <label className={labelClassName()} htmlFor="updateDocument">
                                Update JSON
                              </label>
                              <textarea id="updateDocument" name="update" defaultValue={'{ "$set": { "status": "updated" } }'} className={`${editorClassName()} min-h-28`} />
                              <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                                <input type="checkbox" name="upsert" className="h-4 w-4 rounded accent-black" />
                                Upsert
                              </label>
                              <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Update One
                              </button>
                            </MutationForm>

                            <MutationForm action="updateMany" returnTo={dataWorkspaceHref} className="mt-6 space-y-3">
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="updateManyFilter">
                                Filter
                              </label>
                              <textarea id="updateManyFilter" name="filter" defaultValue={'{ "status": "active" }'} className={`${editorClassName()} min-h-28`} />
                              <label className={labelClassName()} htmlFor="updateManyDocument">
                                Update JSON
                              </label>
                              <textarea id="updateManyDocument" name="update" defaultValue={'{ "$set": { "status": "archived" } }'} className={`${editorClassName()} min-h-28`} />
                              <button className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Update Many
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Delete">
                            <MutationForm action="deleteOne" returnTo={dataWorkspaceHref}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="deleteFilter">
                                Delete Filter
                              </label>
                              <textarea id="deleteFilter" name="filter" defaultValue={'{ "_id": "example" }'} className={`${editorClassName()} min-h-28`} />
                              <button className="btn-secondary text-xs">
                                Delete One
                              </button>
                            </MutationForm>

                            <MutationForm action="deleteMany" returnTo={dataWorkspaceHref} className="mt-6 space-y-3">
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="deleteManyFilter">
                                Delete-Many Filter
                              </label>
                              <textarea id="deleteManyFilter" name="filter" defaultValue={'{ "status": "archived" }'} className={`${editorClassName()} min-h-28`} />
                              <label className={labelClassName()} htmlFor="deleteConfirm">
                                Type DELETE to Confirm
                              </label>
                              <input id="deleteConfirm" name="confirmation" className={fieldClassName()} />
                              <button className="btn-secondary text-xs">
                                Delete Many
                              </button>
                            </MutationForm>
                          </Card>
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "indexes") ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <Card title="Secondary Index">
                            <MutationForm action="createIndex" returnTo={dataWorkspaceHref}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="indexName">
                                Optional Index Name
                              </label>
                              <input id="indexName" name="name" className={fieldClassName()} />
                              <label className={labelClassName()} htmlFor="fields">
                                Fields JSON
                              </label>
                              <textarea id="fields" name="fields" defaultValue={'[\n  { "field": "age", "direction": "desc" },\n  { "field": "email", "direction": "asc" }\n]'} className={`${editorClassName()} min-h-36`} />
                              <label className={labelClassName()} htmlFor="partialFilter">
                                Partial Filter JSON
                              </label>
                              <textarea id="partialFilter" name="partialFilter" defaultValue="" className={`${editorClassName()} min-h-24`} />
                              <div className="flex flex-wrap gap-4 text-sm text-[#111111]">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" name="unique" className="h-4 w-4 rounded accent-black" />
                                  Unique
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" name="sparse" className="h-4 w-4 rounded accent-black" />
                                  Sparse
                                </label>
                              </div>
                              <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Create Index
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Text Index">
                            <MutationForm action="createTextIndex" returnTo={dataWorkspaceHref}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="textField">
                                Text Field
                              </label>
                              <input id="textField" name="field" defaultValue="bio" className={fieldClassName()} />
                              <label className={labelClassName()} htmlFor="stopwords">
                                Stopwords (CSV)
                              </label>
                              <input id="stopwords" name="stopwords" defaultValue="the,and,or" className={fieldClassName()} />
                              <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                                <input type="checkbox" name="normalize" defaultChecked className="h-4 w-4 rounded accent-black" />
                                Normalize Text
                              </label>
                              <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Create Text Index
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Existing Indexes" className="xl:col-span-2">
                            <div className="space-y-3">
                              {studioData.indexes.map((index) => (
                                <div key={index.name} className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <div className="font-sans text-lg font-bold text-[#000000]">{index.name}</div>
                                      <div className="mt-1 font-mono text-xs text-[#666666]">
                                        {index.isText ? "text index" : "secondary index"} · state: {index.buildState} · fields: {index.fields.map((field) => `${field.field}:${field.direction}`).join(", ")}
                                      </div>
                                    </div>
                                    {!index.implicit ? (
                                      <MutationForm action="dropIndex" returnTo={dataWorkspaceHref} className="inline-flex">
                                        <input type="hidden" name="databaseName" value={database} />
                                        <input type="hidden" name="collectionName" value={collection} />
                                        <input type="hidden" name="indexName" value={index.name} />
                                        <button className="btn-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                                          Drop Index
                                        </button>
                                      </MutationForm>
                                    ) : null}
                                  </div>
                                  <div className="mt-3">
                                    <JsonBlock value={index} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "aggregate") ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <form className="space-y-4 rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm" action={dataWorkspaceHref}>
                            <input type="hidden" name="section" value="databases" />
                            <input type="hidden" name="database" value={database} />
                            <input type="hidden" name="collection" value={collection} />
                            <input type="hidden" name="pane" value="aggregate" />
                            <input type="hidden" name="filter" value={queryState.filter} />
                            <input type="hidden" name="projection" value={queryState.projection} />
                            <input type="hidden" name="sort" value={queryState.sort} />
                            <input type="hidden" name="limit" value={String(queryState.limit)} />
                            <input type="hidden" name="skip" value={String(queryState.skip)} />
                            <input type="hidden" name="ids" value={idsInput} />
                            <label className={labelClassName()} htmlFor="aggregate">
                              Pipeline JSON Array
                            </label>
                            <textarea id="aggregate" name="aggregate" defaultValue={aggregateInput} className={`${editorClassName()} min-h-56`} />
                            <button className="btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                              Execute Aggregation
                            </button>
                          </form>

                          <div className="space-y-4">
                            <TerminalBlock
                              title="Aggregation Output"
                              lines={[
                                `$ aggregate ${database}.${collection}`,
                                `pipeline stages: ${aggregateInput.trim() ? "configured" : "empty"}`,
                                `rows returned: ${studioData.aggregateResults.length}`,
                              ]}
                            />
                            <JsonBlock value={studioData.aggregateResults} />
                          </div>
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "danger") ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <Card title="Drop Collection">
                            <MutationForm action="dropCollection" returnTo={hrefFor("databases", { database, pane: "browse" })}>
                              <input type="hidden" name="databaseName" value={database} />
                              <input type="hidden" name="collectionName" value={collection} />
                              <label className={labelClassName()} htmlFor="dropCollectionConfirm">
                                Type {collection} to Confirm
                              </label>
                              <input id="dropCollectionConfirm" name="confirmation" className={fieldClassName()} />
                              <button className="btn-secondary text-xs">
                                Drop Collection
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Drop Database">
                            <MutationForm action="dropDatabase" returnTo={hrefFor("databases")}>
                              <input type="hidden" name="databaseName" value={database} />
                              <label className={labelClassName()} htmlFor="dropDatabaseConfirm">
                                Type {database} to Confirm
                              </label>
                              <input id="dropDatabaseConfirm" name="confirmation" className={fieldClassName()} />
                              <button className="btn-secondary text-xs">
                                Drop Database
                              </button>
                            </MutationForm>
                          </Card>
                        </div>
                      ) : null}
                    </Card>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {section === "account" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Authenticated Principal">
                <SectionAlert error={studioData.errors.account} />
                <JsonBlock value={studioData.principal} />
              </Card>

              <Card title="Current Studio Session">
                <JsonBlock
                  value={{
                    sessionId: session.id,
                    connection: session.metadata,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    expiresAt: session.expiresAt,
                  }}
                />
              </Card>

              <Card title="Active LioranDB Sessions" className="xl:col-span-2">
                <div className="space-y-3">
                  {studioData.sessions.map((item) => (
                    <div key={item.session_id} className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#000000]">{item.session_id}</div>
                          <div className="font-mono text-xs text-[#666666]">
                            status: {item.status} · expires {formatTimestamp(item.expires_at_ms)} UTC
                          </div>
                        </div>
                        <MutationForm action="revokeSession" returnTo={currentHref} className="flex items-center gap-3">
                          <input type="hidden" name="sessionId" value={item.session_id} />
                          <button className="btn-secondary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
                            Revoke Session
                          </button>
                        </MutationForm>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Change Password">
                <MutationForm action="changePassword" returnTo={currentHref}>
                  <label className={labelClassName()} htmlFor="newPassword">
                    New Password
                  </label>
                  <input id="newPassword" name="newPassword" type="password" className={fieldClassName()} required />
                  <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                    <input type="checkbox" name="clearMustChange" className="h-4 w-4 rounded accent-black" />
                    Clear must-change-password flag
                  </label>
                  <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                    Change Password
                  </button>
                </MutationForm>
              </Card>

              <Card title="Global Session Logout">
                <MutationForm action="logoutAll" returnTo={currentHref}>
                  <p className="text-sm leading-6 text-[#666666]">
                    This revokes every active LioranDB session for the current principal across all connected nodes.
                  </p>
                  <button className="btn-secondary text-xs">
                    Log Out All Sessions
                  </button>
                </MutationForm>
              </Card>
            </div>
          ) : null}

          {section === "users" ? (
            <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
              <Card title="Create User">
                <SectionAlert error={studioData.errors.users} />
                <MutationForm action="createUser" returnTo={currentHref}>
                  <label className={labelClassName()} htmlFor="username">Username</label>
                  <input id="username" name="username" className={fieldClassName()} required />
                  <label className={labelClassName()} htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" className={fieldClassName()} required />
                  <label className={labelClassName()} htmlFor="roles">Roles (CSV)</label>
                  <input id="roles" name="roles" className={fieldClassName()} placeholder="admin, developer" />
                  <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                    <input type="checkbox" name="mustChangePassword" className="h-4 w-4 rounded accent-black" />
                    Require password change on next login
                  </label>
                  <button className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create User
                  </button>
                </MutationForm>
              </Card>

              <div className="space-y-6">
                <Card title="User Accounts">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {studioData.users.map((user) => (
                      <Link
                        key={user.id}
                        href={hrefFor("users", { userId: user.id })}
                        className={`rounded-[8px] border border-[var(--hairline-strong)] p-4 transition ${
                          userId === user.id
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                            : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                        }`}
                      >
                        <div className="font-sans text-lg font-bold">{user.username}</div>
                        <div className={`mt-1 font-mono text-xs ${userId === user.id ? "text-white/80" : "text-[#666666]"}`}>
                          status: {user.enabled ? "Enabled" : "Disabled"} · reset required: {user.must_change_password ? "yes" : "no"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>

                {studioData.selectedUser ? (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card title={`Edit User: ${studioData.selectedUser.username}`}>
                      <MutationForm action="updateUser" returnTo={currentHref}>
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                          <input type="checkbox" name="enabled" defaultChecked={studioData.selectedUser.enabled} className="h-4 w-4 rounded accent-black" />
                          User Enabled
                        </label>
                        <label className={labelClassName()} htmlFor="editUserRoles">Roles (CSV)</label>
                        <input id="editUserRoles" name="roles" defaultValue="" className={fieldClassName()} />
                        <label className={labelClassName()} htmlFor="metadata">Metadata JSON</label>
                        <textarea id="metadata" name="metadata" defaultValue={prettyJson(studioData.selectedUser.metadata)} className={`${editorClassName()} min-h-40`} />
                        <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Update User
                        </button>
                      </MutationForm>
                    </Card>

                    <Card title="Sensitive Operations">
                      <MutationForm action="resetUserPassword" returnTo={currentHref}>
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <label className={labelClassName()} htmlFor="resetPassword">New Password</label>
                        <input id="resetPassword" name="password" type="password" className={fieldClassName()} />
                        <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                          <input type="checkbox" name="clearMustChange" className="h-4 w-4 rounded accent-black" />
                          Clear must-change-password flag
                        </label>
                        <button className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Reset Password
                        </button>
                      </MutationForm>

                      <MutationForm action="revokeUserSessions" returnTo={currentHref} className="mt-6 space-y-3">
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <button className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Revoke All Sessions
                        </button>
                      </MutationForm>

                      <MutationForm action="deleteUser" returnTo={hrefFor("users")} className="mt-6 space-y-3">
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <button className="btn-secondary text-xs">
                          Delete User
                        </button>
                      </MutationForm>
                    </Card>

                    <Card title="User Record" className="xl:col-span-2">
                      <JsonBlock value={studioData.selectedUser} />
                    </Card>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {section === "roles" ? (
            <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
              <Card title="Create Role">
                <SectionAlert error={studioData.errors.roles} />
                <MutationForm action="createRole" returnTo={currentHref}>
                  <label className={labelClassName()} htmlFor="roleName">Role Name</label>
                  <input id="roleName" name="name" className={fieldClassName()} required />
                  <label className={labelClassName()} htmlFor="grants">Grants JSON Array</label>
                  <textarea id="grants" name="grants" defaultValue={'[\n  {\n    "permission": "DatabaseList",\n    "scope": { "kind": "cluster" }\n  }\n]'} className={`${editorClassName()} min-h-56`} />
                  <button className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create Role
                  </button>
                </MutationForm>
              </Card>

              <div className="space-y-6">
                <Card title="Advertised Permissions">
                  <div className="flex flex-wrap gap-2">
                    {studioData.permissions.map((permission) => (
                      <span key={permission} className="font-mono text-xs font-semibold text-[#2563EB]">
                        {permission}
                      </span>
                    ))}
                  </div>
                </Card>

                <Card title="Roles">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {studioData.roles.map((role) => (
                      <Link
                        key={role.id}
                        href={hrefFor("roles", { roleId: role.id })}
                        className={`rounded-[8px] border border-[var(--hairline-strong)] p-4 transition ${
                          roleId === role.id
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                            : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                        }`}
                      >
                        <div className="font-sans text-lg font-bold">{role.name}</div>
                        <div className={`mt-1 font-mono text-xs ${roleId === role.id ? "text-white/80" : "text-[#666666]"}`}>
                          {role.grants.length} grants · {role.built_in ? "system role" : "custom role"}
                        </div>
                      </Link>
                    ))}
                  </div>
                </Card>

                {studioData.selectedRole ? (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card title={`Edit Role: ${studioData.selectedRole.name}`}>
                      <MutationForm action="updateRole" returnTo={currentHref}>
                        <input type="hidden" name="roleId" value={studioData.selectedRole.id} />
                        <label className={labelClassName()} htmlFor="editGrants">Grants JSON</label>
                        <textarea id="editGrants" name="grants" defaultValue={prettyJson(studioData.selectedRole.grants)} className={`${editorClassName()} min-h-72`} />
                        <button className="btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Update Role Grants
                        </button>
                      </MutationForm>
                    </Card>

                    <Card title="Delete Role">
                      <MutationForm action="deleteRole" returnTo={hrefFor("roles")}>
                        <input type="hidden" name="roleId" value={studioData.selectedRole.id} />
                        <button className="btn-secondary text-xs">
                          Delete Role
                        </button>
                      </MutationForm>
                    </Card>

                    <Card title="Role Record" className="xl:col-span-2">
                      <JsonBlock value={studioData.selectedRole} />
                    </Card>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {section === "cluster" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Cluster Summary">
                <SectionAlert error={studioData.errors.cluster} />
                <JsonBlock value={studioData.clusterSummary} />
              </Card>

              <Card title="Administrative Actions">
                <div className="space-y-4">
                  <p className="text-xs leading-5 text-[#666666]">
                    Trigger administrative checkpoints and compactions across the storage engine to reclaim disk space.
                  </p>
                  <MutationForm action="clusterCheckpoint" returnTo={currentHref}>
                    <button className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                      Trigger Checkpoint
                    </button>
                  </MutationForm>
                  <MutationForm action="clusterCompact" returnTo={currentHref}>
                    <button className="btn-secondary w-full">
                      Trigger Compaction
                    </button>
                  </MutationForm>
                </div>
              </Card>

              <Card title="Nodes">
                <JsonBlock value={studioData.clusterNodes} />
              </Card>

              <Card title="Partitions">
                <JsonBlock value={studioData.clusterPartitions} />
              </Card>

              <Card title="Health" className="xl:col-span-2">
                <JsonBlock value={studioData.clusterHealth} />
              </Card>

              <Card title="Readiness" className="xl:col-span-2">
                <JsonBlock value={studioData.clusterReadiness} />
              </Card>
            </div>
          ) : null}

          {section === "backups" ? (
            <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
              <Card title="Create Backup">
                <SectionAlert error={studioData.errors.backups} />
                <MutationForm action="createBackup" returnTo={currentHref}>
                  <label className={labelClassName()} htmlFor="label">Backup Label</label>
                  <input id="label" name="label" className={fieldClassName()} placeholder="manual-snapshot" />
                  <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3 text-xs font-mono text-[#666666]">
                    Scope: <span className="font-bold text-[#111111]">local_node</span>
                  </div>
                  <button className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create Backup
                  </button>
                </MutationForm>
              </Card>

              <div className="space-y-6">
                <Card title="Backup History">
                  <div className="space-y-3">
                    {studioData.backups.map((backup) => (
                      <div key={backup.backup_id} className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link href={hrefFor("backups", { backupId: backup.backup_id })} className="font-mono text-sm font-bold text-[#000000] hover:underline">
                            {backup.backup_id}
                          </Link>
                          <span className="font-mono text-xs font-bold uppercase text-[#059669]">
                            {backup.status}
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-xs text-[#666666]">
                          scope: {backup.scope} · label: {backup.label ?? "no label"}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <MutationForm action="verifyBackup" returnTo={currentHref} className="inline-flex">
                            <input type="hidden" name="backupId" value={backup.backup_id} />
                            <button className="btn-secondary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
                              Verify
                            </button>
                          </MutationForm>
                          <MutationForm action="deleteBackup" returnTo={currentHref} className="inline-flex">
                            <input type="hidden" name="backupId" value={backup.backup_id} />
                            <button className="btn-secondary text-xs">
                              Delete
                            </button>
                          </MutationForm>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {studioData.selectedBackup ? (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card title="Backup Details">
                      <JsonBlock value={studioData.selectedBackup} />
                    </Card>

                    <Card title="Restore Backup">
                      <MutationForm action="restoreBackup" returnTo={currentHref}>
                        <input type="hidden" name="backupId" value={studioData.selectedBackup.backup_id} />
                        <label className={labelClassName()} htmlFor="restoreConfirm">Restore Confirmation</label>
                        <input id="restoreConfirm" name="confirmation" defaultValue={studioData.selectedBackup.backup_id} className={fieldClassName()} />
                        <label className="flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                          <input type="checkbox" name="disableSafetyBackup" className="h-4 w-4 rounded accent-black" />
                          Disable safety backup
                        </label>
                        <button className="btn-secondary text-xs">
                          Restore Backup
                        </button>
                      </MutationForm>
                    </Card>
                  </div>
                ) : null}

                {studioData.restoreJob ? (
                  <Card title="Restore Job">
                    <JsonBlock value={studioData.restoreJob} />
                  </Card>
                ) : null}
              </div>
            </div>
          ) : null}

          {section === "settings" ? (
            <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
              <Card title="Settings">
                <SectionAlert error={studioData.errors.settings} />
                <div className="space-y-1.5">
                  {[
                    { key: "general", label: "General" },
                    { key: "cors", label: "CORS" },
                    { key: "performance", label: "Performance" },
                    { key: "limits", label: "Limits" },
                    { key: "backups", label: "Backups" },
                  ].map((item) => (
                    <Link
                      key={item.key}
                      href={hrefFor("settings", { settingsPane: item.key })}
                      scroll={false}
                      className={`block rounded-[8px] px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                        settingsPane === item.key
                          ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm font-semibold"
                          : "text-[var(--body)] hover:text-[var(--ink)] hover:bg-[var(--surface-strong)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </Card>

              {settingsPane === "general" ? (
                <div className="space-y-6">
                  <Card title="General Settings">
                    <div className="space-y-5">
                      <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                          Runtime &amp; Metadata
                        </div>
                        <h3 className="mt-1 font-sans text-xl font-bold text-[#000000]">
                          Server operational footprint
                        </h3>
                        <p className="mt-1.5 text-xs leading-5 text-[#666666]">
                          Backup schedules and retention are managed from the dedicated Backups pane. This section exposes runtime metadata and editable custom setting keys.
                        </p>
                      </div>

                      {(() => {
                        const generalMap = studioData.settingsGeneral ?? {};
                        const backupJobs = parseSettingEntry(generalMap["backup.jobs.v1"]) as { jobs?: readonly Record<string, unknown>[] } | null;
                        const performanceUsage = parseSettingEntry(generalMap["performance.usage"]) as {
                          documents_total?: number;
                          storage_bytes?: number;
                          documents_per_collection?: Record<string, number>;
                          storage_bytes_per_collection?: Record<string, number>;
                        } | null;
                        const customEntries = Object.entries(generalMap).filter(([key]) => ![
                          "backup.jobs.v1",
                          "backup.settings.v1",
                          "performance.usage",
                        ].includes(key));

                        return (
                          <>
                            <div className="grid gap-6 xl:grid-cols-2">
                              <section className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                                <div className="mb-4">
                                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                                    Backup Jobs
                                  </div>
                                  <h3 className="mt-1 font-sans text-lg font-bold text-[#000000]">
                                    Recent scheduler state
                                  </h3>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <SettingsSummaryTile
                                    label="Tracked Jobs"
                                    value={Array.isArray(backupJobs?.jobs) ? backupJobs.jobs.length : 0}
                                    hint="Stored under backup.jobs.v1."
                                  />
                                  <SettingsSummaryTile
                                    label="Managed From"
                                    value="Backups Pane"
                                    hint="Schedules live in the dedicated backups form."
                                  />
                                </div>
                                <div className="mt-4">
                                  <JsonBlock value={backupJobs ?? { jobs: [] }} />
                                </div>
                              </section>

                              <section className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                                <div className="mb-4">
                                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                                    Performance Usage
                                  </div>
                                  <h3 className="mt-1 font-sans text-lg font-bold text-[#000000]">
                                    Current footprint
                                  </h3>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <SettingsSummaryTile
                                    label="Documents Total"
                                    value={performanceUsage?.documents_total ?? 0}
                                  />
                                  <SettingsSummaryTile
                                    label="Storage Bytes"
                                    value={performanceUsage?.storage_bytes ?? 0}
                                  />
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-[8px] border border-[#111111] bg-[#FAFAFA] p-3">
                                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                                      Docs per Collection
                                    </div>
                                    <div className="mt-2">
                                      <JsonBlock value={performanceUsage?.documents_per_collection ?? {}} />
                                    </div>
                                  </div>
                                  <div className="rounded-[8px] border border-[#111111] bg-[#FAFAFA] p-3">
                                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                                      Storage per Collection
                                    </div>
                                    <div className="mt-2">
                                      <JsonBlock value={performanceUsage?.storage_bytes_per_collection ?? {}} />
                                    </div>
                                  </div>
                                </div>
                              </section>
                            </div>

                            <Card title="Custom Setting Keys">
                              <MutationForm action="updateSettingsGui" returnTo={currentHref}>
                                <div className="space-y-4">
                                  {customEntries.length === 0 ? (
                                    <div className="rounded-[8px] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-8 text-center text-sm font-mono text-[#666666]">
                                      No extra editable general settings are currently stored outside the dedicated CORS, Performance, Limits, and Backups panes.
                                    </div>
                                  ) : (
                                    customEntries.map(([key, rawValue]) => {
                                      const parsed = parseSettingEntry(rawValue);
                                      return (
                                        <SettingsField
                                          key={key}
                                          label={key}
                                          hint="Structured values can still be edited here when the server exposes custom keys."
                                          htmlFor={`setting-${key}`}
                                        >
                                          <SettingsTextarea
                                            id={`setting-${key}`}
                                            name={`setting__${key}`}
                                            defaultValue={typeof parsed === "string" ? parsed : prettyJson(parsed)}
                                            rows={8}
                                          />
                                        </SettingsField>
                                      );
                                    })
                                  )}
                                </div>
                                {customEntries.length > 0 ? (
                                  <button className="mt-4 btn-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
                                    Save Custom Settings
                                  </button>
                                ) : null}
                              </MutationForm>
                            </Card>
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                </div>
              ) : null}

              {settingsPane === "cors" ? (
                <Card title="CORS Configuration">
                  <MutationForm action="updateCorsGui" returnTo={currentHref}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3.5 shadow-sm">
                        <div className="text-sm font-bold text-[#000000]">CORS Protocol Policy</div>
                        <p className="mt-1 text-xs leading-5 text-[#666666]">
                          CORS is permanently active. Remove an allowed origin to revoke its browser access.
                        </p>
                      </div>
                      <SettingsCheckbox
                        id="cors-credentials"
                        name="allow_credentials"
                        label="Allow Credentials"
                        defaultChecked={studioData.settingsCors?.allow_credentials}
                        hint="Allow browser cookies and authenticated headers."
                      />
                      <SettingsField label="Allowed Origins" hint="One origin per line." htmlFor="allowed_origins">
                        <SettingsTextarea id="allowed_origins" name="allowed_origins" defaultValue={(studioData.settingsCors?.allowed_origins ?? []).join("\n")} />
                      </SettingsField>
                      <SettingsField label="Allowed Methods" hint="One method per line." htmlFor="allowed_methods">
                        <SettingsTextarea id="allowed_methods" name="allowed_methods" defaultValue={(studioData.settingsCors?.allowed_methods ?? []).join("\n")} />
                      </SettingsField>
                      <SettingsField label="Allowed Headers" hint="One header per line." htmlFor="allowed_headers">
                        <SettingsTextarea id="allowed_headers" name="allowed_headers" defaultValue={(studioData.settingsCors?.allowed_headers ?? []).join("\n")} />
                      </SettingsField>
                      <SettingsField label="Exposed Headers" hint="One header per line." htmlFor="exposed_headers">
                        <SettingsTextarea id="exposed_headers" name="exposed_headers" defaultValue={(studioData.settingsCors?.exposed_headers ?? []).join("\n")} />
                      </SettingsField>
                    </div>
                    <button className="mt-5 btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                      Save CORS Settings
                    </button>
                  </MutationForm>
                </Card>
              ) : null}

              {settingsPane === "performance" ? (
                <Card title="Performance Settings">
                  <MutationForm action="updatePerformanceGui" returnTo={currentHref}>
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        ["controller_interval_ms", "Controller Interval (ms)"],
                        ["query_parallelism_cap", "Query Parallelism Cap"],
                        ["result_batch_size", "Result Batch Size"],
                        ["compaction_permits", "Compaction Permits"],
                        ["checkpoint_permits", "Checkpoint Permits"],
                        ["replication_batch_size", "Replication Batch Size"],
                        ["backup_compression_concurrency", "Backup Compression Concurrency"],
                        ["high_watermark_percent", "High Watermark Percent"],
                        ["critical_watermark_percent", "Critical Watermark Percent"],
                        ["emergency_reserve_percent", "Emergency Reserve Percent"],
                      ].map(([name, label]) => (
                        <SettingsField key={name} label={label} htmlFor={name}>
                          <SettingsTextInput
                            id={name}
                            name={name}
                            type="number"
                            defaultValue={(studioData.settingsPerformance as Record<string, number | boolean | null> | null)?.[name] as number | null}
                          />
                        </SettingsField>
                      ))}
                      <SettingsCheckbox
                        id="index_warming_enabled"
                        name="index_warming_enabled"
                        label="Index Warming Enabled"
                        defaultChecked={studioData.settingsPerformance?.index_warming_enabled}
                      />
                      <SettingsCheckbox
                        id="background_work_enabled"
                        name="background_work_enabled"
                        label="Background Work Enabled"
                        defaultChecked={studioData.settingsPerformance?.background_work_enabled}
                      />
                    </div>
                    <button className="mt-5 btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                      Save Performance Settings
                    </button>
                  </MutationForm>
                </Card>
              ) : null}

              {settingsPane === "limits" ? (
                <Card title="Limits Configuration">
                  <MutationForm action="updateLimitsGui" returnTo={currentHref}>
                    <div className="space-y-6">
                      <div>
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                          Server Bounds
                        </div>
                        <h3 className="mt-1 font-sans text-xl font-bold text-[#000000]">
                          Global Throttling &amp; Resource Caps
                        </h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {[
                            ["max_reads_per_second", "Max Reads / Second"],
                            ["max_writes_per_second", "Max Writes / Second"],
                            ["max_queries_per_second", "Max Queries / Second"],
                            ["max_concurrent_requests", "Max Concurrent Requests"],
                            ["max_concurrent_reads", "Max Concurrent Reads"],
                            ["max_concurrent_writes", "Max Concurrent Writes"],
                            ["max_documents_total", "Max Documents Total"],
                            ["max_documents_per_collection", "Max Documents / Collection"],
                            ["max_storage_bytes", "Max Storage Bytes"],
                            ["max_document_bytes", "Max Document Bytes"],
                            ["max_request_bytes", "Max Request Bytes"],
                            ["max_result_documents", "Max Result Documents"],
                            ["max_query_time_ms", "Max Query Time (ms)"],
                            ["max_transaction_time_ms", "Max Transaction Time (ms)"],
                            ["max_cpu_percent", "Max CPU Percent"],
                            ["max_memory_bytes", "Max Memory Bytes"],
                          ].map(([field, label]) => (
                            <SettingsField key={field} label={label} htmlFor={`server_${field}`}>
                              <SettingsTextInput
                                id={`server_${field}`}
                                name={`server_${field}`}
                                type="number"
                                defaultValue={(studioData.settingsLimits?.server as Record<string, number | null> | undefined)?.[field] ?? null}
                              />
                            </SettingsField>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <SettingsField label="User Overrides" hint="Advanced override map as JSON." htmlFor="users_overrides">
                          <SettingsTextarea id="users_overrides" name="users_overrides" defaultValue={prettyJson(studioData.settingsLimits?.users ?? {})} rows={8} />
                        </SettingsField>
                        <SettingsField label="Database Overrides" hint="Advanced override map as JSON." htmlFor="databases_overrides">
                          <SettingsTextarea id="databases_overrides" name="databases_overrides" defaultValue={prettyJson(studioData.settingsLimits?.databases ?? {})} rows={8} />
                        </SettingsField>
                        <SettingsField label="Collection Overrides" hint="Advanced override map as JSON." htmlFor="collections_overrides">
                          <SettingsTextarea id="collections_overrides" name="collections_overrides" defaultValue={prettyJson(studioData.settingsLimits?.collections ?? {})} rows={8} />
                        </SettingsField>
                      </div>
                    </div>
                    <button className="mt-5 btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                      Save Limit Settings
                    </button>
                  </MutationForm>
                </Card>
              ) : null}

              {settingsPane === "backups" ? (
                <Card title="Backup Schedules &amp; Retention">
                  <MutationForm action="updateBackupSettingsGui" returnTo={currentHref}>
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <SettingsField label="Compression Level" htmlFor="compression_level">
                          <SettingsTextInput id="compression_level" name="compression_level" type="number" defaultValue={studioData.settingsBackups?.compression_level} />
                        </SettingsField>
                        <div className="grid gap-3">
                          <SettingsCheckbox id="verify_after_create" name="verify_after_create" label="Verify After Create" defaultChecked={studioData.settingsBackups?.verify_after_create} />
                          <SettingsCheckbox id="require_cluster_complete" name="require_cluster_complete" label="Require Cluster Complete" defaultChecked={studioData.settingsBackups?.require_cluster_complete} />
                        </div>
                      </div>

                      {([
                        ["hourly", "Hourly"],
                        ["daily", "Daily"],
                        ["weekly", "Weekly"],
                        ["monthly", "Monthly"],
                      ] as const).map(([prefix, label]) => {
                        const schedule = studioData.settingsBackups?.[prefix];
                        return (
                          <div key={prefix} className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <h3 className="font-sans text-lg font-bold text-[#000000]">{label} Schedule</h3>
                              <SettingsCheckbox
                                id={`${prefix}_enabled`}
                                name={`${prefix}_enabled`}
                                label="Enabled"
                                defaultChecked={schedule?.enabled}
                              />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <SettingsField label="Timezone" htmlFor={`${prefix}_timezone`}>
                                <SettingsTextInput id={`${prefix}_timezone`} name={`${prefix}_timezone`} defaultValue={schedule?.timezone ?? "UTC"} />
                              </SettingsField>
                              <SettingsField label="Hour" htmlFor={`${prefix}_hour`}>
                                <SettingsTextInput id={`${prefix}_hour`} name={`${prefix}_hour`} type="number" defaultValue={schedule?.hour ?? 0} />
                              </SettingsField>
                              <SettingsField label="Minute" htmlFor={`${prefix}_minute`}>
                                <SettingsTextInput id={`${prefix}_minute`} name={`${prefix}_minute`} type="number" defaultValue={schedule?.minute ?? 0} />
                              </SettingsField>
                              <SettingsField label="Weekday" hint="Only for weekly schedules." htmlFor={`${prefix}_weekday`}>
                                <SettingsTextInput id={`${prefix}_weekday`} name={`${prefix}_weekday`} type="number" defaultValue={schedule?.weekday} />
                              </SettingsField>
                              <SettingsField label="Day of Month" hint="Only for monthly schedules." htmlFor={`${prefix}_day_of_month`}>
                                <SettingsTextInput id={`${prefix}_day_of_month`} name={`${prefix}_day_of_month`} type="number" defaultValue={schedule?.day_of_month} />
                              </SettingsField>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 shadow-sm">
                        <h3 className="mb-4 font-sans text-lg font-bold text-[#000000]">Retention Policy</h3>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <SettingsField label="Keep Hourly" htmlFor="keep_hourly">
                            <SettingsTextInput id="keep_hourly" name="keep_hourly" type="number" defaultValue={studioData.settingsBackups?.retention.keep_hourly} />
                          </SettingsField>
                          <SettingsField label="Keep Daily" htmlFor="keep_daily">
                            <SettingsTextInput id="keep_daily" name="keep_daily" type="number" defaultValue={studioData.settingsBackups?.retention.keep_daily} />
                          </SettingsField>
                          <SettingsField label="Keep Weekly" htmlFor="keep_weekly">
                            <SettingsTextInput id="keep_weekly" name="keep_weekly" type="number" defaultValue={studioData.settingsBackups?.retention.keep_weekly} />
                          </SettingsField>
                          <SettingsField label="Keep Monthly" htmlFor="keep_monthly">
                            <SettingsTextInput id="keep_monthly" name="keep_monthly" type="number" defaultValue={studioData.settingsBackups?.retention.keep_monthly} />
                          </SettingsField>
                          <SettingsField label="Delete After Days" htmlFor="delete_after_days">
                            <SettingsTextInput id="delete_after_days" name="delete_after_days" type="number" defaultValue={studioData.settingsBackups?.retention.delete_after_days} />
                          </SettingsField>
                          <SettingsField label="Max Total Backup Bytes" htmlFor="max_total_backup_bytes">
                            <SettingsTextInput id="max_total_backup_bytes" name="max_total_backup_bytes" type="number" defaultValue={studioData.settingsBackups?.retention.max_total_backup_bytes} />
                          </SettingsField>
                        </div>
                      </div>
                    </div>
                    <button className="mt-5 btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                      Save Backup Settings
                    </button>
                  </MutationForm>
                </Card>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
