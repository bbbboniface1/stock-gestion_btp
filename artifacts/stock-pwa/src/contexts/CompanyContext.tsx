import { createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";

export interface CompanySettings {
  id: number;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  currency: string;
  signatureText: string | null;
  updatedAt: string;
}

export type CompanySettingsInput = Partial<Omit<CompanySettings, "id" | "updatedAt">>;

const COMPANY_QUERY_KEY = ["/api/company-settings"];

const CompanyContext = createContext<CompanySettings | null>(null);

async function apiFetch<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const { data } = useQuery<CompanySettings>({
    queryKey: COMPANY_QUERY_KEY,
    queryFn: () => apiFetch<CompanySettings>("/api/company-settings", token),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });

  return (
    <CompanyContext.Provider value={data ?? null}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

export function useUpdateCompany() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanySettingsInput) =>
      apiFetch<CompanySettings>("/api/company-settings", token, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(COMPANY_QUERY_KEY, updated);
    },
  });
}
