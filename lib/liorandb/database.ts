import { withLioranClient } from "./client";

/**
 * Creates a database using the gRPC transport exclusively.
 * Database operations strictly communicate over gRPC with zero HTTP fallback.
 */
export async function createDatabaseWithDriver(
  connectionUri: string,
  name: string,
): Promise<void> {
  await withLioranClient(connectionUri, async (client) => {
    await client.createDatabase(name);
  });
}

/**
 * Backwards compatibility alias for createDatabaseWithDriver.
 * Database operations strictly communicate over gRPC with zero HTTP fallback.
 */
export const createDatabaseWithDriverFallback = createDatabaseWithDriver;

export { PROTECTED_DATABASES, isProtectedDatabase } from "./protection";

