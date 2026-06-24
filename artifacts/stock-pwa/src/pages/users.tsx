import { useState } from "react";
import {
  useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Shield, Wrench, HardHat, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const userSchema = z.object({
  fullName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  role: z.enum(["admin", "manager", "worker"]),
  password: z.string().min(6, "Mot de passe min 6 caractères"),
});

const roleConfig: Record<string, { label: string; className: string; icon: any }> = {
  admin: { label: "Admin", className: "bg-red-500/20 text-red-400 border-red-500/30", icon: Shield },
  manager: { label: "Manager", className: "bg-primary/20 text-primary border-primary/30", icon: Wrench },
  worker: { label: "Ouvrier", className: "bg-muted/50 text-muted-foreground border-border", icon: HardHat },
};

export default function UsersPage() {
  const [openCreate, setOpenCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; fullName: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { fullName: "", email: "", role: "worker", password: "" },
  });

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    createUser.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setOpenCreate(false);
        form.reset();
        toast({ title: "Utilisateur créé" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de la création" }),
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: `${deleteTarget.fullName} supprimé` });
        setDeleteTarget(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Erreur lors de la suppression" });
        setDeleteTarget(null);
      },
    });
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{users?.length ?? 0} comptes</p>
        </div>
        {isAdmin && (
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user" className="uppercase font-bold tracking-wide">
                <Plus className="h-4 w-4 mr-2" /> Nouvel Utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wide">Nouvel Utilisateur</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Nom complet</FormLabel>
                      <FormControl><Input {...field} data-testid="input-user-name" className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Email</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-user-email" className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Rôle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="bg-background" data-testid="select-user-role"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="worker">Ouvrier</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Mot de passe</FormLabel>
                      <FormControl><Input {...field} type="password" data-testid="input-user-password" className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full uppercase font-bold" disabled={createUser.isPending}>
                    {createUser.isPending ? "Création..." : "Créer l'utilisateur"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement des utilisateurs...</div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {users && users.length > 0 ? (
              <div className="divide-y divide-border">
                {users.map(user => {
                  const cfg = roleConfig[user.role];
                  const Icon = cfg.icon;
                  const isSelf = currentUser?.id === user.id;
                  return (
                    <div key={user.id} data-testid={`row-user-${user.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-muted shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground hidden md:block">
                          Depuis {format(new Date(user.createdAt), "dd MMM yyyy", { locale: fr })}
                        </div>
                        <Badge className={`text-xs uppercase ${cfg.className}`}>{cfg.label}</Badge>
                        {isAdmin && !isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-user-${user.id}`}
                            onClick={() => setDeleteTarget({ id: user.id, fullName: user.fullName })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground uppercase text-sm">Aucun utilisateur</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wide text-destructive">Supprimer l'utilisateur</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              Cette action est irréversible. L'utilisateur <span className="font-bold text-foreground">{deleteTarget?.fullName}</span> sera définitivement supprimé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteUser.isPending} className="uppercase font-bold text-xs">
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteUser.isPending} data-testid="button-confirm-delete-user" className="uppercase font-bold text-xs">
              {deleteUser.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
