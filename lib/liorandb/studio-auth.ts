import { withLioranClient } from "./client";
import { validateConnectionTarget } from "./connection";
import { mapStudioError, type StudioErrorDescriptor } from "./errors";
import type { StudioHandoffStage } from "./handoff";
import {
  createStudioSession,
  destroyStudioSession,
  getStudioSession,
} from "./session";

export interface StudioConnectionResult {
  readonly host: string;
  readonly database: string | null;
}

export class StudioAuthenticationError extends Error {
  readonly stage: Extract<StudioHandoffStage, "connection_uri_validation" | "grpc_connection" | "principal_authentication" | "studio_session_creation">;
  readonly code: string;
  readonly descriptor: StudioErrorDescriptor;

  constructor(
    stage: StudioAuthenticationError["stage"],
    code: string,
    message: string,
    descriptor?: StudioErrorDescriptor,
  ) {
    super(message);
    this.name = "StudioAuthenticationError";
    this.stage = stage;
    this.code = code;
    this.descriptor = {
      ...(descriptor ?? { title: "Connection failed", message, code }),
      title: stage === "principal_authentication"
        ? "LioranDB authentication failed"
        : stage === "grpc_connection"
          ? "LioranDB connection failed"
          : stage === "studio_session_creation"
            ? "Studio session could not be created"
            : "Invalid database connection",
      message,
      code,
      stage,
    };
  }
}

/**
 * Authenticates a connection URI and replaces the current Studio session only
 * after the new principal has been verified successfully.
 */
export async function establishStudioSession(connectionUri: string): Promise<StudioConnectionResult> {
  const rawUri = connectionUri.trim();
  if (!rawUri) {
    throw new StudioAuthenticationError(
      "connection_uri_validation",
      "CONNECTION_URI_INVALID",
      "Connection URI cannot be empty.",
    );
  }

  const existingSession = await getStudioSession();
  let metadata: ReturnType<typeof validateConnectionTarget>;
  try {
    metadata = validateConnectionTarget(rawUri);
  } catch (error) {
    const mapped = mapStudioError(error);
    throw new StudioAuthenticationError(
      "connection_uri_validation",
      "CONNECTION_URI_INVALID",
      "The database connection is invalid or unsupported.",
      mapped,
    );
  }

  let principal;
  try {
    principal = await withLioranClient(rawUri, async (client) => client.me());
  } catch (error) {
    const mapped = mapStudioError(error);
    const authenticationRejected =
      mapped.isAuthorizationError ||
      mapped.code === "AUTHENTICATION_FAILED" ||
      mapped.title.toLowerCase().includes("authentication");
    throw new StudioAuthenticationError(
      authenticationRejected ? "principal_authentication" : "grpc_connection",
      authenticationRejected ? "PRINCIPAL_AUTHENTICATION_FAILED" : "GRPC_CONNECTION_FAILED",
      authenticationRejected
        ? "The LioranDB credentials or database scope were rejected by the server."
        : "Studio could not connect to the LioranDB instance. Check its status and try again.",
      mapped,
    );
  }

  if (existingSession) {
    try {
      await withLioranClient(
        existingSession.connectionUri,
        async (client) => {
          try {
            await client.logout();
          } catch {
            // Best-effort logout of the previous database session.
          }
        },
        existingSession.id,
      );
    } catch {
      // A new authenticated session must not be discarded because an old
      // session's remote logout is unavailable.
    }
    await destroyStudioSession(existingSession.id);
  }

  try {
    await createStudioSession({ connectionUri: rawUri, principal, metadata });
  } catch (error) {
    const mapped = mapStudioError(error);
    throw new StudioAuthenticationError(
      "studio_session_creation",
      "STUDIO_SESSION_CREATION_FAILED",
      "LioranDB authentication succeeded, but Studio could not create its secure session.",
      mapped,
    );
  }
  return { host: metadata.host, database: metadata.database };
}
