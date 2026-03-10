import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Shield, Ban, UserX, Trash2, Users, Phone, Bell, Zap, Webhook, Megaphone, Gift, UserPlus, Monitor, Headphones, Menu, ExternalLink, MessageCircle, Edit2, ToggleLeft, ToggleRight, Settings2, BookOpen, LifeBuoy, Link, Copy, GripVertical } from "lucide-react";
import { useBetaMode } from "@/contexts/BetaModeContext";
import { format } from "date-fns";

import AdminNotificationsPanel from "@/components/AdminNotificationsPanel";
import AdminIntegrationsTab from "@/components/AdminIntegrationsTab";
import AdminN8nTab from "@/components/AdminN8nTab";
import AdminLandingTab from "@/components/AdminLandingTab";

import AdminRaffleTab from "@/components/AdminRaffleTab";
import AdminSidebarConfig from "@/components/AdminSidebarConfig";
import { AdminGuideCards } from "@/components/AdminGuideCards";

import AdminSystemGuideTab from "@/components/AdminSystemGuideTab";
import AdminSupportTab from "@/components/AdminSupportTab";
import { Switch } from "@/components/ui/switch";

type Member = {
  id: string;
  email: string;
  phone: string | null;
  company_whatsapp: string | null;
  company_name: string | null;
  created_at: string;
  subscription: {
    plan: string;
    status: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

type TeamMember = {
  id: string;
  name: string;
  phone: string | null;
  pin: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

const TEAM_ROLES: Record<string, { label: string; icon: any; color: string; description: string }> = {
  painel: { label: 'Painel Admin', icon: Shield, color: 'text-cyan-400', description: 'Apenas visualiza o Dashboard' },
  suporte: { label: 'Suporte', icon: Headphones, color: 'text-amber-400', description: 'Agenda, Clientes, Financeiro, Produtos, Assinantes, Agendar' },
  gerente: { label: 'Gerente', icon: Shield, color: 'text-purple-400', description: 'Acesso total incluindo gestão de assinantes' },
  sistema: { label: 'Sistema Completo', icon: Monitor, color: 'text-emerald-400', description: 'Agenda, Clientes, Agendar e Suporte' },
};

const publishedUrl = 'https://gestaoarcondicionado.lovable.app';

const DEFAULT_TABS = [
  { id: 'team', label: 'Equipe', icon: 'Users' },
  { id: 'users', label: 'Usuários', icon: 'UserPlus' },
  { id: 'notifications', label: 'Notificações', icon: 'Bell' },
  { id: 'integrations', label: 'Integrações', icon: 'Zap' },
  { id: 'n8n', label: 'n8n', icon: 'Webhook' },
  { id: 'landing', label: 'Landing', icon: 'Megaphone' },
  { id: 'links', label: 'Links', icon: 'Link' },
  { id: 'raffle', label: 'Sorteio', icon: 'Gift' },
  { id: 'sidebar-config', label: 'Menu', icon: 'Menu' },
  { id: 'support', label: 'Suporte', icon: 'LifeBuoy' },
  { id: 'system-guide', label: 'Guia PDF', icon: 'BookOpen' },
];

const TAB_ICONS: Record<string, any> = {
  Users, UserPlus, Bell, Zap, Webhook, Megaphone, Link, Gift, Menu, LifeBuoy, BookOpen
};

export default function Members() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");

  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newRole, setNewRole] = useState("sistema");

  // Tab configuration
  const [tabOrder, setTabOrder] = useState(DEFAULT_TABS);
  const [showTabConfig, setShowTabConfig] = useState(false);
  const [tabDragIdx, setTabDragIdx] = useState<number | null>(null);
  const [tabDragOverIdx, setTabDragOverIdx] = useState<number | null>(null);

  const loadTabOrder = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'members_tab_order')
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value);
        if (Array.isArray(parsed)) {
          const merged = parsed.filter((t: any) => DEFAULT_TABS.some(d => d.id === t.id));
          const missing = DEFAULT_TABS.filter(d => !parsed.some((t: any) => t.id === d.id));
          setTabOrder([...merged, ...missing]);
        }
      } catch {}
    }
  };

  useEffect(() => {
    checkSuperAdmin();
    loadMembers();
    loadTeamMembers();
    loadTabOrder();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();
    if (error || !roleData) { navigate("/"); return; }
    setIsSuperAdmin(true);
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      setMembers((data as Member[]) || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTeamMembers(data as TeamMember[]);
    if (error) console.error('loadTeamMembers error:', error.message);
  };

  const saveTabOrder = async (newOrder: typeof DEFAULT_TABS) => {
    setTabOrder(newOrder);
    await supabase.from('admin_settings').upsert({
      key: 'members_tab_order',
      value: JSON.stringify(newOrder),
      description: 'Ordem das abas do painel admin',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    toast({ title: "Ordem das abas salva! ✓" });
  };

  const handleTabDragStart = (idx: number) => setTabDragIdx(idx);
  const handleTabDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setTabDragOverIdx(idx); };
  const handleTabDrop = (targetIdx: number) => {
    if (tabDragIdx !== null && tabDragIdx !== targetIdx) {
      const newOrder = [...tabOrder];
      const [moved] = newOrder.splice(tabDragIdx, 1);
      newOrder.splice(targetIdx, 0, moved);
      saveTabOrder(newOrder);
    }
    setTabDragIdx(null);
    setTabDragOverIdx(null);
  };
  const handleTabDragEnd = () => { setTabDragIdx(null); setTabDragOverIdx(null); };

  const addTeamMember = async () => {
    if (!newName.trim() || !newPin || newPin.length !== 4) {
      toast({ title: "Preencha nome e PIN de 4 dígitos", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('team_members').insert({
      user_id: user.id,
      name: newName.trim(),
      phone: newPhone.trim() || null,
      pin: newPin,
      role: newRole,
    } as any);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro adicionado! ✓" });
      resetForm();
      setShowAddDialog(false);
      loadTeamMembers();
    }
  };

  const updateTeamMember = async () => {
    if (!editingMember || !newName.trim()) return;

    const updateData: any = { name: newName.trim(), phone: newPhone.trim() || null, role: newRole };
    if (newPin.length === 4) updateData.pin = newPin;

    const { error } = await supabase.from('team_members').update(updateData).eq('id', editingMember.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Membro atualizado! ✓" });
      resetForm();
      setEditingMember(null);
      loadTeamMembers();
    }
  };

  const toggleMemberActive = async (member: TeamMember) => {
    await supabase.from('team_members').update({ is_active: !member.is_active }).eq('id', member.id);
    loadTeamMembers();
    toast({ title: member.is_active ? "Membro desativado" : "Membro ativado" });
  };

  const deleteMember = async (member: TeamMember) => {
    if (!window.confirm(`Remover ${member.name} da equipe?`)) return;
    await supabase.from('team_members').delete().eq('id', member.id);
    loadTeamMembers();
    toast({ title: "Membro removido", variant: "destructive" });
  };

  const startEdit = (member: TeamMember) => {
    setEditingMember(member);
    setNewName(member.name);
    setNewPhone(member.phone || "");
    setNewPin("");
    setNewRole(member.role);
  };

  const resetForm = () => {
    setNewName(""); setNewPhone(""); setNewPin(""); setNewRole("sistema");
  };

  // Subscription management
  const updateSubscription = async (targetUserId: string, plan: string, status: string) => {
    try {
      const startDate = new Date();
      let endDate: Date | null = null;
      if (plan !== 'vitalicio') {
        endDate = new Date();
        if (plan === 'anual') endDate.setFullYear(endDate.getFullYear() + 1);
        else if (plan === 'semestral') endDate.setMonth(endDate.getMonth() + 6);
        else if (plan === 'trimestral') endDate.setMonth(endDate.getMonth() + 3);
        else if (plan === '7dias') endDate.setDate(endDate.getDate() + 7);
        else if (plan === '1dia') endDate.setDate(endDate.getDate() + 1);
        else endDate.setMonth(endDate.getMonth() + 1);
      }
      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: {
          target_user_id: targetUserId, plan, status,
          is_active: status === 'aprovado',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString() || null,
          payment_date: status === 'aprovado' ? startDate.toISOString() : null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Sucesso!", description: status === 'aprovado' ? "Acesso liberado!" : "Assinatura atualizada." });
      await loadMembers();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const banUser = async (targetUserId: string, email: string) => {
    if (!window.confirm(`Banir ${email}?`)) return;
    await updateSubscription(targetUserId, 'mensal', 'cancelado');
    toast({ title: "Usuário Banido", variant: "destructive" });
  };

  const deleteUserPermanently = async (targetUserId: string, email: string, deleteData: boolean) => {
    const msg = deleteData
      ? `⚠️ EXCLUIR ${email} E TODOS OS DADOS? IRREVERSÍVEL!`
      : `Excluir conta de ${email}? Dados mantidos.`;
    if (!window.confirm(msg)) return;
    if (deleteData && !window.confirm(`ÚLTIMA CONFIRMAÇÃO para ${email}?`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { target_user_id: targetUserId, delete_data: deleteData }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário excluído", variant: "destructive" });
      await loadMembers();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      aprovado: "default", pendente: "secondary", vencido: "destructive", cancelado: "outline"
    };
    const labels: Record<string, string> = {
      aprovado: "aprovado", pendente: "pendente", vencido: "vencido", cancelado: "cancelado"
    };
    const colors: Record<string, string> = {
      aprovado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      pendente: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      vencido: "bg-red-500/20 text-red-400 border-red-500/30",
      cancelado: "bg-rose-500/20 text-rose-400 border-rose-500/30"
    };
    return <Badge className={`${colors[status] || ''} text-xs`}>{labels[status] || status}</Badge>;
  };

  const getTimeRemaining = (member: Member) => {
    if (!member.subscription) return { label: '-', color: 'text-muted-foreground' };
    if (member.subscription.plan === 'vitalicio' && member.subscription.status === 'aprovado') {
      return { label: '∞', color: 'text-emerald-400' };
    }
    if (!member.subscription.end_date) return { label: '-', color: 'text-muted-foreground' };
    const ms = new Date(member.subscription.end_date).getTime() - Date.now();
    if (ms <= 0) return { label: '0d', color: 'text-red-500' };
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days <= 3) return { label: `${days}d`, color: 'text-red-500' };
    if (days <= 7) return { label: `${days}d`, color: 'text-amber-500' };
    return { label: `${days}d`, color: 'text-emerald-400' };
  };

  const filteredMembers = members.filter(m => m.email.toLowerCase().includes(search.toLowerCase()));
  const activeTeam = teamMembers.filter(m => m.is_active);

  const stats = {
    total: members.length,
    aprovados: members.filter(m => m.subscription?.status === 'aprovado').length,
    aguardando: members.filter(m => m.subscription?.status === 'pendente').length,
    banidos: members.filter(m => m.subscription?.status === 'cancelado').length,
    vitalicio: members.filter(m => m.subscription?.plan === 'vitalicio').length
  };

  if (!isSuperAdmin || loading) return null;

  // Team member form (shared between add and edit)
  const MemberForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="space-y-4" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input 
          value={newName} 
          onChange={e => { e.stopPropagation(); setNewName(e.target.value); }} 
          onPointerDown={e => e.stopPropagation()}
          placeholder="Nome do membro" 
        />
      </div>
      <div className="space-y-2">
        <Label>WhatsApp</Label>
        <Input 
          value={newPhone} 
          onChange={e => { e.stopPropagation(); setNewPhone(e.target.value); }} 
          onPointerDown={e => e.stopPropagation()}
          placeholder="(11) 99999-9999" 
        />
      </div>
      <div className="space-y-2">
        <Label>PIN de Acesso (4 dígitos) {isEdit && '(deixe vazio para manter)'}</Label>
        <Input
          type="text" inputMode="numeric" maxLength={4}
          value={newPin}
          onChange={e => { e.stopPropagation(); setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); }}
          onPointerDown={e => e.stopPropagation()}
          placeholder={isEdit ? "••••" : "0000"}
          className="text-center text-xl tracking-[0.5em] font-mono"
        />
      </div>
      <div className="space-y-2">
        <Label>Função</Label>
        <Select value={newRole} onValueChange={setNewRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TEAM_ROLES).map(([key, info]) => (
              <SelectItem key={key} value={key}>
                <div className="flex flex-col">
                  <span>{info.label}</span>
                  <span className="text-[10px] text-muted-foreground">{info.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full" onClick={isEdit ? updateTeamMember : addTeamMember}>
        {isEdit ? 'Salvar Alterações' : 'Adicionar Membro'}
      </Button>
    </div>
  );

  const BetaSystemCard = () => {
    const { isBeta, toggleBeta } = useBetaMode();
    return (
      <Card className="mt-6 border-accent/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Sistema Simplificado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O Sistema Simplificado é uma interface com navegação por abas inferiores, ideal para uso rápido no celular. 
            Inclui Agenda, Clientes e Financeiro em uma interface mais intuitiva. Você pode alternar entre os dois a qualquer momento.
          </p>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Ativar Sistema Simplificado</p>
              <p className="text-xs text-muted-foreground">Ao ativar, será redirecionado para o modo simplificado</p>
            </div>
            <Switch checked={isBeta} onCheckedChange={() => { toggleBeta(); if (!isBeta) navigate('/beta'); }} />
          </div>
          <Button variant="outline" size="sm" onClick={() => { if (!isBeta) toggleBeta(); navigate('/beta'); }}>
            <Zap className="w-4 h-4 mr-2" /> Acessar Sistema Simplificado
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6" style={{ minWidth: '100%' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Painel Super Admin
          </h1>
        </div>

        <Tabs defaultValue="team" className="w-full">
          <div className="flex items-center gap-2">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 rounded-xl flex-1">
              {tabOrder.map(tab => {
                const IconComp = TAB_ICONS[tab.icon];
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="text-xs rounded-lg">
                    {IconComp && <IconComp className="w-4 h-4 mr-1" />} {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setShowTabConfig(true)} title="Reorganizar abas">
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Tab order config dialog */}
          <Dialog open={showTabConfig} onOpenChange={setShowTabConfig}>
            <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Reorganizar Abas
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Arraste para reordenar as abas do painel</p>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {tabOrder.map((tab, idx) => {
                  const IconComp = TAB_ICONS[tab.icon];
                  return (
                    <div
                      key={tab.id}
                      draggable
                      onDragStart={() => handleTabDragStart(idx)}
                      onDragOver={(e) => handleTabDragOver(e, idx)}
                      onDrop={() => handleTabDrop(idx)}
                      onDragEnd={handleTabDragEnd}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                        tabDragOverIdx === idx ? 'border-primary bg-primary/10' : 'bg-muted/30'
                      } ${tabDragIdx === idx ? 'opacity-40' : ''}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {IconComp && <IconComp className="w-4 h-4 text-primary flex-shrink-0" />}
                      <span className="text-sm font-medium flex-1">{tab.label}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{idx + 1}</Badge>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { saveTabOrder(DEFAULT_TABS); }}>
                  Restaurar Padrão
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setShowTabConfig(false)}>
                  Fechar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ============ TEAM TAB ============ */}
          <TabsContent value="team" className="mt-6 space-y-6">
            <AdminGuideCards tab="team" />
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Equipe
                </h2>
                <p className="text-muted-foreground text-sm">Cadastre membros que acessam o portal</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(`${publishedUrl}/portal`);
                  toast({ title: "Link copiado! 📋", description: `${publishedUrl}/portal` });
                }}>
                  <ExternalLink className="w-4 h-4 mr-1" /> Link do Portal
                </Button>
                <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="w-4 h-4 mr-1" /> Novo Membro
                    </Button>
                  </DialogTrigger>
                  <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                      <DialogTitle>Adicionar Membro</DialogTitle>
                    </DialogHeader>
                    <MemberForm isEdit={false} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{activeTeam.length}</div>
                    <div className="text-xs text-muted-foreground">Ativos</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <UserPlus className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{teamMembers.length}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Monitor className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{Object.keys(TEAM_ROLES).length}</div>
                    <div className="text-xs text-muted-foreground">Funções</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Member Cards */}
            {teamMembers.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {teamMembers.map(member => {
                  const roleInfo = TEAM_ROLES[member.role] || TEAM_ROLES.sistema;
                  const RoleIcon = roleInfo.icon;
                  const initial = member.name.charAt(0).toUpperCase();
                  const avatarColors = ['bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500'];
                  const avatarColor = avatarColors[member.name.charCodeAt(0) % avatarColors.length];

                  return (
                    <Card key={member.id} className={`transition-shadow hover:shadow-md ${!member.is_active ? 'opacity-50' : ''}`}>
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                              {initial}
                            </div>
                            <div>
                              <div className="font-semibold">{member.name}</div>
                              {member.phone && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="w-3 h-3" /> {member.phone}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant={member.is_active ? "default" : "secondary"} className="text-[10px]">
                            {member.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>

                        {/* Role */}
                        <div className="flex items-center gap-4 bg-muted/40 rounded-lg p-3">
                          <div className="text-center flex-1">
                            <div className="text-[10px] text-muted-foreground uppercase">Função</div>
                            <div className={`font-semibold text-sm flex items-center justify-center gap-1 ${roleInfo.color}`}>
                              <RoleIcon className="w-3.5 h-3.5" /> {roleInfo.label}
                            </div>
                          </div>
                          <div className="text-center flex-1">
                            <div className="text-[10px] text-muted-foreground uppercase">PIN</div>
                            <div className="font-mono font-semibold text-sm tracking-wider">••••</div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {member.phone && (
                            <Button size="sm" variant="outline" className="flex-1 text-xs"
                              onClick={() => window.open(`https://wa.me/55${member.phone!.replace(/\D/g, '')}`, '_blank')}>
                              <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                            onClick={() => toggleMemberActive(member)}
                            title={member.is_active ? 'Desativar' : 'Ativar'}>
                            {member.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => startEdit(member)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => deleteMember(member)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-2">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Nenhum membro cadastrado</p>
                  <p className="text-sm text-muted-foreground">Clique em "Novo Membro" para adicionar</p>
                </CardContent>
              </Card>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingMember} onOpenChange={(open) => { if (!open) { setEditingMember(null); resetForm(); } }}>
              <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Editar Membro</DialogTitle>
                </DialogHeader>
                <MemberForm isEdit={true} />
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============ USERS TAB ============ */}
          <TabsContent value="users" className="mt-6 space-y-6">
            <AdminGuideCards tab="users" />
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={loadMembers} variant="outline">Atualizar Lista</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
              <Card className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-emerald-500/30"><CardContent className="pt-4"><div className="text-2xl font-bold text-emerald-400">{stats.aprovados}</div><div className="text-xs text-emerald-300/70">✓ Ativos</div></CardContent></Card>
              <Card className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border-amber-500/30"><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-400">{stats.aguardando}</div><div className="text-xs text-amber-300/70">⏱ Aguardando</div></CardContent></Card>
              <Card className="bg-gradient-to-br from-rose-500/15 to-rose-600/5 border-rose-500/30"><CardContent className="pt-4"><div className="text-2xl font-bold text-rose-400">{stats.banidos}</div><div className="text-xs text-rose-300/70">🚫 Banidos</div></CardContent></Card>
              <Card className="bg-gradient-to-br from-violet-500/15 to-violet-600/5 border-violet-500/30"><CardContent className="pt-4"><div className="text-2xl font-bold text-violet-400">{stats.vitalicio}</div><div className="text-xs text-violet-300/70">∞ Vitalício</div></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-lg">Lista de Membros</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto touch-pan-x">
                  <Table className="min-w-[1050px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="min-w-[180px]">Email</TableHead>
                        <TableHead className="min-w-[130px]">WhatsApp Empresa</TableHead>
                        <TableHead className="min-w-[110px]">Plano</TableHead>
                        <TableHead className="min-w-[90px]">Status</TableHead>
                        <TableHead className="min-w-[90px]">Cadastro</TableHead>
                        <TableHead className="min-w-[90px]">Vencimento</TableHead>
                        <TableHead className="min-w-[60px] text-center">Tempo</TableHead>
                        <TableHead className="min-w-[90px]">Ações</TableHead>
                        <TableHead className="min-w-[50px] text-center">Excluir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const isSuperAdminUser = ['eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com'].includes(member.email);
                        const timeInfo = getTimeRemaining(member);
                        const whatsapp = member.company_whatsapp || member.phone;
                        return (
                          <TableRow key={member.id} className={`${member.subscription?.status === 'cancelado' ? 'bg-destructive/5' : ''} ${isSuperAdminUser ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                            <TableCell className="font-medium text-xs">
                              <div className="flex items-center gap-2">
                                {isSuperAdminUser && <Shield className="w-4 h-4 text-primary flex-shrink-0" />}
                                <span className="truncate max-w-[160px]" title={member.email}>{member.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {whatsapp ? (
                                <Button size="sm" variant="ghost" onClick={() => window.open(`https://wa.me/55${whatsapp.replace(/\D/g, '')}`, '_blank')} className="h-8 px-2 text-xs gap-1">
                                  <Phone className="w-3 h-3" />{whatsapp}
                                </Button>
                              ) : <span className="text-muted-foreground text-xs">-</span>}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? <Badge>Vitalício</Badge> : (
                                <Select value={member.subscription?.plan || 'mensal'} onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}>
                                  <SelectTrigger className="w-[105px] h-9 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent className="min-w-[120px] z-50" position="popper" sideOffset={4} align="start" avoidCollisions={false}>
                                    <SelectItem value="1dia">1 Dia</SelectItem>
                                    <SelectItem value="trimestral">3 Meses</SelectItem>
                                    <SelectItem value="semestral">6 Meses</SelectItem>
                                    <SelectItem value="anual">1 Ano</SelectItem>
                                    <SelectItem value="vitalicio">Vitalício</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>{isSuperAdminUser ? <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">supremo</Badge> : member.subscription && getStatusBadge(member.subscription.status)}</TableCell>
                            <TableCell className="text-xs">{format(new Date(member.created_at), 'dd/MM/yy')}</TableCell>
                            <TableCell className="text-xs">
                              {isSuperAdminUser ? '∞' : member.subscription?.end_date
                                ? format(new Date(member.subscription.end_date), 'dd/MM/yy')
                                : member.subscription?.plan === 'vitalicio' ? '∞' : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold text-sm ${timeInfo.color}`}>{timeInfo.label}</span>
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge variant="outline" className="text-[10px]"><Shield className="w-3 h-3 mr-1" /> Protegido</Badge>
                              ) : (
                                <Button size="sm" variant={member.subscription?.status === 'aprovado' ? 'outline' : 'default'}
                                  onClick={() => updateSubscription(member.id, member.subscription?.plan || 'mensal', member.subscription?.status === 'aprovado' ? 'pendente' : 'aprovado')}
                                  className="text-xs h-8">
                                  {member.subscription?.status === 'aprovado' ? 'Cancelar' : 'Ativar'}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isSuperAdminUser && (
                                <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => deleteUserPermanently(member.id, member.email, true)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6"><AdminNotificationsPanel /></TabsContent>
          <TabsContent value="integrations" className="mt-6"><AdminIntegrationsTab /></TabsContent>
          <TabsContent value="n8n" className="mt-6"><AdminN8nTab /></TabsContent>
          <TabsContent value="landing" className="mt-6"><AdminLandingTab /></TabsContent>
          <TabsContent value="raffle" className="mt-6"><AdminRaffleTab /></TabsContent>
          <TabsContent value="sidebar-config" className="mt-6"><AdminSidebarConfig /></TabsContent>
          <TabsContent value="support" className="mt-6"><AdminSupportTab /></TabsContent>
          <TabsContent value="links" className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <Link className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Links Rápidos & Compartilhamento</h2>
                  <p className="text-sm text-muted-foreground">Acesse e compartilhe todos os links do sistema</p>
                </div>
              </div>

              {/* System Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Landing Page (Vendas)', url: `${publishedUrl}/vendas`, icon: '🌐', desc: 'Página de vendas principal', external: true },
                  { label: 'Portal da Equipe', url: `${publishedUrl}/portal`, icon: '👥', desc: 'Login do portal da equipe', external: true },
                  { label: 'Agendamento Online', url: `${publishedUrl}/agendar`, icon: '📅', desc: 'Agendamento público', external: true },
                  { label: 'Login do Sistema', url: `${publishedUrl}/?login=true`, icon: '🔐', desc: 'Link direto para login', external: true },
                  { label: 'Cadastro', url: `${publishedUrl}/?cadastro=true`, icon: '📝', desc: 'Link para criar conta', external: true },
                  { label: 'Dashboard', url: '/dashboard', icon: '📊', desc: 'Painel de controle' },
                  { label: 'Simplificado', url: '/beta', icon: '⚡', desc: 'Interface simplificada' },
                ].map(link => (
                  <Card key={link.label} className="group cursor-pointer hover:border-primary/50 transition-all"
                    onClick={() => link.external ? window.open(link.url, '_blank') : navigate(link.url)}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{link.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{link.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{link.desc}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(link.external ? link.url : `${publishedUrl}${link.url}`);
                          toast({ title: "Link copiado! 📋" });
                        }}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <ExternalLink className="w-4 h-4 text-muted-foreground mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Beta System */}
              <BetaSystemCard />
            </div>
          </TabsContent>
          <TabsContent value="system-guide" className="mt-6">
            <AdminSystemGuideTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
