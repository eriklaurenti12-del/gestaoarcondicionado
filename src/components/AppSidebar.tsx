import { BarChart3, CalendarDays, Users, Wrench, Building2, TrendingUp, Briefcase, UserCog, Moon, Sun, LogOut, Wallet, Database, FolderOpen, Settings, Wind, Shield, FileText, ClipboardList, Snowflake, ShoppingCart, Thermometer, Bell, Globe, Zap, MessageCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useBetaMode } from "@/contexts/BetaModeContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isSuperAdmin: boolean;
  userRole?: string;
  onNavigateMembers: () => void;
  onSignOut: () => void;
}

// Menu items with icons mapping
const iconMap: Record<string, any> = {
  dashboard: BarChart3, cadastros: Users, appointments: CalendarDays,
  "online-bookings": Globe, documents: FileText, services: Snowflake,
  "btu-calculator": Thermometer, pdv: ShoppingCart, financeiro: Wallet,
  impostos: TrendingUp, company: Briefcase, "notifications-settings": Bell,
  lembretes: MessageCircle, backup: Database,
};

const defaultSections = [
  { label: "Principal", icon: "Snowflake", items: [
    { id: "dashboard", title: "Painel" },
    { id: "cadastros", title: "Cadastros" },
    { id: "appointments", title: "Agenda" },
    { id: "online-bookings", title: "Agendamento Online" },
  ]},
  { label: "Gestão", icon: "ClipboardList", items: [
    { id: "documents", title: "Orçamentos & O.S." },
    { id: "services", title: "Manutenções" },
    { id: "btu-calculator", title: "Medição BTUs" },
  ]},
  { label: "Vendas", icon: "ShoppingCart", items: [
    { id: "pdv", title: "PDV / Vendas" },
  ]},
  { label: "Financeiro", icon: "Wallet", items: [
    { id: "financeiro", title: "Financeiro" },
    { id: "impostos", title: "Impostos" },
  ]},
  { label: "Configurações", icon: "Settings", items: [
    { id: "company", title: "Minha Empresa" },
    { id: "lembretes", title: "Lembretes & Mensagens" },
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

  // Fetch company data for branding
  const { data: companyData } = useQuery({
    queryKey: ['company-data-sidebar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_data').select('company_name, email').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch custom sidebar config from admin_settings (super admin can customize)
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

  // Filter sections based on team role
  const filterSectionsByRole = (sections: any[]) => {
    // No role = regular owner user, super_admin = owner, sistema = full access team member
    if (!userRole || userRole === 'super_admin' || userRole === 'sistema') return sections;
    
    // Role-specific tab access
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
  const companyName = companyData?.company_name || 'Minha Empresa';

  const renderMenuItems = (items: { id: string; title: string }[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = iconMap[item.id] || Wrench;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              onClick={() => onTabChange(item.id)}
              isActive={activeTab === item.id}
              tooltip={item.title}
              className={`transition-all duration-200 ease-out ${
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md" 
                  : "hover:bg-muted hover:translate-x-1"
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform duration-200 ${activeTab === item.id ? 'scale-110' : ''}`} />
              <span className="transition-all duration-300">{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border transition-all duration-300">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 transition-transform duration-300 hover:scale-105">
            <Wind className="w-5 h-5 text-primary" />
          </div>
          <div className={`flex flex-col transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <span className="font-bold text-sm bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap truncate max-w-[150px]">
              {companyName}
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Gestão de Ar Condicionado</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {sections.map((section: any, idx: number) => {
          const SectionIcon = sectionIconMap[section.icon] || Settings;
          return (
            <SidebarGroup key={idx}>
              <SidebarGroupLabel className={`transition-all duration-300 flex items-center gap-2 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
                <SectionIcon className="w-3 h-3" />
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {renderMenuItems(section.items)}
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Super Admin */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              <Shield className="w-3 h-3 mr-1" />
              Super Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onNavigateMembers}
                    tooltip="Gerenciar Usuários"
                    className="hover:bg-muted hover:translate-x-1 transition-all duration-200"
                  >
                    <UserCog className="w-4 h-4" />
                    <span>Gerenciar Usuários</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => { toggleBeta(); betaNavigate('/beta'); }}
              tooltip="Acessar Sistema Beta"
              className="hover:bg-accent/10 text-accent transition-all duration-200 hover:translate-x-1"
            >
              <Zap className="w-4 h-4 transition-transform duration-300 hover:scale-110" />
              <span>Sistema Beta</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              className="hover:bg-muted transition-all duration-200 hover:translate-x-1"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 transition-transform duration-300 hover:rotate-12" />
              ) : (
                <Sun className="w-4 h-4 transition-transform duration-300 hover:rotate-45" />
              )}
              <span>{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSignOut}
              tooltip="Sair"
              className="hover:bg-destructive/10 text-destructive hover:text-destructive transition-all duration-200 hover:translate-x-1"
            >
              <LogOut className="w-4 h-4 transition-transform duration-200 hover:scale-110" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
