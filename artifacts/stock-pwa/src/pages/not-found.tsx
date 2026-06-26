import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background font-mono p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold uppercase tracking-wide text-foreground">404 — Page introuvable</h1>
          <p className="text-sm text-muted-foreground">
            Cette page n'existe pas ou a été déplacée.
          </p>
          <Button className="uppercase font-bold" onClick={() => setLocation("/")}>
            Retour au tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
