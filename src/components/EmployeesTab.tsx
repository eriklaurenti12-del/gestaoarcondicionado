import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, UserPlus, KeyRound, Phone, Shield, ShieldCheck, 
  Trash2, Edit2, UserX, UserCheck, ExternalLink, Copy,
  Search, Loader2, DollarSign, Calendar, Lock, Link2, CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { recordFinancialEntry } from "@/utils/financialHelpers";

export type TeamRole = "admin" | "gerente" | "atendimento" | "tecnico" | "vendedor";

export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  role: TeamRole;
  is_active: boolean;
  created_at: string;
  monthly_salary?: number | null;
  vale_amount?: number | null;
  expense_category?: string | null;
  permissions?: string[] | null;
  pin?: string;
}

const ROLE_LABELS: Record<TeamRole, { label: string, color: string, description: string }> = {
  admin: { 
    label: "Administrador", 
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    description: "Acesso total ao sistema, financeiro e configurações."
  },
  gerente: { 
    label: "Gerente", 
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    description: "Acesso operacional completo e relatórios básicos."
  },
  atendimento: { 
    label: "Atendimento", 
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    description: "Acesso à agenda, clientes e agendamento online."
  },
  tecnico: { 
    label: "Técnico", 
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    description: "Acesso às próprias rotas, serviços e histórico técnico."
  },
  vendedor: { 
    label: "Vendedor", 
    color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    description: "Acesso ao PDV, vendas e cadastro de clientes."
  },
};

const ALL_PORTAL_TABS: { id: string; label: string; description: string }[] = [
  { id: "agenda", label: "Agenda", description: "Ver e criar agendamentos do dia" },
  { id: "cadastros", label: "Cadastros", description: "Listar e cadastrar clientes" },
  { id: "vendas", label: "Vendas / PDV", description: "Registrar vendas e produtos" },
  { id: "financeiro", label: "Financeiro", description: "Ver faturamento e relatórios" },
  { id: "admin", label: "Admin", description: "Liberar/cancelar assinantes (super-admin)" },
  { id: "suporte", label: "Suporte", description: "Atender solicitações da equipe" },
];

const ROLE_DEFAULT_PERMS: Record<TeamRole, string[]> = {
  admin: ["agenda", "cadastros", "financeiro", "vendas", "admin", "suporte"],
  gerente: ["agenda", "cadastros", "financeiro", "vendas", "suporte"],
  atendimento: ["agenda", "cadastros", "suporte"],
  tecnico: ["agenda", "suporte"],
  vendedor: ["vendas", "cadastros", "suporte"],
};

export default function EmployeesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "tecnico" as TeamRole,
    pin: "",
    monthly_salary: "",
    vale_amount: "",
    expense_category: "Salário",
    permissions: [...ROLE_DEFAULT_PERMS["tecnico"]] as string[],
  });
  
  // Financial modal state
  const [showFinanceDialog, setShowFinanceDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [financeData, setFinanceData] = useState({
    amount: "",
    description: "",
    category: "Salário",
    type: "saque" as "entrada" | "saque" | "reserva",
  });

  const togglePermission = (id: string) => {
    setFormData(fd => ({
      ...fd,
      permissions: fd.permissions.includes(id)
        ? fd.permissions.filter(p => p !== id)
        : [...fd.permissions, id],
    }));
  };

  const applyRoleDefaults = (role: TeamRole) => {
    setFormData(fd => ({ ...fd, role, permissions: [...ROLE_DEFAULT_PERMS[role]] }));
  };

  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) return;

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data as TeamMember[]);
    } catch (error: any) {
      toast({ title: "Erro ao carregar funcionários", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamMembers();

    const channel = supabase
      .channel('employees-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        loadTeamMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync salary/vale to fixed_expenses (auto recurring) for current month
  const syncRecurringExpense = async (memberId: string, memberName: string, salary: number, vale: number, category: string, userId: string) => {
    const tag = `auto:team:${memberId}`;
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);

    // Remove previous auto entries for this member in current month
    await supabase
      .from('fixed_expenses')
      .delete()
      .eq('user_id', userId)
      .ilike('description', `${tag}%`)
      .gte('expense_date', monthStart);

    const rows: any[] = [];
    if (salary > 0) {
      rows.push({
        user_id: userId,
        category,
        helper_name: memberName,
        amount: salary,
        description: `${tag} | ${category} mensal de ${memberName}`,
        expense_date: monthStart,
        is_recurring: true,
      });
    }
    if (vale > 0) {
      rows.push({
        user_id: userId,
        category: 'Vale',
        helper_name: memberName,
        amount: vale,
        description: `${tag} | Vale (adiantamento) de ${memberName}`,
        expense_date: monthStart,
        is_recurring: true,
      });
    }
    if (rows.length > 0) {
      await supabase.from('fixed_expenses').insert(rows);
    }
  };

  const handleSaveMember = async () => {
    if (!formData.name.trim() || (!editingMember && formData.pin.length !== 4)) {
      toast({ title: "Preencha o nome e um PIN de 4 dígitos", variant: "destructive" });
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) return;

      const salary = parseFloat(formData.monthly_salary || '0') || 0;
      const vale = parseFloat(formData.vale_amount || '0') || 0;
      const category = formData.expense_category || 'Salário';

      let memberId = editingMember?.id;
      const memberName = formData.name.trim();

      if (editingMember) {
        const { error } = await supabase
          .from('team_members')
          .update({
            name: memberName,
            phone: formData.phone.trim() || null,
            role: formData.role,
            monthly_salary: salary,
            vale_amount: vale,
            expense_category: category,
            permissions: formData.permissions as any,
          })
          .eq('id', editingMember.id);
        if (error) throw error;

        if (formData.pin.length === 4) {
          const { error: pinErr } = await supabase.rpc('set_team_member_pin', {
            _member_id: editingMember.id, _pin: formData.pin
          });
          if (pinErr) throw pinErr;
        }
        toast({ title: "Funcionário atualizado! ✓" });
      } else {
        const { data: inserted, error } = await supabase
          .from('team_members')
          .insert({
            user_id: session.user.id,
            name: memberName,
            phone: formData.phone.trim() || null,
            role: formData.role,
            is_active: true,
            monthly_salary: salary,
            vale_amount: vale,
            expense_category: category,
            permissions: formData.permissions as any,
          })
          .select('id')
          .single();
        if (error) throw error;
        memberId = inserted.id;

        const { error: pinErr } = await supabase.rpc('set_team_member_pin', {
          _member_id: inserted.id, _pin: formData.pin
        });
        if (pinErr) throw pinErr;

        toast({ title: "Funcionário cadastrado! ✓" });
      }

      // Sync recurring expense
      if (memberId && (salary > 0 || vale > 0)) {
        await syncRecurringExpense(memberId, memberName, salary, vale, category, session.user.id);
        toast({ title: "💰 Despesa recorrente atualizada", description: `${memberName} já consta no Gasto Recorrente do mês.` });
      }

      setShowAddDialog(false);
      setEditingMember(null);
      setFormData({ name: "", phone: "", role: "tecnico", pin: "", monthly_salary: "", vale_amount: "", expense_category: "Salário", permissions: [...ROLE_DEFAULT_PERMS["tecnico"]] });
      loadTeamMembers();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;
      
      setTeamMembers(teamMembers.map(m => 
        m.id === member.id ? { ...m, is_active: !member.is_active } : m
      ));
      
      toast({ 
        title: member.is_active ? "Acesso desativado" : "Acesso ativado",
        description: `${member.name} ${member.is_active ? 'não pode mais' : 'agora pode'} acessar o portal.`
      });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    if (!window.confirm(`Tem certeza que deseja remover ${member.name}? Isso apagará seu acesso permanentemente.`)) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;
      
      setTeamMembers(teamMembers.filter(m => m.id !== member.id));
      toast({ title: "Funcionário removido", variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const handleRecordFinance = async () => {
    if (!selectedMember || !financeData.amount) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) return;

      const { error } = await recordFinancialEntry({
        userId: session.user.id,
        type: financeData.type,
        amount: parseFloat(financeData.amount),
        description: `${financeData.category}: ${selectedMember.name} - ${financeData.description}`,
        paymentMethod: "Dinheiro",
        category: "Mão de Obra",
        providerName: selectedMember.name
      });

      if (error) throw error;

      toast({ title: "Registro financeiro salvo! 💰" });
      setShowFinanceDialog(false);
      setFinanceData({ amount: "", description: "", category: "Salário", type: "saque" });
    } catch (error: any) {
      toast({ title: "Erro ao registrar financeiro", description: error.message, variant: "destructive" });
    }
  };

  const copyPortalLink = () => {
    const url = `${window.location.origin}/portal`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado! 📋", description: "Envie para sua equipe acessar o sistema." });
  };

  const filteredMembers = teamMembers.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.phone?.includes(search)
  );

  const portalUrl = `${window.location.origin}/portal`;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Funcionários e Acessos</h2>
          <p className="text-muted-foreground">Gerencie sua equipe, permissões e acesso ao portal.</p>
        </div>
        <Button onClick={() => { setEditingMember(null); setFormData({ name: "", phone: "", role: "tecnico", pin: "", monthly_salary: "", vale_amount: "", expense_category: "Salário", permissions: [...ROLE_DEFAULT_PERMS["tecnico"]] }); setShowAddDialog(true); }} className="gap-2 shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4" /> Novo Funcionário
        </Button>
      </div>

      {/* Quick Access Link Card (matching attached screenshot style) */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Link de Acesso da Equipe</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Compartilhe com seus funcionários para que entrem com Nome + PIN.</p>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 font-mono text-xs text-muted-foreground truncate flex items-center">
              {portalUrl}
            </div>
            <Button
              variant="default"
              size="icon"
              className="h-auto px-3 shrink-0"
              onClick={copyPortalLink}
              title="Copiar link"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-auto px-3 shrink-0"
              onClick={() => window.open(portalUrl, '_blank')}
              title="Abrir portal"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou telefone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 h-11"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando equipe...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Nenhum funcionário encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                Cadastre seus colaboradores para que eles possam acessar o sistema com permissões controladas.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setShowAddDialog(true)}>
                Cadastrar Primeiro Funcionário
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredMembers.map((member) => (
                <Card key={member.id} className={`overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 ${!member.is_active ? 'opacity-60 grayscale-[0.5]' : 'shadow-sm hover:shadow-md'}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${member.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base truncate max-w-[150px]">{member.name}</CardTitle>
                          <Badge variant="outline" className={`text-[10px] mt-1 ${ROLE_LABELS[member.role]?.color || ''}`}>
                            {ROLE_LABELS[member.role]?.label || member.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => {
                            setEditingMember(member);
                            setFormData({
                              name: member.name,
                              phone: member.phone || "",
                              role: member.role,
                              pin: "",
                              monthly_salary: member.monthly_salary != null ? String(member.monthly_salary) : "",
                              vale_amount: member.vale_amount != null ? String(member.vale_amount) : "",
                              expense_category: member.expense_category || "Salário",
                              permissions: (member.permissions && member.permissions.length > 0) ? [...member.permissions] : [...ROLE_DEFAULT_PERMS[member.role]],
                            });
                            setShowAddDialog(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${member.is_active ? 'text-green-500' : 'text-amber-500'}`}
                          onClick={() => handleToggleActive(member)}
                        >
                          {member.is_active ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-500 hover:bg-blue-500/10"
                          title="Copiar Link Direto"
                          onClick={() => {
                            const url = `${window.location.origin}/portal?n=${encodeURIComponent(member.name)}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: `Link para ${member.name} copiado!` });
                          }}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-4">
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" /> {member.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> Desde {new Date(member.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3" /> PIN Protegido
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 text-[11px] h-8 gap-1.5"
                        onClick={() => { setSelectedMember(member); setShowFinanceDialog(true); }}
                      >
                        <DollarSign className="w-3 h-3" /> Financeiro
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive hover:bg-destructive/10 h-8 px-2"
                        onClick={() => handleDeleteMember(member)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[520px] max-h-[88vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Editar Funcionário' : 'Cadastrar Funcionário'}</DialogTitle>
            <DialogDescription>
              {editingMember 
                ? 'Atualize as informações e permissões do colaborador.' 
                : 'Defina o nome, função e senha de acesso do novo membro da equipe.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João Silva" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">WhatsApp</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pin">PIN (4 dígitos)</Label>
                <Input 
                  id="pin" 
                  type="password"
                  maxLength={4}
                  value={formData.pin} 
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0,4) })}
                  placeholder={editingMember ? "•••• (opcional)" : "••••"}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nível de Acesso (Função)</Label>
              <Select 
                value={formData.role} 
                onValueChange={(val: TeamRole) => applyRoleDefaults(val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as TeamRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{ROLE_LABELS[role].label}</span>
                        <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[role].description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissões granulares por funcionário */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <Label className="text-sm font-bold">Permissões do Portal</Label>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => applyRoleDefaults(formData.role)}>
                  <ShieldCheck className="w-3 h-3" /> Padrão da Função
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Marque apenas as áreas que este funcionário poderá acessar no portal <code className="text-foreground">/portal</code>.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_PORTAL_TABS.map((tab) => {
                  const checked = formData.permissions.includes(tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => togglePermission(tab.id)}
                      className={`text-left rounded-md border px-2.5 py-2 transition-all ${checked ? 'border-blue-500/50 bg-blue-500/10' : 'border-border/40 bg-muted/30 opacity-70'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground/30'}`}>
                          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-semibold">{tab.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 ml-6 leading-tight">{tab.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <Label className="text-sm font-bold">Pagamento Mensal Recorrente</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">Os valores abaixo entram automaticamente como <strong>Gasto Recorrente</strong> do mês. Você pode dividir entre Salário e Vale (adiantamento).</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Salário (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Vale / Adiantamento (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={formData.vale_amount}
                    onChange={(e) => setFormData({ ...formData, vale_amount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Categoria do Salário</Label>
                <Select
                  value={formData.expense_category}
                  onValueChange={(val) => setFormData({ ...formData, expense_category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salário">Salário</SelectItem>
                    <SelectItem value="Comissão">Comissão</SelectItem>
                    <SelectItem value="Diária">Diária</SelectItem>
                    <SelectItem value="Mão de Obra">Mão de Obra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveMember}>
              {editingMember ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finance Dialog */}
      <Dialog open={showFinanceDialog} onOpenChange={setShowFinanceDialog}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançamento Financeiro</DialogTitle>
            <DialogDescription>
              Registre custos vinculados a <strong>{selectedMember?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Gasto</Label>
                <Select 
                  value={financeData.category} 
                  onValueChange={(val) => setFinanceData({ ...financeData, category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salário">Salário</SelectItem>
                    <SelectItem value="Comissão">Comissão</SelectItem>
                    <SelectItem value="Bonificação">Bonificação</SelectItem>
                    <SelectItem value="Adiantamento">Adiantamento</SelectItem>
                    <SelectItem value="Ajuda de Custo">Ajuda de Custo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={financeData.amount}
                  onChange={(e) => setFinanceData({ ...financeData, amount: e.target.value })}
                  placeholder="0,00" 
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Input 
                value={financeData.description}
                onChange={(e) => setFinanceData({ ...financeData, description: e.target.value })}
                placeholder="Ex: Ref. mês de Maio" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinanceDialog(false)}>Cancelar</Button>
            <Button onClick={handleRecordFinance} className="gap-2">
              <DollarSign className="w-4 h-4" /> Registrar Saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
