import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  ConnectionError,
  ConflictError,
  DnsResolutionError,
  DuplicateKeyError,
  LioranDriverError,
  NetworkError,
  NotFoundError,
  PasswordChangeRequiredError,
  RequestAbortedError,
  ServerNotReadyError,
  ServerOverloadedError,
  ServerUnavailableError,
  SessionExpiredError,
  TimeoutError,
  TlsError,
  ValidationError,
} from "@liorandb/driver";

export interface StudioErrorDescriptor {
  readonly title: string;
  readonly message: string;
  readonly code: string;
  readonly shouldClearSession?: boolean;
  readonly isAuthorizationError?: boolean;
}

function redactMessage(message: string): string {
  return message.replace(/:\/\/([^:@]+):([^@]+)@/g, "://$1:***@");
}

export function mapStudioError(error: unknown): StudioErrorDescriptor {
  if (
    error instanceof ApiError &&
    error.serverCode?.toUpperCase() === "STORAGE" &&
    error.message.toLowerCase().includes("collection has been dropped")
  ) {
    return {
      title: "Dropped collection cannot be recreated yet",
      message:
        "The server still treats this collection name as dropped. Use a different collection name, or recreate the database before reusing the same name.",
      code: error.serverCode,
    };
  }

  if (
    error instanceof ApiError &&
    error.serverCode === "DATABASE_CREATE_UNSUPPORTED"
  ) {
    return {
      title: "Database creation unsupported",
      message:
        "This LioranDB server currently rejects database creation through the public API.",
      code: error.serverCode,
    };
  }

  if (
    error instanceof ApiError &&
    error.serverCode === "DATABASE_DROP_UNSUPPORTED"
  ) {
    return {
      title: "Database deletion unsupported",
      message:
        "This LioranDB server currently rejects database deletion through the public API.",
      code: error.serverCode,
    };
  }

  if (error instanceof PasswordChangeRequiredError) {
    return {
      title: "Password change required",
      message: "The server requires this account to change its password before continuing.",
      code: error.code,
    };
  }

  if (error instanceof SessionExpiredError) {
    return {
      title: "Session expired",
      message: "The LioranDB session expired. Please reconnect.",
      code: error.code,
      shouldClearSession: true,
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      title: "Authentication failure",
      message: "The connection URI was rejected by the server.",
      code: error.code,
      shouldClearSession: true,
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      title: "Permission denied",
      message: "Your account is connected, but this action is not allowed for the current principal.",
      code: error.code,
      isAuthorizationError: true,
    };
  }

  if (error instanceof TlsError) {
    return {
      title: "TLS failure",
      message: "The server TLS configuration could not be negotiated.",
      code: error.code,
    };
  }

  if (error instanceof DnsResolutionError) {
    return {
      title: "DNS resolution failure",
      message: "The server hostname could not be resolved.",
      code: error.code,
    };
  }

  if (error instanceof TimeoutError) {
    return {
      title: "Timeout",
      message: "The request did not finish before the configured timeout.",
      code: error.code,
    };
  }

  if (error instanceof RequestAbortedError) {
    return {
      title: "Request cancelled",
      message: "The request was aborted before the server completed it.",
      code: error.code,
    };
  }

  if (error instanceof DuplicateKeyError) {
    return {
      title: "Duplicate key",
      message: "The write could not be applied because it would create a duplicate key.",
      code: error.code,
    };
  }

  if (error instanceof ConflictError) {
    return {
      title: "Conflict",
      message: "The server rejected the change because it conflicts with the current state.",
      code: error.code,
    };
  }

  if (error instanceof ValidationError || error instanceof ConfigurationError) {
    return {
      title: "Validation error",
      message: redactMessage(error.message),
      code: error.code,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      title: "Not found",
      message: redactMessage(error.message),
      code: error.code,
    };
  }

  if (
    error instanceof ServerUnavailableError ||
    error instanceof ServerOverloadedError ||
    error instanceof ServerNotReadyError
  ) {
    return {
      title: "Server unavailable",
      message: redactMessage(error.message),
      code: error.code,
    };
  }

  if (error instanceof ConnectionError || error instanceof NetworkError) {
    return {
      title: "Connection failure",
      message: redactMessage(error.message),
      code: error.code,
    };
  }

  if (error instanceof ApiError || error instanceof LioranDriverError) {
    return {
      title: "Driver error",
      message:
        error instanceof ApiError && error.serverCode
          ? `${redactMessage(error.message)} (${error.serverCode})`
          : redactMessage(error.message),
      code: error instanceof ApiError && error.serverCode ? error.serverCode : error.code,
    };
  }

  if (error instanceof Error) {
    return {
      title: "Unexpected error",
      message: redactMessage(error.message),
      code: "UNKNOWN",
    };
  }

  return {
    title: "Unexpected error",
    message: "The operation failed for an unknown reason.",
    code: "UNKNOWN",
  };
}
