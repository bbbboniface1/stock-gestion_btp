import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import {
  useCreateStockMovement, useListProducts, useListProjects, useGetMe,
  getListProductsQueryKey, getListStockMovementsQueryKey, getGetProductQueryKey,
  getGetDashboardSummaryQueryKey, getGetRecentMovementsQueryKey, getGetLowStockProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown } from "lucide-react";

const NONE_PROJECT = "__none__";

const schema = z.object({
  productId: z.coerce.number().min(1, "Produit requis"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().int("Quantité entière requise").min(1, "Quantité min 1"),
  reason: z.string().min(1, "Raison requise"),
  projectId: z.string().optional(),
});

interface Props {
  open: boolean;
  onClose: () => void;
  productId: number | null;
  productName: string | null;
  currentStock: number | null;
  initialType: "IN" | "OUT";
}

export default function MovementDialog({ open, onClose, productId, productName, currentStock, initialType }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: products } = useListProducts({ limit: 200 });
  const { data: projects } = useListProjects({});
  const { data: me } = useGetMe();
  const createMovement = useCreateStockMovement();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      productId: productId ?? 0,
      type: initialType,
      quantity: 1,
      reason: "",
      projectId: NONE_PROJECT,
    },
  });

  const watchType = form.watch("type");
  const watchProductId = form.watch("productId");
  const selectedProduct = products?.find(p => p.id === watchProductId);
  const effectiveStock = productId ? currentStock : selectedProduct?.quantityInStock;

  useEffect(() => {
    if (!open) return;
    form.reset({
      productId: productId ?? 0,
      type: initialType,
      quantity: 1,
      reason: "",
      projectId: NONE_PROJECT,
    });
  }, [open, productId, initialType, form]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (!me) { toast({ variant: "destructive", title: "Non authentifié" }); return; }
    if (values.type === "OUT" && effectiveStock != null && values.quantity > effectiveStock) {
      toast({
        variant: "destructive",
        title: `Stock insuffisant (disponible: ${effectiveStock})`,
      });
      return;
    }
    const resolvedProjectId = values.projectId && values.projectId !== NONE_PROJECT ? parseInt(values.projectId) : null;
    createMovement.mutate({
      data: {
        productId: values.productId,
        type: values.type,
        quantity: values.quantity,
        reason: values.reason,
        projectId: resolvedProjectId,
        createdById: me.id,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLowStockProductsQueryKey() });
        if (values.productId) {
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(values.productId) });
        }
        toast({ title: `Mouvement ${values.type} enregistré` });
        onClose();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: err?.data?.error ?? "Erreur lors de l'enregistrement" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wide flex items-center gap-2">
            {watchType === "IN" ? <ArrowUp className="h-5 w-5 text-green-500" /> : <ArrowDown className="h-5 w-5 text-orange-500" />}
            {watchType === "IN" ? "Entrée de Stock" : "Sortie de Stock"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem><FormLabel className="uppercase text-xs">Type de mouvement</FormLabel>
                <div className="flex gap-2">
                  <Button type="button" variant={field.value === "IN" ? "default" : "outline"}
                    className="flex-1 uppercase font-bold text-xs bg-green-500/15 border-green-500/30 text-green-500 hover:bg-green-500/25 data-[active=true]:bg-green-500 data-[active=true]:text-white"
                    data-active={field.value === "IN"} onClick={() => field.onChange("IN")} data-testid="button-type-in">
                    <ArrowUp className="h-4 w-4 mr-1" /> Entrée IN
                  </Button>
                  <Button type="button" variant={field.value === "OUT" ? "default" : "outline"}
                    className="flex-1 uppercase font-bold text-xs bg-orange-500/15 border-orange-500/30 text-orange-500 hover:bg-orange-500/25 data-[active=true]:bg-orange-500 data-[active=true]:text-white"
                    data-active={field.value === "OUT"} onClick={() => field.onChange("OUT")} data-testid="button-type-out">
                    <ArrowDown className="h-4 w-4 mr-1" /> Sortie OUT
                  </Button>
                </div>
                <FormMessage /></FormItem>
            )} />

            {!productId && (
              <FormField control={form.control} name="productId" render={({ field }) => (
                <FormItem><FormLabel className="uppercase text-xs">Produit</FormLabel>
                  <Select
                    onValueChange={val => field.onChange(parseInt(val))}
                    value={field.value > 0 ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-background" data-testid="select-movement-product">
                        <SelectValue placeholder="Choisir un produit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products?.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} — {p.quantityInStock} {p.unit} dispo
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
            )}

            {productId && productName && (
              <div className="bg-muted/50 rounded-sm p-3 border border-border">
                <div className="text-xs text-muted-foreground uppercase">Produit sélectionné</div>
                <div className="font-bold">{productName}</div>
                {effectiveStock !== null && effectiveStock !== undefined && (
                  <div className="text-xs text-muted-foreground uppercase">Stock actuel : {effectiveStock}</div>
                )}
              </div>
            )}

            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem><FormLabel className="uppercase text-xs">Quantité</FormLabel>
                <FormControl>
                  <Input type="number" min={1} step={1} {...field} data-testid="input-movement-qty" className="bg-background font-mono text-lg" />
                </FormControl>
                {watchType === "OUT" && effectiveStock !== null && effectiveStock !== undefined && (
                  <div className="text-xs text-muted-foreground">Stock disponible : {effectiveStock}</div>
                )}
                <FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem><FormLabel className="uppercase text-xs">Raison / Description</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-movement-reason" placeholder="Ex: Livraison fournisseur, Chantier X..." className="bg-background" />
                </FormControl>
                <FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="projectId" render={({ field }) => (
              <FormItem><FormLabel className="uppercase text-xs">Projet (optionnel)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? NONE_PROJECT}>
                  <FormControl>
                    <SelectTrigger className="bg-background" data-testid="select-movement-project">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_PROJECT}>Aucun projet</SelectItem>
                    {projects?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select><FormMessage /></FormItem>
            )} />

            <Button type="submit" className="w-full uppercase font-bold" disabled={createMovement.isPending} data-testid="button-submit-movement">
              {createMovement.isPending ? "Enregistrement..." : "Enregistrer le mouvement"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
