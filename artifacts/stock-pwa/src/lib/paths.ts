export function appBasePath(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export function appPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = appBasePath();
  return base ? `${base}${normalized}` : normalized;
}

export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}
