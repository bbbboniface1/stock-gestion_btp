import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { useCompany, useUpdateCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User, Shield, Wrench, HardHat, Building2, Save, Upload, X } from "lucide-react";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";

const roleConfig: Record<string, { label: string; icon: any }> = {
  admin: { label: "Administrateur", icon: Shield },
  manager: { label: "Manager", icon: Wrench },
  worker: { label: "Ouvrier", icon: HardHat },
};

export default function Settings() {
  const { logout, user } = useAuthStore();
  const { data: me } = useGetMe();
  const company = useCompany();
  const updateCompany = useUpdateCompany();
  const { toast } = useToast();
  const cfg = me ? roleConfig[me.role] : null;
  const isAdmin = user?.role === "admin";

  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    taxNumber: "",
    currency: "EUR",
    signatureText: "",
    logoUrl: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        taxNumber: company.taxNumber ?? "",
        currency: company.currency ?? "EUR",
        signatureText: company.signatureText ?? "",
        logoUrl: company.logoUrl ?? "",
      });
    }
  }, [company]);

  const handleSaveCompany = () => {
    updateCompany.mutate({
      name: form.name.trim() || undefined,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      taxNumber: form.taxNumber.trim() || null,
      currency: form.currency || "EUR",
      signatureText: form.signatureText.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
    }, {
      onSuccess: () => toast({ title: "Paramètres entreprise sauvegardés" }),
      onError: (err: any) => toast({ variant: "destructive", title: err.message ?? "Erreur lors de la sauvegarde" }),
    });
  };

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Format image requis (PNG, JPEG, WebP, GIF)" });
      return;
    }
    if (file.size > 1_500_000) {
      toast({ variant: "destructive", title: "Logo trop volumineux (max 1,5 Mo)" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, logoUrl: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const field = (label: string, key: keyof typeof form, placeholder?: string, type = "text") => (
    <div>
      <label className="text-xs uppercase text-muted-foreground font-bold">{label}</label>
      <Input
        type={type}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="bg-background mt-1"
        disabled={!isAdmin}
      />
    </div>
  );

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
          ) : (
            <div className="text-muted-foreground uppercase text-sm animate-pulse">Chargement...</div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Entreprise
            </CardTitle>
            {!isAdmin && (
              <span className="text-xs text-muted-foreground uppercase">Lecture seule (admin requis)</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {field("Nom de l'entreprise", "name", "Mon Entreprise BTP")}
          {field("Adresse", "address", "1 rue du Chantier, 75000 Paris")}
          <div className="grid grid-cols-2 gap-4">
            {field("Téléphone", "phone", "+33 1 00 00 00 00")}
            {field("Email", "email", "contact@entreprise.fr", "email")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("Numéro TVA", "taxNumber", "FR00000000000")}
            <div>
              <label className="text-xs uppercase text-muted-foreground font-bold">Devise</label>
              <select
                value={form.currency}
                onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))}
                disabled={!isAdmin}
                className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="MAD">MAD (DH)</option>
                <option value="XOF">XOF (FCFA)</option>
              </select>
            </div>
          </div>
          {field("Texte de signature (factures)", "signatureText", "Merci de votre confiance.")}

          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs uppercase text-muted-foreground font-bold">Logo entreprise</label>
            <p className="text-xs text-muted-foreground">
              Affiché sur les factures PDF et dans l&apos;application. Import recommandé (PNG/JPEG).
            </p>
            {form.logoUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/20">
                <img
                  src={form.logoUrl}
                  alt="Aperçu logo"
                  className="h-16 w-16 object-contain rounded-sm bg-white border border-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono truncate text-muted-foreground">
                    {form.logoUrl.startsWith("data:") ? "Image importée (base64)" : form.logoUrl}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => setForm(prev => ({ ...prev, logoUrl: "" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground uppercase">Aucun logo configuré</div>
            )}
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" className="uppercase text-xs font-bold" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-3 w-3 mr-2 inline" />
                    Importer une image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleLogoFile}
                    />
                  </label>
                </Button>
              </div>
            )}
            {field("Ou URL du logo", "logoUrl", "https://example.com/logo.png")}
          </div>

          {isAdmin && (
            <Button
              className="w-full uppercase font-bold tracking-wide mt-2"
              onClick={handleSaveCompany}
              disabled={updateCompany.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateCompany.isPending ? "Sauvegarde..." : "Sauvegarder les paramètres entreprise"}
            </Button>
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
            <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-xs font-mono">
              <OnlineStatusBadge />
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full uppercase font-bold tracking-wide" onClick={logout} data-testid="button-logout">
        <LogOut className="h-4 w-4 mr-2" /> Déconnexion
      </Button>
    </div>
  );
}
