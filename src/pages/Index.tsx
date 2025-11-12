
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Sun, Moon, Package, Users, Building2, TrendingUp, UserCog } from "lucide-react";
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
      <div className="min-h-screen bg-background p-6">
        <SupportButton />
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Gestão de Eletrônicos</h1>
            <div className="flex gap-2">
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
                  <UserCog className="w-4 h-4 mr-2" />
                  Membros
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
              <InstallButton />
              <Button variant="outline" onClick={handleSignOut}>
                Sair
              </Button>
            </div>
          </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 p-3">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2 p-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 p-3">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2 p-3">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 p-3">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Relatórios</span>
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
        </Tabs>
      </div>
    </div>
    </SubscriptionGate>
  );
}
