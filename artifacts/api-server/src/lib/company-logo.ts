import dns from "node:dns/promises";
import net from "node:net";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

export type ResolvedLogo = {
  buffer: Buffer;
  format: "png" | "jpeg" | "webp" | "gif";
};

function parseDataUrlLogo(logoUrl: string): ResolvedLogo | null {
  const match = DATA_URL_PATTERN.exec(logoUrl.trim());
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) return null;

  const format = mime === "png"
    ? "png"
    : mime === "webp"
      ? "webp"
      : mime === "gif"
        ? "gif"
        : "jpeg";

  return { buffer, format };
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 0) return true;
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

async function isSafeRemoteLogoUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) return false;

  return addresses.every((entry) => !isPrivateIp(entry.address));
}

function contentTypeToFormat(contentType: string | null): ResolvedLogo["format"] | null {
  if (!contentType) return null;
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/jpeg" || type === "image/jpg") return "jpeg";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return null;
}

async function fetchRemoteLogo(rawUrl: string): Promise<ResolvedLogo | null> {
  if (!(await isSafeRemoteLogoUrl(rawUrl))) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif" },
    });

    if (!response.ok) return null;

    const format = contentTypeToFormat(response.headers.get("content-type"));
    if (!format) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_LOGO_BYTES) return null;

    return { buffer: Buffer.from(arrayBuffer), format };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveCompanyLogo(logoUrl: string | null | undefined): Promise<ResolvedLogo | null> {
  if (!logoUrl?.trim()) return null;

  const trimmed = logoUrl.trim();
  if (trimmed.startsWith("data:image/")) {
    return parseDataUrlLogo(trimmed);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return fetchRemoteLogo(trimmed);
  }

  return null;
}

export function isValidLogoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("data:image/")) {
    return DATA_URL_PATTERN.test(trimmed) && Buffer.from(trimmed.split(",")[1] ?? "", "base64").length <= MAX_LOGO_BYTES;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
