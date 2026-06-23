import { useGetMe } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Shield, Wrench, HardHat } from "lucide-react";

const roleConfig: Record<string, { label: string; icon: any }> = {
  admin: { label: "Administrateur", icon: Shield },
  manager: { label: "Manager", icon: Wrench },
  worker: { label: "Ouvrier", icon: HardHat },
};

export default function Settings() {
  const { logout } = useAuthStore();
  const { data: me } = useGetMe();
  const cfg = me ? roleConfig[me.role] : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Profil et configuration</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Mon Profil</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {me ? (
            <>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-sm bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-lg">{me.fullName}</div>
                  <div className="text-sm text-muted-foreground">{me.email}</div>
                  {cfg && (
                    <div className="flex items-center gap-1 mt-1">
                      <cfg.icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground uppercase">{cfg.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground uppercase text-sm animate-pulse">Chargement...</div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Application</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground uppercase">Version</span>
            <span className="font-mono font-bold">StockBTP v1.0.0</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground uppercase">Mode</span>
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 uppercase text-xs">PWA</Badge>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground uppercase">Statut</span>
            <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-xs">En ligne</Badge>
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full uppercase font-bold tracking-wide" onClick={logout} data-testid="button-logout">
        <LogOut className="h-4 w-4 mr-2" /> Déconnexion
      </Button>
    </div>
  );
}
