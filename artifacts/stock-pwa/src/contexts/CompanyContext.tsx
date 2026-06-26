import { createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
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

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const { data } = useQuery<CompanySettings>({
    queryKey: COMPANY_QUERY_KEY,
    queryFn: () => customFetch<CompanySettings>("/api/company-settings"),
    staleTime: 5 * 60_000,
    enabled: !!token,
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanySettingsInput) =>
      customFetch<CompanySettings>("/api/company-settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(COMPANY_QUERY_KEY, updated);
    },
  });
}
