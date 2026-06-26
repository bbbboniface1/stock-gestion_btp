import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, ApiError } from "@workspace/api-client-react";

export interface InvoiceStockMovement {
  id: number;
  productId: number | null;
  productName: string | null;
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
  createdAt: string;
  reversedByMovementId: number | null;
}

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
  stockMovements?: InvoiceStockMovement[];
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

export type UpdateInvoiceInput = Omit<CreateInvoiceInput, "status">;

export const INVOICES_KEY = ["/api/invoices"];
export const invoiceKey = (id: number) => ["/api/invoices", id];

export function getInvoiceApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    if (data?.error) return data.error;
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function invalidateInvoiceQueries(qc: ReturnType<typeof useQueryClient>, id?: number) {
  qc.invalidateQueries({ queryKey: INVOICES_KEY });
  if (id) qc.invalidateQueries({ queryKey: invoiceKey(id) });
  qc.invalidateQueries({ queryKey: ["/api/products"] });
  qc.invalidateQueries({ queryKey: ["/api/stock-movements"] });
  qc.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
}

export function useListInvoices(status?: "draft" | "unpaid" | "paid") {
  const query = status ? `?status=${status}` : "";
  return useQuery<Invoice[]>({
    queryKey: status ? [...INVOICES_KEY, status] : INVOICES_KEY,
    queryFn: () => customFetch<Invoice[]>(`/api/invoices${query}`),
  });
}

export function useGetInvoice(id: number) {
  return useQuery<InvoiceWithItems>({
    queryKey: invoiceKey(id),
    queryFn: () => customFetch<InvoiceWithItems>(`/api/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) =>
      customFetch<InvoiceWithItems>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useUpdateInvoice(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInvoiceInput) =>
      customFetch<InvoiceWithItems>(`/api/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidateInvoiceQueries(qc, id),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "draft" | "unpaid" | "paid" }) =>
      customFetch<InvoiceWithItems>(`/api/invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { id }) => invalidateInvoiceQueries(qc, id),
  });
}
