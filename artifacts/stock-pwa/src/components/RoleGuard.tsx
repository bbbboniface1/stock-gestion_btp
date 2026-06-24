import { Redirect } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { canAccessRoute } from "@/lib/permissions";

export function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  if (token && !user) return null;
  if (!user || !canAccessRoute(user.role, path)) {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}
