import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Loader2, Wind, User, KeyRound, RefreshCw, LogOut, CalendarDays, 
  ClipboardList, Clock, Users, DollarSign, Plus, Search, Phone, 
  Download, Package, Headphones, MessageCircle, ArrowLeft, Truck,
  UserCheck, UserX, Shield, CalendarPlus, CheckCircle2, Link2, 
  ExternalLink, Copy, AlertTriangle, Timer
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PortalSession = {
  memberId: string;
  memberName: string;
  role: string;
  ownerId: string;
};

export default function TeamPortalLogin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [nameOrPhone, setNameOrPhone] = useState("");
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<PortalSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('portal_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOrPhone.trim() || pin.length !== 4) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-portal-login', {
        body: { member_name: nameOrPhone.trim(), pin }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao fazer login");
      }

      const portalSession: PortalSession = {
        memberId: data.member_id,
        memberName: data.member_name,
        role: data.role,
        ownerId: data.owner_id,
      };

      sessionStorage.setItem('portal_session', JSON.stringify(portalSession));
      setSession(portalSession);
      toast({ title: `Olá, ${data.member_name}!` });
    } catch (error: any) {
      toast({ title: "Erro no acesso", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('portal_session');
    setSession(null);
  };

  if (session) {
    return <PortalDashboard session={session} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border border-border/50 shadow-lg rounded-2xl">
          <CardContent className="p-8 space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <Wind className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold">Portal da Equipe</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Entre com seu <strong className="text-primary">nome</strong> ou{" "}
                  <strong className="text-primary">número de telefone</strong> e sua senha
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome ou WhatsApp</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="text" placeholder="Seu nome ou telefone" value={nameOrPhone}
                    onChange={e => setNameOrPhone(e.target.value)} required className="pl-10 h-12 rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Senha (4 dígitos)</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type="password" inputMode="numeric" placeholder="••••" value={pin} maxLength={4}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required
                    className="pl-10 h-12 rounded-lg text-center text-2xl tracking-[0.5em] font-mono" />
                </div>
                <p className="text-xs text-muted-foreground">Primeiro acesso? Use o PIN enviado pelo administrador.</p>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-lg text-base font-semibold">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ PORTAL DASHBOARD ============
function PortalDashboard({ session, onLogout }: { session: PortalSession; onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("today");
  const [clientSearch, setClientSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<any[]>([]);
  const [supportRequests, setSupportRequests] = useState<any[]>([]);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [activatingUser, setActivatingUser] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("mensal");
  const [newSubscriptionAlerts, setNewSubscriptionAlerts] = useState<any[]>([]);
  // Scheduling state
  const [scheduleClientId, setScheduleClientId] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduleServiceId, setScheduleServiceId] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const fetchPortalData = async (type: string, extra?: Record<string, any>) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    const { data, error } = await supabase.functions.invoke('team-portal-data', {
      body: { owner_id: session.ownerId, member_id: session.memberId, type, start, end, ...extra }
    });
    if (error) throw error;
    return data;
  };

  // === HEARTBEAT: keep online status updated ===
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const data = await fetchPortalData('heartbeat');
        if (data?.online) setOnlineMembers(data.online);
        if (data?.requests) setSupportRequests(data.requests);
        if (data?.new_subscriptions) setNewSubscriptionAlerts(data.new_subscriptions);
      } catch (e) {
        console.error('Heartbeat error:', e);
      }
    };

    sendHeartbeat(); // initial
    const interval = setInterval(sendHeartbeat, 30000); // every 30s

    return () => {
      clearInterval(interval);
      // Go offline on unmount
      fetchPortalData('go_offline').catch(() => {});
    };
  }, [session.memberId]);

  const { data: todayAppointments = [], refetch: refetchApts } = useQuery({
    queryKey: ['portal-today', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('appointments');
      return data?.appointments || [];
    },
    refetchInterval: 30000,
  });

  const { data: pendingBookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['portal-bookings', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('bookings');
      return data?.bookings || [];
    },
    refetchInterval: 30000,
  });

  const { data: portalClients = [], refetch: refetchClients } = useQuery({
    queryKey: ['portal-clients', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('clients');
      return data?.clients || [];
    },
  });

  const { data: portalFinancial = [] } = useQuery({
    queryKey: ['portal-financial', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('financial');
      return data?.financial || [];
    },
  });

  const { data: portalProducts = [] } = useQuery({
    queryKey: ['portal-products', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('products');
      return data?.products || [];
    },
  });

  const { data: supportMembers = [] } = useQuery({
    queryKey: ['portal-support', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('support_members');
      return data?.members || [];
    },
    refetchInterval: 30000,
  });

  const { data: portalSuppliers = [] } = useQuery({
    queryKey: ['portal-suppliers', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('suppliers');
      return data?.suppliers || [];
    },
  });

  const { data: portalSubscribers = [], refetch: refetchSubscribers } = useQuery({
    queryKey: ['portal-subscribers', session.ownerId],
    queryFn: async () => {
      if (!canAccessFeature('assinantes')) return [];
      const data = await fetchPortalData('subscribers');
      return data?.subscribers || [];
    },
    refetchInterval: 60000,
  });

  const canAccessFeature = (_feature: string) => {
    // All portal members have full access
    return true;
  };

  const completed = todayAppointments.filter((a: any) => a.status === 'concluido').length;
  const pending = todayAppointments.filter((a: any) => a.status !== 'concluido' && a.status !== 'cancelado').length;

  const filteredClients = (portalClients as any[]).filter((c: any) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.telefone?.includes(clientSearch)
  );

  const filteredSubscribers = (portalSubscribers as any[]).filter((s: any) =>
    s.email?.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
    s.username?.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

  const pendingSubscribers = (portalSubscribers as any[]).filter((s: any) => s.status === 'pendente');
  const activeSubscribers = (portalSubscribers as any[]).filter((s: any) => s.status === 'aprovado' && s.is_active);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-'] });
    refetchApts();
    refetchBookings();
    refetchClients();
    toast({ title: "Atualizado! ✓" });
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      toast({ title: 'Informe o nome', variant: 'destructive' });
      return;
    }
    try {
      const data = await fetchPortalData('add_client', {
        client_name: newClientName.trim(),
        client_phone: newClientPhone.trim(),
        client_address: newClientAddress.trim(),
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Cliente cadastrado!' });
      setNewClientName('');
      setNewClientPhone('');
      setNewClientAddress('');
      setShowNewClient(false);
      refetchClients();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    try {
      await fetchPortalData('resolve_request', { request_id: requestId });
      setSupportRequests(prev => prev.filter(r => r.id !== requestId));
      toast({ title: '✅ Solicitação resolvida!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const canAccess = (feature: string) => canAccessFeature(feature);

  const handleActivateSubscriber = async (targetUserId: string, activate: boolean) => {
    setActivatingUser(targetUserId);
    try {
      const data = await fetchPortalData('activate_subscriber', {
        target_user_id: targetUserId,
        plan: selectedPlan,
        activate,
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: activate ? '✅ Acesso liberado!' : '🚫 Acesso bloqueado!' });
      refetchSubscribers();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setActivatingUser(null);
    }
  };

  const handleCreateAppointment = async () => {
    if (!scheduleClientId || !scheduleDate || !scheduleTime) {
      toast({ title: 'Preencha cliente, data e horário', variant: 'destructive' });
      return;
    }
    setScheduling(true);
    try {
      const appointmentDate = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const data = await fetchPortalData('create_appointment', {
        client_id: scheduleClientId,
        appointment_date: appointmentDate,
        notes: scheduleNotes || `Agendado via portal por ${session.memberName}`,
        service_id: scheduleServiceId || null,
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Serviço agendado!' });
      setScheduleClientId('');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleNotes('');
      setScheduleServiceId('');
      refetchApts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setScheduling(false);
    }
  };

  // PDF exports
  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Agenda do Dia', 14, 20);
    doc.setFontSize(10);
    doc.text(`Equipe: ${session.memberName} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Horário', 'Cliente', 'Telefone', 'Status', 'Obs']],
      body: todayAppointments.map((a: any) => [
        a.time || '-', a.client_name || '-', a.phone || '-', a.status || '-', a.notes || ''
      ]),
    });
    doc.save('agenda-equipe.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const exportClientesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Lista de Clientes', 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ${(portalClients as any[]).length} | Gerado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Nome', 'Telefone', 'Email', 'Endereço']],
      body: (portalClients as any[]).map((c: any) => [
        c.name || '-', c.telefone || '-', c.email || '-', c.address || '-'
      ]),
    });
    doc.save('clientes.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const exportFinanceiroPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório Financeiro', 14, 20);
    doc.setFontSize(10);
    const totalR = (portalFinancial as any[]).filter((r: any) => r.type === 'receita').reduce((s: number, r: any) => s + Number(r.amount), 0);
    const totalD = (portalFinancial as any[]).filter((r: any) => r.type === 'despesa').reduce((s: number, r: any) => s + Number(r.amount), 0);
    doc.text(`Receitas: R$ ${totalR.toFixed(2)} | Despesas: R$ ${totalD.toFixed(2)} | Saldo: R$ ${(totalR - totalD).toFixed(2)}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Descrição', 'Tipo', 'Pagamento', 'Valor']],
      body: (portalFinancial as any[]).map((r: any) => [
        r.record_date ? format(new Date(r.record_date), 'dd/MM/yyyy') : '-',
        r.description || r.category || '-',
        r.type === 'receita' ? 'Receita' : 'Despesa',
        r.payment_method || '-',
        `R$ ${Number(r.amount || 0).toFixed(2)}`
      ]),
    });
    doc.save('financeiro.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const exportProdutosPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Produtos e Serviços', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Nome', 'Tipo', 'Preço', 'Estoque']],
      body: (portalProducts as any[]).map((p: any) => [
        p.name, p.type === 'service' ? 'Serviço' : 'Produto',
        `R$ ${Number(p.price).toFixed(2)}`, p.type === 'service' ? '-' : String(p.qty)
      ]),
    });
    doc.save('produtos-servicos.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const roleLabel: Record<string, string> = {
    admin: '👑 Admin',
    gerente: '📊 Gerente',
    suporte: '🎧 Suporte',
    sistema: '💻 Sistema',
    tecnico: '🔧 Técnico',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary-foreground/20 relative">
              <Wind className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Olá, {session.memberName}!</h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{roleLabel[session.role] || session.role}</Badge>
                <span className="text-sm opacity-80">{pending} pendente{pending !== 1 ? 's' : ''}</span>
                <span className="text-[10px] opacity-60">• {onlineMembers.length} online</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="ghost" onClick={handleRefresh} className="text-primary-foreground hover:bg-primary-foreground/20">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* New Subscription Alerts */}
      {newSubscriptionAlerts.length > 0 && canAccessFeature('assinantes') && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <Card className="border-purple-500/50 bg-purple-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-purple-500" />
                <span className="font-bold text-sm text-purple-700 dark:text-purple-400">
                  🆕 {newSubscriptionAlerts.length} nova(s) assinatura(s) aguardando ativação
                </span>
              </div>
              <div className="space-y-2">
                {newSubscriptionAlerts.slice(0, 3).map((sub: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-background rounded-lg p-2 border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.email || sub.username}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sub.created_at ? format(new Date(sub.created_at), 'dd/MM HH:mm') : ''} • Teste expirando
                      </p>
                    </div>
                    <Button size="sm" className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                      disabled={activatingUser === sub.id}
                      onClick={() => { handleActivateSubscriber(sub.id, true); setNewSubscriptionAlerts(prev => prev.filter(s => s.id !== sub.id)); }}>
                      {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserCheck className="w-3 h-3 mr-1" /> Ativar</>}
                    </Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="w-full mt-2 text-purple-500 text-xs" onClick={() => setActiveTab('assinantes')}>
                Ver todos os assinantes →
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Support Requests Alert */}
      {supportRequests.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm text-amber-700 dark:text-amber-400">
                  {supportRequests.length} solicitação(ões) de suporte pendente(s)
                </span>
              </div>
              <div className="space-y-2">
                {supportRequests.slice(0, 5).map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between bg-background rounded-lg p-2 border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.requester_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {req.requester_phone || req.requester_email || '-'} • {req.request_type}
                      </p>
                      {req.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">💬 {req.message}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {req.requester_phone && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                          onClick={() => window.open(`https://wa.me/55${req.requester_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${req.requester_name}! Sou ${session.memberName} do suporte. Como posso ajudar?`)}`, '_blank')}>
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
                      <Button size="sm" className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleResolveRequest(req.id)}>
                        ✓
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-2">
          <Card className="cursor-pointer" onClick={() => setActiveTab('today')}>
            <CardContent className="pt-3 pb-2 text-center">
              <CalendarDays className="w-4 h-4 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold">{todayAppointments.length}</div>
              <div className="text-[10px] text-muted-foreground">Hoje</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setActiveTab('clientes')}>
            <CardContent className="pt-3 pb-2 text-center">
              <Users className="w-4 h-4 mx-auto text-blue-500 mb-1" />
              <div className="text-xl font-bold">{(portalClients as any[]).length}</div>
              <div className="text-[10px] text-muted-foreground">Clientes</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer" onClick={() => setActiveTab('pending')}>
            <CardContent className="pt-3 pb-2 text-center">
              <Clock className="w-4 h-4 mx-auto text-amber-500 mb-1" />
              <div className="text-xl font-bold text-amber-500">{pendingBookings.length}</div>
              <div className="text-[10px] text-muted-foreground">Pendentes</div>
            </CardContent>
          </Card>
          {canAccess('assinantes') && (
            <Card className="cursor-pointer" onClick={() => setActiveTab('assinantes')}>
              <CardContent className="pt-3 pb-2 text-center">
                <Shield className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                <div className="text-xl font-bold text-purple-500">{pendingSubscribers.length}</div>
                <div className="text-[10px] text-muted-foreground">Novos</div>
              </CardContent>
            </Card>
          )}
          <Card className="cursor-pointer" onClick={() => setActiveTab('suporte')}>
            <CardContent className="pt-3 pb-2 text-center">
              <Headphones className="w-4 h-4 mx-auto text-green-500 mb-1" />
              <div className="text-xl font-bold text-green-500">{onlineMembers.length}</div>
              <div className="text-[10px] text-muted-foreground">Online</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="today" className="flex-1 text-[11px] px-2">📋 Agenda</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 text-[11px] px-2">⏳ Pendentes</TabsTrigger>
            <TabsTrigger value="agendar" className="flex-1 text-[11px] px-2">📅 Agendar</TabsTrigger>
            <TabsTrigger value="clientes" className="flex-1 text-[11px] px-2">👥 Clientes</TabsTrigger>
            <TabsTrigger value="financeiro" className="flex-1 text-[11px] px-2">💰 Finanças</TabsTrigger>
            <TabsTrigger value="produtos" className="flex-1 text-[11px] px-2">📦 Produtos</TabsTrigger>
            <TabsTrigger value="assinantes" className="flex-1 text-[11px] px-2">
              🛡️ Usuários
              {pendingSubscribers.length > 0 && (
                <span className="ml-1 bg-purple-500 text-white text-[9px] rounded-full w-4 h-4 inline-flex items-center justify-center">
                  {pendingSubscribers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="suporte" className="flex-1 text-[11px] px-2">
              🎧 Suporte
              {supportRequests.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 inline-flex items-center justify-center">
                  {supportRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 text-[11px] px-2">🔗 Links</TabsTrigger>
          </TabsList>

          {/* === AGENDA === */}
          <TabsContent value="today" className="mt-3 space-y-3">
            <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportAgendaPDF}>
              <Download className="w-4 h-4" /> Exportar Agenda PDF
            </Button>
            {todayAppointments.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Nenhum serviço hoje</p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={handleRefresh}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
                  </Button>
                </CardContent>
              </Card>
            ) : (
              todayAppointments.map((apt: any) => (
                <Card key={apt.id} className={`border-l-4 ${apt.status === 'concluido' ? 'border-l-emerald-500 opacity-70' : 'border-l-primary'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{apt.client_name || 'Cliente'}</span>
                          <Badge variant={apt.status === 'concluido' ? 'secondary' : 'default'} className="text-[10px]">
                            {apt.status === 'concluido' ? '✓ Feito' : apt.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">🕐 {apt.time || '-'}</p>
                        {apt.address && <p className="text-xs text-muted-foreground">📍 {apt.address}</p>}
                        {apt.notes && <p className="text-xs text-muted-foreground">📝 {apt.notes}</p>}
                      </div>
                      {apt.phone && (
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                          onClick={() => window.open(`https://wa.me/55${apt.phone.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* === PENDENTES === */}
          <TabsContent value="pending" className="mt-3 space-y-3">
            {pendingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Nenhum agendamento pendente</p>
                </CardContent>
              </Card>
            ) : (
              pendingBookings.map((b: any) => (
                <Card key={b.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{b.client_name}</p>
                        <p className="text-xs text-muted-foreground">📱 {b.client_phone}</p>
                        <p className="text-xs text-muted-foreground">🔧 {b.service_name}</p>
                        <p className="text-xs text-muted-foreground">📅 {b.preferred_date} às {b.preferred_time}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                        onClick={() => window.open(`https://wa.me/55${b.client_phone?.replace(/\D/g, '')}`, '_blank')}>
                        <Phone className="w-4 h-4 text-green-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* === CLIENTES === */}
          {canAccess('clientes') && (
            <TabsContent value="clientes" className="mt-3 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9" />
                </div>
                <Button size="icon" variant="outline" onClick={exportClientesPDF}><Download className="w-4 h-4" /></Button>
                <Button size="icon" onClick={() => setShowNewClient(!showNewClient)}><Plus className="w-4 h-4" /></Button>
              </div>

              {showNewClient && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Cadastrar Novo Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <Input placeholder="Nome completo *" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="h-10" />
                    <Input placeholder="Telefone / WhatsApp" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="h-10" />
                    <Input placeholder="Endereço" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} className="h-10" />
                    <div className="flex gap-2">
                      <Button onClick={handleAddClient} className="flex-1">
                        <Plus className="w-4 h-4 mr-1" /> Cadastrar
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewClient(false)}>Cancelar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {filteredClients.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum cliente encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                filteredClients.slice(0, 50).map((client: any) => (
                  <Card key={client.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{client.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.telefone || 'Sem telefone'}</p>
                          {client.email && <p className="text-[10px] text-muted-foreground">{client.email}</p>}
                        </div>
                      </div>
                      {client.telefone && (
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => window.open(`https://wa.me/55${client.telefone.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          )}

          {/* === FINANCEIRO === */}
          {canAccess('financeiro') && (
            <TabsContent value="financeiro" className="mt-3 space-y-3">
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportFinanceiroPDF}>
                <Download className="w-4 h-4" /> Exportar Financeiro PDF
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Receitas</p>
                    <p className="text-xl font-bold text-green-500">
                      R$ {(portalFinancial as any[]).filter((r: any) => r.type === 'receita').reduce((s: number, r: any) => s + Number(r.amount), 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Despesas</p>
                    <p className="text-xl font-bold text-destructive">
                      R$ {(portalFinancial as any[]).filter((r: any) => r.type === 'despesa').reduce((s: number, r: any) => s + Number(r.amount), 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              {(portalFinancial as any[]).slice(0, 15).map((rec: any, idx: number) => (
                <Card key={rec.id || idx}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rec.type === 'receita' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <DollarSign className={`w-4 h-4 ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rec.description || rec.category || 'Registro'}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{rec.record_date ? format(new Date(rec.record_date), 'dd/MM/yyyy') : '-'}</p>
                          {rec.payment_method && <Badge variant="outline" className="text-[9px]">{rec.payment_method}</Badge>}
                        </div>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`}>
                      {rec.type === 'receita' ? '+' : '-'}R$ {Number(rec.amount || 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {/* === PRODUTOS === */}
          {canAccess('produtos') && (
            <TabsContent value="produtos" className="mt-3 space-y-3">
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportProdutosPDF}>
                <Download className="w-4 h-4" /> Exportar Produtos PDF
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Serviços</p>
                    <p className="text-xl font-bold text-primary">
                      {(portalProducts as any[]).filter((p: any) => p.type === 'service').length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">Produtos</p>
                    <p className="text-xl font-bold">
                      {(portalProducts as any[]).filter((p: any) => p.type !== 'service').length}
                    </p>
                  </CardContent>
                </Card>
              </div>
              {(portalProducts as any[]).map((p: any) => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${p.type === 'service' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                        <Package className={`w-4 h-4 ${p.type === 'service' ? 'text-primary' : 'text-amber-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <Badge variant="outline" className="text-[9px]">{p.type === 'service' ? 'Serviço' : 'Produto'}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-primary">R$ {Number(p.price).toFixed(2)}</p>
                      {p.type !== 'service' && <p className="text-[10px] text-muted-foreground">Estoque: {p.qty}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {/* === AGENDAR SERVIÇO === */}
          {canAccess('agendar') && (
            <TabsContent value="agendar" className="mt-3 space-y-3">
              <Card className="border-primary/30">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarPlus className="w-5 h-5 text-primary" /> Agendar Novo Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente *</Label>
                    <Select value={scheduleClientId} onValueChange={setScheduleClientId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>
                        {(portalClients as any[]).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name} {c.telefone ? `• ${c.telefone}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Serviço (opcional)</Label>
                    <Select value={scheduleServiceId} onValueChange={setScheduleServiceId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                      <SelectContent>
                        {(portalProducts as any[]).filter((p: any) => p.type === 'service').map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} • R$ {Number(p.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Data *</Label>
                      <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Horário *</Label>
                      <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Input placeholder="Notas sobre o serviço..." value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreateAppointment} disabled={scheduling}>
                    {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                    Agendar Serviço
                  </Button>
                </CardContent>
              </Card>

              <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setActiveTab('clientes')}>
                Cliente não cadastrado? Vá para 👥 Clientes e cadastre primeiro
              </Button>
            </TabsContent>
          )}

          {/* === ASSINANTES === */}
          {canAccess('assinantes') && (
            <TabsContent value="assinantes" className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por email ou nome..." value={subscriberSearch} onChange={e => setSubscriberSearch(e.target.value)} className="pl-9" />
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Ativos</p>
                    <p className="text-xl font-bold text-green-500">{activeSubscribers.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-xl font-bold text-amber-500">{pendingSubscribers.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{(portalSubscribers as any[]).length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Pending first */}
              {pendingSubscribers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    ⏳ Aguardando Ativação ({pendingSubscribers.length})
                  </h3>
                  {pendingSubscribers.map((sub: any) => (
                    <Card key={sub.id} className="border-l-4 border-l-amber-500">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{sub.email}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {sub.username} • Desde {sub.created_at ? format(new Date(sub.created_at), 'dd/MM/yyyy') : '-'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                              <SelectTrigger className="h-7 text-[10px] w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1dia">1 Dia</SelectItem>
                                <SelectItem value="7dias">7 Dias</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="trimestral">Trimestral</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                                <SelectItem value="vitalicio">Vitalício</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                              disabled={activatingUser === sub.id}
                              onClick={() => handleActivateSubscriber(sub.id, true)}>
                              {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* All subscribers */}
              <h3 className="text-sm font-medium text-muted-foreground">Todos os Assinantes</h3>
              {filteredSubscribers.map((sub: any) => (
                <Card key={sub.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sub.is_active && sub.status === 'aprovado' ? 'bg-green-500/10' : 'bg-muted'}`}>
                          <span className={`text-xs font-bold ${sub.is_active && sub.status === 'aprovado' ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {sub.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.email}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant={sub.status === 'aprovado' ? 'default' : sub.status === 'pendente' ? 'secondary' : 'destructive'} className="text-[8px] h-4">
                              {sub.status === 'aprovado' ? '✓ Ativo' : sub.status === 'pendente' ? '⏳ Pendente' : '🚫 ' + sub.status}
                            </Badge>
                            <Badge variant="outline" className="text-[8px] h-4">{sub.plan}</Badge>
                            {sub.end_date && (
                              <span className="text-[9px] text-muted-foreground">
                                até {format(new Date(sub.end_date), 'dd/MM/yy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {sub.status !== 'aprovado' || !sub.is_active ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                            disabled={activatingUser === sub.id}
                            onClick={() => handleActivateSubscriber(sub.id, true)}>
                            <UserCheck className="w-3 h-3 text-green-500" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                            disabled={activatingUser === sub.id}
                            onClick={() => handleActivateSubscriber(sub.id, false)}>
                            <UserX className="w-3 h-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {/* === SUPORTE ONLINE === */}
          <TabsContent value="suporte" className="mt-3 space-y-3">
            {/* Online members indicator */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Headphones className="w-6 h-6 text-green-500" />
                  <div>
                    <h3 className="font-bold text-sm">Equipe Online Agora</h3>
                    <p className="text-xs text-muted-foreground">
                      {onlineMembers.length} membro{onlineMembers.length !== 1 ? 's' : ''} conectado{onlineMembers.length !== 1 ? 's' : ''} no portal
                    </p>
                  </div>
                </div>
                {onlineMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {onlineMembers.map((m: any) => (
                      <div key={m.member_id || m.id} className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1 border">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium">{m.member_name}</span>
                        <Badge variant="outline" className="text-[8px] h-4">{roleLabel[m.member_role] || m.member_role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Support Requests */}
            {supportRequests.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    Solicitações de Suporte ({supportRequests.length})
                  </h3>
                </div>
                {supportRequests.map((req: any) => (
                  <Card key={req.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{req.requester_name}</p>
                          <p className="text-xs text-muted-foreground">
                            📱 {req.requester_phone || 'Sem telefone'} • {req.requester_email || ''}
                          </p>
                          <Badge variant="outline" className="text-[9px] mt-1">{req.request_type}</Badge>
                          {req.message && (
                            <p className="text-xs mt-1 p-2 bg-muted rounded">💬 {req.message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {req.created_at ? format(new Date(req.created_at), 'dd/MM HH:mm') : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {req.requester_phone && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-[10px]"
                              onClick={() => window.open(`https://wa.me/55${req.requester_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${req.requester_name}! Sou ${session.memberName} do suporte. Vi sua solicitação e estou aqui para ajudar!`)}`, '_blank')}>
                              <Phone className="w-3 h-3" /> Chamar
                            </Button>
                          )}
                          <Button size="sm" className="h-8 gap-1 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleResolveRequest(req.id)}>
                            ✓ Resolvido
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {/* Support Members Directory */}
            <div className="flex items-center gap-2 mt-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Diretório da Equipe</h3>
            </div>

            {(supportMembers as any[]).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Headphones className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhum membro com telefone cadastrado</p>
                </CardContent>
              </Card>
            ) : (
              (supportMembers as any[]).map((m: any) => (
                <Card key={m.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${m.is_online ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <span className={`text-sm font-bold ${m.is_online ? 'text-green-500' : 'text-muted-foreground'}`}>{m.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{m.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">{roleLabel[m.role] || m.role}</Badge>
                          <span className={`flex items-center gap-1 text-[10px] ${m.is_online ? 'text-green-500' : 'text-muted-foreground'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${m.is_online ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'}`} />
                            {m.is_online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className={`gap-1.5 ${m.is_online ? 'bg-green-500 hover:bg-green-600' : 'bg-muted-foreground/50'} text-white`}
                      onClick={() => window.open(`https://wa.me/55${m.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${m.name}, preciso de ajuda! Sou ${session.memberName} do portal da equipe.`)}`, '_blank')}>
                      <MessageCircle className="w-4 h-4" /> Chamar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Suppliers quick access */}
            {canAccess('fornecedores') && (portalSuppliers as any[]).length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-4">
                  <Truck className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">Fornecedores</h3>
                </div>
                {(portalSuppliers as any[]).slice(0, 10).map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.contact_person || s.contact || '-'}</p>
                      </div>
                      {s.contact && (
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => window.open(`https://wa.me/55${s.contact.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
