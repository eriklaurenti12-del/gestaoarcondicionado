import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Sun, Moon, Scissors, Users, Building2, TrendingUp, UserCog, Briefcase, CalendarDays } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import InstallButton from "@/components/InstallButton";
import SupportButton from "@/components/SupportButton";
import SubscriptionGate from "@/components/SubscriptionGate";
import Dashboard from "@/components/Dashboard";
import ClientsTab from "@/components/ClientsTab";
import ProductsTab from "@/components/ProductsTab";
import SuppliersTab from "@/components/SuppliersTab";
import ReportsTab from "@/components/ReportsTab";
import CompanyDataTab from "@/components/CompanyDataTab";
import AppointmentsTab from "@/components/AppointmentsTab";

export default function Index() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);
    
    setIsSuperAdmin(roles?.some(r => r.role === 'super_admin') || false);
    setLoading(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return null;
  }

  return (
    <SubscriptionGate>
      <div className="min-h-screen bg-background p-3 sm:p-6">
        <SupportButton />
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-3">
            <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-fade-in flex items-center gap-2">
              <Scissors className="w-5 h-5 sm:w-8 sm:h-8 text-primary" />
              <span className="hidden sm:inline">Salão de Beleza</span>
              <span className="sm:hidden">Salão</span>
            </h1>
            <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap">
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/members")} className="h-8 sm:h-9 px-2 sm:px-3">
                  <UserCog className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Membros</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleTheme} className="h-8 sm:h-9 w-8 sm:w-9 p-0">
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
              <InstallButton />
              <Button variant="outline" size="sm" onClick={handleSignOut} className="h-8 sm:h-9 px-2 sm:px-3">
                <span className="text-xs sm:text-sm">Sair</span>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-7 h-auto p-1 gap-0.5">
              <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="appointments" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Agenda</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <Scissors className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Serviços</span>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Fornecedores</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Relatórios</span>
              </TabsTrigger>
              <TabsTrigger value="company" className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 p-1.5 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all min-w-0">
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="hidden sm:inline text-xs truncate">Meu Salão</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <Dashboard />
            </TabsContent>

            <TabsContent value="appointments">
              <AppointmentsTab />
            </TabsContent>

            <TabsContent value="clients">
              <ClientsTab />
            </TabsContent>

            <TabsContent value="products">
              <ProductsTab />
            </TabsContent>

            <TabsContent value="suppliers">
              <SuppliersTab />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsTab />
            </TabsContent>

            <TabsContent value="company">
              <CompanyDataTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SubscriptionGate>
  );
}
