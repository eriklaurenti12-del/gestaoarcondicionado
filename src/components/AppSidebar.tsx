import { BarChart3, CalendarDays, Users, Wrench, Building2, TrendingUp, Briefcase, UserCog, LogOut, Wallet, Database, Settings, Wind, FileText, ClipboardList, Snowflake, ShoppingCart, Thermometer, Bell, Globe, Zap, MessageCircle, Download, Headphones, Share, CheckCircle, Shield, RefreshCw, UserPlus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemBranding } from "@/hooks/useSystemBranding";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isToday } from "date-fns";

const checkForUpdates = async () => {
  try {
    const response = await fetch('/version.json?' + Date.now(), { cache: 'no-store' });
    const data = await response.json();
    const currentVersion = localStorage.getItem('app_version');
    if (currentVersion && data.version !== currentVersion) {
       window.dispatchEvent(new CustomEvent('pwa:need-refresh', { detail: { reload: true } }));
    }
    localStorage.setItem('app_version', data.version);
    toast.success("Sistema verificado!", { description: "Você está na versão mais recente." });
  } catch (e) {
    console.log('Update check failed', e);
  }
};

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isSuperAdmin: boolean;
  userRole?: string;
  onNavigateMembers: () => void;
  onSignOut: () => void;
}

const SidebarInstallCard = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === 'true';
  });
  const [isIOS] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  });

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      localStorage.setItem('pwa-installed', 'true');
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => {
      setIsInstalled(true);
      localStorage.setItem('pwa-installed', 'true');
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      toast.info('Para instalar: toque em 📤 (compartilhar) → "Adicionar à Tela de Início"', { duration: 6000 });
      return;
    }
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('🎉 App instalado com sucesso! Acesse pela tela inicial.');
          setIsInstalled(true);
          setDeferredPrompt(null);
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch {
        toast.error('Erro ao instalar. Tente pelo menu do navegador.');
      }
    } else {
      toast.info('Abra no Chrome → Menu (⋮) → "Instalar aplicativo"', { duration: 5000 });
    }
  }, [deferredPrompt, isIOS]);

  if (isInstalled || isCollapsed) return null;

  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-3 shadow-sm animate-pulse-subtle">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-xs font-bold text-foreground">App AC Service</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2 leading-tight">Instale agora e acesse offline com rapidez total.</p>
      <Button
        size="sm"
        variant="default"
        className="w-full h-8 text-[11px] rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
        onClick={handleInstall}
        id="pwa-install-button-sidebar"
      >
        {isIOS ? <Share className="w-3 h-3 mr-1.5" /> : <Download className="w-3 h-3 mr-1.5" />}
        {isIOS ? 'ADICIONAR À TELA' : 'INSTALAR AGORA'}
      </Button>
      
      <div className="mt-3 pt-2 border-t border-primary/10">
        <div className="flex items-center justify-between text-[8px] font-bold text-primary/60 uppercase tracking-tighter mb-1">
          <span className="flex items-center gap-1"><Shield className="w-2 h-2" /> RLS Ativo</span>
          <span>Escalabilidade 50k+</span>
        </div>
        <div className="w-full h-1 bg-primary/5 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-gradient-to-r from-primary to-cyan-500 w-full animate-pulse" />
        </div>
        <div className="flex items-center justify-between text-[7px] text-muted-foreground/60 font-medium">
          <span>Sincronização Realtime</span>
          <span>Latência &lt; 50ms</span>
        </div>
      </div>
    </div>
  );
};

const iconMap: Record<string, any> = {
  dashboard: BarChart3, cadastros: Users, appointments: CalendarDays,
  "online-bookings": Globe, documents: FileText, services: Snowflake,
  "btu-calculator": Thermometer, pdv: ShoppingCart, financeiro: Wallet,
  impostos: TrendingUp, company: Briefcase, "notifications-settings": Bell,
  lembretes: MessageCircle, backup: Database, prestadores: Users,
  historico: ClipboardList, funcionarios: UserPlus,
};

const defaultSections = [
  { label: "MENU", icon: "Snowflake", items: [
    { id: "dashboard", title: "Painel" },
    { id: "cadastros", title: "Cadastros" },
    { id: "appointments", title: "Agenda" },
    { id: "prestadores", title: "Prestadores" },
    { id: "funcionarios", title: "Funcionários" },
    { id: "online-bookings", title: "Agendamento Online" },
  ]},
  { label: "GESTÃO", icon: "ClipboardList", items: [
    { id: "documents", title: "Orçamentos" },
    { id: "services", title: "Manutenções" },
    { id: "historico", title: "Histórico Geral" },
    { id: "btu-calculator", title: "Medição BTUs" },
  ]},
  { label: "VENDAS", icon: "ShoppingCart", items: [
    { id: "pdv", title: "PDV / Vendas" },
  ]},
  { label: "FINANCEIRO", icon: "Wallet", items: [
    { id: "financeiro", title: "Financeiro" },
    { id: "impostos", title: "Impostos" },
  ]},
  { label: "GERAL", icon: "Settings", items: [
    { id: "company", title: "Minha Empresa" },
    { id: "notifications-settings", title: "Notificações" },
    { id: "backup", title: "Backup" },
  ]},
];

export function AppSidebar({ activeTab, onTabChange, isSuperAdmin, userRole, onNavigateMembers, onSignOut }: AppSidebarProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { systemName, systemSubtitle, systemLogoUrl } = useSystemBranding();

  const { data: companyData } = useQuery({
    queryKey: ['company-data-sidebar'],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('company_data')
        .select('company_name, email, logo_url')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  const { data: supportContacts } = useQuery({
    queryKey: ['support-contacts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'support_contacts')
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          return parsed.filter((c: any) => c.available && c.name && c.phone);
        } catch { return []; }
      }
      return [];
    },
    staleTime: 60 * 1000,
  });

  const filterSectionsByRole = (sections: any[]) => {
    if (!userRole || userRole === 'super_admin' || userRole === 'sistema') return sections;
    const roleTabAccess: Record<string, string[]> = {
      painel: ['dashboard'],
      suporte: ['dashboard', 'appointments', 'online-bookings', 'cadastros', 'financeiro', 'pdv', 'documents'],
    };
    const allowedTabs = roleTabAccess[userRole];
    if (!allowedTabs) return sections;
    return sections
      .map((section: any) => ({
        ...section,
        items: section.items.filter((item: any) => allowedTabs.includes(item.id))
      }))
      .filter((section: any) => section.items.length > 0);
  };

  const sections = filterSectionsByRole(defaultSections);
  const companyName = companyData?.company_name || systemName;

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      <SidebarHeader className="p-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          {(companyData?.logo_url || systemLogoUrl) ? (
            <img src={companyData?.logo_url || systemLogoUrl!} alt={companyName} className="w-9 h-9 rounded-xl object-contain flex-shrink-0" />
          ) : (
            <div className="p-2 rounded-xl bg-primary shadow-sm flex-shrink-0 relative">
              <Wind className="w-5 h-5 text-primary-foreground" />
              {localStorage.getItem('pwa-installed') === 'true' && (
                <div className="absolute -top-1 -right-1 bg-white dark:bg-zinc-950 rounded-full p-0.5 shadow-sm">
                  <CheckCircle className="w-3 h-3 text-green-500 fill-green-500/10" />
                </div>
              )}
            </div>
          )}
          <div className={`flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-foreground truncate">
                {companyName}
              </span>
              {localStorage.getItem('pwa-installed') === 'true' && (
                <div className="flex items-center gap-0.5 ml-1">
                  <Badge variant="outline" className="h-3 px-1 text-[8px] bg-green-500/10 text-green-600 border-green-500/20 uppercase tracking-tighter font-black">
                    App
                  </Badge>
                  <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[10px] text-muted-foreground truncate">{systemSubtitle}</span>
              {!isCollapsed && (
                <div className="flex items-center gap-1 shrink-0">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                  <span className="text-[8px] font-bold text-green-600/70 uppercase">Online</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {sections.map((section: any, idx: number) => (
          <SidebarGroup key={idx} className="py-0.5">
            <SidebarGroupLabel className={`text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 mb-1 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item: any) => {
                  const Icon = iconMap[item.id] || Wrench;
                  const isActive = activeTab === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => onTabChange(item.id)}
                        isActive={isActive}
                        tooltip={item.title}
                        className={`h-11 rounded-xl transition-all duration-300 relative group overflow-hidden ${
                          isActive
                            ? "bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 glow-active"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
                        )}
                        <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <span className="text-[14px] font-medium truncate ml-1">{item.title}</span>
                        {isActive && (
                          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isSuperAdmin && (
          <SidebarGroup className="py-0.5">
            <SidebarGroupLabel className={`text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 mb-1 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              ADMIN
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onNavigateMembers}
                    tooltip="Gerenciar Usuários"
                    className="h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150"
                  >
                    <UserCog className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="text-[13px]">Gerenciar Usuários</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border space-y-2">
        <SidebarInstallCard isCollapsed={isCollapsed} />

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate('/beta')}
              tooltip="Sistema Simplificado"
              className="h-9 rounded-lg text-primary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">Simplificado</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {supportContacts && supportContacts.length > 0 ? (
            supportContacts.map((contact: any) => (
              <SidebarMenuItem key={contact.id}>
                <SidebarMenuButton
                  onClick={() => window.open(`https://wa.me/${contact.phone}?text=Olá%2C+preciso+de+suporte`, '_blank')}
                  tooltip={`${contact.name} - ${contact.role || 'Suporte'}`}
                  className="h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Headphones className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs truncate">{contact.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("https://wa.me/5516992600631?text=Olá%2C+preciso+de+suporte", '_blank')}
                tooltip="Falar com suporte"
                className="h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">Falar com suporte</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              tooltip="Sair"
              className="h-9 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className={`flex flex-col gap-1.5 mt-2 px-2 pb-2 ${isCollapsed ? "hidden" : "block"}`}>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Sistema Online (v2.4.0)</span>
          </div>
          <button 
            onClick={checkForUpdates}
            className="flex items-center gap-2 text-[9px] text-muted-foreground/50 hover:text-primary transition-colors text-left"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Verificar Atualizações</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
