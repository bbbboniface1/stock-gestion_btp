import { useEffect } from "react";
import { useGetMe, ApiError } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { token, setUser, logout } = useAuthStore();
  const { data, error, isError } = useGetMe({ query: { enabled: !!token, retry: false } as any });

  useEffect(() => {
    if (data) setUser(data as Parameters<typeof setUser>[0]);
  }, [data, setUser]);

  useEffect(() => {
    if (!isError || !token) return;
    const status = error instanceof ApiError ? error.status : undefined;
    if (status === 401) logout();
  }, [isError, error, token, logout]);

  return <>{children}</>;
}
