import { BarChart3, CalendarDays, Users, Wrench, Building2, TrendingUp, Briefcase, UserCog, LogOut, Wallet, Database, Settings, Wind, FileText, ClipboardList, Snowflake, ShoppingCart, Thermometer, Bell, Globe, Zap, MessageCircle, Download, Headphones, Share, CheckCircle } from "lucide-react";
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

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isSuperAdmin: boolean;
  userRole?: string;
  onNavigateMembers: () => void;
  onSignOut: () => void;
}

// Sidebar PWA Install Card with real install prompt
const SidebarInstallCard = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Check standalone mode OR localStorage flag
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === 'true';
  });
  const [isIOS] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent));

  useEffect(() => {
    // Re-check on mount
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
    <div className="rounded-xl bg-muted/40 border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <Download className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-xs font-semibold text-foreground">Baixe nosso App</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">Gerencie de qualquer lugar</p>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs rounded-lg"
        onClick={handleInstall}
      >
        {isIOS ? <Share className="w-3 h-3 mr-1" /> : <Download className="w-3 h-3 mr-1" />}
        Instalar App
      </Button>
    </div>
  );
};

const iconMap: Record<string, any> = {
  dashboard: BarChart3, cadastros: Users, appointments: CalendarDays,
  "online-bookings": Globe, documents: FileText, services: Snowflake,
  "btu-calculator": Thermometer, pdv: ShoppingCart, financeiro: Wallet,
  impostos: TrendingUp, company: Briefcase, "notifications-settings": Bell,
  lembretes: MessageCircle, backup: Database,
};

const defaultSections = [
  { label: "MENU", icon: "Snowflake", items: [
    { id: "dashboard", title: "Painel" },
    { id: "cadastros", title: "Cadastros" },
    { id: "appointments", title: "Agenda" },
    { id: "online-bookings", title: "Agendamento Online" },
  ]},
  { label: "GESTÃO", icon: "ClipboardList", items: [
    { id: "documents", title: "Orçamentos & O.S." },
    { id: "services", title: "Manutenções" },
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
      // CRITICAL: filter by current user_id to avoid showing another user's company name
      const { data: { session } } = await supabase.auth.getSession();
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

  const { data: sidebarConfig } = useQuery({
    queryKey: ['sidebar-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'sidebar_config')
        .maybeSingle();
      if (error) return null;
      return data?.value ? JSON.parse(data.value) : null;
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

  const allSections = sidebarConfig?.sections || defaultSections;
  const sections = filterSectionsByRole(allSections);
  const companyName = companyData?.company_name || systemName;

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      {/* Logo Header */}
      <SidebarHeader className="p-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          {systemLogoUrl ? (
            <img src={systemLogoUrl} alt={companyName} className="w-9 h-9 rounded-xl object-contain flex-shrink-0" />
          ) : (
            <div className="p-2 rounded-xl bg-primary shadow-sm flex-shrink-0">
              <Wind className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className={`flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            <span className="font-bold text-sm text-foreground truncate">
              {companyName}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">{systemSubtitle}</span>
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
                        className={`h-10 rounded-lg transition-all duration-150 ${
                          isActive
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="text-[13px] truncate">{item.title}</span>
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
        {/* App download card */}
        <SidebarInstallCard isCollapsed={isCollapsed} />

        {/* Footer actions */}
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
          {/* Dynamic support contacts */}
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
      </SidebarFooter>
    </Sidebar>
  );
}
