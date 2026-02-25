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
import { ArrowLeft, Search, Mail, Shield, Ban, UserX, Trash2, Users, Phone, Bell, Zap, Webhook, Megaphone, Share2, Gift, UserPlus, Copy } from "lucide-react";
import { format } from "date-fns";

import AdminNotificationsPanel from "@/components/AdminNotificationsPanel";
import AdminIntegrationsTab from "@/components/AdminIntegrationsTab";
import AdminN8nTab from "@/components/AdminN8nTab";
import AdminLandingTab from "@/components/AdminLandingTab";
import AdminShareTab from "@/components/AdminShareTab";
import AdminRaffleTab from "@/components/AdminRaffleTab";

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
  accepted_email: string | null;
  accepted_by: string | null;
  created_at: string;
  accepted_at: string | null;
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

  const publishedUrl = 'https://gestaoarcondicionado.lovable.app';

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
      description: 'Números da equipe de suporte'
    }, { onConflict: 'key' });
    if (!error) {
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

  const generateTeamInvite = async () => {
    setLoadingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      const { error } = await supabase.from('team_invites').insert({
        invite_code: code,
        created_by: user.id,
        status: 'pending'
      });
      if (error) throw error;
      toast({ title: "Link criado!", description: `Código: ${code}` });
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
    <div className="min-h-screen bg-[#0a0a0f] p-6 relative" style={{ minWidth: '100%' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
      </div>
      
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="bg-[#1a1a24] border-[#2a2a3a] hover:bg-[#2a2a3a] text-white">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-white">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-500" />
              Painel Super Admin
            </h1>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="users" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Users className="w-4 h-4 mr-1" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <UserPlus className="w-4 h-4 mr-1" /> Equipe
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Bell className="w-4 h-4 mr-1" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Zap className="w-4 h-4 mr-1" /> Integrações
            </TabsTrigger>
            <TabsTrigger value="n8n" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Webhook className="w-4 h-4 mr-1" /> n8n
            </TabsTrigger>
            <TabsTrigger value="landing" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Megaphone className="w-4 h-4 mr-1" /> Landing
            </TabsTrigger>
            <TabsTrigger value="share" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Share2 className="w-4 h-4 mr-1" /> Links
            </TabsTrigger>
            <TabsTrigger value="raffle" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs">
              <Gift className="w-4 h-4 mr-1" /> Sorteio
            </TabsTrigger>
          </TabsList>

          {/* TEAM TAB */}
          <TabsContent value="team" className="mt-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-cyan-400" /> Equipe Co-Admin
                </h2>
                <p className="text-gray-400 text-sm">Membros que co-administram o sistema</p>
              </div>
              <Button onClick={generateTeamInvite} disabled={loadingInvite}
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white">
                <UserPlus className="w-4 h-4 mr-2" /> Gerar Convite
              </Button>
            </div>

            {/* Phone Numbers - Direct Team */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5 text-green-400" /> Números da Equipe
                </CardTitle>
                <p className="text-gray-400 text-xs">
                  Cadastre os telefones da equipe. Clientes podem ligar para quem estiver disponível ou selecionar aleatório.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {supportNumbers.map((num, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-3">
                    <div className="flex-1 space-y-2 sm:space-y-0 sm:flex sm:gap-2">
                      <Input value={num.name} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].name = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="Nome do membro" className="bg-[#12121a] border-[#2a2a3a] text-white flex-1" />
                      <Input value={num.phone} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].phone = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="(11) 99999-9999" className="bg-[#12121a] border-[#2a2a3a] text-white flex-1" />
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-green-400 h-8 w-8 p-0"
                        onClick={() => {
                          if (num.phone) window.open(`https://wa.me/55${num.phone.replace(/\D/g, '')}`, '_blank');
                        }}><Phone className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400 h-8 w-8 p-0" onClick={() => {
                        setSupportNumbers(supportNumbers.filter((_, i) => i !== idx));
                      }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => setSupportNumbers([...supportNumbers, { name: '', phone: '' }])}
                    className="bg-[#2a2a3a] text-white hover:bg-[#3a3a4a]">
                    <UserPlus className="w-3 h-3 mr-1" /> Adicionar Membro
                  </Button>
                  <Button size="sm" onClick={saveSupportNumbers}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">Salvar Números</Button>
                  {supportNumbers.length > 0 && (
                    <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={() => {
                        const available = supportNumbers.filter(n => n.phone);
                        if (available.length === 0) { toast({ title: "Nenhum número cadastrado" }); return; }
                        const random = available[Math.floor(Math.random() * available.length)];
                        window.open(`https://wa.me/55${random.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${random.name}! Preciso de atendimento.`)}`, '_blank');
                        toast({ title: `Conectando com ${random.name}...` });
                      }}>
                      🎲 Chamar Aleatório
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Team Members */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  👥 Membros Ativos ({acceptedInvites.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {acceptedInvites.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">Nenhum membro na equipe ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#2a2a3a]">
                        <TableHead className="text-gray-400">Email</TableHead>
                        <TableHead className="text-gray-400">Código</TableHead>
                        <TableHead className="text-gray-400">Aceito em</TableHead>
                        <TableHead className="text-gray-400">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedInvites.map(invite => (
                        <TableRow key={invite.id} className="border-[#2a2a3a]">
                          <TableCell className="text-white font-medium">{invite.accepted_email}</TableCell>
                          <TableCell><code className="text-cyan-300 text-xs">{invite.invite_code}</code></TableCell>
                          <TableCell className="text-gray-400 text-sm">
                            {invite.accepted_at ? format(new Date(invite.accepted_at), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="destructive" onClick={() => removeTeamMember(invite)}
                              className="bg-red-600 hover:bg-red-700 text-xs">
                              <Trash2 className="w-3 h-3 mr-1" /> Remover
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pending Invites */}
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  ⏳ Convites Pendentes ({pendingInvites.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingInvites.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Nenhum convite pendente.</p>
                ) : (
                  pendingInvites.map(invite => {
                    const teamUrl = `${publishedUrl}/auth?team=${invite.invite_code}`;
                    return (
                      <div key={invite.id} className="flex items-center gap-3 bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <code className="text-cyan-300 text-sm font-mono">{invite.invite_code}</code>
                          <p className="text-gray-500 text-xs truncate mt-1">{teamUrl}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(teamUrl)}
                          className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] text-xs">
                          <Copy className="w-3 h-3 mr-1" /> Copiar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteInvite(invite.id)}
                          className="bg-red-600/80 hover:bg-red-700 text-xs">
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
              <Button onClick={loadMembers} variant="outline" className="bg-[#1a1a24] border-[#2a2a3a] hover:bg-[#2a2a3a] text-white">
                Atualizar Lista
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="bg-[#1a1a24] border-[#2a2a3a]">
                <CardContent className="pt-4">
                  <div className="text-xl font-bold text-white">{stats.total}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-900/30 to-green-950/30 border-green-800/50">
                <CardContent className="pt-4">
                  <div className="text-xl font-bold text-green-400">{stats.aprovados}</div>
                  <div className="text-xs text-green-300/70">✓ Ativos</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-950/30 border-yellow-800/50">
                <CardContent className="pt-4">
                  <div className="text-xl font-bold text-yellow-400">{stats.aguardando}</div>
                  <div className="text-xs text-yellow-300/70">⏱ Aguardando</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-900/30 to-red-950/30 border-red-800/50">
                <CardContent className="pt-4">
                  <div className="text-xl font-bold text-red-400">{stats.banidos}</div>
                  <div className="text-xs text-red-300/70">🚫 Banidos</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-950/30 border-cyan-800/50">
                <CardContent className="pt-4">
                  <div className="text-xl font-bold text-cyan-400">{stats.vitalicio}</div>
                  <div className="text-xs text-cyan-300/70">∞ Vitalício</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input placeholder="Buscar por email..." value={search} onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto touch-pan-x">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="border-[#2a2a3a] hover:bg-[#1a1a24]">
                        <TableHead className="min-w-[180px] text-gray-400">Email</TableHead>
                        <TableHead className="min-w-[120px] text-gray-400">WhatsApp</TableHead>
                        <TableHead className="min-w-[110px] text-gray-400">Plano</TableHead>
                        <TableHead className="min-w-[100px] text-gray-400">Status</TableHead>
                        <TableHead className="min-w-[100px] text-gray-400">Cadastro</TableHead>
                        <TableHead className="min-w-[100px] text-gray-400">Vencimento</TableHead>
                        <TableHead className="min-w-[180px] text-gray-400">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const isSuperAdminUser = member.email === 'eriklaurenti09@gmail.com';
                        return (
                          <TableRow key={member.id} className={`border-[#2a2a3a] hover:bg-[#1a1a24]/50 ${member.subscription?.status === 'cancelado' ? 'bg-red-950/20' : ''} ${isSuperAdminUser ? 'bg-cyan-950/20 border-l-2 border-l-cyan-500' : ''}`}>
                            <TableCell className="font-medium text-xs text-white">
                              <div className="flex items-center gap-2">
                                {isSuperAdminUser && <Shield className="w-4 h-4 text-cyan-500 flex-shrink-0" />}
                                <span className="truncate max-w-[150px]" title={member.email}>{member.email}</span>
                                {isSuperAdminUser && <Badge className="bg-cyan-600 text-white text-[10px]">SUPREMO</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {member.phone ? (
                                <Button size="sm" variant="ghost"
                                  onClick={() => window.open(`https://wa.me/55${member.phone?.replace(/\D/g, '')}`, '_blank')}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2">
                                  <Phone className="w-3 h-3 mr-1" />
                                  <span className="text-xs">{member.phone}</span>
                                </Button>
                              ) : <span className="text-gray-500 text-xs">-</span>}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge className="bg-cyan-600 text-white">Vitalício</Badge>
                              ) : (
                                <Select value={member.subscription?.plan || 'mensal'}
                                  onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}>
                                  <SelectTrigger className="w-[100px] h-9 text-xs bg-[#0f0f17] border-[#2a2a3a] text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a] min-w-[120px] z-50" position="popper" sideOffset={4} align="start" avoidCollisions={false}>
                                    <SelectItem value="vitalicio" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">Vitalício</SelectItem>
                                    <SelectItem value="anual" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">1 Ano</SelectItem>
                                    <SelectItem value="trimestral" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">3 Meses</SelectItem>
                                    <SelectItem value="mensal" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">1 Mês</SelectItem>
                                    <SelectItem value="7dias" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">7 Dias</SelectItem>
                                    <SelectItem value="1dia" className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white cursor-pointer">1 Dia</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge className="bg-cyan-600 text-white">✓ Supremo</Badge>
                              ) : member.subscription && getStatusBadge(member.subscription.status)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-300">
                              {format(new Date(member.created_at), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-xs text-gray-300">
                              {isSuperAdminUser ? '∞' : member.subscription?.end_date 
                                ? format(new Date(member.subscription.end_date), 'dd/MM/yyyy')
                                : member.subscription?.plan === 'vitalicio' ? '∞' : '-'}
                            </TableCell>
                            <TableCell>
                              {isSuperAdminUser ? (
                                <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
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
                                        ? 'bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]' 
                                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white'
                                    }`}>
                                    {member.subscription?.status === 'aprovado' ? 'Suspender' : 'Ativar'}
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => banUser(member.id, member.email)}
                                    className="text-xs bg-red-600 hover:bg-red-700" title="Banir">
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
        </Tabs>
      </div>
    </div>
  );
}
