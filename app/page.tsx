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
  LioranDBClusterIllustration,
  InteractiveQueryStage,
  SketchUnderline,
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
  return "w-full rounded-[7px] border-2 border-[#111111] bg-white px-3.5 py-2.5 font-mono text-sm text-[#111111] shadow-[2px_2px_0px_#111111] placeholder:text-[#888888] focus:border-[#000000] focus:outline-none focus:shadow-[3px_3px_0px_#111111] transition";
}

function editorClassName() {
  return "editor-scroll w-full rounded-[7px] border-2 border-[#111111] bg-white p-3.5 font-mono text-xs text-[#111111] shadow-[2px_2px_0px_#111111] placeholder:text-[#888888] focus:border-[#000000] focus:outline-none focus:shadow-[3px_3px_0px_#111111] transition";
}

function labelClassName() {
  return "mb-2 block font-mono text-xs font-bold uppercase tracking-wider text-[#111111]";
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
    <section className={`sketch-card p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between border-b-2 border-[#111111] pb-3">
        <h2 className="font-sans text-xl font-bold tracking-tight text-[#000000]">{title}</h2>
        <span className="h-2 w-2 rounded-full border border-[#111111] bg-[#111111]" />
      </div>
      {children}
    </section>
  );
}

function JsonBlock({ value }: { readonly value: unknown }) {
  return (
    <pre
      className="editor-scroll overflow-x-auto rounded-[7px] border-2 border-[#111111] bg-white p-4 font-mono text-xs leading-6 text-[#111111] shadow-[2px_2px_0px_#111111]"
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
    <div className="rounded-[7px] border-2 border-[#111111] bg-white p-4 shadow-[2px_2px_0px_#111111] transition">
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">{label}</div>
      <div className="mt-2 break-all font-sans text-xl font-bold tracking-tight text-[#000000]">{value}</div>
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
        <div key={item.label} className="rounded-[7px] border-2 border-[#111111] bg-white px-4 py-3 shadow-[2px_2px_0px_#111111]">
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
            {item.label}
          </div>
          <div className="mt-1 break-all font-mono text-xs font-semibold text-[#111111]">{item.value}</div>
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
    <div className="rounded-[7px] border-2 border-[#111111] bg-white text-[#111111] shadow-[3px_3px_0px_#111111]">
      <div className="flex items-center justify-between border-b-2 border-[#111111] bg-[#FAFAFA] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border border-[#111111] bg-white" />
          <span className="h-2.5 w-2.5 rounded-full border border-[#111111] bg-white" />
          <span className="h-2.5 w-2.5 rounded-full border border-[#111111] bg-[#111111]" />
        </div>
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#111111]">
          {title}
        </span>
        <span className="font-mono text-[10px] text-[#059669] font-bold">[LOG]</span>
      </div>
      <div className="editor-scroll space-y-2 overflow-x-auto p-4 font-mono text-xs leading-6 text-[#111111]">
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
    <div className="paper-slip p-5 bg-white shadow-[3px_3px_0px_#111111]">
      <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-[#111111] pb-3">
        <div>
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
            Document #{index + 1}
          </div>
          <div className="font-mono text-sm font-bold text-[#2563EB]">
            {String(value._id ?? `row-${index + 1}`)}
          </div>
        </div>
        <span className="sketch-badge">
          {entries.length} fields
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([key, fieldValue]) => (
          <div key={key} className="rounded-[5px] border border-[#111111] bg-[#FAFAFA] p-3">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">
              {key}
            </div>
            <div className="mt-1 text-sm text-[#111111]">
              {typeof fieldValue === "object" && fieldValue !== null ? (
                <pre
                  className="editor-scroll overflow-x-auto rounded border border-[#111111] bg-white p-2 font-mono text-xs leading-5 text-[#111111]"
                  dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(fieldValue) }}
                />
              ) : (
                <span className={`font-mono text-xs font-semibold ${
                  typeof fieldValue === "number"
                    ? "text-[#D97706]"
                    : typeof fieldValue === "boolean"
                    ? "text-[#DC2626]"
                    : fieldValue === null
                    ? "text-[#6B7280] italic"
                    : "text-[#059669]"
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
    <div className="grid gap-3 rounded-[7px] border-2 border-[#111111] bg-white px-4 py-4 shadow-[2px_2px_0px_#111111] md:grid-cols-[220px_1fr] md:items-start">
      <div className="space-y-1">
        <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#000000]" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <p className="text-xs leading-5 text-[#666666]">{hint}</p> : null}
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
    <label htmlFor={props.id} className="flex items-start gap-3 rounded-[7px] border-2 border-[#111111] bg-white px-4 py-3.5 cursor-pointer shadow-[2px_2px_0px_#111111]">
      <input id={props.id} name={props.name} type="checkbox" defaultChecked={props.defaultChecked} className="mt-1 h-4 w-4 rounded accent-black" suppressHydrationWarning />
      <span className="space-y-0.5">
        <span className="block text-sm font-bold text-[#000000]">{props.label}</span>
        {props.hint ? <span className="block text-xs leading-5 text-[#666666]">{props.hint}</span> : null}
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
    <div className="rounded-[7px] border-2 border-[#111111] bg-white px-4 py-4 shadow-[2px_2px_0px_#111111]">
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">{label}</div>
      <div className="mt-2 break-all font-sans text-xl font-bold text-[#000000]">{value}</div>
      {hint ? <div className="mt-1.5 text-xs leading-5 text-[#666666]">{hint}</div> : null}
    </div>
  );
}

function SectionAlert({ error }: { readonly error?: SectionError }) {
  if (!error) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[7px] border-2 border-[#111111] bg-white p-4 shadow-[2px_2px_0px_#111111] text-[#111111]">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#111111] font-mono text-xs font-bold text-[#111111]">
          ×
        </span>
        <strong className="block font-bold text-[#000000]">{error.title}</strong>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#333333] pl-7">{error.message}</p>
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
    <div className="min-h-screen bg-white text-[#111111]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="sidebar-scroll flex flex-col border-r-2 border-[#111111] bg-white p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <div className="mb-8">
            <LioranDBLogo size={26} />
            <h1 className="mt-4 font-sans text-2xl font-bold tracking-tight text-[#000000]">Workspace</h1>
            <p className="mt-1 text-xs leading-5 text-[#666666]">
              Session for {session.metadata.host}:{session.metadata.port}
            </p>
          </div>

          <details className="rounded-[7px] border-2 border-[#111111] bg-white text-sm text-[#111111] shadow-[2px_2px_0px_#111111]">
            <summary className="cursor-pointer list-none px-4 py-3 select-none font-bold">
              <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-[#111111]">
                <span>Stored Context</span>
                <span className="text-[11px] text-[#666666]">Details</span>
              </div>
            </summary>
            <div className="space-y-2 border-t-2 border-[#111111] px-4 py-3 text-xs font-mono text-[#333333]">
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
                className="sketch-btn-secondary w-full py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                Clear Saved Session
              </button>
            </form>
          </div>
        </aside>

        <main className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-2xl space-y-6">
            <Card title="Server Unreachable">
              <div className="rounded-[7px] border-2 border-[#111111] bg-white p-4 font-mono text-xs leading-relaxed text-[#111111] shadow-[2px_2px_0px_#111111]">
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

            <Card title="Next Step">
              <p className="text-sm leading-relaxed text-[#333333]">
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
      <div className="min-h-screen bg-white text-[#111111] selection:bg-[#000000] selection:text-[#FFFFFF]">
        {/* Top Navigation Bar (Pure White Paper + Black Ink Rule) */}
        <header className="sticky top-0 z-50 border-b-2 border-[#111111] bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <LioranDBLogo size={26} />
              <span className="hidden sm:inline-block sketch-badge">
                CONTROL PLANE
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#111111]">
              <a href="#connect" className="hover:underline underline-offset-4 decoration-2">
                Connect
              </a>
              <a href="#sandbox" className="hover:underline underline-offset-4 decoration-2">
                Query Sandbox
              </a>
              <a href="#features" className="hover:underline underline-offset-4 decoration-2">
                Features
              </a>
              <a href="#architecture" className="hover:underline underline-offset-4 decoration-2">
                Architecture
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <a
                href="#connect"
                className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider"
              >
                Quick Connect →
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section: Editorial Display & Cluster Topology Illustration */}
        <section className="mx-auto max-w-6xl px-6 py-12 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Editorial Display */}
            <div className="space-y-6 lg:col-span-6">
              <div>
                <h1 className="font-sans text-4xl font-bold leading-[1.05] tracking-tight text-[#000000] sm:text-5xl lg:text-6xl">
                  Meet your database thinking partner.
                </h1>
                <div className="mt-2 w-48">
                  <SketchUnderline />
                </div>
              </div>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-[#333333]">
                A full-screen management console and control plane for LioranDB deployments. Browse collections, evaluate live queries, configure granular RBAC security, and inspect Raft cluster topologies with editorial paper &amp; ink clarity.
              </p>

              <div className="grid gap-3 pt-2 sm:grid-cols-2 font-mono text-xs text-[#111111]">
                <div className="flex items-center gap-2.5 rounded-[5px] border border-[#111111] bg-white p-2.5 shadow-[2px_2px_0px_#111111]">
                  <span className="font-bold">✓</span>
                  <span>Raft Distributed Cluster</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-[5px] border border-[#111111] bg-white p-2.5 shadow-[2px_2px_0px_#111111]">
                  <span className="font-bold">✓</span>
                  <span>Multistage Aggregations</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-[5px] border border-[#111111] bg-white p-2.5 shadow-[2px_2px_0px_#111111]">
                  <span className="font-bold">✓</span>
                  <span>Granular RBAC Governance</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-[5px] border border-[#111111] bg-white p-2.5 shadow-[2px_2px_0px_#111111]">
                  <span className="font-bold">✓</span>
                  <span>AES-256 Session Isolation</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <a
                  href="#connect"
                  className="sketch-btn-primary px-6 py-3 text-sm font-bold uppercase tracking-wider"
                >
                  Connect to Studio
                </a>
                <a
                  href="#sandbox"
                  className="sketch-btn-secondary px-6 py-3 text-sm font-bold uppercase tracking-wider"
                >
                  Try Query Sandbox
                </a>
              </div>
            </div>

            {/* Right Column: Sketched Technical Architecture Illustration */}
            <div className="lg:col-span-6">
              <LioranDBClusterIllustration />
            </div>
          </div>
        </section>

        {/* Quick Connect & Cluster Control Plane Section */}
        <section id="connect" className="border-t-2 border-[#111111] bg-[#FAFAFA] py-16">
          <div className="mx-auto max-w-4xl px-6">
            <ConnectionPortal
              connectAction={connectAction}
              errorMessage={errorMessage}
            />
          </div>
        </section>

        {/* Interactive Query Sandbox Section */}
        <section id="sandbox" className="border-t-2 border-[#111111] bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="sketch-badge">
                INTERACTIVE SANDBOX
              </span>
              <h2 className="mt-3 font-sans text-3xl sm:text-4xl font-bold tracking-tight text-[#000000]">
                Interactive Query Stage
              </h2>
              <p className="mt-2 text-sm text-[#666666]">
                Test the LioranDB query evaluation engine directly in your browser. Inspect stage pipelines, index match execution times, and document projections in paper-and-ink clarity.
              </p>
            </div>

            <InteractiveQueryStage />
          </div>
        </section>

        {/* How It Works / Engine Capabilities: 3 Large Sketch Panels */}
        <section id="features" className="border-t-2 border-[#111111] bg-[#FAFAFA] py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="sketch-badge">
                ENGINE CAPABILITIES
              </span>
              <h2 className="mt-3 font-sans text-3xl sm:text-4xl font-bold tracking-tight text-[#000000]">
                Built for High-Throughput Workloads
              </h2>
              <p className="mt-2 text-sm text-[#666666]">
                Explore the complete control plane: from low-level Raft consensus logs to schema-agnostic document queries.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 relative">
              {/* Panel 1: Data Engine */}
              <div className="sketch-card p-6 flex flex-col justify-between min-h-[260px]">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
                    <span className="font-mono text-2xl font-bold text-[#000000]">01</span>
                    <span className="sketch-badge">DATA ENGINE</span>
                  </div>
                  <h3 className="font-sans text-xl font-bold text-[#000000]">
                    Collections &amp; Aggregations
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                    Full document lifecycle management. Inspect nested structures, execute multistage pipelines ($match, $group, $sort), and optimize index coverage.
                  </p>
                </div>
                <div className="mt-6 border-t border-[#111111] pt-3 font-mono text-xs text-[#111111]">
                  <code className="text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-1 rounded inline-block">
                    <span className="text-[#2563EB] font-bold">db.collection</span>
                    <span className="text-[#111111]">(</span>
                    <span className="text-[#059669]">&apos;metrics&apos;</span>
                    <span className="text-[#111111]">).</span>
                    <span className="text-[#7C3AED] font-bold">aggregate</span>
                    <span className="text-[#111111]">([...])</span>
                  </code>
                </div>
              </div>

              {/* Panel 2: RBAC Security */}
              <div className="sketch-card p-6 flex flex-col justify-between min-h-[260px]">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
                    <span className="font-mono text-2xl font-bold text-[#000000]">02</span>
                    <span className="sketch-badge">SECURITY</span>
                  </div>
                  <h3 className="font-sans text-xl font-bold text-[#000000]">
                    Granular RBAC Governance
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                    Define custom roles with strict permission matrices across namespaces. Manage operator credentials, rotate passwords, and inspect active sessions.
                  </p>
                </div>
                <div className="mt-6 border-t border-[#111111] pt-3 font-mono text-xs text-[#111111]">
                  <code className="text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] px-2 py-1 rounded inline-block">
                    <span className="text-[#7C3AED] font-bold">GRANT </span>
                    <span className="text-[#059669] font-bold">readWrite </span>
                    <span className="text-[#7C3AED] font-bold">ON </span>
                    <span className="text-[#2563EB] font-bold">telemetry </span>
                    <span className="text-[#7C3AED] font-bold">TO </span>
                    <span className="text-[#D97706] font-bold">svc_analytics</span>
                  </code>
                </div>
              </div>

              {/* Panel 3: Cluster Engine */}
              <div className="sketch-card p-6 flex flex-col justify-between min-h-[260px]">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
                    <span className="font-mono text-2xl font-bold text-[#000000]">03</span>
                    <span className="sketch-badge">CONSENSUS</span>
                  </div>
                  <h3 className="font-sans text-xl font-bold text-[#000000]">
                    Raft Consensus &amp; Partitions
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666666]">
                    Monitor real-time node health, heartbeat latency, log replication lag, partition placements, and snapshot compaction across distributed topologies.
                  </p>
                </div>
                <div className="mt-6 border-t border-[#111111] pt-3 font-mono text-xs text-[#111111]">
                  <code className="text-[#059669] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-1 rounded inline-block">
                    <span className="text-[#2563EB] font-bold">Leader Term: </span>
                    <span className="text-[#D97706] font-bold">42</span>
                    <span className="text-[#64748B]"> • </span>
                    <span className="text-[#059669] font-bold">Quorum: 3/3 Healthy</span>
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture & Infrastructure Section */}
        <section id="architecture" className="border-t-2 border-[#111111] bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="sketch-badge">
                INFRASTRUCTURE &amp; SECURITY
              </span>
              <h2 className="mt-3 font-sans text-3xl sm:text-4xl font-bold tracking-tight text-[#000000]">
                Engineered with Zero-Compromise Security
              </h2>
              <p className="mt-2 text-sm text-[#666666]">
                LioranDB Studio is built for deterministic reliability, strict session boundaries, and operational safety.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sketch-card p-5">
                <div className="mb-3 font-mono text-lg font-bold">[ PROTOCOL ]</div>
                <h3 className="font-sans text-base font-bold text-[#000000]">Direct Binary Framing</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">
                  Low-latency TCP and TLS 1.3 framing powered by @liorandb/driver. No unnecessary HTTP proxy layers.
                </p>
              </div>

              <div className="sketch-card p-5">
                <div className="mb-3 font-mono text-lg font-bold">[ ENCRYPTION ]</div>
                <h3 className="font-sans text-base font-bold text-[#000000]">AES-256-GCM Sessions</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">
                  Connection credentials remain sealed in encrypted httpOnly cookies. Never persisted into browser storage.
                </p>
              </div>

              <div className="sketch-card p-5">
                <div className="mb-3 font-mono text-lg font-bold">[ BACKUPS ]</div>
                <h3 className="font-sans text-base font-bold text-[#000000]">Automated Snapshots</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">
                  Trigger point-in-time backup jobs, verify checksum integrity, and initiate coordinated cluster restore pipelines.
                </p>
              </div>

              <div className="sketch-card p-5">
                <div className="mb-3 font-mono text-lg font-bold">[ AUDIT ]</div>
                <h3 className="font-sans text-base font-bold text-[#000000]">Live Node Diagnostics</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#666666]">
                  Real-time diagnostic event streams, memory footprint graphs, and connection pool saturation metrics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Editorial Sketch Footer */}
        <footer className="border-t-2 border-[#111111] bg-white py-12 text-xs text-[#666666]">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <LioranDBLogo size={22} />
              <span className="font-mono text-xs font-bold text-[#111111]">
                LIORANDB STUDIO
              </span>
            </div>
            <div className="font-mono text-center sm:text-right">
              LioranDB Studio • Management Console &amp; Control Plane • Pure light mode sketchbook.
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
    <div className="min-h-screen bg-white text-[#111111]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="sidebar-scroll flex flex-col border-r-2 border-[#111111] bg-white p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
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
                  className={`flex items-center gap-3 rounded-[7px] px-3.5 py-2.5 text-sm font-bold transition ${
                    active
                      ? "border-2 border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                      : "border-2 border-transparent text-[#111111] hover:border-[#111111] hover:bg-[#FAFAFA]"
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

          <details className="mt-6 rounded-[7px] border-2 border-[#111111] bg-white text-sm text-[#111111] shadow-[2px_2px_0px_#111111]">
            <summary className="cursor-pointer list-none px-4 py-3 select-none font-bold">
              <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wider text-[#111111]">
                <span>Active Context</span>
                <span className="text-[11px] text-[#666666]">Details</span>
              </div>
            </summary>
            <div className="space-y-1.5 border-t-2 border-[#111111] px-4 py-3 text-xs font-mono text-[#333333]">
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
                className="sketch-btn-secondary w-full py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content Floor */}
        <main className="space-y-6 overflow-hidden bg-[#FAFAFA] p-6 md:p-8">
          <StudioClientEffects />

          {/* Section Breadcrumb & Header Bar */}
          <div className="sketch-card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#666666]">
                LIORANDB STUDIO / {section}
              </div>
              <h2 className="mt-1 font-sans text-2xl sm:text-3xl font-bold tracking-tight text-[#000000]">
                {section === "databases"
                  ? `${database || "Data"}${collection ? ` / ${collection}` : ""}`
                  : navItems.find((item) => item.section === section)?.label}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle showLabel={false} />
              <span className="sketch-badge flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#111111]" />
                LIVE • NODE {studioData.live?.node_id ?? "1"}
              </span>
              <span className="sketch-badge">
                READY
              </span>
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
                  <button className="sketch-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
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
                      className={`block rounded-[7px] border-2 px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                        database === name
                          ? "border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                          : "border-[#111111] bg-white text-[#111111] hover:bg-[#FAFAFA]"
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
                        <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                            className={`break-all rounded-[7px] border-2 px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                              collection === name
                                ? "border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                                : "border-[#111111] bg-white text-[#111111] hover:bg-[#FAFAFA]"
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
                    <div id={dataWorkspaceId} className="flex flex-wrap gap-2 rounded-[10px] border-2 border-[#111111] bg-white p-2 shadow-[2px_2px_0px_#111111]">
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
                          className={`inline-flex items-center gap-2 rounded-[7px] px-3.5 py-2 text-xs font-bold transition ${
                            dataPane === item.key
                              ? "border-2 border-[#111111] bg-[#000000] text-white shadow-[1px_1px_0px_#111111]"
                              : "border-2 border-transparent text-[#111111] hover:bg-[#FAFAFA]"
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
                            <div className="rounded-[7px] border-2 border-dashed border-[#111111] bg-white px-4 py-12 text-center text-sm font-mono text-[#666666]">
                              No documents matched the current query.
                            </div>
                          )}
                        </div>
                      ) : null}

                      {(dataPane === "all" || dataPane === "query") ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <form className="space-y-4 rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]" action={dataWorkspaceHref}>
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
                            <button className="sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
                              Execute Query
                            </button>
                          </form>

                          <div className="space-y-4">
                            <form className="space-y-3 rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]" action={dataWorkspaceHref}>
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
                              <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                              <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                              <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                                Create Text Index
                              </button>
                            </MutationForm>
                          </Card>

                          <Card title="Existing Indexes" className="xl:col-span-2">
                            <div className="space-y-3">
                              {studioData.indexes.map((index) => (
                                <div key={index.name} className="paper-slip p-5 bg-white shadow-[2px_2px_0px_#111111]">
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
                                        <button className="sketch-btn-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
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
                          <form className="space-y-4 rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]" action={dataWorkspaceHref}>
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
                            <button className="sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
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
                              <button className="sketch-btn-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                              <button className="sketch-btn-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                    <div key={item.session_id} className="paper-slip p-4 bg-white shadow-[2px_2px_0px_#111111]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#000000]">{item.session_id}</div>
                          <div className="font-mono text-xs text-[#666666]">
                            status: {item.status} · expires {formatTimestamp(item.expires_at_ms)} UTC
                          </div>
                        </div>
                        <MutationForm action="revokeSession" returnTo={currentHref} className="flex items-center gap-3">
                          <input type="hidden" name="sessionId" value={item.session_id} />
                          <button className="sketch-btn-secondary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
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
                  <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                    Change Password
                  </button>
                </MutationForm>
              </Card>

              <Card title="Global Session Logout">
                <MutationForm action="logoutAll" returnTo={currentHref}>
                  <p className="text-sm leading-6 text-[#666666]">
                    This revokes every active LioranDB session for the current principal across all connected nodes.
                  </p>
                  <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                  <button className="sketch-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
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
                        className={`rounded-[7px] border-2 p-4 transition ${
                          userId === user.id
                            ? "border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                            : "border-[#111111] bg-white text-[#111111] hover:bg-[#FAFAFA]"
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
                        <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
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
                        <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Reset Password
                        </button>
                      </MutationForm>

                      <MutationForm action="revokeUserSessions" returnTo={currentHref} className="mt-6 space-y-3">
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Revoke All Sessions
                        </button>
                      </MutationForm>

                      <MutationForm action="deleteUser" returnTo={hrefFor("users")} className="mt-6 space-y-3">
                        <input type="hidden" name="userId" value={studioData.selectedUser.id} />
                        <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                  <button className="sketch-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create Role
                  </button>
                </MutationForm>
              </Card>

              <div className="space-y-6">
                <Card title="Advertised Permissions">
                  <div className="flex flex-wrap gap-2">
                    {studioData.permissions.map((permission) => (
                      <span key={permission} className="sketch-badge">
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
                        className={`rounded-[7px] border-2 p-4 transition ${
                          roleId === role.id
                            ? "border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                            : "border-[#111111] bg-white text-[#111111] hover:bg-[#FAFAFA]"
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
                        <button className="sketch-btn-primary px-4 py-2 text-xs font-bold uppercase tracking-wider">
                          Update Role Grants
                        </button>
                      </MutationForm>
                    </Card>

                    <Card title="Delete Role">
                      <MutationForm action="deleteRole" returnTo={hrefFor("roles")}>
                        <input type="hidden" name="roleId" value={studioData.selectedRole.id} />
                        <button className="sketch-btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                    <button className="sketch-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                      Trigger Checkpoint
                    </button>
                  </MutationForm>
                  <MutationForm action="clusterCompact" returnTo={currentHref}>
                    <button className="sketch-btn-secondary w-full py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                  <div className="rounded-[7px] border-2 border-[#111111] bg-white px-4 py-3 text-xs font-mono text-[#666666]">
                    Scope: <span className="font-bold text-[#111111]">local_node</span>
                  </div>
                  <button className="sketch-btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider">
                    Create Backup
                  </button>
                </MutationForm>
              </Card>

              <div className="space-y-6">
                <Card title="Backup History">
                  <div className="space-y-3">
                    {studioData.backups.map((backup) => (
                      <div key={backup.backup_id} className="paper-slip p-5 bg-white shadow-[2px_2px_0px_#111111]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link href={hrefFor("backups", { backupId: backup.backup_id })} className="font-mono text-sm font-bold text-[#000000] hover:underline">
                            {backup.backup_id}
                          </Link>
                          <span className="sketch-badge">
                            {backup.status}
                          </span>
                        </div>
                        <div className="mt-2 font-mono text-xs text-[#666666]">
                          scope: {backup.scope} · label: {backup.label ?? "no label"}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <MutationForm action="verifyBackup" returnTo={currentHref} className="inline-flex">
                            <input type="hidden" name="backupId" value={backup.backup_id} />
                            <button className="sketch-btn-secondary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider">
                              Verify
                            </button>
                          </MutationForm>
                          <MutationForm action="deleteBackup" returnTo={currentHref} className="inline-flex">
                            <input type="hidden" name="backupId" value={backup.backup_id} />
                            <button className="sketch-btn-secondary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                        <button className="sketch-btn-secondary px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-2 border-[#111111]">
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
                      className={`block rounded-[7px] px-3.5 py-2.5 font-mono text-xs font-bold transition ${
                        settingsPane === item.key
                          ? "border-2 border-[#111111] bg-[#000000] text-white shadow-[2px_2px_0px_#111111]"
                          : "border-2 border-transparent text-[#111111] hover:bg-[#FAFAFA]"
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
                      <div className="rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]">
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
                              <section className="rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]">
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

                              <section className="rounded-[7px] border-2 border-[#111111] bg-white p-5 shadow-[2px_2px_0px_#111111]">
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
                                  <div className="rounded-[7px] border border-[#111111] bg-[#FAFAFA] p-3">
                                    <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#666666]">
                                      Docs per Collection
                                    </div>
                                    <div className="mt-2">
                                      <JsonBlock value={performanceUsage?.documents_per_collection ?? {}} />
                                    </div>
                                  </div>
                                  <div className="rounded-[7px] border border-[#111111] bg-[#FAFAFA] p-3">
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
                                    <div className="rounded-[7px] border-2 border-dashed border-[#111111] bg-white px-4 py-8 text-center text-sm font-mono text-[#666666]">
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
                                  <button className="mt-4 sketch-btn-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider">
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
                      <div className="rounded-[7px] border-2 border-[#111111] bg-white px-4 py-3.5 shadow-[2px_2px_0px_#111111]">
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
                    <button className="mt-5 sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
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
                    <button className="mt-5 sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
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
                    <button className="mt-5 sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
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
                          <div key={prefix} className="paper-slip p-5 bg-white shadow-[2px_2px_0px_#111111]">
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

                      <div className="paper-slip p-5 bg-white shadow-[2px_2px_0px_#111111]">
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
                    <button className="mt-5 sketch-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider">
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
