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
import { ArrowLeft, Search, Mail, Shield, Ban, UserX, Trash2, Users, Phone, Bell, Zap, Webhook, Megaphone, Share2, Activity, Gift } from "lucide-react";
import { format } from "date-fns";

import AdminNotificationsPanel from "@/components/AdminNotificationsPanel";
import AdminIntegrationsTab from "@/components/AdminIntegrationsTab";
import AdminN8nTab from "@/components/AdminN8nTab";
import AdminLandingTab from "@/components/AdminLandingTab";
import AdminShareTab from "@/components/AdminShareTab";
import AdminUsersOnlineTab from "@/components/AdminUsersOnlineTab";
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

export default function Members() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [supportNumbers, setSupportNumbers] = useState<{name: string; phone: string}[]>([]);

  useEffect(() => {
    checkSuperAdmin();
    loadMembers();
    loadSupportNumbers();
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

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }
    
    // Query user_roles table to verify super_admin role (server-side validation)
    const { data: roleData, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();
    
    if (error || !roleData) {
      navigate("/");
      return;
    }
    
    setIsSuperAdmin(true);
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      setMembers((data as Member[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive"
      });
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
        if (plan === 'anual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else if (plan === 'trimestral') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else if (plan === '7dias') {
          endDate.setDate(endDate.getDate() + 7);
        } else if (plan === '1dia') {
          endDate.setDate(endDate.getDate() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
      }

      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: {
          target_user_id: targetUserId,
          plan,
          status,
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
        description: status === 'aprovado' 
          ? "Acesso liberado! O usuário já pode acessar o sistema."
          : "Assinatura atualizada."
      });

      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const banUser = async (targetUserId: string, email: string) => {
    if (!window.confirm(`Tem certeza que deseja BANIR o usuário ${email}? Ele perderá todo acesso ao sistema.`)) return;
    
    try {
      await updateSubscription(targetUserId, 'mensal', 'cancelado');
      toast({
        title: "Usuário Banido",
        description: `${email} foi banido do sistema.`,
        variant: "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Erro ao banir usuário",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      aprovado: "default",
      pendente: "secondary",
      vencido: "destructive",
      cancelado: "outline"
    };
    const labels: Record<string, string> = {
      aprovado: "✓ Ativo",
      pendente: "⏳ Pendente",
      vencido: "⚠️ Vencido",
      cancelado: "🚫 Banido"
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const filteredMembers = members.filter(m => 
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: members.length,
    aprovados: members.filter(m => m.subscription?.status === 'aprovado').length,
    aguardando: members.filter(m => m.subscription?.status === 'pendente').length,
    banidos: members.filter(m => m.subscription?.status === 'cancelado').length,
    vitalicio: members.filter(m => m.subscription?.plan === 'vitalicio').length
  };

  if (!isSuperAdmin || loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6 relative" style={{ minWidth: '100%' }}>
      {/* Background effects */}
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
          <TabsList className="bg-[#1a1a24] border border-[#2a2a3a]">
            <TabsTrigger value="users" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Bell className="w-4 h-4 mr-2" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="integrations" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="n8n" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Webhook className="w-4 h-4 mr-2" />
              n8n
            </TabsTrigger>
            <TabsTrigger value="landing" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Megaphone className="w-4 h-4 mr-2" />
              Landing Page
            </TabsTrigger>
            <TabsTrigger value="share" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Share2 className="w-4 h-4 mr-2" />
              Links
            </TabsTrigger>
            <TabsTrigger value="online" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Online
            </TabsTrigger>
            <TabsTrigger value="raffle" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
              <Gift className="w-4 h-4 mr-2" />
              Sorteio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-6">
            <AdminNotificationsPanel />
          </TabsContent>

          <TabsContent value="users" className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={loadMembers} variant="outline" className="bg-[#1a1a24] border-[#2a2a3a] hover:bg-[#2a2a3a] text-white">
                Atualizar Lista
              </Button>
              <Button onClick={() => setShowTeamPanel(!showTeamPanel)} variant="outline" className="bg-[#1a1a24] border-[#2a2a3a] hover:bg-[#2a2a3a] text-white">
                <Users className="w-4 h-4 mr-2" />
                Equipe Suporte
              </Button>
            </div>

            {/* Team Support Management Panel */}
            {showTeamPanel && (
              <Card className="bg-[#1a1a24] border-[#2a2a3a]">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-400" />
                    Números de Suporte / Equipe
                  </CardTitle>
                  <p className="text-gray-400 text-sm">Adicione números extras de suporte que aparecem para os usuários</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {supportNumbers.map((num, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input value={num.name} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].name = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="Nome" className="bg-[#0f0f17] border-[#2a2a3a] text-white flex-1" />
                      <Input value={num.phone} onChange={e => {
                        const updated = [...supportNumbers];
                        updated[idx].phone = e.target.value;
                        setSupportNumbers(updated);
                      }} placeholder="WhatsApp" className="bg-[#0f0f17] border-[#2a2a3a] text-white flex-1" />
                      <Button size="sm" variant="destructive" onClick={() => {
                        setSupportNumbers(supportNumbers.filter((_, i) => i !== idx));
                      }} className="bg-red-600 hover:bg-red-700">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setSupportNumbers([...supportNumbers, { name: '', phone: '' }])}
                      className="bg-[#2a2a3a] text-white hover:bg-[#3a3a4a]">
                      + Adicionar Número
                    </Button>
                    <Button size="sm" onClick={saveSupportNumbers}
                      className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-xs sm:text-sm text-gray-400">Total Usuários</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-900/30 to-green-950/30 border-green-800/50">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-green-400">{stats.aprovados}</div>
              <div className="text-xs sm:text-sm text-green-300/70">✓ Ativos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-950/30 border-yellow-800/50">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-yellow-400">{stats.aguardando}</div>
              <div className="text-xs sm:text-sm text-yellow-300/70">⏱ Aguardando</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-900/30 to-red-950/30 border-red-800/50">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-red-400">{stats.banidos}</div>
              <div className="text-xs sm:text-sm text-red-300/70">🚫 Banidos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-900/30 to-cyan-950/30 border-cyan-800/50">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-cyan-400">{stats.vitalicio}</div>
              <div className="text-xs sm:text-sm text-cyan-300/70">∞ Vitalício</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-white">Gerenciar Usuários</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600"
                />
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
                      <TableRow 
                        key={member.id} 
                        className={`border-[#2a2a3a] hover:bg-[#1a1a24]/50 ${member.subscription?.status === 'cancelado' ? 'bg-red-950/20' : ''} ${isSuperAdminUser ? 'bg-cyan-950/20 border-l-2 border-l-cyan-500' : ''}`}
                      >
                        <TableCell className="font-medium text-xs sm:text-sm text-white">
                          <div className="flex items-center gap-2">
                            {isSuperAdminUser && <Shield className="w-4 h-4 text-cyan-500 flex-shrink-0" />}
                            <span className="truncate max-w-[150px]" title={member.email}>{member.email}</span>
                            {isSuperAdminUser && <Badge className="bg-cyan-600 text-white text-[10px] flex-shrink-0">SUPREMO</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.phone ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`https://wa.me/55${member.phone?.replace(/\D/g, '')}`, '_blank')}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2"
                              title={`Chamar ${member.phone}`}
                            >
                              <Phone className="w-3 h-3 mr-1" />
                              <span className="text-xs">{member.phone}</span>
                            </Button>
                          ) : (
                            <span className="text-gray-500 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isSuperAdminUser ? (
                            <Badge className="bg-cyan-600 text-white">Vitalício</Badge>
                          ) : (
                            <Select
                              value={member.subscription?.plan || 'mensal'}
                              onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}
                            >
                              <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-[#0f0f17] border-[#2a2a3a] text-white">
                                <SelectValue />
                              </SelectTrigger>
                            <SelectContent 
                                className="bg-[#1a1a24] border-[#2a2a3a] min-w-[120px] z-50"
                                position="popper"
                                sideOffset={4}
                                align="start"
                                avoidCollisions={false}
                              >
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
                            <Badge className="bg-cyan-600 text-white">✓ Admin Supremo</Badge>
                          ) : (
                            member.subscription && getStatusBadge(member.subscription.status)
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-gray-300">
                          {format(new Date(member.created_at), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-gray-300">
                          {isSuperAdminUser 
                            ? '∞ Permanente' 
                            : member.subscription?.end_date 
                              ? format(new Date(member.subscription.end_date), 'dd/MM/yyyy')
                              : member.subscription?.plan === 'vitalicio' ? '∞' : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {isSuperAdminUser ? (
                            <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                              <Shield className="w-3 h-3 mr-1" />
                              Protegido
                            </Badge>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={member.subscription?.status === 'aprovado' ? 'outline' : 'default'}
                                onClick={() => updateSubscription(
                                  member.id, 
                                  member.subscription?.plan || 'mensal',
                                  member.subscription?.status === 'aprovado' ? 'pendente' : 'aprovado'
                                )}
                                className={`text-xs whitespace-nowrap ${
                                  member.subscription?.status === 'aprovado' 
                                    ? 'bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]' 
                                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white'
                                }`}
                              >
                                {member.subscription?.status === 'aprovado' ? 'Suspender' : 'Ativar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => banUser(member.id, member.email)}
                                className="text-xs bg-red-600 hover:bg-red-700"
                                title="Banir usuário"
                              >
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

          <TabsContent value="online" className="mt-6">
            <AdminUsersOnlineTab />
          </TabsContent>

          <TabsContent value="raffle" className="mt-6">
            <AdminRaffleTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
