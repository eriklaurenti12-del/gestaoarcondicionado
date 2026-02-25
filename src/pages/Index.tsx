import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import SupportButton from "@/components/SupportButton";
import SubscriptionGate from "@/components/SubscriptionGate";
import Dashboard from "@/components/Dashboard";
import CadastrosUnifiedTab from "@/components/CadastrosUnifiedTab";
import CompanyDataTab from "@/components/CompanyDataTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import FinanceiroUnifiedTab from "@/components/FinanceiroUnifiedTab";
import DocumentsUnifiedTab from "@/components/DocumentsUnifiedTab";
import ServicesUnifiedTab from "@/components/ServicesUnifiedTab";
import PDVTab from "@/components/PDVTab";
import ImpostosTab from "@/components/ImpostosTab";
import BtuCalculator from "@/components/BtuCalculator";
import DataBackup from "@/components/DataBackup";
import NotificationsPanel from "@/components/NotificationsPanel";
import NotificationSettings from "@/components/NotificationSettings";
import OnboardingTour from "@/components/OnboardingTour";
import RotatingNotifications from "@/components/RotatingNotifications";
import UpdateNotification from "@/components/UpdateNotification";
import { AppSidebar } from "@/components/AppSidebar";
import InstallButton from "@/components/InstallButton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, HelpCircle } from "lucide-react";
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
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { data: notificationCount = 0 } = useQuery({
    queryKey: ['notification-count'],
    queryFn: fetchNotificationCount,
    refetchInterval: 60000
  });

  useEffect(() => {
    // Check for recovery tokens in URL FIRST - redirect to reset-password
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken) {
      // Has token - redirect to reset-password with the hash
      console.log('Recovery token detected, redirecting to reset-password');
      navigate(`/reset-password${window.location.hash}`);
      return;
    }

    // Setup auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Index auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate("/reset-password");
        return;
      }
      
      if (!session) {
        navigate("/");
      }
    });

    checkAuth();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/");
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    setIsSuperAdmin(roles?.some(r => r.role === 'super_admin') || false);
    
    // Check if first time user (onboarding not completed)
    const onboardingKey = `ac_onboarding_completed_${session.user.id}`;
    const onboardingCompleted = localStorage.getItem(onboardingKey);
    
    if (!onboardingCompleted) {
      setShowOnboarding(true);
    }
    
    setLoading(false);
  };

  const handleOnboardingComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const onboardingKey = `ac_onboarding_completed_${session.user.id}`;
      localStorage.setItem(onboardingKey, 'true');
    }
    setShowOnboarding(false);
  };

  const handleRestartOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigateToTab={setActiveTab} />;
      case "appointments":
        return <AppointmentsTab />;
      case "cadastros":
        return <CadastrosUnifiedTab />;
      case "documents":
        return <DocumentsUnifiedTab />;
      case "financeiro":
        return <FinanceiroUnifiedTab />;
      case "services":
        return <ServicesUnifiedTab />;
      case "btu-calculator":
        return <BtuCalculator />;
      case "pdv":
        return <PDVTab />;
      case "impostos":
        return <ImpostosTab />;
      case "notifications-settings":
        return <NotificationSettings />;
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
      dashboard: "Painel de Controle",
      appointments: "Agenda de Atendimentos",
      cadastros: "Clientes & Serviços",
      documents: "Orçamentos & Ordens de Serviço",
      financeiro: "Gestão Financeira",
      services: "Manutenções & Contratos",
      "btu-calculator": "Calculadora de BTUs",
      pdv: "Ponto de Venda",
      impostos: "Gestão de Impostos",
      "notifications-settings": "Configurações de Notificações",
      backup: "Backup dos Dados",
      company: "Dados da Empresa"
    };
    return titles[activeTab] || "Painel de Controle";
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
                  {/* Help/Onboarding button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-muted"
                    onClick={handleRestartOnboarding}
                    title="Ver tutorial do sistema"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                  
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
          
          {/* Update Notification */}
          <UpdateNotification />
          
          {/* Rotating Tips/Notifications */}
          <RotatingNotifications />
          
          {/* Onboarding Tour */}
          <OnboardingTour 
            open={showOnboarding} 
            onComplete={handleOnboardingComplete}
          />
        </div>
      </SidebarProvider>
    </SubscriptionGate>
  );
}
