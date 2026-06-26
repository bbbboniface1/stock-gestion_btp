import { Redirect } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { canAccessRoute } from "@/lib/permissions";

export function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { token, user } = useAuthStore();

  if (token && !user) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse font-mono uppercase text-sm">
        Vérification des droits...
      </div>
    );
  }

  if (!user || !canAccessRoute(user.role, path)) {
    return <Redirect to="/" />;
  }

  return <>{children}</>;
}
