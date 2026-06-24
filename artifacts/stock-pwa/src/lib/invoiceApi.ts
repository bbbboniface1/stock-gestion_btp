import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

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

export const INVOICES_KEY = ["/api/invoices"];
export const invoiceKey = (id: number) => ["/api/invoices", id];

export function useListInvoices() {
  return useQuery<Invoice[]>({
    queryKey: INVOICES_KEY,
    queryFn: () => customFetch<Invoice[]>("/api/invoices"),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "draft" | "unpaid" | "paid" }) =>
      customFetch<Invoice>(`/api/invoices/${id}/status`, {
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
