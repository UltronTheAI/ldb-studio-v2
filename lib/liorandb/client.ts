import { LioranDBClient, type TransportResponseDiagnostics } from "@liorandb/driver";

export interface DiagnosticEvent {
  readonly durationMs: number;
  readonly transport: string;
  readonly operation: string;
  readonly ok: boolean;
  readonly statusCode: number | null;
  readonly requestId: string | null;
}

export async function createLioranClient(
  connectionUri: string,
  diagnostics?: DiagnosticEvent[],
): Promise<LioranDBClient> {
  const client = new LioranDBClient(connectionUri, {
    logoutOnClose: false,
  });

  client.setResponseObserver((event: TransportResponseDiagnostics) => {
    diagnostics?.push({
      durationMs: event.durationMS,
      transport: event.transport,
      operation: event.operation,
      ok: event.ok,
      statusCode: event.httpStatus ?? event.grpcStatusCode ?? null,
      requestId: event.requestId ?? null,
    });
  });

  await client.connect();
  return client;
}

export async function withLioranClient<T>(
  connectionUri: string,
  callback: (client: LioranDBClient, diagnostics: DiagnosticEvent[]) => Promise<T>,
): Promise<T> {
  const diagnostics: DiagnosticEvent[] = [];
  const client = await createLioranClient(connectionUri, diagnostics);

  try {
    return await callback(client, diagnostics);
  } finally {
    await client.close();
  }
}
