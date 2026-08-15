import { parseConnectionString } from "@liorandb/driver";

export interface SanitizedConnectionMetadata {
  readonly host: string;
  readonly port: number;
  readonly database: string | null;
  readonly protocol: string;
  readonly tls: boolean;
  readonly transport: string;
}

export function getSanitizedConnectionMetadata(
  connectionUri: string,
): SanitizedConnectionMetadata {
  const parsed = parseConnectionString(connectionUri);

  return {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database ?? null,
    protocol: parsed.scheme,
    tls: parsed.tls ?? false,
    transport: parsed.transport ?? "auto",
  };
}
