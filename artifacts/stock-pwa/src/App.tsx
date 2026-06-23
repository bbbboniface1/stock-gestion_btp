import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth";
import { SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { Package, ArrowRightLeft, LayoutGrid, Users, Settings, LogOut, FileText, HardHat, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Products from "@/pages/products";
import ProductDetail from "@/pages/product-detail";
import Movements from "@/pages/movements";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import ReportsPage from "@/pages/reports";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      if (error?.status === 401) {
        useAuthStore.getState().logout();
      }
    },
  }),
});

function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { logout } = useAuthStore();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutGrid },
    { name: "Produits", href: "/products", icon: Package },
    { name: "Mouvements", href: "/movements", icon: ArrowRightLeft },
    { name: "Projets", href: "/projects", icon: FileText },
    { name: "Rapports", href: "/reports", icon: FileDown },
    { name: "Utilisateurs", href: "/users", icon: Users },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-4 flex items-center justify-start gap-2 text-primary font-mono font-bold text-xl uppercase">
        <HardHat className="h-6 w-6" />
        <span>STOCK BTP</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    onClick={() => setLocation(item.href)}
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
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={() => setLocation("/settings")}>
          <Settings className="h-4 w-4 mr-2" />
          Paramètres
        </Button>
        <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
      <SidebarRail />
    </Sidebar>
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
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/products" component={() => <ProtectedLayout><Products /></ProtectedLayout>} />
      <Route path="/products/:id" component={() => <ProtectedLayout><ProductDetail /></ProtectedLayout>} />
      <Route path="/movements" component={() => <ProtectedLayout><Movements /></ProtectedLayout>} />
      <Route path="/projects" component={() => <ProtectedLayout><Projects /></ProtectedLayout>} />
      <Route path="/projects/:id" component={() => <ProtectedLayout><ProjectDetail /></ProtectedLayout>} />
      <Route path="/reports" component={() => <ProtectedLayout><ReportsPage /></ProtectedLayout>} />
      <Route path="/users" component={() => <ProtectedLayout><UsersPage /></ProtectedLayout>} />
      <Route path="/settings" component={() => <ProtectedLayout><SettingsPage /></ProtectedLayout>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
