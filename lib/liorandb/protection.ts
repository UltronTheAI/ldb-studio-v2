/**
 * Protected system databases that cannot be dropped or deleted.
 */
export const PROTECTED_DATABASES: ReadonlySet<string> = new Set(["default"]);

/**
 * Checks whether a database name corresponds to a protected system database.
 */
export function isProtectedDatabase(name: string | null | undefined): boolean {
  if (!name) return false;
  return PROTECTED_DATABASES.has(name.trim().toLowerCase());
}
