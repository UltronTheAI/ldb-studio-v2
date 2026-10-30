export interface StudioCacheScope {
  readonly principalId: string;
  readonly host: string;
  readonly port: number | string;
  readonly database?: string;
}

export function createStudioCacheScopeKey(scope: StudioCacheScope): string {
  return [scope.principalId, scope.host, scope.port, scope.database ?? "*"].join("|");
}

export function studioQueryKey(
  scope: StudioCacheScope,
  operation: string,
  parts: readonly unknown[] = [],
): string {
  return JSON.stringify([createStudioCacheScopeKey(scope), operation, ...parts]);
}

export function collectionQueryPrefix(scope: StudioCacheScope, database: string, collection: string): string {
  return studioQueryKey(scope, "collection", [database, collection]);
}
