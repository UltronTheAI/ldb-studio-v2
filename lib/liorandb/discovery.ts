import { LioranDBClient, NotFoundError } from "@liorandb/driver";

export type DatabaseScope = "explicit" | "allocated" | "cluster" | "unselected";

export interface TenantAllocation {
  readonly tenantId: string;
  readonly databaseName: string;
  readonly status?: string;
  readonly storageQuotaBytes?: number;
  readonly storageUsedBytes?: number;
  readonly remainingStorageBytes?: number;
}

export interface DatabaseResolution {
  readonly databases: string[];
  readonly scopedDatabase?: string;
  readonly databaseScope: DatabaseScope;
  readonly databaseDiscoveryVerified: boolean;
}

interface AllocationAwareClient extends LioranDBClient {
  /** Added by the driver release that supports DatabaseService/GetMyAllocation. */
  readonly getMyAllocation?: () => Promise<unknown>;
}

function allocationMethod(client: LioranDBClient): (() => Promise<unknown>) | null {
  const candidate = client as AllocationAwareClient;
  return typeof candidate.getMyAllocation === "function"
    ? candidate.getMyAllocation.bind(client)
    : null;
}

function isAllocationResponse(value: unknown): value is TenantAllocation {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.tenantId === "string" &&
    record.tenantId.length > 0 &&
    typeof record.databaseName === "string" &&
    /^[A-Za-z0-9_.-]+$/.test(record.databaseName)
  );
}

function isAllocationEndpointUnavailable(error: unknown): boolean {
  if (error instanceof NotFoundError) return true;
  const details = error as Record<string, unknown>;
  return (
    details.serverCode === "UNIMPLEMENTED" ||
    details.grpcStatusName === "UNIMPLEMENTED" ||
    details.grpcStatusCode === 12
  );
}

/**
 * Resolves the safest database context for the authenticated principal.
 *
 * An explicit URI database is validated directly. When the installed driver
 * supports GetMyAllocation, that tenant-scoped result is used and no
 * cluster-wide list is attempted. Older drivers/servers retain the existing
 * listDatabases fallback for administrators and local development.
 */
export async function resolveDatabaseContext(
  client: LioranDBClient,
  explicitDatabase?: string,
): Promise<DatabaseResolution> {
  const requestedDatabase = explicitDatabase?.trim();
  if (requestedDatabase) {
    await client.db(requestedDatabase).listCollections();
    return {
      databases: [requestedDatabase],
      scopedDatabase: requestedDatabase,
      databaseScope: "explicit",
      databaseDiscoveryVerified: false,
    };
  }

  const getMyAllocation = allocationMethod(client);
  if (getMyAllocation) {
    try {
      const allocation = await getMyAllocation();
      if (isAllocationResponse(allocation)) {
        return {
          databases: [allocation.databaseName],
          scopedDatabase: allocation.databaseName,
          databaseScope: "allocated",
          databaseDiscoveryVerified: false,
        };
      }
    } catch (error) {
      // Dedicated servers and older servers may legitimately return not found
      // or unimplemented. Only those cases fall through to admin discovery;
      // authorization errors remain authorization errors.
      if (!isAllocationEndpointUnavailable(error)) {
        throw error;
      }
    }
  }

  const databases = await client.listDatabases();
  return {
    databases: [...databases],
    databaseScope: "cluster",
    databaseDiscoveryVerified: true,
  };
}
