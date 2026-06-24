export type UserRole = "admin" | "manager" | "worker";

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

export function canViewAudit(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canExportReports(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canCreateProduct(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canDeleteProduct(role: UserRole): boolean {
  return role === "admin";
}

export function canCreateProject(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canUpdateProject(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAddProjectMaterial(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (path.startsWith("/users")) return canManageUsers(role);
  if (path.startsWith("/audit")) return canViewAudit(role);
  if (path.startsWith("/reports")) return canExportReports(role);
  return true;
}

export function filterNavByRole<T extends { href: string }>(items: T[], role: UserRole | null): T[] {
  if (!role) return [];
  return items.filter((item) => canAccessRoute(role, item.href));
}
