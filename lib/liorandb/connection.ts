import { isIP } from "node:net";
import { parseConnectionString, type ImmutableMongoClientConfig } from "@liorandb/driver";
import { LocalTargetNotReachableError, ProhibitedTargetError } from "./errors";

export type ConnectionTargetType =
  | "local-loopback"
  | "cloud-metadata"
  | "private-network"
  | "remote";

export interface SanitizedConnectionMetadata {
  readonly host: string;
  readonly port: number;
  readonly database: string | null;
  readonly protocol: string;
  readonly tls: boolean;
  readonly transport: string;
  readonly targetType: ConnectionTargetType;
  readonly isLocal: boolean;
}

export function trimIpv6Brackets(host: string): string {
  if (host.startsWith("[") && host.endsWith("]")) {
    return host.slice(1, -1);
  }
  return host;
}

export function isLoopbackHost(hostname: string): boolean {
  const host = trimIpv6Brackets(hostname).toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    return true;
  }
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (host === "0.0.0.0" || host === "::") {
    return true;
  }
  if (isIP(host) === 4) {
    const [first] = host.split(".").map((n) => Number.parseInt(n, 10));
    return first === 127;
  }
  return false;
}

export function isCloudMetadataHost(hostname: string): boolean {
  const host = trimIpv6Brackets(hostname).toLowerCase();
  if (
    host === "169.254.169.254" ||
    host === "instance-data" ||
    host === "metadata.google.internal" ||
    host === "metadata.packet.net" ||
    host === "fd00:ec2::254"
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [first, second] = host.split(".").map((n) => Number.parseInt(n, 10));
    return first === 169 && second === 254;
  }
  if (ipVersion === 6) {
    return /^fe[89ab]/i.test(host);
  }

  return false;
}

export function isPrivateNetworkHost(hostname: string): boolean {
  const host = trimIpv6Brackets(hostname).toLowerCase();
  const ipVersion = isIP(host);

  if (ipVersion === 4) {
    const [first, second] = host.split(".").map((n) => Number.parseInt(n, 10));
    if (first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    return false;
  }

  if (ipVersion === 6) {
    return /^f[cd]/i.test(host);
  }

  return false;
}

export function classifyConnectionTarget(host: string): ConnectionTargetType {
  if (isLoopbackHost(host)) {
    return "local-loopback";
  }
  if (isCloudMetadataHost(host)) {
    return "cloud-metadata";
  }
  if (isPrivateNetworkHost(host)) {
    return "private-network";
  }
  return "remote";
}

export function isRemoteHostedEnvironment(): boolean {
  if (process.env.STUDIO_HOSTED === "1" || process.env.STUDIO_HOSTED === "true") {
    return true;
  }
  if (process.env.STUDIO_HOSTED === "0" || process.env.STUDIO_HOSTED === "false") {
    return false;
  }
  if (process.env.VERCEL === "1") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

export function shouldBlockLocalhostInCurrentEnvironment(): boolean {
  if (
    process.env.STUDIO_ALLOW_LOCAL_CONNECTION === "1" ||
    process.env.STUDIO_ALLOW_LOCAL_CONNECTION === "true"
  ) {
    return false;
  }
  return isRemoteHostedEnvironment();
}

export function sanitizeConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return connectionString.replace(/:\/\/([^:@\s]+):([^@\s]+)@/g, "://$1:***@");
  }
}

export function parseAndClassifyConnection(connectionUri: string): {
  parsed: ImmutableMongoClientConfig;
  targetType: ConnectionTargetType;
  isLocal: boolean;
} {
  const parsed = parseConnectionString(connectionUri);
  const targetType = classifyConnectionTarget(parsed.host);
  const isLocal = targetType === "local-loopback";

  return { parsed, targetType, isLocal };
}

export function getSanitizedConnectionMetadata(
  connectionUri: string,
): SanitizedConnectionMetadata {
  const { parsed, targetType, isLocal } = parseAndClassifyConnection(connectionUri);

  return {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database ?? null,
    protocol: parsed.scheme,
    tls: parsed.tls ?? false,
    transport: parsed.transport ?? "auto",
    targetType,
    isLocal,
  };
}

export function validateConnectionTarget(
  connectionUri: string,
  options?: { readonly allowLocal?: boolean },
): SanitizedConnectionMetadata {
  const metadata = getSanitizedConnectionMetadata(connectionUri);

  if (metadata.targetType === "cloud-metadata") {
    throw new ProhibitedTargetError(metadata.host);
  }

  const allowLocal = options?.allowLocal ?? !shouldBlockLocalhostInCurrentEnvironment();
  if (metadata.isLocal && !allowLocal) {
    throw new LocalTargetNotReachableError(metadata.host, metadata.port);
  }

  return metadata;
}
