import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import SupportButton from "@/components/SupportButton";
import SubscriptionGate from "@/components/SubscriptionGate";
import Dashboard from "@/components/Dashboard";
import ClientsTab from "@/components/ClientsTab";
import ProductsTab from "@/components/ProductsTab";
import SuppliersTab from "@/components/SuppliersTab";
import ReportsTab from "@/components/ReportsTab";
import CompanyDataTab from "@/components/CompanyDataTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import { AppSidebar } from "@/components/AppSidebar";
import InstallButton from "@/components/InstallButton";

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

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

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "appointments":
        return <AppointmentsTab />;
      case "clients":
        return <ClientsTab />;
      case "products":
        return <ProductsTab />;
      case "suppliers":
        return <SuppliersTab />;
      case "reports":
        return <ReportsTab />;
      case "company":
        return <CompanyDataTab />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: "Dashboard",
      appointments: "Agenda",
      clients: "Clientes",
      products: "Serviços & Produtos",
      suppliers: "Fornecedores",
      reports: "Relatórios",
      company: "Meu Salão"
    };
    return titles[activeTab] || "Dashboard";
  };

  return (
    <SubscriptionGate>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isSuperAdmin={isSuperAdmin}
            onNavigateMembers={() => navigate("/members")}
            onSignOut={handleSignOut}
          />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-8 w-8" />
                <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
              </div>
              <div className="flex items-center gap-2">
                <InstallButton />
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 overflow-auto">
              <div className="max-w-7xl mx-auto">
                {renderContent()}
              </div>
            </main>
          </div>

          <SupportButton />
        </div>
      </SidebarProvider>
    </SubscriptionGate>
  );
}
