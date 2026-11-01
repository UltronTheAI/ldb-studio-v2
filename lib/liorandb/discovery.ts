import {
  AuthorizationError,
  LioranDBClient,
  type PermissionGrant,
  type PermissionName,
  type Principal,
  type RoleRecord,
  type TenantAllocation,
} from "@liorandb/driver";
import { AssignedDatabaseUnavailableError } from "./errors";

export type DatabaseScope = "explicit" | "allocated" | "cluster" | "unselected";

export type StudioCapabilityProfile =
  | "cluster-administrator"
  | "database-scoped-user"
  | "restricted-shared-tenant";

export interface StudioCapabilities {
  readonly profile: StudioCapabilityProfile;
  readonly databaseList: boolean;
  readonly databaseCreate: boolean;
  readonly databaseDrop: boolean;
  readonly collectionList: boolean;
  readonly collectionCreate: boolean;
  readonly collectionDrop: boolean;
  readonly documentRead: boolean;
  readonly documentInsert: boolean;
  readonly documentUpdate: boolean;
  readonly documentDelete: boolean;
  readonly indexList: boolean;
  readonly indexCreate: boolean;
  readonly indexDrop: boolean;
  readonly queryExecute: boolean;
  readonly clusterAdministration: boolean;
  readonly effectivePermissionGrants: readonly PermissionGrant[];
  readonly permissionsVerified: boolean;
}

export interface DatabaseResolution {
  readonly databases: string[];
  readonly scopedDatabase?: string;
  readonly databaseScope: DatabaseScope;
  readonly isFreeSharedHosting: boolean;
  readonly databaseCapabilityVerified: boolean;
  readonly databaseDiscoveryVerified: boolean;
  readonly clusterAdministrationVerified: boolean;
  readonly databaseManagementAllowed: boolean;
  readonly databaseCreateAllowed: boolean;
  readonly databaseDropAllowed: boolean;
  readonly capabilities: StudioCapabilities;
}

interface DatabaseDiscoveryDiagnostics {
  readonly listDatabasesAttempted: boolean;
  readonly listDatabasesSucceeded: boolean;
  readonly grpcErrorCode?: string | number | null;
}

const DATABASE_MANAGEMENT_PERMISSIONS: readonly PermissionName[] = [
  "DatabaseList",
  "DatabaseCreate",
  "DatabaseDrop",
];

function isTenantPrincipal(principal: Principal | undefined): boolean {
  // This is a server-issued role marker, not a hostname or username heuristic.
  // It remains a safe fallback for tenant-aware servers that predate /v1/allocation.
  return Boolean(principal?.roles.some((role) => role.startsWith("tenant_role:")));
}

function grantAppliesToCluster(grant: PermissionGrant, permission: PermissionName): boolean {
  return grant.permission === permission && grant.scope.kind === "cluster";
}

function grantAppliesToDatabase(
  grant: PermissionGrant,
  permission: PermissionName,
  database?: string,
): boolean {
  if (grant.permission !== permission) return false;
  if (grant.scope.kind === "cluster") return true;
  return Boolean(
    database &&
      (grant.scope.kind === "database" || grant.scope.kind === "collection") &&
      grant.scope.database === database,
  );
}

function hasClusterPermission(
  grants: readonly PermissionGrant[],
  permission: PermissionName,
): boolean {
  return grants.some((grant) => grantAppliesToCluster(grant, permission));
}

function hasAnyPermission(
  grants: readonly PermissionGrant[],
  permission: PermissionName,
): boolean {
  return grants.some((grant) => grant.permission === permission);
}

function diagnosticErrorCode(error: unknown): string | number | null {
  if (!error || typeof error !== "object") return null;
  const value = error as Record<string, unknown>;
  if (typeof value.grpcStatusCode === "number") return value.grpcStatusCode;
  if (typeof value.grpcStatusName === "string") return value.grpcStatusName;
  if (typeof value.code === "string") return value.code;
  return null;
}

function emitDatabaseDiscoveryDiagnostics(input: {
  readonly profile: StudioCapabilityProfile;
  readonly requestedDatabase?: string;
  readonly scopedDatabase?: string;
  readonly databasesReturned: number;
  readonly diagnostics: DatabaseDiscoveryDiagnostics;
}): void {
  if (process.env.STUDIO_DATABASE_DISCOVERY_DIAGNOSTICS === "0") return;
  console.info(
    JSON.stringify({
      event: "studio.database_discovery",
      principal_category: input.profile,
      list_databases_attempted: input.diagnostics.listDatabasesAttempted,
      list_databases_succeeded: input.diagnostics.listDatabasesSucceeded,
      databases_returned: input.databasesReturned,
      databases_displayed: input.databasesReturned,
      uri_selection_filtered: Boolean(
        input.requestedDatabase && input.scopedDatabase !== input.requestedDatabase,
      ),
      grpc_error_code: input.diagnostics.grpcErrorCode ?? null,
    }),
  );
}

function buildCapabilities(
  grants: readonly PermissionGrant[],
  permissionsVerified: boolean,
  isFreeSharedHosting: boolean,
  database?: string,
): StudioCapabilities {
  const clusterDatabaseManagement = DATABASE_MANAGEMENT_PERMISSIONS.every((permission) =>
    hasClusterPermission(grants, permission),
  );
  // Database administration is the capability that decides whether Studio
  // should present the normal administrative workspace. Cluster topology and
  // other governance calls still remain server-authorized individually.
  const clusterAdministration = clusterDatabaseManagement;

  const capability = (permission: PermissionName): boolean =>
    database
      ? grants.some((grant) => grantAppliesToDatabase(grant, permission, database))
      : hasAnyPermission(grants, permission);

  return {
    profile: isFreeSharedHosting
      ? "restricted-shared-tenant"
      : clusterDatabaseManagement
        ? "cluster-administrator"
        : "database-scoped-user",
    databaseList: hasAnyPermission(grants, "DatabaseList"),
    databaseCreate: isFreeSharedHosting ? false : hasClusterPermission(grants, "DatabaseCreate"),
    databaseDrop: isFreeSharedHosting ? false : hasClusterPermission(grants, "DatabaseDrop"),
    collectionList: capability("CollectionList"),
    collectionCreate: capability("CollectionCreate"),
    collectionDrop: capability("CollectionDrop"),
    documentRead: capability("DocumentRead"),
    documentInsert: capability("DocumentInsert"),
    documentUpdate: capability("DocumentUpdate"),
    documentDelete: capability("DocumentDelete"),
    indexList: capability("IndexList"),
    indexCreate: capability("IndexCreate"),
    indexDrop: capability("IndexDrop"),
    queryExecute: capability("QueryExecute"),
    clusterAdministration: isFreeSharedHosting ? false : clusterAdministration,
    effectivePermissionGrants: [...grants],
    permissionsVerified,
  };
}

async function getTenantAllocation(
  client: LioranDBClient,
): Promise<TenantAllocation | undefined> {
  try {
    return await client.getMyAllocation();
  } catch {
    // Non-tenant servers normally return an authorization/not-found response.
    // Keep discovery available for dedicated and ordinary database-scoped users.
    return undefined;
  }
}

async function getEffectivePermissionGrants(
  client: LioranDBClient,
  principal: Principal,
): Promise<{ grants: readonly PermissionGrant[]; verified: boolean }> {
  const principalWithPermissions = principal as Principal & {
    readonly grants?: readonly PermissionGrant[];
    readonly permissions?: readonly PermissionGrant[];
    readonly effective_permissions?: readonly PermissionGrant[];
  };
  const advertisedGrants =
    principalWithPermissions.grants ??
    principalWithPermissions.permissions ??
    principalWithPermissions.effective_permissions;
  if (Array.isArray(advertisedGrants)) {
    return { grants: advertisedGrants, verified: true };
  }

  try {
    const roles = await client.roles.listRoles();
    const principalRoles = new Set(principal.roles);
    const grants = roles
      .filter((role: RoleRecord) => principalRoles.has(role.name) || principalRoles.has(role.id))
      .flatMap((role) => role.grants);
    return { grants, verified: true };
  } catch {
    // The server may allow data access while denying role introspection. In
    // that case the server still enforces each operation, but Studio must not
    // infer cluster-wide management privileges from a username or role label.
    return { grants: [], verified: false };
  }
}

async function listTenantDatabases(
  client: LioranDBClient,
  allocation?: TenantAllocation,
): Promise<string[]> {
  if (allocation) return [...allocation.databases];
  return [...(await client.listMyDatabases())];
}

function result(
  databases: readonly string[],
  options: {
    scopedDatabase?: string;
    databaseScope: DatabaseScope;
    isFreeSharedHosting: boolean;
    databaseCapabilityVerified: boolean;
    databaseDiscoveryVerified: boolean;
    capabilities: StudioCapabilities;
    requestedDatabase?: string;
    diagnostics: DatabaseDiscoveryDiagnostics;
  },
): DatabaseResolution {
  const databaseCreateAllowed = options.capabilities.databaseCreate;
  const databaseDropAllowed = options.capabilities.databaseDrop;
  const resolution: DatabaseResolution = {
    databases: [...databases],
    scopedDatabase: options.scopedDatabase,
    databaseScope: options.databaseScope,
    isFreeSharedHosting: options.isFreeSharedHosting,
    databaseCapabilityVerified: options.databaseCapabilityVerified,
    databaseDiscoveryVerified: options.databaseDiscoveryVerified,
    clusterAdministrationVerified: options.capabilities.clusterAdministration,
    databaseManagementAllowed: databaseCreateAllowed && databaseDropAllowed,
    databaseCreateAllowed,
    databaseDropAllowed,
    capabilities: options.capabilities,
  };
  emitDatabaseDiscoveryDiagnostics({
    profile: options.capabilities.profile,
    requestedDatabase: options.requestedDatabase,
    scopedDatabase: options.scopedDatabase,
    databasesReturned: databases.length,
    diagnostics: options.diagnostics,
  });
  return resolution;
}

/**
 * Resolves the database context from authenticated server metadata and
 * authorized driver calls. URI shape, hostname, and username are never used
 * to elevate a connection.
 */
export async function resolveDatabaseContext(
  client: LioranDBClient,
  explicitDatabase?: string,
): Promise<DatabaseResolution> {
  const requestedDatabase = explicitDatabase?.trim();
  const principal = await client.me();
  const allocation = await getTenantAllocation(client);
  const isFreeSharedHosting = Boolean(allocation) || isTenantPrincipal(principal);
  const permissionState = await getEffectivePermissionGrants(client, principal);
  const baseCapabilities = buildCapabilities(
    permissionState.grants,
    permissionState.verified,
    isFreeSharedHosting,
    requestedDatabase,
  );
  let listDatabasesAttempted = false;
  let listDatabasesSucceeded = false;
  let listDatabasesErrorCode: string | number | null = null;
  const discoveryDiagnostics = (): DatabaseDiscoveryDiagnostics => ({
    listDatabasesAttempted,
    listDatabasesSucceeded,
    grpcErrorCode: listDatabasesErrorCode,
  });

  if (isFreeSharedHosting) {
    if (requestedDatabase) {
      const databases = await listTenantDatabases(client, allocation);
      if (!databases.includes(requestedDatabase)) {
        if (allocation) {
          // An allocation response is authoritative. Never use a URI path to
          // widen a shared tenant beyond the databases returned by the server.
          throw new AssignedDatabaseUnavailableError();
        }
        // Older tenant-aware servers may not expose allocation metadata; the
        // direct collection authorization remains the compatibility fallback.
        await client.db(requestedDatabase).listCollections();
      }
      const capabilities = buildCapabilities(
        permissionState.grants,
        permissionState.verified,
        true,
        requestedDatabase,
      );
      return result(databases, {
        scopedDatabase: requestedDatabase,
        databaseScope: "allocated",
        isFreeSharedHosting: true,
        databaseCapabilityVerified: permissionState.verified,
        databaseDiscoveryVerified: true,
        capabilities,
        requestedDatabase,
        diagnostics: discoveryDiagnostics(),
      });
    }

    const databases = await listTenantDatabases(client, allocation);
    if (databases.length === 0) {
      throw new AssignedDatabaseUnavailableError();
    }
    const capabilities = buildCapabilities(
      permissionState.grants,
      permissionState.verified,
      true,
      databases[0],
    );
    return result(databases, {
      scopedDatabase: databases[0],
      databaseScope: "allocated",
      isFreeSharedHosting: true,
      databaseCapabilityVerified: permissionState.verified,
      databaseDiscoveryVerified: true,
      capabilities,
      requestedDatabase,
      diagnostics: discoveryDiagnostics(),
    });
  }

  // A cluster administrator gets the complete authorized list even when the
  // URI contains a database path. The path only chooses the initial database.
  const canDiscoverCluster = baseCapabilities.databaseList && permissionState.verified;
  if (canDiscoverCluster) {
    listDatabasesAttempted = true;
    try {
      const databases = await client.listDatabases();
      listDatabasesSucceeded = true;
      const capabilities = buildCapabilities(
        permissionState.grants,
        permissionState.verified,
        false,
        databases[0] ?? requestedDatabase,
      );
      const isClusterAdministrator = capabilities.profile === "cluster-administrator";
      return result(databases, {
        scopedDatabase: requestedDatabase && databases.includes(requestedDatabase)
          ? requestedDatabase
          : databases[0],
        databaseScope: isClusterAdministrator ? "cluster" : databases.length > 0 ? "explicit" : "unselected",
        isFreeSharedHosting: false,
        databaseCapabilityVerified: permissionState.verified,
        databaseDiscoveryVerified: true,
        capabilities,
        requestedDatabase,
        diagnostics: discoveryDiagnostics(),
      });
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      listDatabasesErrorCode = diagnosticErrorCode(error);
      // Fall through to explicit database validation or the authorized
      // database-scoped listing below.
    }
  }

  if (requestedDatabase) {
    await client.db(requestedDatabase).listCollections();
    const capabilities = buildCapabilities(
      permissionState.grants,
      permissionState.verified,
      false,
      requestedDatabase,
    );
    return result([requestedDatabase], {
      scopedDatabase: requestedDatabase,
      databaseScope: "explicit",
      isFreeSharedHosting: false,
      databaseCapabilityVerified: permissionState.verified,
      databaseDiscoveryVerified: false,
      capabilities,
      requestedDatabase,
      diagnostics: discoveryDiagnostics(),
    });
  }

  // Some ordinary users cannot call ListDatabases but can call the server's
  // authorized-database listing. An empty response is valid and remains empty.
  const databases = await client.listMyDatabases();
  const capabilities = buildCapabilities(
    permissionState.grants,
    permissionState.verified,
    false,
    databases[0],
  );
  return result(databases, {
    scopedDatabase: databases[0],
    databaseScope: databases.length > 0 ? "explicit" : "unselected",
    isFreeSharedHosting: false,
    databaseCapabilityVerified: permissionState.verified,
    databaseDiscoveryVerified: true,
    capabilities,
    requestedDatabase,
    diagnostics: discoveryDiagnostics(),
  });
}
