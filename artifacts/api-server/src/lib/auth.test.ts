import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { hashPassword, verifyPassword, generateToken, verifyToken } from "./auth";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-key";
});

describe("auth lib", () => {
  it("hashPassword produces consistent hashes", async () => {
    const hash = await hashPassword("admin123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await hashPassword("admin123")).not.toBe(hash); // bcrypt salts differ
  });

  it("verifyPassword validates correct and rejects wrong passwords", async () => {
    const hash = await hashPassword("manager123");
    expect(await verifyPassword("manager123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("generateToken and verifyToken round-trip", () => {
    const token = generateToken(1, "admin");
    const payload = verifyToken(token);
    expect(payload).toEqual({ userId: 1, role: "admin" });
  });

  it("verifyToken rejects tampered token", () => {
    const token = generateToken(2, "worker");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    parts[1] = "admin";
    const tampered = Buffer.from(parts.join(":")).toString("base64url");
    expect(verifyToken(tampered)).toBeNull();
  });

  it("verifyToken rejects invalid signature", () => {
    const payload = "1:admin:1234567890";
    const badSig = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");
    const token = Buffer.from(`${payload}:${badSig}`).toString("base64url");
    expect(verifyToken(token)).toBeNull();
  });
});
