import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { db, revokedTokensTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.trim() === "") {
  console.error("[FATAL] SESSION_SECRET env variable is required but not set or empty. Refusing to start.");
  process.exit(1);
}

export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

function legacyHash(password: string): string {
  return crypto.createHash("sha256").update(password + "stockbtp_salt").digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$2")) {
    return bcryptjs.compare(password, hash);
  }
  return legacyHash(password) === hash;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getTokenExpiry(token: string): Date | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const issuedAtMs = parseInt(parts[2], 10);
    if (isNaN(issuedAtMs)) return null;
    return new Date(issuedAtMs + TOKEN_TTL_MS);
  } catch {
    return null;
  }
}

export async function revokeToken(token: string): Promise<void> {
  const expiresAt = getTokenExpiry(token);
  if (!expiresAt) return;

  await db
    .insert(revokedTokensTable)
    .values({ tokenHash: hashToken(token), expiresAt })
    .onConflictDoNothing();
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  await db.delete(revokedTokensTable).where(lt(revokedTokensTable.expiresAt, new Date()));

  const [row] = await db
    .select({ tokenHash: revokedTokensTable.tokenHash })
    .from(revokedTokensTable)
    .where(eq(revokedTokensTable.tokenHash, hashToken(token)));

  return !!row;
}

export function generateToken(userId: number, role: string): string {
  const payload = `${userId}:${role}:${Date.now()}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET!).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [userId, role, issuedAt, signature] = parts;

    const issuedAtMs = parseInt(issuedAt, 10);
    if (isNaN(issuedAtMs) || Date.now() - issuedAtMs > TOKEN_TTL_MS) return null;

    const payload = `${userId}:${role}:${issuedAt}`;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET!).update(payload).digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    return { userId: parseInt(userId, 10), role };
  } catch {
    return null;
  }
}
