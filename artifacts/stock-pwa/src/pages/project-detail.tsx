import { useParams, useLocation } from "wouter";
import {
  useGetProject, useGetProjectMaterials, useUpdateProject, useAddProjectMaterial, useListProducts,
  getGetProjectQueryKey, getGetProjectMaterialsQueryKey, getListProjectsQueryKey,
  getListProductsQueryKey, getListStockMovementsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Package, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { useAuthStore } from "@/lib/auth";
import { canUpdateProject, canAddProjectMaterial } from "@/lib/permissions";

const materialSchema = z.object({
  productId: z.coerce.number().min(1, "Produit requis"),
  quantityUsed: z.coerce.number().min(1, "Quantité requise"),
});

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  completed: { label: "Terminé", className: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  paused: { label: "Suspendu", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
};

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const [openMaterial, setOpenMaterial] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = user ? canUpdateProject(user.role) : false;
  const canAddMaterial = user ? canAddProjectMaterial(user.role) : false;

  const { data: project, isLoading, isError, refetch } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) } });
  const { data: materials, isLoading: loadingMaterials } = useGetProjectMaterials(id, { query: { enabled: !!id, queryKey: getGetProjectMaterialsQueryKey(id) } });
  const { data: products } = useListProducts({});
  const updateProject = useUpdateProject();
  const addMaterial = useAddProjectMaterial();

  const form = useForm<z.infer<typeof materialSchema>>({
    resolver: zodResolver(materialSchema),
    defaultValues: { productId: 0, quantityUsed: 1 },
  });

  const onSubmitMaterial = (values: z.infer<typeof materialSchema>) => {
    addMaterial.mutate({ id, data: { productId: values.productId, quantityUsed: values.quantityUsed } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectMaterialsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListStockMovementsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setOpenMaterial(false);
        form.reset();
        toast({ title: "Matériau ajouté" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de l'ajout" }),
    });
  };

  const handleStatusChange = (status: string) => {
    updateProject.mutate({ id, data: { status: status as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Statut mis à jour" });
      },
    });
  };

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-8 w-32 rounded bg-card border border-border animate-pulse" />
      <div className="h-24 rounded-lg bg-card border border-border animate-pulse" />
      <div className="h-64 rounded-lg bg-card border border-border animate-pulse" />
    </div>
  );
  if (isError) return (
    <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-muted-foreground uppercase text-sm font-mono">Impossible de charger ce projet</p>
      <Button variant="outline" size="sm" onClick={() => refetch()} className="uppercase text-xs font-bold gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Réessayer
      </Button>
    </div>
  );
  if (!project) return <div className="p-8 text-muted-foreground uppercase">Projet introuvable</div>;

  const cfg = statusConfig[project.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="uppercase text-xs">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold uppercase tracking-tight">{project.name}</h1>
            <Badge className={`uppercase text-xs ${cfg.className}`}>{cfg.label}</Badge>
          </div>
          {project.clientName && <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{project.clientName}</p>}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Calendar className="h-3 w-3" />
              {project.startDate && format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })}
              {project.endDate && <> → {format(new Date(project.endDate), "dd MMM yyyy", { locale: fr })}</>}
            </div>
          )}
        </div>
        {canEdit && (
        <div className="flex items-center gap-2">
          <Select value={project.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40 bg-card border-border" data-testid="select-project-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="paused">Suspendu</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        )}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Matériaux consommés</CardTitle>
          {canAddMaterial && (
          <Dialog open={openMaterial} onOpenChange={setOpenMaterial}>
            <DialogTrigger asChild>
              <Button size="sm" className="uppercase font-bold text-xs" data-testid="button-add-material">
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wide">Ajouter un matériau</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitMaterial)} className="space-y-4">
                  <FormField control={form.control} name="productId" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Produit</FormLabel>
                      <Select onValueChange={val => field.onChange(parseInt(val))} value={field.value > 0 ? String(field.value) : undefined}>
                        <FormControl><SelectTrigger className="bg-background" data-testid="select-material-product"><SelectValue placeholder="Choisir un produit" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {products?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.quantityInStock} {p.unit} dispo)</SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="quantityUsed" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Quantité utilisée</FormLabel>
                      <FormControl><Input type="number" {...field} data-testid="input-material-qty" className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full uppercase font-bold" disabled={addMaterial.isPending}>
                    {addMaterial.isPending ? "Ajout..." : "Ajouter le matériau"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingMaterials ? (
            <div className="p-4 text-muted-foreground uppercase text-sm animate-pulse">Chargement...</div>
          ) : materials && materials.length > 0 ? (
            <div className="divide-y divide-border">
              {materials.map(m => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-bold">{m.productName}</span>
                  </div>
                  <div className="font-bold font-mono">{m.quantityUsed} <span className="text-xs text-muted-foreground">{m.unit}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground uppercase text-sm">Aucun matériau enregistré</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
