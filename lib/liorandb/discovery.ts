import { LioranDBClient, type Principal } from "@liorandb/driver";

export type DatabaseScope = "explicit" | "allocated" | "cluster" | "unselected";

export interface DatabaseResolution {
  readonly databases: string[];
  readonly scopedDatabase?: string;
  readonly databaseScope: DatabaseScope;
  readonly databaseDiscoveryVerified: boolean;
  readonly clusterAdministrationVerified: boolean;
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

/**
 * Resolves database context using only APIs exposed by the installed official
 * driver. The server owns tenant namespace mapping: names returned by
 * listDatabases are authoritative logical names and are passed through as-is.
 */
export async function resolveDatabaseContext(
  client: LioranDBClient,
  explicitDatabase?: string,
): Promise<DatabaseResolution> {
  const requestedDatabase = explicitDatabase?.trim();
  const principal = await getPrincipal(client);
  const tenantScoped = isTenantPrincipal(principal);
  const clusterAdministrationVerified = isClusterAdministrator(principal);

  if (requestedDatabase) {
    await client.db(requestedDatabase).listCollections();
    if (tenantScoped) {
      try {
        const databases = await client.listDatabases();
        return {
          databases: [...databases],
          scopedDatabase: requestedDatabase,
          databaseScope: "allocated",
          databaseDiscoveryVerified: true,
          clusterAdministrationVerified,
        };
      } catch {
        // Older tenant-aware servers may validate an explicit database but
        // not expose tenant-scoped listing yet. Keep that authorized context.
      }
    }
    return {
      databases: [requestedDatabase],
      scopedDatabase: requestedDatabase,
      databaseScope: tenantScoped ? "allocated" : "explicit",
      databaseDiscoveryVerified: false,
      clusterAdministrationVerified,
    };
  }

  const databases = await client.listDatabases();
  return {
    databases: [...databases],
    scopedDatabase: databases[0],
    databaseScope: tenantScoped ? "allocated" : "cluster",
    databaseDiscoveryVerified: true,
    clusterAdministrationVerified,
  };
}
