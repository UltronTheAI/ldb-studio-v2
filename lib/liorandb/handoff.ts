import { validateConnectionTarget } from "./connection";

const DEFAULT_DASHBOARD_ORIGIN = "https://app.liorandb.com";
const HANDOFF_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const HANDOFF_TIMEOUT_MS = 8_000;

export class StudioHandoffError extends Error {
  readonly code: "invalid" | "unavailable" | "expired" | "response";

  constructor(
    code: "invalid" | "unavailable" | "expired" | "response",
    message: string,
  ) {
    super(message);
    this.name = "StudioHandoffError";
    this.code = code;
  }
}

function dashboardHandoffEndpoint(): string {
  const configuredOrigin = process.env.LIORANDB_DASHBOARD_ORIGIN?.trim() || DEFAULT_DASHBOARD_ORIGIN;
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw new StudioHandoffError("unavailable", "Studio handoff is not configured correctly.");
  }

  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new StudioHandoffError("unavailable", "Studio handoff is not configured correctly.");
  }

  return new URL("/api/studio/handoff", origin).toString();
}

function validateHandoffToken(token: string): string {
  const normalized = token.trim();
  if (normalized.length > 128 || !HANDOFF_TOKEN_PATTERN.test(normalized)) {
    throw new StudioHandoffError("invalid", "This Studio handoff is invalid or has expired. Return to Dashboard and open Studio again.");
  }
  return normalized;
}

interface DashboardHandoffResponse {
  readonly connectionUri?: unknown;
  readonly databaseName?: unknown;
  readonly instanceId?: unknown;
  readonly error?: unknown;
}

/** Exchanges a Dashboard one-time handoff without exposing the URI to the browser. */
export async function exchangeStudioHandoff(token: string): Promise<{ connectionUri: string }> {
  const normalizedToken = validateHandoffToken(token);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HANDOFF_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(dashboardHandoffEndpoint(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: normalizedToken }),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new StudioHandoffError("unavailable", "Studio could not reach Dashboard to complete the handoff. Try again from Dashboard.");
    }

    const payload = (await response.json().catch(() => null)) as DashboardHandoffResponse | null;
    if (response.status === 401) {
      throw new StudioHandoffError("expired", "This Studio handoff is invalid or has expired. Return to Dashboard and open Studio again.");
    }
    if (response.status === 409) {
      throw new StudioHandoffError("unavailable", "The assigned database connection is no longer available. Return to Dashboard and try again.");
    }
    if (!response.ok) {
      throw new StudioHandoffError("unavailable", "Dashboard could not complete the Studio handoff. Return to Dashboard and try again.");
    }

    if (
      !payload ||
      typeof payload.connectionUri !== "string" ||
      payload.connectionUri.length === 0 ||
      typeof payload.databaseName !== "string" ||
      payload.databaseName.length === 0 ||
      typeof payload.instanceId !== "string" ||
      payload.instanceId.length === 0
    ) {
      throw new StudioHandoffError("response", "Dashboard returned an invalid Studio handoff response.");
    }

    try {
      validateConnectionTarget(payload.connectionUri);
    } catch {
      throw new StudioHandoffError("response", "Dashboard returned an invalid database connection.");
    }

    return { connectionUri: payload.connectionUri };
  } finally {
    clearTimeout(timeout);
  }
}
