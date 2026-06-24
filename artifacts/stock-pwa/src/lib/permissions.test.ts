import { describe, it, expect } from "vitest";
import {
  canManageUsers,
  canViewAudit,
  canExportReports,
  canCreateProduct,
  canDeleteProduct,
  canCreateProject,
  canUpdateProject,
  canAddProjectMaterial,
  canAccessRoute,
  filterNavByRole,
} from "./permissions";

describe("permissions", () => {
  it("admin has full access", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canViewAudit("admin")).toBe(true);
    expect(canExportReports("admin")).toBe(true);
    expect(canCreateProduct("admin")).toBe(true);
    expect(canDeleteProduct("admin")).toBe(true);
    expect(canCreateProject("admin")).toBe(true);
    expect(canAccessRoute("admin", "/users")).toBe(true);
  });

  it("manager can manage stock but not users", () => {
    expect(canManageUsers("manager")).toBe(false);
    expect(canViewAudit("manager")).toBe(true);
    expect(canExportReports("manager")).toBe(true);
    expect(canCreateProduct("manager")).toBe(true);
    expect(canDeleteProduct("manager")).toBe(false);
    expect(canCreateProject("manager")).toBe(true);
    expect(canAccessRoute("manager", "/users")).toBe(false);
    expect(canAccessRoute("manager", "/products")).toBe(true);
  });

  it("worker has read-only product/project access", () => {
    expect(canManageUsers("worker")).toBe(false);
    expect(canViewAudit("worker")).toBe(false);
    expect(canExportReports("worker")).toBe(false);
    expect(canCreateProduct("worker")).toBe(false);
    expect(canDeleteProduct("worker")).toBe(false);
    expect(canCreateProject("worker")).toBe(false);
    expect(canUpdateProject("worker")).toBe(false);
    expect(canAddProjectMaterial("worker")).toBe(false);
    expect(canAccessRoute("worker", "/movements")).toBe(true);
    expect(canAccessRoute("worker", "/audit")).toBe(false);
    expect(canAccessRoute("worker", "/reports")).toBe(false);
  });

  it("filterNavByRole hides restricted pages by role", () => {
    const nav = [
      { href: "/", name: "Dashboard" },
      { href: "/audit", name: "Traçabilité" },
      { href: "/reports", name: "Rapports" },
      { href: "/users", name: "Utilisateurs" },
    ];
    expect(filterNavByRole(nav, "admin")).toHaveLength(4);
    expect(filterNavByRole(nav, "manager").map((item) => item.href)).toEqual(["/", "/audit", "/reports"]);
    expect(filterNavByRole(nav, "worker")).toHaveLength(1);
    expect(filterNavByRole(nav, null)).toHaveLength(0);
  });
});
