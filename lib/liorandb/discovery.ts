import { LioranDBClient, type Principal, type TenantAllocation } from "@liorandb/driver";
import { AssignedDatabaseUnavailableError } from "./errors";

export type DatabaseScope = "explicit" | "allocated" | "cluster" | "unselected";

export interface DatabaseResolution {
  readonly databases: string[];
  readonly scopedDatabase?: string;
  readonly databaseScope: DatabaseScope;
  readonly isFreeSharedHosting: boolean;
  readonly databaseCapabilityVerified: boolean;
  readonly databaseDiscoveryVerified: boolean;
  readonly clusterAdministrationVerified: boolean;
  readonly databaseManagementAllowed: boolean;
}

function isTenantPrincipal(principal: Principal | undefined): boolean {
  return Boolean(principal?.roles.some((role) => role.startsWith("tenant_role:")));
}

function isClusterAdministrator(principal: Principal | undefined): boolean {
  return Boolean(principal?.roles.includes("admin"));
}

async function getPrincipal(client: LioranDBClient): Promise<Principal | undefined> {
  try {
    return await client.me();
  } catch {
    // Older/dedicated servers can still validate an explicit database or
    // authorize listDatabases even when the principal endpoint is unavailable.
    return undefined;
  }
}

async function getTenantAllocation(
  client: LioranDBClient,
): Promise<TenantAllocation | undefined> {
  try {
    return await client.getMyAllocation();
  } catch {
    // Older tenant-aware servers may expose ListMyDatabases without the
    // allocation metadata endpoint. Keep the tenant role as the safe
    // restriction and use the tenant-scoped list API below.
    return undefined;
  }
}

async function listTenantDatabases(
  client: LioranDBClient,
  allocation?: TenantAllocation,
): Promise<string[]> {
  if (allocation) return [...allocation.databases];
  return [...(await client.listMyDatabases())];
}

/**
 * Resolves database context using only APIs exposed by the installed official
 * driver. The server owns tenant namespace mapping: names returned by
 * listMyDatabases/getMyAllocation are authoritative logical names for tenant
 * principals. Dedicated connections retain cluster listDatabases discovery.
 */
export async function resolveDatabaseContext(
  client: LioranDBClient,
  explicitDatabase?: string,
): Promise<DatabaseResolution> {
  const requestedDatabase = explicitDatabase?.trim();
  const principal = await getPrincipal(client);
  const allocation = await getTenantAllocation(client);
  const tenantScoped = Boolean(allocation) || isTenantPrincipal(principal);
  const databaseCapabilityVerified = principal !== undefined;
  const clusterAdministrationVerified = isClusterAdministrator(principal);
  const databaseManagementAllowed = allocation?.databaseManagementAllowed ?? !tenantScoped;

  if (requestedDatabase) {
    if (tenantScoped) {
      try {
        const databases = await listTenantDatabases(client, allocation);
        if (!databases.includes(requestedDatabase)) {
          // A URI database is an explicit logical scope. Do not silently
          // replace an unauthorized or stale scope with another allocation
          // database; ask the server to validate the requested logical name.
          await client.db(requestedDatabase).listCollections();
        }
        return {
          databases: [...databases],
          scopedDatabase: requestedDatabase,
          databaseScope: "allocated",
          isFreeSharedHosting: true,
          databaseCapabilityVerified,
          databaseDiscoveryVerified: true,
          clusterAdministrationVerified,
          databaseManagementAllowed,
        };
      } catch {
        // Older tenant-aware servers may validate an explicit database but
        // not expose tenant-scoped listing yet. Validate that explicit scope
        // directly as a compatibility fallback.
        await client.db(requestedDatabase).listCollections();
      }
    } else {
      await client.db(requestedDatabase).listCollections();
    }
    return {
      databases: [requestedDatabase],
      scopedDatabase: requestedDatabase,
      databaseScope: tenantScoped ? "allocated" : "explicit",
      isFreeSharedHosting: tenantScoped,
      databaseCapabilityVerified,
      databaseDiscoveryVerified: false,
      clusterAdministrationVerified,
      databaseManagementAllowed,
    };
  }

  if (tenantScoped) {
    const databases = await listTenantDatabases(client, allocation);
    if (databases.length === 0) {
      throw new AssignedDatabaseUnavailableError();
    }
    return {
      databases,
      scopedDatabase: databases[0],
      databaseScope: "allocated",
      isFreeSharedHosting: true,
      databaseCapabilityVerified,
      databaseDiscoveryVerified: true,
      clusterAdministrationVerified,
      databaseManagementAllowed,
    };
  }

  const databases = await client.listDatabases();
  return {
    databases: [...databases],
    scopedDatabase: databases[0],
    databaseScope: tenantScoped ? "allocated" : "cluster",
    isFreeSharedHosting: tenantScoped,
    databaseCapabilityVerified,
    databaseDiscoveryVerified: true,
    clusterAdministrationVerified,
    databaseManagementAllowed,
  };
}
