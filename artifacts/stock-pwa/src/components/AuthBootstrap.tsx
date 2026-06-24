import { useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { token, setUser, logout } = useAuthStore();
  const { data, isError } = useGetMe({ query: { enabled: !!token, retry: false } as any });

  useEffect(() => {
    if (data) setUser(data as Parameters<typeof setUser>[0]);
  }, [data, setUser]);

  useEffect(() => {
    if (isError && token) logout();
  }, [isError, token, logout]);

  return <>{children}</>;
}
