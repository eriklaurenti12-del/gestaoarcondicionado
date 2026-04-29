import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, HelpCircle, Lightbulb, MessageCircle, RefreshCw, Wind, Zap, Moon, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
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
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const lastUserIdRef = useRef<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTipsDialog, setShowTipsDialog] = useState(false);

  const { data: notificationCount = 0 } = useQuery({
    queryKey: ['notification-count', currentUserId],
    queryFn: fetchNotificationCount,
    enabled: !!currentUserId,
    refetchInterval: 60000
  });

  // Browser push notifications for appointments
  useEffect(() => {
    if (!('Notification' in window)) return;
    
    const checkAndNotify = async () => {
      if (Notification.permission !== 'granted') return;
      
      const today = new Date();
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('*, clients(name), products(name)')
        .gte('appointment_date', today.toISOString().split('T')[0])
        .lte('appointment_date', today.toISOString().split('T')[0] + 'T23:59:59')
        .in('status', ['agendado', 'confirmado']);
      
      if (todayAppointments && todayAppointments.length > 0) {
        const lastNotifKey = `push_notif_${today.toISOString().split('T')[0]}`;
        if (!localStorage.getItem(lastNotifKey)) {
          new Notification('📅 Agendamentos de Hoje', {
            body: `Você tem ${todayAppointments.length} agendamento(s) hoje!`,
            icon: '/icon-192x192.png',
            tag: 'appointments-today'
          });
          localStorage.setItem(lastNotifKey, 'true');
        }
      }
    };
    
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 5 * 60 * 1000); // Check every 5 min
    return () => clearInterval(interval);
  }, []);

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

      // CRITICAL: if a different user is now logged in on this browser,
      // wipe all React Query cache + per-user localStorage to avoid showing
      // the previous user's company name/logo (e.g. "Excelência" appearing for Erik).
      const previousUserId = localStorage.getItem('current_user_id');
      if (previousUserId && previousUserId !== session.user.id) {
        queryClient.clear();
        // Wipe per-browser branding leftovers from old account
        localStorage.removeItem('company_logo');
        localStorage.removeItem('company_name');
        localStorage.removeItem('company_cnpj');
        localStorage.removeItem('company_email');
        localStorage.removeItem('company_whatsapp');
        localStorage.removeItem('company_address');
      }
      localStorage.setItem('current_user_id', session.user.id);
      lastUserIdRef.current = session.user.id;

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
              <header className="h-14 border-b border-border/60 flex items-center px-3 sm:px-5 bg-card/80 backdrop-blur-xl sticky top-0 z-20 gap-2 shadow-[0_1px_3px_hsl(var(--primary)/0.04)]">
                {/* Left: trigger + title */}
                <SidebarTrigger className="h-9 w-9 flex-shrink-0 rounded-lg hover:bg-muted transition-colors" />
                <div className="hidden sm:block h-5 w-px bg-border/50 flex-shrink-0" />
                <h1 className="text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis mr-auto">{getPageTitle()}</h1>

                {/* Right: icon buttons */}
                {/* Mobile-only dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10">
                      <Lightbulb className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setTimeout(() => setShowTipsDialog(true), 100)} className="gap-2 cursor-pointer">
                      <Lightbulb className="w-4 h-4 text-primary" /> Dicas AC
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.open("https://wa.me/5516992600631?text=Olá%2C+preciso+de+suporte", '_blank')} className="gap-2 cursor-pointer">
                      <MessageCircle className="w-4 h-4 text-primary" /> Suporte WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleRestartOnboarding} className="gap-2 cursor-pointer">
                      <HelpCircle className="w-4 h-4" /> Ver Tutorial
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={async () => {
                      toast.info("🔍 Verificando atualizações...");
                      try {
                        if ('serviceWorker' in navigator) {
                          const regs = await navigator.serviceWorker.getRegistrations();
                          for (const r of regs) {
                            if (r.active) r.active.postMessage({ type: 'FORCE_UPDATE' });
                            await r.unregister();
                          }
                        }
                        const keys = await caches.keys();
                        await Promise.all(keys.map(n => caches.delete(n)));
                        toast.success("✅ Atualização aplicada!");
                        setTimeout(() => { window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now(); }, 1000);
                      } catch { toast.info("🔄 Recarregando..."); setTimeout(() => window.location.reload(), 800); }
                    }} className="gap-2 cursor-pointer">
                      <RefreshCw className="w-4 h-4" /> Atualizar Sistema
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Desktop action buttons */}
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-9 w-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setShowTipsDialog(true)} title="Dicas AC">
                  <Lightbulb className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-9 w-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={handleRestartOnboarding} title="Tutorial">
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-9 w-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={async () => {
                  toast.info("🔍 Verificando atualizações...");
                  try {
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      for (const r of regs) {
                        if (r.active) r.active.postMessage({ type: 'FORCE_UPDATE' });
                        await r.unregister();
                      }
                    }
                    const keys = await caches.keys();
                    await Promise.all(keys.map(n => caches.delete(n)));
                    toast.success("✅ Atualização aplicada!");
                    setTimeout(() => { window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now(); }, 1000);
                  } catch { toast.info("🔄 Recarregando..."); setTimeout(() => window.location.reload(), 800); }
                }} title="Atualizar Sistema">
                  <RefreshCw className="h-4 w-4" />
                </Button>

                {/* Notification Bell */}
                <Popover open={notificationsOpen} onOpenChange={(open) => {
                  setNotificationsOpen(open);
                  if (open && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className={`relative h-9 w-9 flex-shrink-0 rounded-lg transition-colors ${notificationCount > 0 ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                      <Bell className={`h-4 w-4 ${notificationCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />
                      {notificationCount > 0 && (
                        <>
                          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold shadow-sm">{notificationCount > 99 ? '99' : notificationCount}</span>
                          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive animate-ping opacity-60" />
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[92vw] sm:w-[400px] max-w-[400px] p-0 shadow-2xl border-primary/20" align="end" sideOffset={8}>
                    <NotificationsPanel onClose={() => setNotificationsOpen(false)} />
                  </PopoverContent>
                </Popover>

                {/* Theme toggle */}
                <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={toggleTheme} title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}>
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>

                <div className="h-5 w-px bg-border flex-shrink-0" />

                {/* User Profile */}
                <UserProfileDropdown
                  onSignOut={handleSignOut}
                  onNavigateCompany={() => setActiveTab('company')}
                />
              </header>

              {/* Main Content */}
              <main className="flex-1 p-2 sm:p-4 md:p-6 overflow-auto">
                <div className="max-w-7xl mx-auto">
                  {renderContent()}
                </div>
              </main>
            </div>
          </div>

          <SupportButton tipsOpen={showTipsDialog} onTipsOpenChange={setShowTipsDialog} />
          
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
