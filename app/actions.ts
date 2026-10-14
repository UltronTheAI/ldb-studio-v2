"use server";

import { redirect } from "next/navigation";

import type {
  BackupSettings,
  BackupSchedule,
  CollectionIndexDefinition,
  CorsSettings,
  Document,
  FindOptions,
  LimitOverride,
  LimitSettings,
  PerformanceSettings,
  PermissionGrant,
  PermissionName,
  RestoreInput,
  RoleGrantScope,
  SortDirection,
  UpdateUserInput,
} from "@liorandb/driver";

import { validateConnectionTarget } from "@/lib/liorandb/connection";
import { withLioranClient } from "@/lib/liorandb/client";
import { mapStudioError } from "@/lib/liorandb/errors";
import { parseJsonValue } from "@/lib/liorandb/json";
import {
  createStudioSession,
  destroyStudioSession,
  getStudioSession,
} from "@/lib/liorandb/session";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formOptionalString(formData: FormData, key: string): string | undefined {
  const value = formString(formData, key);
  return value.length > 0 ? value : undefined;
}

function formBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function formNullableNumber(formData: FormData, key: string): number | null {
  const value = formString(formData, key);
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${key}.`);
  }
  return parsed;
}

function formRequiredNumber(formData: FormData, key: string): number {
  const value = formNullableNumber(formData, key);
  if (value === null) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function formStringList(formData: FormData, key: string): readonly string[] {
  return formString(formData, key)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function redirectWithMessage(target: string, kind: "notice" | "error", message: string): never {
  const url = new URL(target, "http://localhost");
  url.searchParams.set(kind, message);
  redirect(`${url.pathname}${url.search}`);
}

function sanitizeReturnTo(value: string): string {
  return value.startsWith("/") ? value : "/";
}

function parsePermissionGrants(input: string): readonly PermissionGrant[] {
  const grants = parseJsonValue<readonly { permission: string; scope: RoleGrantScope }[]>(
    "role grants",
    input,
  );

  return grants.map((grant) => ({
    permission: grant.permission as PermissionName,
    scope: grant.scope,
  }));
}

function normalizeGeneralSettingValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return value;
    }
  }

  return value;
}

function collectGeneralSettings(formData: FormData): Record<string, string> {
  const settings: Record<string, string> = {};

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("setting__")) {
      continue;
    }
    if (typeof rawValue !== "string") {
      continue;
    }
    settings[key.slice("setting__".length)] = normalizeGeneralSettingValue(rawValue);
  }

  return settings;
}

function buildLimitOverride(formData: FormData, prefix: string): LimitOverride {
  return {
    max_reads_per_second: formNullableNumber(formData, `${prefix}_max_reads_per_second`),
    max_writes_per_second: formNullableNumber(formData, `${prefix}_max_writes_per_second`),
    max_queries_per_second: formNullableNumber(formData, `${prefix}_max_queries_per_second`),
    max_concurrent_requests: formNullableNumber(formData, `${prefix}_max_concurrent_requests`),
    max_concurrent_reads: formNullableNumber(formData, `${prefix}_max_concurrent_reads`),
    max_concurrent_writes: formNullableNumber(formData, `${prefix}_max_concurrent_writes`),
    max_documents_total: formNullableNumber(formData, `${prefix}_max_documents_total`),
    max_documents_per_collection: formNullableNumber(formData, `${prefix}_max_documents_per_collection`),
    max_storage_bytes: formNullableNumber(formData, `${prefix}_max_storage_bytes`),
    max_document_bytes: formNullableNumber(formData, `${prefix}_max_document_bytes`),
    max_request_bytes: formNullableNumber(formData, `${prefix}_max_request_bytes`),
    max_result_documents: formNullableNumber(formData, `${prefix}_max_result_documents`),
    max_query_time_ms: formNullableNumber(formData, `${prefix}_max_query_time_ms`),
    max_transaction_time_ms: formNullableNumber(formData, `${prefix}_max_transaction_time_ms`),
    max_cpu_percent: formNullableNumber(formData, `${prefix}_max_cpu_percent`),
    max_memory_bytes: formNullableNumber(formData, `${prefix}_max_memory_bytes`),
  };
}

function parseOverrideMap(formData: FormData, key: string): Readonly<Record<string, LimitOverride>> {
  const raw = formString(formData, key);
  if (!raw) {
    return {};
  }
  return parseJsonValue<Readonly<Record<string, LimitOverride>>>(key, raw);
}

function buildBackupSchedule(formData: FormData, prefix: string, scheduleType: BackupSchedule["schedule_type"]): BackupSchedule {
  return {
    enabled: formBoolean(formData, `${prefix}_enabled`),
    timezone: formString(formData, `${prefix}_timezone`) || "UTC",
    schedule_type: scheduleType,
    hour: formRequiredNumber(formData, `${prefix}_hour`),
    minute: formRequiredNumber(formData, `${prefix}_minute`),
    weekday: formNullableNumber(formData, `${prefix}_weekday`),
    day_of_month: formNullableNumber(formData, `${prefix}_day_of_month`),
    next_run_utc_ms: null,
    last_run_utc_ms: null,
  };
}

async function runWithSession<T>(callback: (connectionUri: string) => Promise<T>): Promise<T> {
  const session = await getStudioSession();
  if (!session) {
    throw new Error("No active Studio session.");
  }

  return callback(session.connectionUri);
}

export async function connectAction(formData: FormData): Promise<void> {
  const connectionUri = formString(formData, "connectionUri");

  try {
    const metadata = validateConnectionTarget(connectionUri);
    const principal = await withLioranClient(connectionUri, async (client) => client.me());
    await createStudioSession({ connectionUri, principal, metadata });
  } catch (error) {
    const mapped = mapStudioError(error);
    redirectWithMessage("/", "error", `${mapped.title}: ${mapped.message}`);
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await getStudioSession();

  try {
    if (session) {
      await withLioranClient(session.connectionUri, async (client) => {
        try {
          await client.logout();
        } catch {
          // Best-effort logout before local session removal.
        }
      });
    }
  } finally {
    await destroyStudioSession(session?.id);
  }

  redirect("/");
}

export async function studioMutationAction(formData: FormData): Promise<void> {
  const action = formString(formData, "action");
  const returnTo = sanitizeReturnTo(formString(formData, "returnTo") || "/");

  try {
    await runWithSession(async (connectionUri) => {
      await withLioranClient(connectionUri, async (client) => {
        switch (action) {
          case "logoutAll":
            await client.logoutAll();
            return;
          case "revokeSession":
            await client.revokeSession(formString(formData, "sessionId"));
            return;
          case "changePassword":
            await client.changePassword(
              formString(formData, "newPassword"),
              formBoolean(formData, "clearMustChange"),
            );
            return;
          case "createDatabase":
            await client.createDatabase(formString(formData, "databaseName"));
            return;
          case "dropDatabase": {
            const name = formString(formData, "databaseName");
            if (formString(formData, "confirmation") !== name) {
              throw new Error("Database confirmation text did not match.");
            }
            await client.dropDatabase(name);
            return;
          }
          case "createCollection":
            await client
              .db(formString(formData, "databaseName"))
              .createCollection(formString(formData, "collectionName"));
            return;
          case "dropCollection": {
            const databaseName = formString(formData, "databaseName");
            const collectionName = formString(formData, "collectionName");
            if (formString(formData, "confirmation") !== collectionName) {
              throw new Error("Collection confirmation text did not match.");
            }
            await client.db(databaseName).dropCollection(collectionName);
            return;
          }
          case "insertOne":
            await client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"))
              .insertOne(
                parseJsonValue<Document>("insert-one document", formString(formData, "document")),
                { idempotencyKey: formOptionalString(formData, "idempotencyKey") },
              );
            return;
          case "insertMany":
            await client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"))
              .insertMany(
                parseJsonValue<readonly Document[]>(
                  "insert-many documents",
                  formString(formData, "documents"),
                ),
                { idempotencyKey: formOptionalString(formData, "idempotencyKey") },
              );
            return;
          case "updateOne":
          case "updateMany": {
            const collection = client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"));
            const filter = parseJsonValue<Document>("update filter", formString(formData, "filter"));
            const update = parseJsonValue<Document>("update document", formString(formData, "update"));
            const options = {
              upsert: formBoolean(formData, "upsert"),
              idempotencyKey: formOptionalString(formData, "idempotencyKey"),
            };
            if (action === "updateOne") {
              await collection.updateOne(filter, update, options);
            } else {
              await collection.updateMany(filter, update, options);
            }
            return;
          }
          case "deleteOne":
          case "deleteMany": {
            const filter = parseJsonValue<Document>("delete filter", formString(formData, "filter"));
            if (action === "deleteMany" && formString(formData, "confirmation") !== "DELETE") {
              throw new Error("Type DELETE to confirm delete many.");
            }
            const collection = client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"));
            if (action === "deleteOne") {
              await collection.deleteOne(filter, {
                idempotencyKey: formOptionalString(formData, "idempotencyKey"),
              });
            } else {
              await collection.deleteMany(filter, {
                idempotencyKey: formOptionalString(formData, "idempotencyKey"),
              });
            }
            return;
          }
          case "createIndex": {
            const collection = client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"));
            const fields = parseJsonValue<
              readonly (
                | string
                | {
                    readonly field: string;
                    readonly direction?: SortDirection | "Asc" | "Desc";
                  }
              )[]
            >("index fields", formString(formData, "fields"));
            await collection.createIndex(
              {
                fields,
                name: formOptionalString(formData, "name"),
                unique: formBoolean(formData, "unique"),
                sparse: formBoolean(formData, "sparse"),
                partialFilter: formString(formData, "partialFilter")
                  ? parseJsonValue<Document>(
                      "partial filter",
                      formString(formData, "partialFilter"),
                    )
                  : undefined,
              },
              {
                idempotencyKey: formOptionalString(formData, "idempotencyKey"),
              },
            );
            return;
          }
          case "createTextIndex": {
            const collection = client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"));
            await collection.createTextIndex(formString(formData, "field"), {
              normalize: formBoolean(formData, "normalize"),
              stopwords: formString(formData, "stopwords")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              idempotencyKey: formOptionalString(formData, "idempotencyKey"),
            });
            return;
          }
          case "dropIndex":
            await client
              .db(formString(formData, "databaseName"))
              .collection(formString(formData, "collectionName"))
              .dropIndex(formString(formData, "indexName"), {
                idempotencyKey: formOptionalString(formData, "idempotencyKey"),
              });
            return;
          case "createUser":
            await client.users.create({
              username: formString(formData, "username"),
              password: formString(formData, "password"),
              roles: formString(formData, "roles")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              must_change_password: formBoolean(formData, "mustChangePassword"),
            });
            return;
          case "updateUser": {
            const input: UpdateUserInput = {
              enabled: formBoolean(formData, "enabled"),
              roles: formString(formData, "roles")
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              metadata: parseJsonValue<Record<string, string>>(
                "user metadata",
                formString(formData, "metadata"),
              ),
            };
            await client.users.update(formString(formData, "userId"), input);
            return;
          }
          case "deleteUser":
            await client.users.delete(formString(formData, "userId"));
            return;
          case "resetUserPassword":
            await client.users.resetPassword(formString(formData, "userId"), {
              new_password: formString(formData, "password"),
              clear_must_change: formBoolean(formData, "clearMustChange"),
            });
            return;
          case "revokeUserSessions":
            await client.users.revokeSessions(formString(formData, "userId"));
            return;
          case "createRole":
            await client.roles.createRole({
              name: formString(formData, "name"),
              grants: parsePermissionGrants(formString(formData, "grants")),
            });
            return;
          case "updateRole":
            await client.roles.updateRole(formString(formData, "roleId"), {
              grants: parsePermissionGrants(formString(formData, "grants")),
            });
            return;
          case "deleteRole":
            await client.roles.deleteRole(formString(formData, "roleId"));
            return;
          case "clusterCheckpoint":
            await client.cluster.checkpoint();
            return;
          case "clusterCompact":
            await client.cluster.compact();
            return;
          case "createBackup":
            await client.backups.create({
              label: formOptionalString(formData, "label"),
              scope: "local_node",
            });
            return;
          case "verifyBackup":
            await client.backups.verify(formString(formData, "backupId"));
            return;
          case "deleteBackup":
            await client.backups.delete(formString(formData, "backupId"));
            return;
          case "restoreBackup": {
            const input: RestoreInput = {
              confirmation: formString(formData, "confirmation"),
              disable_safety_backup: formBoolean(formData, "disableSafetyBackup"),
            };
            await client.backups.restore(formString(formData, "backupId"), input);
            return;
          }
          case "updateSettings":
            await client.settings.update(
              parseJsonValue<Record<string, string>>(
                "general settings",
                formString(formData, "settings"),
              ),
            );
            return;
          case "updateSettingsGui":
            await client.settings.update(collectGeneralSettings(formData));
            return;
          case "updateCors":
            await client.settings.updateCors(
              parseJsonValue<CorsSettings>("CORS settings", formString(formData, "settings")),
            );
            return;
          case "updateCorsGui":
            await client.settings.updateCors({
              enabled: true,
              allowed_origins: formStringList(formData, "allowed_origins"),
              allowed_methods: formStringList(formData, "allowed_methods"),
              allowed_headers: formStringList(formData, "allowed_headers"),
              exposed_headers: formStringList(formData, "exposed_headers"),
              allow_credentials: formBoolean(formData, "allow_credentials"),
              max_age_secs: 2_147_483_647,
            });
            return;
          case "updatePerformance":
            await client.settings.updatePerformance(
              parseJsonValue<PerformanceSettings>(
                "performance settings",
                formString(formData, "settings"),
              ),
            );
            return;
          case "updatePerformanceGui":
            await client.settings.updatePerformance({
              controller_interval_ms: formRequiredNumber(formData, "controller_interval_ms"),
              query_parallelism_cap: formRequiredNumber(formData, "query_parallelism_cap"),
              result_batch_size: formRequiredNumber(formData, "result_batch_size"),
              compaction_permits: formRequiredNumber(formData, "compaction_permits"),
              checkpoint_permits: formRequiredNumber(formData, "checkpoint_permits"),
              replication_batch_size: formRequiredNumber(formData, "replication_batch_size"),
              backup_compression_concurrency: formRequiredNumber(formData, "backup_compression_concurrency"),
              index_warming_enabled: formBoolean(formData, "index_warming_enabled"),
              background_work_enabled: formBoolean(formData, "background_work_enabled"),
              high_watermark_percent: formRequiredNumber(formData, "high_watermark_percent"),
              critical_watermark_percent: formRequiredNumber(formData, "critical_watermark_percent"),
              emergency_reserve_percent: formRequiredNumber(formData, "emergency_reserve_percent"),
            });
            return;
          case "updateLimits":
            await client.settings.updateLimits(
              parseJsonValue<LimitSettings>("limit settings", formString(formData, "settings")),
            );
            return;
          case "updateLimitsGui":
            await client.settings.updateLimits({
              server: buildLimitOverride(formData, "server"),
              users: parseOverrideMap(formData, "users_overrides"),
              databases: parseOverrideMap(formData, "databases_overrides"),
              collections: parseOverrideMap(formData, "collections_overrides"),
            });
            return;
          case "updateBackupSettings":
            await client.settings.updateBackups(
              parseJsonValue<BackupSettings>(
                "backup settings",
                formString(formData, "settings"),
              ),
            );
            return;
          case "updateBackupSettingsGui":
            await client.settings.updateBackups({
              compression_level: formRequiredNumber(formData, "compression_level"),
              verify_after_create: formBoolean(formData, "verify_after_create"),
              require_cluster_complete: formBoolean(formData, "require_cluster_complete"),
              hourly: buildBackupSchedule(formData, "hourly", "Hourly"),
              daily: buildBackupSchedule(formData, "daily", "Daily"),
              weekly: buildBackupSchedule(formData, "weekly", "Weekly"),
              monthly: buildBackupSchedule(formData, "monthly", "Monthly"),
              retention: {
                keep_hourly: formRequiredNumber(formData, "keep_hourly"),
                keep_daily: formRequiredNumber(formData, "keep_daily"),
                keep_weekly: formRequiredNumber(formData, "keep_weekly"),
                keep_monthly: formRequiredNumber(formData, "keep_monthly"),
                delete_after_days: formNullableNumber(formData, "delete_after_days"),
                max_total_backup_bytes: formNullableNumber(formData, "max_total_backup_bytes"),
              },
            });
            return;
          default:
            throw new Error(`Unsupported Studio action: ${action}`);
        }
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    if (mapped.shouldClearSession) {
      await destroyStudioSession();
    }
    redirectWithMessage(returnTo, "error", `${mapped.title}: ${mapped.message}`);
  }

  redirectWithMessage(returnTo, "notice", "Operation completed successfully.");
}

// ==========================================
// REACTIVE IDE SERVER ACTIONS
// ==========================================

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  durationMs?: number;
}

export async function listExplorerTreeAction(): Promise<
  ActionResult<{ databases: string[]; collectionsMap: Record<string, string[]> }>
> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const databases = await client.listDatabases();
        const collectionsMap: Record<string, string[]> = {};
        for (const dbName of databases) {
          try {
            const cols = await client.db(dbName).listCollections();
            collectionsMap[dbName] = [...cols];
          } catch {
            collectionsMap[dbName] = [];
          }
        }
        return {
          ok: true,
          data: { databases: [...databases], collectionsMap },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function fetchCollectionDocumentsAction(params: {
  database: string;
  collection: string;
  filter?: string;
  projection?: string;
  sort?: string;
  limit?: number;
  skip?: number;
}): Promise<
  ActionResult<{
    documents: Document[];
    total: number;
    indexes: CollectionIndexDefinition[];
  }>
> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        let filterObj: Document | undefined = undefined;
        if (params.filter?.trim()) {
          filterObj = JSON.parse(params.filter.trim()) as Document;
        }

        const options: FindOptions<Document> = {
          limit: params.limit ?? 50,
          skip: params.skip ?? 0,
          ...(params.projection?.trim()
            ? { projection: JSON.parse(params.projection.trim()) as FindOptions<Document>["projection"] }
            : {}),
          ...(params.sort?.trim()
            ? { sort: JSON.parse(params.sort.trim()) as FindOptions<Document>["sort"] }
            : {}),
        };

        const documents = [...(await col.find(filterObj, options).toArray())];
        let total = documents.length;
        try {
          total = await col.countDocuments(filterObj);
        } catch {
          // Fallback to returned length if count fails
        }

        let indexes: CollectionIndexDefinition[] = [];
        try {
          indexes = [...(await col.listIndexes())];
        } catch {
          // Indexes are optional
        }

        return {
          ok: true,
          data: { documents, total, indexes },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function executeQueryAction(params: {
  database: string;
  collection: string;
  filter?: string;
  projection?: string;
  sort?: string;
  limit?: number;
  skip?: number;
}): Promise<ActionResult<{ documents: Document[]; total: number }>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        let filterObj: Document | undefined = undefined;
        if (params.filter?.trim()) {
          filterObj = JSON.parse(params.filter.trim()) as Document;
        }

        const options: FindOptions<Document> = {
          limit: params.limit ?? 50,
          skip: params.skip ?? 0,
          ...(params.projection?.trim()
            ? { projection: JSON.parse(params.projection.trim()) as FindOptions<Document>["projection"] }
            : {}),
          ...(params.sort?.trim()
            ? { sort: JSON.parse(params.sort.trim()) as FindOptions<Document>["sort"] }
            : {}),
        };

        const documents = [...(await col.find(filterObj, options).toArray())];
        let total = documents.length;
        try {
          total = await col.countDocuments(filterObj);
        } catch {
          // Ignore count error
        }

        return {
          ok: true,
          data: { documents, total },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function executeAggregationAction(params: {
  database: string;
  collection: string;
  pipelineJson: string;
}): Promise<ActionResult<{ documents: Document[] }>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        const pipeline = JSON.parse(params.pipelineJson.trim()) as Document[];
        if (!Array.isArray(pipeline)) {
          throw new Error("Aggregation pipeline must be a JSON array of stage objects.");
        }

        const documents = [...(await col.aggregate<Document>(pipeline).toArray())];
        return {
          ok: true,
          data: { documents },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function insertOneDocumentAction(params: {
  database: string;
  collection: string;
  documentJson: string;
  idempotencyKey?: string;
}): Promise<ActionResult<{ insertedId: unknown }>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        const doc = JSON.parse(params.documentJson) as Document;
        const res = await col.insertOne(doc, { idempotencyKey: params.idempotencyKey });
        return {
          ok: true,
          data: { insertedId: res.insertedId },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function updateOneDocumentAction(params: {
  database: string;
  collection: string;
  filterJson: string;
  updateJson: string;
  upsert?: boolean;
  idempotencyKey?: string;
}): Promise<ActionResult<{ matchedCount: number; modifiedCount: number; upsertedId: unknown }>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        const filter = JSON.parse(params.filterJson) as Document;
        const update = JSON.parse(params.updateJson) as Document;
        const res = await col.updateOne(filter, update, {
          upsert: params.upsert,
          idempotencyKey: params.idempotencyKey,
        });
        return {
          ok: true,
          data: {
            matchedCount: res.matchedCount,
            modifiedCount: res.modifiedCount,
            upsertedId: res.upsertedId,
          },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function deleteOneDocumentAction(params: {
  database: string;
  collection: string;
  filterJson: string;
  idempotencyKey?: string;
}): Promise<ActionResult<{ deletedCount: number }>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        const filter = JSON.parse(params.filterJson) as Document;
        const res = await col.deleteOne(filter, { idempotencyKey: params.idempotencyKey });
        return {
          ok: true,
          data: { deletedCount: res.deletedCount },
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function createIndexAction(params: {
  database: string;
  collection: string;
  name?: string;
  fieldsJson: string;
  unique?: boolean;
  sparse?: boolean;
  partialFilterJson?: string;
  idempotencyKey?: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        const fields = JSON.parse(params.fieldsJson) as readonly (
          | string
          | { readonly field: string; readonly direction?: SortDirection | "Asc" | "Desc" }
        )[];
        const partialFilter = params.partialFilterJson?.trim()
          ? (JSON.parse(params.partialFilterJson.trim()) as Document)
          : undefined;

        await col.createIndex(
          {
            fields,
            name: params.name || undefined,
            unique: params.unique,
            sparse: params.sparse,
            partialFilter,
          },
          { idempotencyKey: params.idempotencyKey },
        );

        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function dropIndexAction(params: {
  database: string;
  collection: string;
  indexName: string;
  idempotencyKey?: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        const col = client.db(params.database).collection<Document>(params.collection);
        await col.dropIndex(params.indexName, { idempotencyKey: params.idempotencyKey });
        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function createDatabaseAction(params: {
  databaseName: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        await client.createDatabase(params.databaseName.trim());
        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function dropDatabaseAction(params: {
  databaseName: string;
  confirmation: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    if (params.databaseName !== params.confirmation) {
      throw new Error("Confirmation text does not match database name.");
    }
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        await client.dropDatabase(params.databaseName);
        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function createCollectionAction(params: {
  databaseName: string;
  collectionName: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        await client.db(params.databaseName).createCollection(params.collectionName.trim());
        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function dropCollectionAction(params: {
  databaseName: string;
  collectionName: string;
  confirmation: string;
}): Promise<ActionResult<void>> {
  const start = Date.now();
  try {
    if (params.collectionName !== params.confirmation) {
      throw new Error("Confirmation text does not match collection name.");
    }
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client) => {
        await client.db(params.databaseName).dropCollection(params.collectionName);
        return { ok: true, durationMs: Date.now() - start };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}

export async function fetchAdminSectionDataAction(
  section: string,
  params?: { userId?: string; roleId?: string; backupId?: string },
): Promise<ActionResult<Record<string, unknown>>> {
  const start = Date.now();
  try {
    return await runWithSession(async (connectionUri) => {
      return await withLioranClient(connectionUri, async (client, diagnostics) => {
        const result: Record<string, unknown> = { diagnostics };

        if (section === "overview") {
          try {
            result.live = await client.live();
            result.ready = await client.ready();
            result.serverInfo = await client.serverInfo();
            result.clusterSummary = await client.cluster.summary();
          } catch {
            // Ignore partial errors in overview
          }
        } else if (section === "users") {
          result.users = await client.users.list();
          if (params?.userId) {
            try {
              result.selectedUser = await client.users.get(params.userId);
            } catch {
              // Ignore
            }
          }
        } else if (section === "roles") {
          result.roles = await client.roles.listRoles();
          result.permissions = await client.roles.listPermissions();
          if (params?.roleId) {
            try {
              result.selectedRole = await client.roles.getRole(params.roleId);
            } catch {
              // Ignore
            }
          }
        } else if (section === "cluster") {
          result.clusterNodes = await client.cluster.nodes();
          result.clusterPartitions = await client.cluster.partitions();
          result.clusterHealth = await client.cluster.health();
          result.clusterReadiness = await client.cluster.readiness();
        } else if (section === "backups") {
          result.backups = await client.backups.list();
          if (params?.backupId) {
            try {
              result.selectedBackup = await client.backups.get(params.backupId);
            } catch {
              // Ignore
            }
          }
        } else if (section === "settings") {
          result.settingsGeneral = await client.settings.get();
          result.settingsCors = await client.settings.getCors();
          result.settingsPerformance = await client.settings.getPerformance();
          result.settingsLimits = await client.settings.getLimits();
          result.settingsBackups = await client.settings.getBackups();
        }

        return {
          ok: true,
          data: result,
          durationMs: Date.now() - start,
        };
      });
    });
  } catch (error) {
    const mapped = mapStudioError(error);
    return { ok: false, error: mapped.message, durationMs: Date.now() - start };
  }
}
