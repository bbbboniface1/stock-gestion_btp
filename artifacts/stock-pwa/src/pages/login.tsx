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
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
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
    <div className="min-h-screen flex">
      {/* Colonne gauche : photo, cachée sur mobile et tablette */}
      <div className="hidden lg:flex lg:w-[55%] relative">
        <img
          src="/login-chantier.jpg"
          alt="Chantier BTP"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-10 lg:p-14">
          <p className="text-white/90 font-mono uppercase text-xs tracking-widest mb-3">
            Stock BTP
          </p>
          <h2 className="text-white font-display text-3xl lg:text-4xl font-bold leading-tight">
            Gestion de stock et suivi de chantier
          </h2>
        </div>
      </div>

      {/* Colonne droite : formulaire */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* En-tête */}
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-md shrink-0">
              <HardHat className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-foreground">
                Stock BTP
              </p>
              <p className="text-xs text-muted-foreground">
                Gestion de stock &amp; chantiers
              </p>
            </div>
          </div>

          {/* Formulaire */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-muted-foreground">
                      Identifiant (Email)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ouvrier@chantier.com"
                        {...field}
                        className="font-mono bg-background border-border focus-visible:ring-primary"
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
                    <FormLabel className="uppercase text-xs font-bold text-muted-foreground">
                      Code d'accès
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        className="font-mono bg-background border-border focus-visible:ring-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Case "Rester connecté" */}
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      Rester connecté
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full font-bold uppercase tracking-wide bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Connexion..." : "Accéder au terminal"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
