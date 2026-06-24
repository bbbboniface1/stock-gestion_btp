import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  position: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  date: string;
  status: "draft" | "unpaid" | "paid";
  notes: string | null;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface CreateInvoiceItemInput {
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceInput {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  date: string;
  status?: "draft" | "unpaid" | "paid";
  notes?: string;
  taxRate?: number;
  items: CreateInvoiceItemInput[];
}

async function apiFetch<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const INVOICES_KEY = ["/api/invoices"];
export const invoiceKey = (id: number) => ["/api/invoices", id];

export function useListInvoices() {
  const { token } = useAuthStore();
  return useQuery<Invoice[]>({
    queryKey: INVOICES_KEY,
    queryFn: () => apiFetch<Invoice[]>("/api/invoices", token),
    enabled: !!token,
  });
}

export function useGetInvoice(id: number) {
  const { token } = useAuthStore();
  return useQuery<InvoiceWithItems>({
    queryKey: invoiceKey(id),
    queryFn: () => apiFetch<InvoiceWithItems>(`/api/invoices/${id}`, token),
    enabled: !!token && !!id,
  });
}

export function useCreateInvoice() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) =>
      apiFetch<InvoiceWithItems>("/api/invoices", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const { token } = useAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "draft" | "unpaid" | "paid" }) =>
      apiFetch<Invoice>(`/api/invoices/${id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
      qc.invalidateQueries({ queryKey: invoiceKey(id) });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    },
  });
}
