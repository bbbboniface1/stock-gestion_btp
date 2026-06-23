import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListProjects, useCreateProject, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderOpen, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const projectSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  clientName: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  completed: { label: "Terminé", className: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  paused: { label: "Suspendu", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
};

export default function Projects() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = statusFilter !== "all" ? { status: statusFilter as "active" | "completed" | "paused" } : {};
  const { data: projects, isLoading } = useListProjects(params);
  const createProject = useCreateProject();

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", clientName: "", status: "active", startDate: "", endDate: "" },
  });

  const onSubmit = (values: z.infer<typeof projectSchema>) => {
    const data: Record<string, string> = { name: values.name, status: values.status };
    if (values.clientName) data.clientName = values.clientName;
    if (values.startDate) data.startDate = values.startDate;
    if (values.endDate) data.endDate = values.endDate;
    createProject.mutate({ data: data as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpenCreate(false);
        form.reset();
        toast({ title: "Projet créé avec succès" });
      },
      onError: () => toast({ variant: "destructive", title: "Erreur lors de la création" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight">Projets</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">{projects?.length ?? 0} projets</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-project" className="uppercase font-bold tracking-wide">
              <Plus className="h-4 w-4 mr-2" /> Nouveau Projet
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-wide">Nouveau Projet</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Nom du projet</FormLabel>
                    <FormControl><Input {...field} data-testid="input-project-name" className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Client (optionnel)</FormLabel>
                    <FormControl><Input {...field} className="bg-background" /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel className="uppercase text-xs">Statut</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="paused">Suspendu</SelectItem>
                        <SelectItem value="completed">Terminé</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Début</FormLabel>
                      <FormControl><Input type="date" {...field} className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem><FormLabel className="uppercase text-xs">Fin prévue</FormLabel>
                      <FormControl><Input type="date" {...field} className="bg-background" /></FormControl>
                      <FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full uppercase font-bold" disabled={createProject.isPending}>
                  {createProject.isPending ? "Création..." : "Créer le projet"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", "active", "completed", "paused"].map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="uppercase text-xs font-bold" data-testid={`button-filter-${s}`}>
            {s === "all" ? "Tous" : statusConfig[s]?.label || s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground uppercase text-sm animate-pulse p-8">Chargement des projets...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects && projects.length > 0 ? projects.map(project => (
            <Card key={project.id} data-testid={`card-project-${project.id}`} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation(`/projects/${project.id}`)}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{project.name}</h3>
                  <Badge className={`text-xs uppercase shrink-0 ${statusConfig[project.status]?.className}`}>
                    {statusConfig[project.status]?.label}
                  </Badge>
                </div>
                {project.clientName && (
                  <div className="text-xs text-muted-foreground uppercase font-mono">{project.clientName}</div>
                )}
                {(project.startDate || project.endDate) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {project.startDate && format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })}
                    {project.endDate && <> → {format(new Date(project.endDate), "dd MMM yyyy", { locale: fr })}</>}
                  </div>
                )}
              </CardContent>
            </Card>
          )) : (
            <div className="col-span-full p-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground uppercase text-sm">Aucun projet trouvé</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
