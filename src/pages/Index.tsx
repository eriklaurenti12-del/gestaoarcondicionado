import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase, getSafeUser } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SupportButton from "@/components/SupportButton";
import SubscriptionGate from "@/components/SubscriptionGate";
import Dashboard from "@/components/Dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CadastrosUnifiedTab from "@/components/CadastrosUnifiedTab";
import CompanyDataTab from "@/components/CompanyDataTab";
import AppointmentsTab from "@/components/AppointmentsTab";
import FinanceiroUnifiedTab from "@/components/FinanceiroUnifiedTab";
import DocumentsUnifiedTab from "@/components/DocumentsUnifiedTab";
import ServicesUnifiedTab from "@/components/ServicesUnifiedTab";
import ServiceProvidersTab from "@/components/ServiceProvidersTab";
import HistoricoGeralTab from "@/components/HistoricoGeralTab";
import PDVTab from "@/components/PDVTab";
import ImpostosTab from "@/components/ImpostosTab";
import BtuCalculator from "@/components/BtuCalculator";
import DataBackup from "@/components/DataBackup";
import NotificationsPanel from "@/components/NotificationsPanel";
import OnlineBookingsTab from "@/components/OnlineBookingsTab";
import NotificationSettings from "@/components/NotificationSettings";
import LembretesTab from "@/components/LembretesTab";
import EmployeesTab from "@/components/EmployeesTab";
import OnboardingTour from "@/components/OnboardingTour";
import SpotlightAtualizar from "@/components/SpotlightAtualizar";
import { getUserPref, setUserPref } from "@/utils/userPreferences";
import RotatingNotifications from "@/components/RotatingNotifications";
import UpdateNotification from "@/components/UpdateNotification";
import { AppSidebar } from "@/components/AppSidebar";
import PWAInstallButton from "@/components/PWAInstallButton";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, HelpCircle, Lightbulb, MessageCircle, RefreshCw, Wind, Moon, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { differenceInDays, isToday } from "date-fns";
import { ParticleBackground } from "@/components/ParticleBackground";
import { forceUpdateApp } from "@/lib/updateApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const safeIsToday = (date: any) => {
  try {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return isToday(d);
  } catch {
    return false;
  }
};

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
      if (safeIsToday(apt.appointment_date) && apt.status !== 'concluido' && apt.status !== 'cancelado') {
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
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  useGlobalShortcuts(); // Ctrl+Shift+R: limpa cache + reconcilia financeiro
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const lastUserIdRef = useRef<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTipsDialog, setShowTipsDialog] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const { data: notificationCount = 0 } = useQuery({
    queryKey: ['notification-count', currentUserId],
    queryFn: fetchNotificationCount,
    enabled: !!currentUserId,
    refetchInterval: 60000
  });

  useEffect(() => {
    let mounted = true;

    // Check for recovery tokens in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    if (accessToken) {
      navigate(`/reset-password${window.location.hash}`);
      return;
    }

    // Stable Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[Index] Auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate("/reset-password");
        return;
      }
      
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        navigate("/");
      }
    });

    const checkAuth = async () => {
      try {
        const { user } = await getSafeUser();
        if (!mounted) return;

        if (!user) {
          navigate("/");
          return;
        }

        // Cache cleanup for new user
        const previousUserId = localStorage.getItem('current_user_id');
        if (previousUserId && previousUserId !== user.id) {
          queryClient.clear();
          localStorage.removeItem('company_logo');
          localStorage.removeItem('company_name');
        }
        localStorage.setItem('current_user_id', user.id);
        setCurrentUserId(user.id);

        // Pré-aquece o endpoint da agenda online para abrir instantâneo
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          if (projectId) {
            fetch(`https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${user.id}`).catch(() => {});
          }
        } catch { /* ignore */ }

        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
        const isSA = roles?.some(r => r.role === 'super_admin') || false;
        setIsSuperAdmin(isSA);

        const { data: teamInvite } = await supabase.from('team_invites').select('team_role').eq('accepted_by', user.id).eq('status', 'accepted').maybeSingle();
        const teamRole = teamInvite?.team_role || '';
        setUserRole(teamRole || (isSA ? 'super_admin' : ''));

        const tourDone = await getUserPref<boolean>('onboarding_completed');
        const legacy = localStorage.getItem(`ac_onboarding_completed_${user.id}`);
        if (!tourDone && !legacy) setShowOnboarding(true);
        
        setLoading(false);
      } catch (error) {
        console.error('[Index] Auth check error:', error);
        if (mounted) {
          setLoading(false);
          navigate("/");
        }
      }
    };

    checkAuth();
    return () => { 
      mounted = false;
      subscription.unsubscribe(); 
    };
  }, [navigate, queryClient]);

  const handleOnboardingComplete = () => {
    if (currentUserId) {
      localStorage.setItem(`ac_onboarding_completed_${currentUserId}`, 'true');
    }
    void setUserPref('onboarding_completed', true);
    setShowOnboarding(false);
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdates(true);
    await forceUpdateApp();
    setTimeout(() => setIsCheckingUpdates(false), 1000);
  };

  const handleSignOut = async () => {
    try {
      queryClient.clear();
      localStorage.removeItem('current_user_id');
      await supabase.auth.signOut();
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Wind className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Iniciando painel...</p>
        </div>
      </div>
    );
  }

  const allowedTabsByRole: Record<string, string[]> = {
    painel: ['dashboard'],
    suporte: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'financeiro', 'pdv', 'documents', 'prestadores', 'historico', 'lembretes'],
    sistema: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'documents', 'financeiro', 'services', 'btu-calculator', 'pdv', 'impostos', 'notifications-settings', 'lembretes', 'backup', 'company', 'prestadores', 'historico'],
    super_admin: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'documents', 'financeiro', 'services', 'btu-calculator', 'pdv', 'impostos', 'notifications-settings', 'lembretes', 'backup', 'company', 'prestadores', 'historico', 'funcionarios'],
  };

  const canAccessTab = (tab: string) => (allowedTabsByRole[userRole] || allowedTabsByRole['super_admin']).includes(tab);

  const renderContent = () => {
    if (!canAccessTab(activeTab)) return <Dashboard onNavigateToTab={setActiveTab} isSuperAdmin={isSuperAdmin} />;

    switch (activeTab) {
      case "dashboard": return <Dashboard onNavigateToTab={setActiveTab} isSuperAdmin={isSuperAdmin} />;
      case "appointments": return <AppointmentsTab />;
      case "online-bookings": return <OnlineBookingsTab userId={currentUserId} />;
      case "cadastros": return <CadastrosUnifiedTab />;
      case "documents": return <DocumentsUnifiedTab />;
      case "financeiro": return <FinanceiroUnifiedTab />;
      case "services": return <ServicesUnifiedTab />;
      case "btu-calculator": return <BtuCalculator />;
      case "pdv": return <PDVTab />;
      case "impostos": return <ImpostosTab />;
      case "notifications-settings": return <NotificationSettings />;
      case "lembretes": return <LembretesTab />;
      case "backup": return <DataBackup />;
      case "company": return <CompanyDataTab />;
      case "prestadores": return <ServiceProvidersTab />;
      case "historico": return <HistoricoGeralTab />;
      case "funcionarios": return <EmployeesTab />;
      default: return <Dashboard onNavigateToTab={setActiveTab} isSuperAdmin={isSuperAdmin} />;
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: "Painel de Controle",
      appointments: "Agenda de Atendimentos",
      "online-bookings": "Agendamento Online",
      cadastros: "Clientes & Serviços",
      documents: "Orçamentos",
      financeiro: "Gestão Financeira",
      services: "Manutenções & Contratos",
      "btu-calculator": "Calculadora de BTUs",
      pdv: "Ponto de Venda",
      impostos: "Gestão de Impostos",
      "notifications-settings": "Configurações de Notificações",
      lembretes: "Lembretes & Mensagens",
      prestadores: "Equipe de Prestadores",
      historico: "Histórico Geral",
      backup: "Backup dos Dados",
      company: "Dados da Empresa"
    };
    return titles[activeTab] || "Painel de Controle";
  };

  return (
    <SubscriptionGate>
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen flex w-full bg-background relative overflow-hidden">
          <ParticleBackground className="z-0 opacity-50 pointer-events-none" />

          <div className="flex w-full h-full min-h-0 relative z-10">
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

            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <header className="h-14 border-b border-border/60 flex items-center px-3 sm:px-5 bg-card/80 backdrop-blur-xl sticky top-0 z-20 gap-2 shadow-sm">
                <SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-muted" />
                <div className="hidden sm:block h-5 w-px bg-border/50" />
                <h1 className="text-sm font-semibold text-foreground mr-auto">{getPageTitle()}</h1>

                <Button data-spotlight-target="atualizar" variant="outline" size="sm" className="hidden sm:inline-flex h-9 rounded-lg border-primary/40 text-primary hover:bg-primary/10 shadow-sm" onClick={() => setShowUpdateModal(true)} disabled={isCheckingUpdates}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                  {isCheckingUpdates ? 'Sincronizando...' : 'Atualizar'}
                </Button>

                <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
                  <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Atualizar Sistema</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Clique abaixo para forçar a sincronização com a versão mais recente e corrigir erros de exibição.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={() => { setShowUpdateModal(false); checkForUpdates(); }}>
                        Sincronizar Agora
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-9 w-9">
                      <Bell className={`h-4 w-4 ${notificationCount > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                      {notificationCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] flex items-center justify-center font-bold text-white shadow-sm">{notificationCount}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 shadow-2xl" align="end">
                    <NotificationsPanel onClose={() => setNotificationsOpen(false)} />
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>

                <div className="h-5 w-px bg-border" />
                <UserProfileDropdown onSignOut={handleSignOut} onNavigateCompany={() => setActiveTab('company')} />
              </header>

              <main className="flex-1 min-h-0 p-4 overflow-y-auto overflow-x-hidden">
                <div className="w-full max-w-7xl min-w-0 mx-auto">
                  <ErrorBoundary>
                    {renderContent()}
                  </ErrorBoundary>
                </div>
              </main>
            </div>
          </div>

          <SupportButton tipsOpen={showTipsDialog} onTipsOpenChange={setShowTipsDialog} />
          <UpdateNotification />
          <RotatingNotifications />
          <OnboardingTour open={showOnboarding} onComplete={handleOnboardingComplete} />
          <SpotlightAtualizar />
          <PWAInstallButton />
        </div>
      </SidebarProvider>
    </SubscriptionGate>
  );
}
