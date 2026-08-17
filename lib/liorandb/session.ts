import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";

import type { Principal } from "@liorandb/driver";

import type { SanitizedConnectionMetadata } from "./connection";

const COOKIE_NAME = "liorandb_studio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_DIR = process.env.STUDIO_SESSION_DIR ?? path.join(process.cwd(), ".sessions");
const KEY_SALT = "liorandb-studio-session";
const MAX_COOKIE_VALUE_BYTES = 3_800;

interface EncryptedValue {
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

interface SessionRecord {
  readonly id: string;
  readonly encryptedConnectionUri: EncryptedValue;
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

interface CookieSessionRecord {
  readonly id: string;
  readonly connectionUri: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly principal: SessionRecord["principal"];
  readonly metadata: SanitizedConnectionMetadata;
}

export interface StudioSession {
  readonly id: string;
  readonly connectionUri: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
  readonly principal: SessionRecord["principal"];
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

function usesCookieSessionStore(): boolean {
  if (process.env.STUDIO_SESSION_STORE === "cookie") {
    return true;
  }

  if (process.env.STUDIO_SESSION_STORE === "filesystem") {
    return false;
  }

  // Vercel Functions have a read-only deployment filesystem, so session files
  // cannot be created there. The encrypted, HttpOnly cookie is stateless and
  // works across function invocations.
  return process.env.VERCEL === "1";
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
      "Studio session is too large for cookie-based storage. Use a shorter connection URI or configure a shared session store.",
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

function sessionFile(sessionId: string): string {
  return path.join(SESSION_DIR, `${sessionId}.json`);
}

async function ensureSessionDir(): Promise<void> {
  await mkdir(SESSION_DIR, { recursive: true });
}

async function writeSessionRecord(record: SessionRecord): Promise<void> {
  await ensureSessionDir();
  await writeFile(sessionFile(record.id), JSON.stringify(record, null, 2), "utf8");
}

async function readSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  try {
    const raw = await readFile(sessionFile(sessionId), "utf8");
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export async function createStudioSession(input: {
  readonly connectionUri: string;
  readonly principal: Principal;
  readonly metadata: SanitizedConnectionMetadata;
}): Promise<void> {
  const id = randomBytes(32).toString("hex");
  const now = Date.now();
  const baseRecord = {
    id,
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

  if (usesCookieSessionStore()) {
    await writeCookieSession({
      ...baseRecord,
      connectionUri: input.connectionUri,
    });
    return;
  }

  const record: SessionRecord = {
    ...baseRecord,
    encryptedConnectionUri: encrypt(input.connectionUri),
  };

  await writeSessionRecord(record);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, id, cookieOptions(record.expiresAt));
}

export async function getStudioSession(): Promise<StudioSession | null> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(COOKIE_NAME)?.value;

  if (usesCookieSessionStore()) {
    if (!sessionValue) {
      return null;
    }

    const record = decodeCookieSession(sessionValue);
    if (!record || record.expiresAt <= Date.now()) {
      cookieStore.delete(COOKIE_NAME);
      return null;
    }

    return studioSessionFromCookieRecord(record);
  }

  const sessionId = sessionValue;

  if (!sessionId) {
    return null;
  }

  const record = await readSessionRecord(sessionId);
  if (!record) {
    cookieStore.delete(COOKIE_NAME);
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    await destroyStudioSession(sessionId);
    return null;
  }

  return {
    id: record.id,
    connectionUri: decrypt(record.encryptedConnectionUri),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    principal: record.principal,
    metadata: record.metadata,
  };
}

export async function refreshStudioSession(sessionId: string): Promise<void> {
  if (usesCookieSessionStore()) {
    const cookieStore = await cookies();
    const value = cookieStore.get(COOKIE_NAME)?.value;
    const record = value ? decodeCookieSession(value) : null;

    if (!record || record.id !== sessionId || record.expiresAt <= Date.now()) {
      cookieStore.delete(COOKIE_NAME);
      return;
    }

    await writeCookieSession({
      ...record,
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return;
  }

  const record = await readSessionRecord(sessionId);
  if (!record || record.expiresAt <= Date.now()) {
    await destroyStudioSession(sessionId);
    return;
  }

  const refreshedRecord: SessionRecord = {
    ...record,
    updatedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  await writeSessionRecord(refreshedRecord);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, refreshedRecord.id, cookieOptions(refreshedRecord.expiresAt));
}

export async function destroyStudioSession(sessionId?: string): Promise<void> {
  const cookieStore = await cookies();
  const resolvedId = sessionId ?? cookieStore.get(COOKIE_NAME)?.value;

  cookieStore.delete(COOKIE_NAME);

  if (usesCookieSessionStore() || !resolvedId) {
    return;
  }

  await rm(sessionFile(resolvedId), { force: true });
}
