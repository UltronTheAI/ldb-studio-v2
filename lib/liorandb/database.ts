import {
  ApiError,
  LioranDBClient,
  parseConnectionString,
} from "@liorandb/driver";

interface Envelope<T> {
  readonly request_id?: string;
  readonly data: T | null;
  readonly error: {
    readonly code?: string;
    readonly message?: string;
  } | null;
}

function isPublishedCreateDatabaseBug(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.method === "POST" &&
    error.path === "/v1/databases" &&
    error.serverCode === "INVALID_JSON"
  );
}

async function fetchEnvelope<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  method: string,
  path: string,
): Promise<T> {
  const response = await fetch(input, init);
  const envelope = (await response.json()) as Envelope<T>;

  if (!response.ok || envelope.error) {
    throw new ApiError(
      envelope.error?.message ?? `${method} ${path} failed.`,
      {
        status: response.status,
        method,
        path,
        serverCode: envelope.error?.code,
        requestId: envelope.request_id,
      },
    );
  }

  return envelope.data as T;
}

async function createDatabaseViaHttpFallback(
  connectionUri: string,
  name: string,
): Promise<void> {
  const parsed = parseConnectionString(connectionUri);
  const username = parsed.username;
  const password = parsed.password;
  const baseUrl = parsed.baseUrl;

  if (!username || !password || !baseUrl) {
    throw new Error(
      "Database creation fallback requires an HTTP-capable connection URI with username and password.",
    );
  }

  const login = await fetchEnvelope<{
    readonly access_token: string;
  }>(
    new URL("/v1/auth/login", baseUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    },
    "POST",
    "/v1/auth/login",
  );

  try {
    await fetchEnvelope<{ readonly database: string }>(
      new URL("/v1/databases", baseUrl),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${login.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name }),
      },
      "POST",
      "/v1/databases",
    );
  } finally {
    await fetch(new URL("/v1/auth/logout", baseUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${login.access_token}`,
      },
    }).catch(() => undefined);
  }
}

export async function createDatabaseWithDriverFallback(
  connectionUri: string,
  name: string,
): Promise<void> {
  const client = new LioranDBClient(connectionUri, {
    logoutOnClose: false,
  });

  try {
    await client.connect();
    try {
      await client.createDatabase(name);
      return;
    } catch (error) {
      if (!isPublishedCreateDatabaseBug(error)) {
        throw error;
      }
    }
  } finally {
    await client.close().catch(() => undefined);
  }

  await createDatabaseViaHttpFallback(connectionUri, name);
}
