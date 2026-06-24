import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListProducts, useListProductCategories, useCreateProduct, useUpdateProduct, useDeleteProduct,
  getListProductsQueryKey, getListProductCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { canCreateProduct, canDeleteProduct } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, AlertTriangle, Package, Trash2, ArrowUp, ArrowDown, QrCode, Pencil } from "lucide-react";
import MovementDialog from "@/components/MovementDialog";
import QRCodeModal from "@/components/QRCodeModal";

const productSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  category: z.string().min(1, "Catégorie requise"),
  unit: z.enum(["kg", "m", "litre", "piece"]),
  quantityInStock: z.coerce.number().min(0).default(0),
  minimumThreshold: z.coerce.number().min(0).default(0),
  location: z.enum(["warehouse", "site", "project"]),
});

const productUpdateSchema = productSchema.omit({ quantityInStock: true });

export default function Products() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<{
    id: number;
    name: string;
    category: string;
    unit: "kg" | "m" | "litre" | "piece";
    minimumThreshold: number;
    location: "warehouse" | "site" | "project";
  } | null>(null);
  const [movementProduct, setMovementProduct] = useState<{ id: number; name: string; stock: number } | null>(null);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [qrProduct, setQrProduct] = useState<{ id: number; name: string; stock: number; unit: string } | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canCreate = user ? canCreateProduct(user.role) : false;
  const canEdit = canCreate;
  const canDelete = user ? canDeleteProduct(user.role) : false;

  const params: Record<string, string | boolean | number> = {};
  if (search) params.search = search;
  if (categoryFilter !== "all") params.category = categoryFilter;
  if (lowStockOnly) params.low_stock = true;

  const { data: products, isLoading } = useListProducts(params);
  const { data: categories } = useListProductCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", category: "", unit: "piece", quantityInStock: 0, minimumThreshold: 0, location: "warehouse" },
  });

  const editForm = useForm<z.infer<typeof productUpdateSchema>>({
    resolver: zodResolver(productUpdateSchema),
    defaultValues: { name: "", category: "", unit: "piece", minimumThreshold: 0, location: "warehouse" },
  });

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    createProduct.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() });
        setOpenCreate(false);
        form.reset();
        toast({ title: "Produit créé avec succès" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de la création" }),
    });
  };

  const openEditDialog = (product: {
    id: number;
    name: string;
    category: string;
    unit: "kg" | "m" | "litre" | "piece";
    minimumThreshold: number;
    location: "warehouse" | "site" | "project";
  }) => {
    setEditProduct(product);
    editForm.reset({
      name: product.name,
      category: product.category,
      unit: product.unit,
      minimumThreshold: product.minimumThreshold,
      location: product.location,
    });
  };

  const onUpdate = (values: z.infer<typeof productUpdateSchema>) => {
    if (!editProduct) return;
    updateProduct.mutate({ id: editProduct.id, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() });
        setEditProduct(null);
        toast({ title: "Produit modifie avec succes" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de la modification" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Supprimer ce produit definitivement ?")) return;
    deleteProduct.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductCategoriesQueryKey() });
        toast({ title: "Produit supprime" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de la suppression" }),
    });
  };

  const locationLabels: Record<string, string> = { warehouse: "Entrepôt", site: "Chantier", project: "Projet" };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Produits</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{products?.length ?? 0} articles en stock</p>
        </div>
        {canCreate && (
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-product" className="uppercase font-bold tracking-wide">
              <Plus className="h-4 w-4 mr-2" /> Nouveau Produit
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wide">Nouveau Produit</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Nom</FormLabel>
                    <FormControl><Input {...field} data-testid="input-product-name" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Catégorie</FormLabel>
                    <FormControl><Input {...field} data-testid="input-product-category" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Unité</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="litre">litre</SelectItem>
                          <SelectItem value="piece">pièce</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Emplacement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="warehouse">Entrepôt</SelectItem>
                          <SelectItem value="site">Chantier</SelectItem>
                          <SelectItem value="project">Projet</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="quantityInStock" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Qté initiale</FormLabel>
                      <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="minimumThreshold" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Seuil min</FormLabel>
                      <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full uppercase font-bold" disabled={createProduct.isPending}>
                  {createProduct.isPending ? "Création..." : "Créer le produit"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-products" placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-48 bg-card border-border" data-testid="select-category-filter">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories?.map(c => <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={lowStockOnly ? "destructive" : "outline"} onClick={() => setLowStockOnly(!lowStockOnly)} className="uppercase text-xs font-bold" data-testid="button-filter-low-stock">
          <AlertTriangle className="h-4 w-4 mr-2" /> Stock Critique
        </Button>
      </div>

      {/* Products list */}
      {isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement des produits...</div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {products && products.length > 0 ? (
              <div className="divide-y divide-border">
                {products.map(product => {
                  const isLow = product.quantityInStock < product.minimumThreshold;
                  return (
                    <div key={product.id} data-testid={`card-product-${product.id}`} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/products/${product.id}`)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{product.name}</span>
                          {isLow && <Badge variant="destructive" className="text-xs uppercase">Stock Critique</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase mt-1 flex gap-3 flex-wrap">
                          <span>{product.category}</span>
                          <span>·</span>
                          <span>{locationLabels[product.location]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right min-w-[60px] md:min-w-[80px]">
                          <div className={`font-bold font-mono text-base md:text-lg ${isLow ? "text-destructive" : "text-foreground"}`}>
                            {product.quantityInStock} <span className="text-xs text-muted-foreground">{product.unit}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">min: {product.minimumThreshold}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="bg-green-500/10 border-green-500/30 text-green-500 hover:bg-green-500/20 h-8 w-8 p-0 md:w-auto md:px-2" data-testid={`button-in-${product.id}`}
                            onClick={() => { setMovementProduct({ id: product.id, name: product.name, stock: product.quantityInStock }); setMovementType("IN"); }}>
                            <ArrowUp className="h-3 w-3 md:mr-1" />
                            <span className="hidden md:inline">IN</span>
                          </Button>
                          <Button size="sm" variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20 h-8 w-8 p-0 md:w-auto md:px-2" data-testid={`button-out-${product.id}`}
                            onClick={() => { setMovementProduct({ id: product.id, name: product.name, stock: product.quantityInStock }); setMovementType("OUT"); }}>
                            <ArrowDown className="h-3 w-3 md:mr-1" />
                            <span className="hidden md:inline">OUT</span>
                          </Button>
                          <Button size="sm" variant="outline" className="bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 h-8 w-8 p-0" data-testid={`button-qr-${product.id}`}
                            onClick={() => setQrProduct({ id: product.id, name: product.name, stock: product.quantityInStock, unit: product.unit })}>
                            <QrCode className="h-3 w-3" />
                          </Button>
                          {canEdit && (
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" data-testid={`button-edit-${product.id}`}
                              onClick={() => openEditDialog({
                                id: product.id,
                                name: product.name,
                                category: product.category,
                                unit: product.unit,
                                minimumThreshold: product.minimumThreshold,
                                location: product.location,
                              })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-destructive/40 text-destructive hover:bg-destructive/10" data-testid={`button-delete-${product.id}`}
                              onClick={() => handleDelete(product.id)}
                              disabled={deleteProduct.isPending}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-sm">Aucun produit trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {movementProduct && (
        <MovementDialog
          open={!!movementProduct}
          onClose={() => setMovementProduct(null)}
          productId={movementProduct.id}
          productName={movementProduct.name}
          currentStock={movementProduct.stock}
          initialType={movementType}
        />
      )}

      <Dialog open={!!editProduct} onOpenChange={(open) => !open && setEditProduct(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wide">Modifier le produit</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdate)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel className="uppercase text-xs">Nom</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-product-name" className="bg-background" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="category" render={({ field }) => (
                <FormItem><FormLabel className="uppercase text-xs">Categorie</FormLabel>
                  <FormControl><Input {...field} data-testid="input-edit-product-category" className="bg-background" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Unite</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="litre">litre</SelectItem>
                        <SelectItem value="piece">piece</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Emplacement</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="warehouse">Entrepot</SelectItem>
                        <SelectItem value="site">Chantier</SelectItem>
                        <SelectItem value="project">Projet</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="minimumThreshold" render={({ field }) => (
                <FormItem><FormLabel className="uppercase text-xs">Seuil min</FormLabel>
                  <FormControl><Input type="number" {...field} className="bg-background" /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full uppercase font-bold" disabled={updateProduct.isPending}>
                {updateProduct.isPending ? "Modification..." : "Enregistrer les modifications"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {qrProduct && (
        <QRCodeModal
          open={!!qrProduct}
          onClose={() => setQrProduct(null)}
          productId={qrProduct.id}
          productName={qrProduct.name}
          currentStock={qrProduct.stock}
          unit={qrProduct.unit}
        />
      )}
    </div>
  );
}
