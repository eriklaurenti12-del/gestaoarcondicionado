
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Sun, Moon, Package, Users, Building2, TrendingUp, UserCog, Building } from "lucide-react";
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

    // Verificar se é super admin
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
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <SupportButton />
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold">Gestão de Eletrônicos</h1>
            <div className="flex gap-2 items-center flex-wrap">
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
                  <UserCog className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Membros</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
              <InstallButton />
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sair
              </Button>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 h-auto p-1">
              <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Package className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Produtos</span>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Building2 className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Fornecedores</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Relatórios</span>
              </TabsTrigger>
              <TabsTrigger value="company" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 p-2 sm:p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Building className="w-4 h-4" />
                <span className="text-xs sm:text-sm">Empresa</span>
              </TabsTrigger>
            </TabsList>

          <TabsContent value="dashboard">
            <Dashboard />
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
