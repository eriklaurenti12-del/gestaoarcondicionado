import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import SupportButton from "@/components/SupportButton";
import SubscriptionGate from "@/components/SubscriptionGate";
import Dashboard from "@/components/Dashboard";
import ClientsTab from "@/components/ClientsTab";
import ProductsTab from "@/components/ProductsTab";
import SuppliersTab from "@/components/SuppliersTab";
import ReportsTab from "@/components/ReportsTab";
import CompanyDataTab from "@/components/CompanyDataTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import FinanceiroTab from "@/components/FinanceiroTab";
import InstallmentsTab from "@/components/InstallmentsTab";
import SalesTab from "@/components/SalesTab";
import ChartsMetrics from "@/components/ChartsMetrics";
import QuotesTab from "@/components/QuotesTab";
import PDVTab from "@/components/PDVTab";
import DataBackup from "@/components/DataBackup";
import NotificationsPanel from "@/components/NotificationsPanel";
import { AppSidebar } from "@/components/AppSidebar";
import InstallButton from "@/components/InstallButton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { differenceInDays, isToday } from "date-fns";
import { ParticleBackground } from "@/components/ParticleBackground";

const fetchNotificationCount = async () => {
  const today = new Date();

  const [
    { data: installments },
    { data: appointments }
  ] = await Promise.all([
    supabase.from('installments').select('due_date, is_paid').eq('is_paid', false),
    supabase.from('appointments').select('appointment_date, status').gte('appointment_date', today.toISOString().split('T')[0])
  ]);

  let count = 0;

  // Count urgent installments (overdue or due in 7 days)
  installments?.forEach((inst: any) => {
    const dueDate = new Date(inst.due_date);
    const daysUntil = differenceInDays(dueDate, today);
    if (daysUntil <= 7) count++;
  });

  // Count today's pending appointments
  appointments?.forEach((apt: any) => {
    if (isToday(new Date(apt.appointment_date)) && apt.status !== 'concluído' && apt.status !== 'cancelado') {
      count++;
    }
  });

  return count;
};

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: notificationCount = 0 } = useQuery({
    queryKey: ['notification-count'],
    queryFn: fetchNotificationCount,
    refetchInterval: 60000
  });

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
      case "pdv":
        return <PDVTab />;
      case "sales":
        return <SalesTab />;
      case "quotes":
        return <QuotesTab />;
      case "financeiro":
        return <FinanceiroTab />;
      case "installments":
        return <InstallmentsTab />;
      case "charts":
        return <ChartsMetrics />;
      case "reports":
        return <ReportsTab />;
      case "backup":
        return <DataBackup />;
      case "company":
        return <CompanyDataTab />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: "Dashboard",
      appointments: "Agenda de Atendimentos",
      clients: "Clientes",
      products: "Serviços & Peças",
      suppliers: "Fornecedores",
      pdv: "PDV - Ponto de Venda",
      sales: "Ordens de Serviço",
      quotes: "Orçamentos",
      financeiro: "Financeiro",
      installments: "Parcelas",
      charts: "Gráficos & Métricas",
      reports: "Relatórios",
      backup: "Backup dos Dados",
      company: "Minha Empresa"
    };
    return titles[activeTab] || "Dashboard";
  };

  return (
    <SubscriptionGate>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
          <ParticleBackground className="z-0 opacity-50 pointer-events-none" />

          {/* Main layout wrapper - z-index to sit above particles */}
          <div className="flex w-full relative z-10">
            <AppSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isSuperAdmin={isSuperAdmin}
              onNavigateMembers={() => navigate("/members")}
              onSignOut={handleSignOut}
            />

            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <header className="h-16 border-b border-border flex items-center justify-between px-4 bg-card/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="h-11 w-11 min-h-[44px] min-w-[44px] touch-target relative z-50" />
                  <h1 className="text-base sm:text-lg font-semibold truncate">{getPageTitle()}</h1>
                </div>
                <div className="flex items-center gap-2">
                  {/* Notification Bell */}
                  <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`relative h-11 w-11 min-h-[44px] min-w-[44px] transition-all duration-300 ${notificationCount > 0
                            ? 'text-primary hover:bg-primary/10'
                            : 'hover:bg-muted'
                          }`}
                      >
                        <Bell className={`h-5 w-5 transition-transform ${notificationCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''
                          }`} />
                        {notificationCount > 0 && (
                          <>
                            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] flex items-center justify-center font-bold shadow-lg">
                              {notificationCount > 99 ? '99' : notificationCount}
                            </span>
                            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 animate-ping opacity-75" />
                          </>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[90vw] sm:w-[400px] max-w-[400px] p-0 shadow-2xl border-primary/20" align="end" sideOffset={8}>
                      <NotificationsPanel onClose={() => setNotificationsOpen(false)} />
                    </PopoverContent>
                  </Popover>

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
          </div>

          <SupportButton />
        </div>
      </SidebarProvider>
    </SubscriptionGate>
  );
}
