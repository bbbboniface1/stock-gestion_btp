import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "stockbtp_salt").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function generateToken(userId: number, role: string): string {
  const payload = `${userId}:${role}:${Date.now()}`;
  const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET || "fallback_secret").update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [userId, role, , signature] = parts;
    const payload = `${userId}:${role}:${parts[2]}`;
    const expectedSig = crypto.createHmac("sha256", process.env.SESSION_SECRET || "fallback_secret").update(payload).digest("hex");
    if (signature !== expectedSig) return null;
    return { userId: parseInt(userId, 10), role };
  } catch {
    return null;
  }
}
