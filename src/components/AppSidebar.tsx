import { BarChart3, CalendarDays, Users, Wrench, Building2, TrendingUp, Briefcase, UserCog, Moon, Sun, LogOut, Wallet, Database, FolderOpen, Settings, Wind, Shield, FileText, ClipboardList, Snowflake, ShoppingCart, Thermometer, Bell, Globe, Zap, MessageCircle, HelpCircle, Download } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useBetaMode } from "@/contexts/BetaModeContext";
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

const sectionIconMap: Record<string, any> = {
  Snowflake, ClipboardList, ShoppingCart, Wallet, Settings,
};

export function AppSidebar({ activeTab, onTabChange, isSuperAdmin, userRole, onNavigateMembers, onSignOut }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { toggleBeta } = useBetaMode();
  const betaNavigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { data: companyData } = useQuery({
    queryKey: ['company-data-sidebar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_data').select('company_name, email').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
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
  const companyName = companyData?.company_name || 'AC Service Pro';

  const renderMenuItems = (items: { id: string; title: string }[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = iconMap[item.id] || Wrench;
        const isActive = activeTab === item.id;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              onClick={() => onTabChange(item.id)}
              isActive={isActive}
              tooltip={item.title}
              className={`h-10 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[13px]">{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      {/* Logo Header */}
      <SidebarHeader className="p-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary shadow-sm">
            <Wind className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className={`flex flex-col transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <span className="font-bold text-sm text-foreground whitespace-nowrap truncate max-w-[150px]">
              {companyName}
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Gestão de Ar Condicionado</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1.5">
        {sections.map((section: any, idx: number) => (
          <SidebarGroup key={idx} className="py-1">
            <SidebarGroupLabel className={`text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase px-3 mb-0.5 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(section.items)}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isSuperAdmin && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className={`text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase px-3 mb-0.5 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              ADMIN
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onNavigateMembers}
                    tooltip="Gerenciar Usuários"
                    className="h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                  >
                    <UserCog className="w-[18px] h-[18px]" />
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
        <div className={`rounded-xl bg-muted/50 border border-border p-3 ${isCollapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold">Baixe nosso App</span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">Gerencie de qualquer lugar</p>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs"
            onClick={() => {
              const event = new Event('beforeinstallprompt');
              window.dispatchEvent(event);
            }}
          >
            <Download className="w-3 h-3 mr-1" /> Instalar
          </Button>
        </div>

        {/* Footer actions */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              className="h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-xs">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => window.open("https://wa.me/5516992600631?text=Olá%2C+preciso+de+suporte", '_blank')}
              tooltip="Falar com suporte"
              className="h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">Falar com suporte</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              tooltip="Sair"
              className="h-9 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
