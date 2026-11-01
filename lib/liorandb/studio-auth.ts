import { withLioranClient } from "./client";
import { validateConnectionTarget } from "./connection";
import {
  createStudioSession,
  destroyStudioSession,
  getStudioSession,
} from "./session";

export interface StudioConnectionResult {
  readonly host: string;
  readonly database: string | null;
}

/**
 * Authenticates a connection URI and replaces the current Studio session only
 * after the new principal has been verified successfully.
 */
export async function establishStudioSession(connectionUri: string): Promise<StudioConnectionResult> {
  const rawUri = connectionUri.trim();
  if (!rawUri) {
    throw new Error("Connection URI cannot be empty.");
  }

  const existingSession = await getStudioSession();
  const metadata = validateConnectionTarget(rawUri);
  const principal = await withLioranClient(rawUri, async (client) => client.me());

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

  await createStudioSession({ connectionUri: rawUri, principal, metadata });
  return { host: metadata.host, database: metadata.database };
}
