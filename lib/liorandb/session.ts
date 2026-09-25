import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { cookies } from "next/headers";

import type { Principal } from "@liorandb/driver";
import type { SanitizedConnectionMetadata } from "./connection";

const COOKIE_NAME = "liorandb_studio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const KEY_SALT = "liorandb-studio-session";
const MAX_COOKIE_VALUE_BYTES = 3_800;

interface EncryptedValue {
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

interface CookieSessionRecord {
  readonly id: string;
  readonly connectionUri: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly principal: {
    readonly userId: string;
    readonly username: string;
    readonly roles: readonly string[];
    readonly mustChangePassword: boolean;
  };
  readonly metadata: SanitizedConnectionMetadata;
}

export interface StudioSession {
  readonly id: string;
  readonly connectionUri: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly principal: CookieSessionRecord["principal"];
  readonly metadata: SanitizedConnectionMetadata;
}

function getSecretKey(): Buffer {
  const secret = process.env.STUDIO_SESSION_SECRET?.trim();

  if (!secret || secret.trim().length < 16) {
    if (process.env.NODE_ENV !== "production") {
      return scryptSync(
        "liorandb-studio-development-session-secret",
        KEY_SALT,
        32,
      );
    }

    throw new Error(
      "STUDIO_SESSION_SECRET must be set to at least 16 characters before using Studio sessions.",
    );
  }

  return scryptSync(secret, KEY_SALT, 32);
}

function encrypt(text: string): EncryptedValue {
  const iv = randomBytes(12);
  const key = getSecretKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decrypt(value: EncryptedValue): string {
  const key = getSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

function cookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  };
}

function encodeCookieSession(record: CookieSessionRecord): string {
  const encrypted = encrypt(JSON.stringify(record));
  const value = Buffer.from(JSON.stringify(encrypted), "utf8").toString("base64url");

  if (Buffer.byteLength(value, "utf8") > MAX_COOKIE_VALUE_BYTES) {
    throw new Error(
      "Studio session is too large for cookie-based storage. Use a shorter connection URI.",
    );
  }

  return value;
}

function decodeCookieSession(value: string): CookieSessionRecord | null {
  try {
    const encrypted = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as EncryptedValue;
    const record = JSON.parse(decrypt(encrypted)) as CookieSessionRecord;

    if (
      !record
      || typeof record.id !== "string"
      || typeof record.connectionUri !== "string"
      || typeof record.createdAt !== "number"
      || typeof record.updatedAt !== "number"
      || typeof record.expiresAt !== "number"
    ) {
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

function studioSessionFromCookieRecord(record: CookieSessionRecord): StudioSession {
  return {
    id: record.id,
    connectionUri: record.connectionUri,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    principal: record.principal,
    metadata: record.metadata,
  };
}

async function writeCookieSession(record: CookieSessionRecord): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeCookieSession(record), cookieOptions(record.expiresAt));
}

export async function createStudioSession(input: {
  readonly connectionUri: string;
  readonly principal: Principal;
  readonly metadata: SanitizedConnectionMetadata;
}): Promise<void> {
  const id = randomBytes(32).toString("hex");
  const now = Date.now();
  const record: CookieSessionRecord = {
    id,
    connectionUri: input.connectionUri,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    principal: {
      userId: input.principal.user_id,
      username: input.principal.username,
      roles: input.principal.roles,
      mustChangePassword: input.principal.must_change_password,
    },
    metadata: input.metadata,
  };

  await writeCookieSession(record);
}

export async function getStudioSession(): Promise<StudioSession | null> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionValue) {
    return null;
  }

  const record = decodeCookieSession(sessionValue);
  if (!record || record.expiresAt <= Date.now()) {
    return null;
  }

  return studioSessionFromCookieRecord(record);
}

export async function refreshStudioSession(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  const record = value ? decodeCookieSession(value) : null;

  if (!record || record.id !== sessionId || record.expiresAt <= Date.now()) {
    try {
      cookieStore.delete(COOKIE_NAME);
    } catch {
      // Ignore cookie mutation errors outside action context
    }
    return;
  }

  await writeCookieSession({
    ...record,
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

export async function destroyStudioSession(sessionId?: string): Promise<void> {
  void sessionId;
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {
    // In Server Components (GET requests), cookies cannot be mutated.
  }
}
