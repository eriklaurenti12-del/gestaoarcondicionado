import { BarChart3, CalendarDays, Users, Scissors, Building2, TrendingUp, Briefcase, UserCog, Moon, Sun, LogOut, Wallet, CreditCard, PieChart, CalendarRange, Database } from "lucide-react";
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

const menuItems = [
  { id: "dashboard", title: "Dashboard", icon: BarChart3 },
  { id: "appointments", title: "Agenda", icon: CalendarDays },
  { id: "calendar", title: "Calendário", icon: CalendarRange },
  { id: "clients", title: "Clientes", icon: Users },
  { id: "products", title: "Serviços", icon: Scissors },
  { id: "suppliers", title: "Fornecedores", icon: Building2 },
  { id: "financeiro", title: "Financeiro", icon: Wallet },
  { id: "installments", title: "Parcelas", icon: CreditCard },
  { id: "company", title: "Meu Salão", icon: Briefcase },
];

const toolsItems = [
  { id: "charts", title: "Gráficos", icon: PieChart },
  { id: "reports", title: "Relatórios", icon: TrendingUp },
  { id: "backup", title: "Backup", icon: Database },
];

export function AppSidebar({ activeTab, onTabChange, isSuperAdmin, onNavigateMembers, onSignOut }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border transition-all duration-300">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 transition-transform duration-300 hover:scale-105">
            <Scissors className="w-5 h-5 text-primary" />
          </div>
          <div className={`flex flex-col transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <span className="font-bold text-sm bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap">
              Salão de Beleza
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Gestão Completa</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
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
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <item.icon className={`w-4 h-4 transition-transform duration-200 ${activeTab === item.id ? 'scale-110' : ''}`} />
                    <span className="transition-all duration-300">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => (
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
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className={`transition-all duration-300 ${isCollapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`}>
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onNavigateMembers}
                    tooltip="Gerenciar Membros"
                    className="hover:bg-muted hover:translate-x-1 transition-all duration-200"
                  >
                    <UserCog className="w-4 h-4" />
                    <span>Membros</span>
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
