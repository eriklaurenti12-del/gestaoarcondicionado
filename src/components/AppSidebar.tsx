import { BarChart3, CalendarDays, Users, Wrench, Building2, TrendingUp, Briefcase, UserCog, Moon, Sun, LogOut, Wallet, CreditCard, Database, ShoppingCart, FolderOpen, Settings, Wind, Shield, FileText, Store, Fuel, Bell } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
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
  onNavigateMembers: () => void;
  onSignOut: () => void;
}

// Menu Principal
const mainItems = [
  { id: "dashboard", title: "Dashboard", icon: BarChart3 },
  { id: "appointments", title: "Agenda", icon: CalendarDays },
];

// Cadastros
const cadastrosItems = [
  { id: "clients", title: "Clientes", icon: Users },
  { id: "products", title: "Serviços", icon: Wrench },
  { id: "suppliers", title: "Fornecedores", icon: Building2 },
];

// Vendas e Financeiro
const vendasItems = [
  { id: "pdv", title: "PDV", icon: Store },
  { id: "quotes", title: "Orçamentos", icon: FileText },
  { id: "service-orders", title: "Ordens de Serviço", icon: Briefcase },
  { id: "sales", title: "Vendas", icon: ShoppingCart },
  { id: "financeiro", title: "Financeiro", icon: Wallet },
  { id: "installments", title: "Parcelas", icon: CreditCard },
  { id: "expenses", title: "Gastos Fixos", icon: Fuel },
];

// Ferramentas
const toolsItems = [
  { id: "reminders", title: "Lembretes", icon: Bell },
  { id: "reports", title: "Relatórios & Gráficos", icon: TrendingUp },
  { id: "backup", title: "Backup", icon: Database },
];

// Configurações
const configItems = [
  { id: "company", title: "Minha Empresa", icon: Briefcase },
];

export function AppSidebar({ activeTab, onTabChange, isSuperAdmin, onNavigateMembers, onSignOut }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const renderMenuItems = (items: typeof mainItems) => (
    <SidebarMenu>
      {items.map((item) => (
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
            <item.icon className={`w-4 h-4 transition-transform duration-200 ${activeTab === item.id ? 'scale-110' : ''}`} />
            <span className="transition-all duration-300">{item.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
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
            <span className="font-bold text-sm bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              AC Service Pro
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Gestão de Ar Condicionado</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {/* Menu Principal */}
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(mainItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cadastros */}
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 flex items-center gap-2 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            <FolderOpen className="w-3 h-3" />
            Cadastros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(cadastrosItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Vendas e Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 flex items-center gap-2 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            <ShoppingCart className="w-3 h-3" />
            Operações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(vendasItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Ferramentas */}
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 flex items-center gap-2 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            <Settings className="w-3 h-3" />
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(toolsItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            Configurações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(configItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Administração */}
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
