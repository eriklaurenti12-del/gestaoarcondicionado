import { useState, useEffect } from "react";
import { toast } from "sonner";
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
import OnlineBookingsTab from "@/components/OnlineBookingsTab";
import NotificationSettings from "@/components/NotificationSettings";
import LembretesTab from "@/components/LembretesTab";
import OnboardingTour from "@/components/OnboardingTour";
import RotatingNotifications from "@/components/RotatingNotifications";
import UpdateNotification from "@/components/UpdateNotification";
import { AppSidebar } from "@/components/AppSidebar";
import InstallButton from "@/components/InstallButton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, HelpCircle, RefreshCw, Wind, Zap } from "lucide-react";
import { useBetaMode } from "@/contexts/BetaModeContext";
import { differenceInDays, isToday } from "date-fns";
import { ParticleBackground } from "@/components/ParticleBackground";

const fetchNotificationCount = async () => {
  try {
    const today = new Date();

    const [
      { data: installments },
      { data: appointments }
    ] = await Promise.all([
      supabase.from('installments').select('due_date, is_paid').eq('is_paid', false),
      supabase.from('appointments').select('appointment_date, status').gte('appointment_date', today.toISOString().split('T')[0])
    ]);

    let count = 0;

    installments?.forEach((inst: any) => {
      const dueDate = new Date(inst.due_date);
      const daysUntil = differenceInDays(dueDate, today);
      if (daysUntil <= 7) count++;
    });

    appointments?.forEach((apt: any) => {
      if (isToday(new Date(apt.appointment_date)) && apt.status !== 'concluído' && apt.status !== 'cancelado') {
        count++;
      }
    });

    return count;
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return 0;
  }
};

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const isSA = roles?.some(r => r.role === 'super_admin') || false;
      setIsSuperAdmin(isSA);
      setCurrentUserId(session.user.id);

      const { data: teamInvite } = await supabase
        .from('team_invites')
        .select('team_role')
        .eq('accepted_by', session.user.id)
        .eq('status', 'accepted')
        .maybeSingle();
      
      const teamRole = teamInvite?.team_role || '';
      if (teamRole) {
        setUserRole(teamRole);
        setIsSuperAdmin(false);
      } else {
        setUserRole(isSA ? 'super_admin' : '');
      }
      
      const onboardingKey = `ac_onboarding_completed_${session.user.id}`;
      const onboardingCompleted = localStorage.getItem(onboardingKey);
      
      if (!onboardingCompleted) {
        setShowOnboarding(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking auth:', error);
      setLoading(false);
      navigate("/");
    }
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
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch (error) {
      console.error('Error signing out:', error);
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Wind className="w-12 h-12 text-primary animate-spin" style={{ animationDuration: '2s' }} />
          <p className="text-muted-foreground text-sm">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  const allowedTabsByRole: Record<string, string[]> = {
    painel: ['dashboard'],
    suporte: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'financeiro', 'pdv', 'documents', 'lembretes'],
    sistema: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'documents', 'financeiro', 'services', 'btu-calculator', 'pdv', 'impostos', 'notifications-settings', 'lembretes', 'backup', 'company'],
    super_admin: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'documents', 'financeiro', 'services', 'btu-calculator', 'pdv', 'impostos', 'notifications-settings', 'lembretes', 'backup', 'company'],
    '': ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'documents', 'financeiro', 'services', 'btu-calculator', 'pdv', 'impostos', 'notifications-settings', 'lembretes', 'backup', 'company'],
  };

  const canAccessTab = (tab: string) => (allowedTabsByRole[userRole] || allowedTabsByRole['']).includes(tab);

  const renderContent = () => {
    if (!canAccessTab(activeTab)) {
      return <Dashboard onNavigateToTab={setActiveTab} />;
    }

    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigateToTab={setActiveTab} />;
      case "appointments":
        return <AppointmentsTab />;
      case "online-bookings":
        return currentUserId ? <OnlineBookingsTab userId={currentUserId} /> : null;
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
      case "lembretes":
        return <NotificationSettings />;
      case "backup":
        return <DataBackup />;
      case "company":
        return <CompanyDataTab />;
      default:
        return <Dashboard onNavigateToTab={setActiveTab} />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: "Painel de Controle",
      appointments: "Agenda de Atendimentos",
      "online-bookings": "Agendamento Online",
      cadastros: "Clientes & Serviços",
      documents: "Orçamentos & Ordens de Serviço",
      financeiro: "Gestão Financeira",
      services: "Manutenções & Contratos",
      "btu-calculator": "Calculadora de BTUs",
      pdv: "Ponto de Venda",
      impostos: "Gestão de Impostos",
      "notifications-settings": "Configurações de Notificações",
      lembretes: "Lembretes & Mensagens",
      backup: "Backup dos Dados",
      company: "Dados da Empresa"
    };
    return titles[activeTab] || "Painel de Controle";
  };

  return (
    <SubscriptionGate>
      <SidebarProvider open={true} onOpenChange={() => {}} >
        <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
          <ParticleBackground className="z-0 opacity-50 pointer-events-none" />

          {/* Main layout wrapper - z-index to sit above particles */}
          <div className="flex w-full relative z-10">
            <AppSidebar
              activeTab={activeTab}
              onTabChange={(tab) => {
                if (canAccessTab(tab)) setActiveTab(tab);
                else setActiveTab('dashboard');
              }}
              isSuperAdmin={isSuperAdmin}
              userRole={userRole}
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
                  {/* Beta access button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-accent/10 text-accent"
                    onClick={() => navigate('/beta')}
                    title="Sistema Beta"
                  >
                    <Zap className="h-5 w-5" />
                  </Button>
                  {/* Check for updates button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-muted"
                    onClick={async () => {
                      toast.info("🔍 Verificando atualizações...");
                      try {
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                          const reg = await navigator.serviceWorker.ready;
                          await reg.update();
                          toast.success("✅ Verificação concluída! Se houver atualização, será aplicada.");
                        } else {
                          toast.info("🔄 Recarregando para buscar atualizações...");
                          setTimeout(() => window.location.reload(), 1000);
                        }
                      } catch {
                        toast.info("🔄 Recarregando...");
                        setTimeout(() => window.location.reload(), 1000);
                      }
                    }}
                    title="Procurar atualização"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>

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
