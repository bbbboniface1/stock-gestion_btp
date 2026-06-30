import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, keepPreviousData } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  Package, ArrowRightLeft, LayoutGrid, Users, Settings, LogOut,
  FileText, HardHat, FileDown, ClipboardList, Menu, MoreHorizontal, QrCode, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { useState, lazy, Suspense } from "react";

import Login from "@/pages/login";
import { AuthBootstrap } from "@/components/AuthBootstrap";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Products = lazy(() => import("@/pages/products"));
const ProductDetail = lazy(() => import("@/pages/product-detail"));
const Movements = lazy(() => import("@/pages/movements"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const UsersPage = lazy(() => import("@/pages/users"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const AuditPage = lazy(() => import("@/pages/audit"));
const ScanPage = lazy(() => import("@/pages/scan"));
const InvoicesPage = lazy(() => import("@/pages/invoices"));
const InvoiceNewPage = lazy(() => import("@/pages/invoice-new"));
const InvoiceEditPage = lazy(() => import("@/pages/invoice-edit"));
const InvoiceDetailPage = lazy(() => import("@/pages/invoice-detail"));
import { RoleGuard } from "@/components/RoleGuard";
import { filterNavByRole } from "@/lib/permissions";
import { OfflineBanner } from "@/components/OfflineBanner";
import { InstallBanner } from "@/components/InstallBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      placeholderData: keepPreviousData,
    },
  },
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.status === 401) {
        useAuthStore.getState().logout();
      }
    },
  }),
});

const mainNav = [
  { name: "Dashboard", href: "/", icon: LayoutGrid },
  { name: "Produits", href: "/products", icon: Package },
  { name: "Mouvements", href: "/movements", icon: ArrowRightLeft },
  { name: "Projets", href: "/projects", icon: FileText },
];

const moreNav = [
  { name: "Factures", href: "/invoices", icon: Receipt },
  { name: "Traçabilité", href: "/audit", icon: ClipboardList },
  { name: "Rapports", href: "/reports", icon: FileDown },
  { name: "Utilisateurs", href: "/users", icon: Users },
  { name: "Paramètres", href: "/settings", icon: Settings },
];

const allNav = [...mainNav, ...moreNav];

function pageTitleFromPath(path: string): string {
  if (path === "/") return "Dashboard";
  if (path.startsWith("/products")) return "Produits";
  if (path.startsWith("/movements")) return "Mouvements";
  if (path.startsWith("/projects")) return "Projets";
  if (path.startsWith("/invoices")) return "Factures";
  if (path.startsWith("/audit")) return "Traçabilité";
  if (path.startsWith("/reports")) return "Rapports";
  if (path.startsWith("/users")) return "Utilisateurs";
  if (path.startsWith("/settings")) return "Paramètres";
  return "Stock BTP";
}

function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuthStore();
  const company = useCompany();
  const { setOpenMobile } = useSidebar();

  const visibleNav = filterNavByRole(allNav, user?.role ?? null);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const navigate = (href: string) => {
    setLocation(href);
    setOpenMobile(false);
  };

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-4 flex items-center justify-start gap-3 text-primary">
        {company?.logoUrl ? (
          <img
            src={company.logoUrl}
            alt={company.name}
            className="h-8 w-8 rounded-sm object-contain bg-white/10 border border-border shrink-0"
          />
        ) : (
          <HardHat className="h-6 w-6 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="font-mono font-bold text-sm uppercase truncate">{company?.name ?? "Stock BTP"}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestion stock</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    onClick={() => navigate(item.href)}
                    className="font-medium"
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-4 flex flex-col gap-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}

function MobileHeader() {
  const [location] = useLocation();
  const title = pageTitleFromPath(location);

  return (
    <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-40 pwa-header">
      <SidebarTrigger className="h-9 w-9 shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <HardHat className="h-4 w-4 text-primary shrink-0" />
        <span className="font-bold font-mono uppercase text-primary text-sm tracking-wider truncate">
          {title}
        </span>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const [location, setLocation] = useLocation();
  const { logout, user } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleMoreNav = filterNavByRole(moreNav, user?.role ?? null);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const isMoreActive = visibleMoreNav.some((item) => isActive(item.href));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-1">
        {mainNav.map((item) => (
          <button
            key={item.href}
            onClick={() => setLocation(item.href)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
              isActive(item.href)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className={`h-5 w-5 transition-transform ${isActive(item.href) ? "scale-110" : ""}`} />
            <span className="text-[10px] font-mono uppercase font-bold leading-none">{item.name}</span>
            {isActive(item.href) && (
              <span className="absolute bottom-0 w-6 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isMoreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MoreHorizontal className={`h-5 w-5 ${isMoreActive ? "scale-110" : ""}`} />
              <span className="text-[10px] font-mono uppercase font-bold leading-none">Plus</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-card border-t border-border rounded-t-xl pb-8">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-left font-mono uppercase text-sm text-muted-foreground">
                Navigation
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {visibleMoreNav.map((item) => (
                <button
                  key={item.href}
                  onClick={() => { setLocation(item.href); setMoreOpen(false); }}
                  className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                    isActive(item.href)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="font-mono font-bold uppercase text-xs">{item.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <button
                onClick={() => { logout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="font-mono font-bold uppercase text-xs">Déconnexion</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function ScanFAB() {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation("/scan")}
      className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
      aria-label="Scanner QR code"
    >
      <QrCode className="h-6 w-6" />
    </button>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Redirect to="/login" />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background font-mono">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <MobileHeader />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8 pwa-content">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <ScanFAB />
    </SidebarProvider>
  );
}

const PageFallback = () => (
  <div className="p-8 text-muted-foreground animate-pulse font-mono uppercase text-sm">Chargement...</div>
);

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/products" component={() => <ProtectedLayout><Products /></ProtectedLayout>} />
        <Route path="/products/:id" component={() => <ProtectedLayout><ProductDetail /></ProtectedLayout>} />
        <Route path="/movements" component={() => <ProtectedLayout><Movements /></ProtectedLayout>} />
        <Route path="/projects" component={() => <ProtectedLayout><Projects /></ProtectedLayout>} />
        <Route path="/projects/:id" component={() => <ProtectedLayout><ProjectDetail /></ProtectedLayout>} />
        <Route path="/invoices" component={() => <ProtectedLayout><RoleGuard path="/invoices"><InvoicesPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/invoices/new" component={() => <ProtectedLayout><RoleGuard path="/invoices"><InvoiceNewPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/invoices/:id/edit" component={() => <ProtectedLayout><RoleGuard path="/invoices"><InvoiceEditPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/invoices/:id" component={() => <ProtectedLayout><RoleGuard path="/invoices"><InvoiceDetailPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/audit" component={() => <ProtectedLayout><RoleGuard path="/audit"><AuditPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/reports" component={() => <ProtectedLayout><RoleGuard path="/reports"><ReportsPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/users" component={() => <ProtectedLayout><RoleGuard path="/users"><UsersPage /></RoleGuard></ProtectedLayout>} />
        <Route path="/settings" component={() => <ProtectedLayout><SettingsPage /></ProtectedLayout>} />
        <Route path="/scan" component={() => <ScanPage />} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineBanner />
        <InstallBanner />
        <AuthBootstrap>
          <CompanyProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </CompanyProvider>
        </AuthBootstrap>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
