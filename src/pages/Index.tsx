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
import NotificationsPanel from "@/components/NotificationsPanel";
import { AppSidebar } from "@/components/AppSidebar";
import InstallButton from "@/components/InstallButton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { differenceInDays, differenceInYears, isToday } from "date-fns";

const fetchNotificationCount = async () => {
  const today = new Date();
  
  const [
    { data: clients },
    { data: installments },
    { data: appointments }
  ] = await Promise.all([
    supabase.from('clients').select('aniversario'),
    supabase.from('installments').select('due_date, is_paid').eq('is_paid', false),
    supabase.from('appointments').select('appointment_date, status').gte('appointment_date', today.toISOString().split('T')[0])
  ]);

  let count = 0;

  // Count upcoming birthdays (7 days)
  clients?.forEach((client: any) => {
    if (!client.aniversario) return;
    const birthday = new Date(client.aniversario);
    const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
    if (thisYearBirthday < today) thisYearBirthday.setFullYear(today.getFullYear() + 1);
    const daysUntil = differenceInDays(thisYearBirthday, today);
    if (daysUntil >= 0 && daysUntil <= 7) count++;
  });

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
      case "financeiro":
        return <FinanceiroTab />;
      case "installments":
        return <InstallmentsTab />;
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
      financeiro: "Financeiro",
      installments: "Parcelas",
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
                {/* Notification Bell */}
                <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-9 w-9">
                      <Bell className="h-5 w-5" />
                      {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                          {notificationCount > 9 ? '9+' : notificationCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0" align="end">
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

          <SupportButton />
        </div>
      </SidebarProvider>
    </SubscriptionGate>
  );
}
