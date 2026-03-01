import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Mail, Shield, Ban, UserX, Trash2, Users, Phone, Bell, Zap, Webhook, Megaphone, Share2, Gift, UserPlus, Copy, Monitor, Headphones, Link2, Menu, GripVertical, Save } from "lucide-react";
import { format } from "date-fns";

import AdminNotificationsPanel from "@/components/AdminNotificationsPanel";
import AdminIntegrationsTab from "@/components/AdminIntegrationsTab";
import AdminN8nTab from "@/components/AdminN8nTab";
import AdminLandingTab from "@/components/AdminLandingTab";
import AdminShareTab from "@/components/AdminShareTab";
import AdminRaffleTab from "@/components/AdminRaffleTab";
import AdminSidebarConfig from "@/components/AdminSidebarConfig";
type Member = {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  subscription: {
    plan: string;
    status: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

type TeamInvite = {
  id: string;
  invite_code: string;
  status: string;
  team_role: string;
  accepted_email: string | null;
  accepted_by: string | null;
  created_at: string;
  accepted_at: string | null;
};

const TEAM_ROLES: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  painel: { label: 'Painel Admin', desc: 'Acesso apenas ao painel administrativo', icon: Shield, color: 'text-cyan-400' },
  sistema: { label: 'Sistema Completo', desc: 'Acesso total ao sistema de gestão', icon: Monitor, color: 'text-green-400' },
  suporte: { label: 'Suporte', desc: 'Acesso para atendimento ao cliente', icon: Headphones, color: 'text-amber-400' },
};

export default function Members() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [supportNumbers, setSupportNumbers] = useState<{name: string; phone: string}[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [loadingInvite, setLoadingInvite] = useState(false);

  const publishedUrl = window.location.origin;

  useEffect(() => {
    checkSuperAdmin();
    loadMembers();
    loadSupportNumbers();
    loadTeamInvites();
  }, []);

  const loadSupportNumbers = async () => {
    const { data } = await supabase.from('admin_settings').select('value').eq('key', 'support_team_numbers').maybeSingle();
    if (data?.value) {
      try { setSupportNumbers(JSON.parse(data.value)); } catch {}
    }
  };

  const saveSupportNumbers = async () => {
    const { error } = await supabase.from('admin_settings').upsert({
      key: 'support_team_numbers',
      value: JSON.stringify(supportNumbers.filter(n => n.name && n.phone)),
      description: 'Números da equipe de suporte',
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: "Números de suporte atualizados." });
    }
  };

  const loadTeamInvites = async () => {
    const { data } = await supabase
      .from('team_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTeamInvites(data as TeamInvite[]);
  };

  const generateTeamInvite = async (role: string = 'sistema') => {
    setLoadingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      const { error } = await (supabase.from('team_invites') as any).insert({
        invite_code: code,
        created_by: user.id,
        status: 'pending',
        team_role: role
      });
      if (error) throw error;
      const roleLabel = TEAM_ROLES[role]?.label || role;
      toast({ title: "Link criado!", description: `Convite ${roleLabel}: ${code}` });
      loadTeamInvites();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoadingInvite(false);
    }
  };

  const deleteInvite = async (id: string) => {
    await supabase.from('team_invites').delete().eq('id', id);
    loadTeamInvites();
    toast({ title: "Convite removido" });
  };

  const removeTeamMember = async (invite: TeamInvite) => {
    if (!window.confirm(`Remover ${invite.accepted_email} da equipe? O membro perderá acesso co-admin.`)) return;
    
    // Remove role and deactivate subscription for the team member
    if (invite.accepted_by) {
      await supabase.functions.invoke('admin-update-subscription', {
        body: {
          target_user_id: invite.accepted_by,
          plan: 'mensal',
          status: 'cancelado',
          is_active: false,
          start_date: new Date().toISOString(),
          end_date: null,
          payment_date: null
        }
      });
    }
    
    // Delete the invite
    await supabase.from('team_invites').delete().eq('id', invite.id);
    loadTeamInvites();
    toast({ title: "Membro removido da equipe", variant: "destructive" });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado! 📋" });
  };

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

  const updateSubscription = async (targetUserId: string, plan: string, status: string) => {
    try {
      const startDate = new Date();
      let endDate: Date | null = null;
      if (plan !== 'vitalicio') {
        endDate = new Date();
        if (plan === 'anual') endDate.setFullYear(endDate.getFullYear() + 1);
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
      toast({
        title: "Sucesso!",
        description: status === 'aprovado' ? "Acesso liberado!" : "Assinatura atualizada."
      });
      await loadMembers();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const banUser = async (targetUserId: string, email: string) => {
    if (!window.confirm(`Banir ${email}?`)) return;
    try {
      await updateSubscription(targetUserId, 'mensal', 'cancelado');
      toast({ title: "Usuário Banido", description: `${email} foi banido.`, variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      aprovado: "default", pendente: "secondary", vencido: "destructive", cancelado: "outline"
    };
    const labels: Record<string, string> = {
      aprovado: "✓ Ativo", pendente: "⏳ Pendente", vencido: "⚠️ Vencido", cancelado: "🚫 Banido"
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const filteredMembers = members.filter(m => m.email.toLowerCase().includes(search.toLowerCase()));
  const acceptedInvites = teamInvites.filter(i => i.status === 'accepted');
  const pendingInvites = teamInvites.filter(i => i.status === 'pending');

  const stats = {
    total: members.length,
    aprovados: members.filter(m => m.subscription?.status === 'aprovado').length,
    aguardando: members.filter(m => m.subscription?.status === 'pendente').length,
    banidos: members.filter(m => m.subscription?.status === 'cancelado').length,
    vitalicio: members.filter(m => m.subscription?.plan === 'vitalicio').length
  };

  if (!isSuperAdmin || loading) return null;

  return (
    <div className="min-h-screen bg-background p-6 relative" style={{ minWidth: '100%' }}>
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Painel Super Admin
            </h1>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 rounded-xl">
            <TabsTrigger value="users" className="text-xs rounded-lg">
              <Users className="w-4 h-4 mr-1" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs rounded-lg">
              <UserPlus className="w-4 h-4 mr-1" /> Equipe
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs rounded-lg">
              <Bell className="w-4 h-4 mr-1" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs rounded-lg">
              <Zap className="w-4 h-4 mr-1" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="n8n" className="text-xs rounded-lg">
              <Webhook className="w-4 h-4 mr-1" /> n8n
            </TabsTrigger>
            <TabsTrigger value="landing" className="text-xs rounded-lg">
              <Megaphone className="w-4 h-4 mr-1" /> Landing
            </TabsTrigger>
            <TabsTrigger value="share" className="text-xs rounded-lg">
              <Share2 className="w-4 h-4 mr-1" /> Links
            </TabsTrigger>
            <TabsTrigger value="raffle" className="text-xs rounded-lg">
              <Gift className="w-4 h-4 mr-1" /> Sorteio
            </TabsTrigger>
            <TabsTrigger value="sidebar-config" className="text-xs rounded-lg">
              <Menu className="w-4 h-4 mr-1" /> Menu
            </TabsTrigger>
          </TabsList>

          {/* TEAM TAB */}
          <TabsContent value="team" className="mt-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" /> Gestão de Equipe
                </h2>
                <p className="text-muted-foreground text-sm">Crie links fixos para convidar membros com funções específicas</p>
              </div>
            </div>

            {/* Generate invites by role */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-primary" /> Gerar Link de Convite
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  Escolha a função e gere um link fixo.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  {Object.entries(TEAM_ROLES).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                      <button key={key} onClick={() => generateTeamInvite(key)} disabled={loadingInvite}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 transition-all group">
                        <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">
                          <Icon className={`w-6 h-6 ${info.color}`} />
                        </div>
                        <span className="font-medium text-sm">{info.label}</span>
                        <span className="text-muted-foreground text-xs text-center">{info.desc}</span>
                        <Badge variant="outline" className="text-xs mt-1">
                          + Gerar Link
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Phone Numbers - Direct Team */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5 text-green-500" /> Números da Equipe
                </CardTitle>
                <p className="text-muted-foreground text-xs">Cadastre os telefones da equipe para suporte.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {supportNumbers.map((num, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-muted/30 border border-border rounded-lg p-3">
                    <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:gap-2">
                      <Input value={num.name} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].name = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="Nome" className="flex-1" />
                      <Input value={num.phone} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].phone = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="(11) 99999-9999" className="flex-1" />
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                        onClick={() => { if (num.phone) window.open(`https://wa.me/55${num.phone.replace(/\D/g, '')}`, '_blank'); }}>
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => {
                        setSupportNumbers(supportNumbers.filter((_, i) => i !== idx));
                      }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => setSupportNumbers([...supportNumbers, { name: '', phone: '' }])}>
                    <UserPlus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                  <Button size="sm" onClick={saveSupportNumbers}>Salvar</Button>
                  {supportNumbers.length > 0 && (
                    <Button size="sm" variant="outline"
                      onClick={() => {
                        const available = supportNumbers.filter(n => n.phone);
                        if (available.length === 0) { toast({ title: "Nenhum número cadastrado" }); return; }
                        const random = available[Math.floor(Math.random() * available.length)];
                        window.open(`https://wa.me/55${random.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${random.name}! Preciso de atendimento.`)}`, '_blank');
                        toast({ title: `Conectando com ${random.name}...` });
                      }}>
                      🎲 Aleatório
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Team Members */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  👥 Membros Ativos ({acceptedInvites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {acceptedInvites.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhum membro na equipe ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                         <TableRow className="border-border">
                        <TableHead>Email</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Aceito em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedInvites.map(invite => {
                        const roleInfo = TEAM_ROLES[(invite as any).team_role] || TEAM_ROLES.sistema;
                        const RoleIcon = roleInfo.icon;
                        return (
                          <TableRow key={invite.id}>
                            <TableCell className="font-medium">{invite.accepted_email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="gap-1">
                                <RoleIcon className={`w-3 h-3 ${roleInfo.color}`} />
                                {roleInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {invite.accepted_at ? format(new Date(invite.accepted_at), 'dd/MM/yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="destructive" onClick={() => removeTeamMember(invite)}
                                className="text-xs">
                                <Trash2 className="w-3 h-3 mr-1" /> Remover
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  ⏳ Links Pendentes ({pendingInvites.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingInvites.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">Nenhum link pendente.</p>
                ) : (
                  pendingInvites.map(invite => {
                    const teamUrl = `${publishedUrl}/auth?team=${invite.invite_code}`;
                    const roleInfo = TEAM_ROLES[(invite as any).team_role] || TEAM_ROLES.sistema;
                    const RoleIcon = roleInfo.icon;
                    return (
                      <div key={invite.id} className="flex items-center gap-3 bg-muted/30 border border-border rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <RoleIcon className={`w-3 h-3 ${roleInfo.color}`} />
                              {roleInfo.label}
                            </Badge>
                            <code className="text-primary text-xs font-mono">{invite.invite_code}</code>
                          </div>
                          <p className="text-muted-foreground text-xs truncate">{teamUrl}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(teamUrl)}
                          className="text-xs">
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteInvite(invite.id)}
                          className="text-xs">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <AdminNotificationsPanel />
          </TabsContent>

          <TabsContent value="users" className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={loadMembers} variant="outline">
                Atualizar Lista
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="border-border">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border-emerald-500/30">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-emerald-400">{stats.aprovados}</div>
                  <div className="text-xs text-emerald-300/70">✓ Ativos</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border-amber-500/30">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-amber-400">{stats.aguardando}</div>
                  <div className="text-xs text-amber-300/70">⏱ Aguardando</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-rose-500/15 to-rose-600/5 border-rose-500/30">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-rose-400">{stats.banidos}</div>
                  <div className="text-xs text-rose-300/70">🚫 Banidos</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-violet-500/15 to-violet-600/5 border-violet-500/30">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-violet-400">{stats.vitalicio}</div>
                  <div className="text-xs text-violet-300/70">∞ Vitalício</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle>Gerenciar Usuários</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)}
                      className="pl-10" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto touch-pan-x">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="min-w-[180px]">Email</TableHead>
                        <TableHead className="min-w-[120px]">WhatsApp</TableHead>
                        <TableHead className="min-w-[110px]">Plano</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Cadastro</TableHead>
                        <TableHead className="min-w-[100px]">Vencimento</TableHead>
                        <TableHead className="min-w-[180px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const isSuperAdminUser = member.email === 'eriklaurenti09@gmail.com';
                        return (
                          <TableRow key={member.id} className={`${member.subscription?.status === 'cancelado' ? 'bg-destructive/5' : ''} ${isSuperAdminUser ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}>
                            <TableCell className="font-medium text-xs">
                              <div className="flex items-center gap-2">
                                {isSuperAdminUser && <Shield className="w-4 h-4 text-primary flex-shrink-0" />}
                                <span className="truncate max-w-[150px]" title={member.email}>{member.email}</span>
                                {isSuperAdminUser && <Badge className="text-[10px]">SUPREMO</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {member.phone ? (
                                <Button size="sm" variant="ghost"
                                  onClick={() => window.open(`https://wa.me/55${member.phone?.replace(/\D/g, '')}`, '_blank')}
                                  className="h-8 px-2">
                                  <Phone className="w-3 h-3 mr-1" />
                                  <span className="text-xs">{member.phone}</span>
                                </Button>
                              ) : <span className="text-muted-foreground text-xs">-</span>}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge>Vitalício</Badge>
                              ) : (
                                <Select value={member.subscription?.plan || 'mensal'}
                                  onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}>
                                  <SelectTrigger className="w-[100px] h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[120px] z-50" position="popper" sideOffset={4} align="start" avoidCollisions={false}>
                                    <SelectItem value="vitalicio">Vitalício</SelectItem>
                                    <SelectItem value="anual">1 Ano</SelectItem>
                                    <SelectItem value="trimestral">3 Meses</SelectItem>
                                    <SelectItem value="mensal">1 Mês</SelectItem>
                                    <SelectItem value="7dias">7 Dias</SelectItem>
                                    <SelectItem value="1dia">1 Dia</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge>✓ Supremo</Badge>
                              ) : member.subscription && getStatusBadge(member.subscription.status)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(member.created_at), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {isSuperAdminUser ? '∞' : member.subscription?.end_date 
                                ? format(new Date(member.subscription.end_date), 'dd/MM/yyyy')
                                : member.subscription?.plan === 'vitalicio' ? '∞' : '-'}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge variant="outline">
                                  <Shield className="w-3 h-3 mr-1" /> Protegido
                                </Badge>
                              ) : (
                                <div className="flex gap-2">
                                  <Button size="sm"
                                    variant={member.subscription?.status === 'aprovado' ? 'outline' : 'default'}
                                    onClick={() => updateSubscription(member.id, member.subscription?.plan || 'mensal',
                                      member.subscription?.status === 'aprovado' ? 'pendente' : 'aprovado')}
                                    className={`text-xs whitespace-nowrap ${
                                      member.subscription?.status === 'aprovado' 
                                        ? '' 
                                        : ''
                                    }`}>
                                    {member.subscription?.status === 'aprovado' ? 'Suspender' : 'Ativar'}
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => banUser(member.id, member.email)}
                                    className="text-xs" title="Banir">
                                    <Ban className="w-3 h-3" />
                                  </Button>
                                </div>
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

          <TabsContent value="integrations" className="mt-6">
            <AdminIntegrationsTab />
          </TabsContent>
          <TabsContent value="n8n" className="mt-6">
            <AdminN8nTab />
          </TabsContent>
          <TabsContent value="landing" className="mt-6">
            <AdminLandingTab />
          </TabsContent>
          <TabsContent value="share" className="mt-6">
            <AdminShareTab />
          </TabsContent>
          <TabsContent value="raffle" className="mt-6">
            <AdminRaffleTab />
          </TabsContent>
          <TabsContent value="sidebar-config" className="mt-6">
            <AdminSidebarConfig />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
