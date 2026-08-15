import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { cookies } from "next/headers";

import type { Principal } from "@liorandb/driver";

import type { SanitizedConnectionMetadata } from "./connection";

const COOKIE_NAME = "liorandb_studio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_DIR = path.join(process.cwd(), ".sessions");
const KEY_SALT = "liorandb-studio-session";

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
  const secret = process.env.STUDIO_SESSION_SECRET;

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
  const record: SessionRecord = {
    id,
    encryptedConnectionUri: encrypt(input.connectionUri),
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

  await writeSessionRecord(record);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(record.expiresAt),
  });
}

export async function getStudioSession(): Promise<StudioSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;

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
  cookieStore.set(COOKIE_NAME, refreshedRecord.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(refreshedRecord.expiresAt),
  });
}

export async function destroyStudioSession(sessionId?: string): Promise<void> {
  const cookieStore = await cookies();
  const resolvedId = sessionId ?? cookieStore.get(COOKIE_NAME)?.value;

  cookieStore.delete(COOKIE_NAME);

  if (!resolvedId) {
    return;
  }

  await rm(sessionFile(resolvedId), { force: true });
}
