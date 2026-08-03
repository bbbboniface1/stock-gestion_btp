import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuthStore } from "@/lib/auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { safeReturnPath } from "@/lib/paths";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe requis (min 6 caractères)"),
  rememberMe: z.boolean().optional().default(false),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { token, setAuth } = useAuthStore();
  const { toast } = useToast();

  const returnTo = safeReturnPath(
    new URLSearchParams(window.location.search).get("returnTo"),
  );

  useEffect(() => {
    if (token) setLocation(returnTo);
  }, [token, returnTo, setLocation]);

  if (token) {
    return <Redirect to={returnTo} />;
  }

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const loginMutation = useLogin();

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: { email: values.email, password: values.password } },
      {
        onSuccess: (data) => {
          setAuth(
            data.token,
            data.user as Parameters<typeof setAuth>[1],
            values.rememberMe ?? false,
          );
          setLocation(returnTo);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erreur de connexion",
            description: "Email ou mot de passe incorrect.",
          });
        },
      },
    );
  };

  return (
    /* Fond plein écran sombre */
    <div className="min-h-screen w-full bg-stone-950 flex items-center justify-center p-4 lg:p-10">
      {/* Carte flottante principale */}
      <div className="w-full max-w-5xl flex rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] min-h-[580px]">

        {/* ── Colonne gauche : photo plein cadre ─────────────────── */}
        <div className="hidden lg:flex lg:w-[58%] relative flex-col">
          <img
            src="/login-chantier.jpg"
            alt="Chantier BTP"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="eager"
            decoding="async"
          />
          {/* Gradient superposé */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60" />

          {/* Logo centré sur la photo */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
            <div className="bg-primary/20 backdrop-blur-sm border border-primary/30 w-20 h-20 flex items-center justify-center rounded-2xl shadow-lg">
              <HardHat className="w-10 h-10 text-primary" />
            </div>
            <p className="text-white font-bold text-2xl tracking-wide drop-shadow">Stock BTP</p>
            <p className="text-white/70 text-xs font-mono uppercase tracking-widest">Gestion de stock & chantiers</p>
          </div>

          {/* Texte bas gauche */}
          <div className="relative z-10 p-8 lg:p-10">
            <p className="text-white/60 font-mono uppercase text-xs tracking-widest mb-2">
              Plateforme professionnelle
            </p>
            <h2 className="text-white font-bold text-2xl lg:text-3xl leading-snug">
              Gestion de stock<br />et suivi de chantier
            </h2>
          </div>
        </div>

        {/* ── Colonne droite : formulaire ────────────────────────── */}
        <div className="w-full lg:w-[42%] flex flex-col justify-center bg-card px-8 py-10 lg:px-12 lg:py-14">

          {/* En-tête mobile uniquement */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="bg-primary/10 w-11 h-11 flex items-center justify-center rounded-xl">
              <HardHat className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">Stock BTP</p>
              <p className="text-xs text-muted-foreground">Gestion de stock & chantiers</p>
            </div>
          </div>

          {/* Titre formulaire */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-1">Connexion</h1>
            <p className="text-sm text-muted-foreground">
              Bienvenue — entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          {/* Formulaire */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Identifiant (Email)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ouvrier@chantier.com"
                        {...field}
                        className="h-11 bg-background/60 border-border/60 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mot de passe
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="h-11 bg-background/60 border-border/60 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Rester connecté */}
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2.5 space-y-0 pt-1">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="rounded"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer select-none">
                      Rester connecté
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 font-semibold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-lg shadow-md hover:shadow-primary/30 mt-2"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Connexion en cours…" : "Se connecter"}
              </Button>
            </form>
          </Form>

          {/* Footer discret */}
          <p className="mt-8 text-center text-xs text-muted-foreground/50">
            Stock BTP © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
