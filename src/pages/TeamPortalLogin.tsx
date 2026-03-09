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

  // Computed stats
  const expiringSubscribers = (portalSubscribers as any[]).filter((s: any) => {
    if (!s.end_date || s.status !== 'aprovado') return false;
    const daysLeft = Math.ceil((new Date(s.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft >= 0;
  });

  const getTimeRemaining = (endDate: string) => {
    const ms = new Date(endDate).getTime() - Date.now();
    if (ms <= 0) return { label: 'Expirado', color: 'text-destructive', urgent: true };
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 30) return { label: `${days} dias`, color: 'text-green-500', urgent: false };
    if (days > 7) return { label: `${days} dias`, color: 'text-amber-500', urgent: false };
    if (days > 0) return { label: `${days}d ${hours % 24}h`, color: 'text-red-500', urgent: true };
    return { label: `${hours}h`, color: 'text-red-500 animate-pulse', urgent: true };
  };

  const getTrialRemaining = (createdAt: string) => {
    const ms = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000 - Date.now();
    if (ms <= 0) return { label: 'Trial expirado', expired: true, hours: 0 };
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { label: `${hours}h ${minutes}m restantes`, expired: false, hours };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                  <Wind className="w-6 h-6" />
                </div>
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-primary animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-base">{session.memberName}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] h-5">{roleLabel[session.role] || session.role}</Badge>
                  <span className="text-[11px] opacity-80">
                    {onlineMembers.length} online • {pending} pendente{pending !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={handleRefresh} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onLogout} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Alerts Banner */}
      {(newSubscriptionAlerts.length > 0 || supportRequests.length > 0 || expiringSubscribers.length > 0) && (
        <div className="max-w-3xl mx-auto px-4 pt-3 flex gap-2 overflow-x-auto">
          {newSubscriptionAlerts.length > 0 && (
            <button onClick={() => setActiveTab('assinantes')} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium whitespace-nowrap hover:bg-purple-500/20 transition-colors">
              <Shield className="w-3.5 h-3.5" />
              {newSubscriptionAlerts.length} novo{newSubscriptionAlerts.length > 1 ? 's' : ''} aguardando
            </button>
          )}
          {expiringSubscribers.length > 0 && (
            <button onClick={() => setActiveTab('assinantes')} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium whitespace-nowrap hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {expiringSubscribers.length} expirando
            </button>
          )}
          {supportRequests.length > 0 && (
            <button onClick={() => setActiveTab('suporte')} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium whitespace-nowrap hover:bg-amber-500/20 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              {supportRequests.length} suporte
            </button>
          )}
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { tab: 'today', icon: CalendarDays, val: todayAppointments.length, label: 'Hoje', color: 'text-primary' },
            { tab: 'clientes', icon: Users, val: (portalClients as any[]).length, label: 'Clientes', color: 'text-blue-500' },
            { tab: 'pending', icon: Clock, val: pendingBookings.length, label: 'Pendentes', color: 'text-amber-500' },
            { tab: 'assinantes', icon: Shield, val: (portalSubscribers as any[]).length, label: 'Usuários', color: 'text-purple-500' },
            { tab: 'suporte', icon: Headphones, val: onlineMembers.length, label: 'Online', color: 'text-green-500' },
          ].map(s => (
            <Card key={s.tab} className="cursor-pointer hover:shadow-md transition-shadow border-border/50" onClick={() => setActiveTab(s.tab)}>
              <CardContent className="pt-3 pb-2 text-center px-1">
                <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[9px] text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs - organized in 2 rows */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="space-y-1.5">
            <TabsList className="w-full grid grid-cols-5 h-10">
              <TabsTrigger value="today" className="text-xs gap-1"><CalendarDays className="w-3.5 h-3.5" /> Agenda</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs gap-1"><Clock className="w-3.5 h-3.5" /> Pendentes</TabsTrigger>
              <TabsTrigger value="agendar" className="text-xs gap-1"><CalendarPlus className="w-3.5 h-3.5" /> Agendar</TabsTrigger>
              <TabsTrigger value="clientes" className="text-xs gap-1"><Users className="w-3.5 h-3.5" /> Clientes</TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs gap-1"><DollarSign className="w-3.5 h-3.5" /> Finanças</TabsTrigger>
            </TabsList>
            <TabsList className="w-full grid grid-cols-4 h-10">
              <TabsTrigger value="produtos" className="text-xs gap-1"><Package className="w-3.5 h-3.5" /> Produtos</TabsTrigger>
              <TabsTrigger value="assinantes" className="text-xs gap-1 relative">
                <Shield className="w-3.5 h-3.5" /> Usuários
                {pendingSubscribers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {pendingSubscribers.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suporte" className="text-xs gap-1 relative">
                <Headphones className="w-3.5 h-3.5" /> Suporte
                {supportRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {supportRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="links" className="text-xs gap-1"><Link2 className="w-3.5 h-3.5" /> Links</TabsTrigger>
            </TabsList>
          </div>

          {/* === AGENDA === */}
          <TabsContent value="today" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Agenda de Hoje — {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
              </h2>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportAgendaPDF}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
            {todayAppointments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhum serviço agendado hoje</p>
                  <Button size="sm" variant="outline" className="mt-4 gap-1" onClick={() => setActiveTab('agendar')}>
                    <CalendarPlus className="w-3.5 h-3.5" /> Agendar serviço
                  </Button>
                </CardContent>
              </Card>
            ) : (
              todayAppointments.map((apt: any) => (
                <Card key={apt.id} className={`border-l-4 transition-all hover:shadow-md ${apt.status === 'concluido' ? 'border-l-green-500 opacity-60' : apt.status === 'cancelado' ? 'border-l-destructive opacity-50' : 'border-l-primary'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{apt.client_name}</span>
                          <Badge variant={apt.status === 'concluido' ? 'secondary' : 'default'} className="text-[10px] h-5">
                            {apt.status === 'concluido' ? '✓ Concluído' : apt.status === 'confirmado' ? '✓ Confirmado' : '• Agendado'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.time}</span>
                          {apt.address && <span className="truncate max-w-[180px]">📍 {apt.address}</span>}
                        </div>
                        {apt.notes && <p className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1 mt-1">📝 {apt.notes}</p>}
                      </div>
                      {apt.phone && (
                        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0"
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
          <TabsContent value="pending" className="mt-4 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Agendamentos Pendentes ({pendingBookings.length})
            </h2>
            {pendingBookings.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500/20 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhum agendamento pendente</p>
                </CardContent>
              </Card>
            ) : (
              pendingBookings.map((b: any) => (
                <Card key={b.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">{b.client_name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>📱 {b.client_phone}</span>
                          <span>🔧 {b.service_name}</span>
                        </div>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">📅 {b.preferred_date} às {b.preferred_time}</p>
                      </div>
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0"
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
          <TabsContent value="clientes" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9 h-10" />
              </div>
              <Button size="icon" variant="outline" className="h-10 w-10" onClick={exportClientesPDF}><Download className="w-4 h-4" /></Button>
              <Button size="icon" className="h-10 w-10" onClick={() => setShowNewClient(!showNewClient)}><Plus className="w-4 h-4" /></Button>
            </div>

            {showNewClient && (
              <Card className="border-primary/40 shadow-md">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Cadastrar Novo Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <Input placeholder="Nome completo *" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="h-10" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Telefone / WhatsApp" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="h-10" />
                    <Input placeholder="Endereço" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} className="h-10" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleAddClient} className="flex-1 h-10">
                      <Plus className="w-4 h-4 mr-1" /> Cadastrar
                    </Button>
                    <Button variant="outline" className="h-10" onClick={() => setShowNewClient(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">{filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''}</p>

            {filteredClients.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p>Nenhum cliente encontrado</p>
                </CardContent>
              </Card>
            ) : (
              filteredClients.slice(0, 50).map((client: any) => (
                <Card key={client.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{client.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{client.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{client.telefone || 'Sem telefone'}</p>
                          {client.email && <p className="text-[10px] text-muted-foreground">• {client.email}</p>}
                        </div>
                      </div>
                    </div>
                    {client.telefone && (
                      <Button size="icon" variant="ghost" className="h-9 w-9"
                        onClick={() => window.open(`https://wa.me/55${client.telefone.replace(/\D/g, '')}`, '_blank')}>
                        <Phone className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* === FINANCEIRO === */}
          <TabsContent value="financeiro" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Resumo Financeiro
              </h2>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportFinanceiroPDF}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Receitas</p>
                  <p className="text-lg font-bold text-green-500">
                    R$ {(portalFinancial as any[]).filter((r: any) => r.type === 'receita').reduce((s: number, r: any) => s + Number(r.amount), 0).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Despesas</p>
                  <p className="text-lg font-bold text-destructive">
                    R$ {(portalFinancial as any[]).filter((r: any) => r.type === 'despesa').reduce((s: number, r: any) => s + Number(r.amount), 0).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Saldo</p>
                  <p className="text-lg font-bold text-primary">
                    R$ {((portalFinancial as any[]).filter((r: any) => r.type === 'receita').reduce((s: number, r: any) => s + Number(r.amount), 0) - (portalFinancial as any[]).filter((r: any) => r.type === 'despesa').reduce((s: number, r: any) => s + Number(r.amount), 0)).toFixed(0)}
                  </p>
                </CardContent>
              </Card>
            </div>
            {(portalFinancial as any[]).slice(0, 15).map((rec: any, idx: number) => (
              <Card key={rec.id || idx} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${rec.type === 'receita' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      <DollarSign className={`w-4 h-4 ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{rec.description || rec.category || 'Registro'}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground">{rec.record_date ? format(new Date(rec.record_date), 'dd/MM/yyyy') : '-'}</p>
                        {rec.payment_method && <Badge variant="outline" className="text-[9px] h-4">{rec.payment_method}</Badge>}
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

          {/* === PRODUTOS === */}
          <TabsContent value="produtos" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" /> Produtos & Serviços
              </h2>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportProdutosPDF}>
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Serviços</p>
                  <p className="text-xl font-bold text-primary">{(portalProducts as any[]).filter((p: any) => p.type === 'service').length}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Produtos</p>
                  <p className="text-xl font-bold text-amber-500">{(portalProducts as any[]).filter((p: any) => p.type !== 'service').length}</p>
                </CardContent>
              </Card>
            </div>
            {(portalProducts as any[]).map((p: any) => (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.type === 'service' ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                      <Package className={`w-4 h-4 ${p.type === 'service' ? 'text-primary' : 'text-amber-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <Badge variant="outline" className="text-[9px] h-4">{p.type === 'service' ? 'Serviço' : 'Produto'}</Badge>
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

          {/* === AGENDAR SERVIÇO === */}
          <TabsContent value="agendar" className="mt-4 space-y-3">
            <Card className="border-primary/30 shadow-md">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-primary" /> Agendar Novo Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Cliente *</Label>
                  <Select value={scheduleClientId} onValueChange={setScheduleClientId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
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
                  <Label className="text-xs font-medium">Serviço (opcional)</Label>
                  <Select value={scheduleServiceId} onValueChange={setScheduleServiceId}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
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
                    <Label className="text-xs font-medium">Data *</Label>
                    <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Horário *</Label>
                    <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="h-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Observações</Label>
                  <Input placeholder="Notas sobre o serviço..." value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} className="h-10" />
                </div>
                <Button className="w-full h-11" onClick={handleCreateAppointment} disabled={scheduling}>
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                  Agendar Serviço
                </Button>
              </CardContent>
            </Card>
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setActiveTab('clientes')}>
              Cliente não cadastrado? Vá para Clientes e cadastre primeiro →
            </Button>
          </TabsContent>

          {/* === USUÁRIOS / ASSINANTES === */}
          <TabsContent value="assinantes" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por email ou nome..." value={subscriberSearch} onChange={e => setSubscriberSearch(e.target.value)} className="pl-9 h-10" />
              </div>
              <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => refetchSubscribers()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total', val: (portalSubscribers as any[]).length, color: 'text-foreground', bg: '' },
                { label: 'Ativos', val: activeSubscribers.length, color: 'text-green-500', bg: 'bg-green-500/5 border-green-500/20' },
                { label: 'Pendentes', val: pendingSubscribers.length, color: 'text-amber-500', bg: 'bg-amber-500/5 border-amber-500/20' },
                { label: 'Expirando', val: expiringSubscribers.length, color: 'text-red-500', bg: 'bg-red-500/5 border-red-500/20' },
              ].map(s => (
                <Card key={s.label} className={s.bg}>
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Expiring Soon Section */}
            {expiringSubscribers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> Prazos Expirando
                </h3>
                {expiringSubscribers.map((sub: any) => {
                  const remaining = getTimeRemaining(sub.end_date);
                  return (
                    <Card key={sub.id} className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                            <Timer className={`w-5 h-5 text-red-500 ${remaining.urgent ? 'animate-pulse' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{sub.email}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[9px] h-4">{sub.plan}</Badge>
                              <span className={`text-[11px] font-bold ${remaining.color}`}>
                                ⏱ {remaining.label}
                              </span>
                              {sub.end_date && (
                                <span className="text-[10px] text-muted-foreground">
                                  até {format(new Date(sub.end_date), 'dd/MM/yyyy HH:mm')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                              <SelectTrigger className="h-8 text-[10px] w-[80px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1dia">1 Dia</SelectItem>
                                <SelectItem value="7dias">7 Dias</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="trimestral">Trimestral</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                                <SelectItem value="vitalicio">Vitalício</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                              disabled={activatingUser === sub.id}
                              onClick={() => handleActivateSubscriber(sub.id, true)}>
                              {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3" /> Renovar</>}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pending / Trial Section */}
            {pendingSubscribers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" /> Aguardando Ativação ({pendingSubscribers.length})
                </h3>
                {pendingSubscribers.map((sub: any) => {
                  const trial = getTrialRemaining(sub.created_at);
                  return (
                    <Card key={sub.id} className={`border-l-4 hover:shadow-md transition-shadow ${trial.expired ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${trial.expired ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                            <User className={`w-5 h-5 ${trial.expired ? 'text-red-500' : 'text-amber-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{sub.email}</p>
                            <p className="text-[11px] text-muted-foreground">{sub.username}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[11px] font-bold ${trial.expired ? 'text-red-500' : 'text-amber-500'}`}>
                                {trial.expired ? '⛔ ' : '⏱ '}{trial.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                • Cadastro: {format(new Date(sub.created_at), 'dd/MM HH:mm')}
                              </span>
                              {sub.phone && <span className="text-[10px] text-muted-foreground">📱 {sub.phone}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                              <SelectTrigger className="h-7 text-[10px] w-[80px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1dia">1 Dia</SelectItem>
                                <SelectItem value="7dias">7 Dias</SelectItem>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="trimestral">Trimestral</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                                <SelectItem value="vitalicio">Vitalício</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1"
                              disabled={activatingUser === sub.id}
                              onClick={() => handleActivateSubscriber(sub.id, true)}>
                              {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserCheck className="w-3 h-3" /> Liberar</>}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* All subscribers */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Todos os Usuários ({filteredSubscribers.length})
              </h3>
              {filteredSubscribers.map((sub: any) => {
                const isActive = sub.is_active && sub.status === 'aprovado';
                const isVitalicio = sub.plan === 'vitalicio';
                const remaining = sub.end_date ? getTimeRemaining(sub.end_date) : null;

                return (
                  <Card key={sub.id} className={`hover:shadow-sm transition-shadow ${!isActive ? 'opacity-70' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-green-500/10' : 'bg-muted'}`}>
                          <span className={`text-sm font-bold ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {sub.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.email}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <Badge variant={isActive ? 'default' : sub.status === 'pendente' ? 'secondary' : 'destructive'} className="text-[9px] h-4">
                              {isActive ? '✓ Ativo' : sub.status === 'pendente' ? '⏳ Pendente' : '🚫 ' + sub.status}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] h-4">{sub.plan}</Badge>
                            {isVitalicio && <span className="text-[10px] text-green-500 font-medium">🏆 Permanente</span>}
                            {remaining && !isVitalicio && (
                              <span className={`text-[10px] font-medium ${remaining.color}`}>
                                ⏱ {remaining.label}
                              </span>
                            )}
                            {sub.start_date && (
                              <span className="text-[10px] text-muted-foreground">
                                desde {format(new Date(sub.start_date), 'dd/MM/yy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!isActive ? (
                            <Button size="icon" variant="outline" className="h-8 w-8"
                              disabled={activatingUser === sub.id}
                              onClick={() => handleActivateSubscriber(sub.id, true)}>
                              <UserCheck className="w-3.5 h-3.5 text-green-500" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="outline" className="h-8 w-8"
                              disabled={activatingUser === sub.id}
                              onClick={() => handleActivateSubscriber(sub.id, false)}>
                              <UserX className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* === SUPORTE ONLINE === */}
          <TabsContent value="suporte" className="mt-4 space-y-3">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Equipe Online</h3>
                    <p className="text-xs text-muted-foreground">
                      {onlineMembers.length} membro{onlineMembers.length !== 1 ? 's' : ''} conectado{onlineMembers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {onlineMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {onlineMembers.map((m: any) => (
                      <div key={m.member_id || m.id} className="flex items-center gap-1.5 bg-background rounded-full px-3 py-1.5 border shadow-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium">{m.member_name}</span>
                        <Badge variant="outline" className="text-[8px] h-4">{roleLabel[m.member_role] || m.member_role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Support */}
            {supportRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <MessageCircle className="w-3.5 h-3.5" /> Solicitações Pendentes ({supportRequests.length})
                </h3>
                {supportRequests.map((req: any) => (
                  <Card key={req.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-sm">{req.requester_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {req.requester_phone && <span>📱 {req.requester_phone}</span>}
                            {req.requester_email && <span>✉️ {req.requester_email}</span>}
                          </div>
                          <Badge variant="outline" className="text-[9px]">{req.request_type}</Badge>
                          {req.message && (
                            <p className="text-xs p-2 bg-muted rounded-lg">💬 {req.message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {req.created_at ? format(new Date(req.created_at), "dd/MM 'às' HH:mm") : ''}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {req.requester_phone && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                              onClick={() => window.open(`https://wa.me/55${req.requester_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${req.requester_name}! Sou ${session.memberName} do suporte. Vi sua solicitação e estou aqui para ajudar!`)}`, '_blank')}>
                              <Phone className="w-3 h-3" /> WhatsApp
                            </Button>
                          )}
                          <Button size="sm" className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleResolveRequest(req.id)}>
                            <CheckCircle2 className="w-3 h-3" /> Resolvido
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Team Directory */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Diretório da Equipe
              </h3>
              {(supportMembers as any[]).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Headphones className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhum membro com telefone cadastrado</p>
                  </CardContent>
                </Card>
              ) : (
                (supportMembers as any[]).map((m: any) => (
                  <Card key={m.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.is_online ? 'bg-green-500/10' : 'bg-muted'}`}>
                          <span className={`text-sm font-bold ${m.is_online ? 'text-green-500' : 'text-muted-foreground'}`}>{m.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] h-4">{roleLabel[m.role] || m.role}</Badge>
                            <span className={`flex items-center gap-1 text-[10px] ${m.is_online ? 'text-green-500' : 'text-muted-foreground'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.is_online ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                              {m.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" className={`gap-1.5 text-xs ${m.is_online ? 'bg-green-500 hover:bg-green-600' : 'bg-muted-foreground/40'} text-white`}
                        onClick={() => window.open(`https://wa.me/55${m.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${m.name}, preciso de ajuda!`)}`, '_blank')}>
                        <MessageCircle className="w-3.5 h-3.5" /> Chamar
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Suppliers */}
            {(portalSuppliers as any[]).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Fornecedores
                </h3>
                {(portalSuppliers as any[]).slice(0, 10).map((s: any) => (
                  <Card key={s.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.contact_person || s.contact || '-'}</p>
                      </div>
                      {s.contact && (
                        <Button size="icon" variant="ghost" className="h-9 w-9"
                          onClick={() => window.open(`https://wa.me/55${s.contact.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === LINKS ÚTEIS === */}
          <TabsContent value="links" className="mt-4 space-y-3">
            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" /> Links do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  { label: 'Landing Page', desc: 'Página de vendas e marketing', url: 'https://gestaoarcondicionado.lovable.app/', icon: '🌐' },
                  { label: 'Login do Sistema', desc: 'Acesso para usuários cadastrados', url: 'https://gestaoarcondicionado.lovable.app/auth', icon: '🔐' },
                  { label: 'Portal da Equipe', desc: 'Este portal de administração', url: 'https://gestaoarcondicionado.lovable.app/portal', icon: '👥' },
                  { label: 'Agenda Online', desc: 'Link público para agendamentos', url: `https://gestaoarcondicionado.lovable.app/agendar?u=${session.ownerId}`, icon: '📅' },
                  { label: 'Dashboard Admin', desc: 'Painel do super admin', url: 'https://gestaoarcondicionado.lovable.app/members', icon: '🛡️' },
                ].map((link) => (
                  <div key={link.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{link.icon}</span>
                      <div>
                        <p className="text-sm font-medium">{link.label}</p>
                        <p className="text-[11px] text-muted-foreground">{link.desc}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1"
                        onClick={() => { navigator.clipboard.writeText(link.url); toast({ title: '📋 Link copiado!' }); }}>
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs"
                        onClick={() => window.open(link.url, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-500" /> Compartilhar via WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2" onClick={() => {
                  const msg = encodeURIComponent(`🔧 Gestão AC - Agende seu serviço de ar condicionado online!\n\n📅 ${`https://gestaoarcondicionado.lovable.app/agendar?u=${session.ownerId}`}`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}>
                  📅 Enviar link da Agenda Online
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2" onClick={() => {
                  const msg = encodeURIComponent(`🔧 Gestão AC - Sistema completo para prestadores de serviço!\n\n🌐 https://gestaoarcondicionado.lovable.app/`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}>
                  🌐 Enviar link da Landing Page
                </Button>
                <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2" onClick={() => {
                  const msg = encodeURIComponent(`🔧 Portal da Equipe - Acesse o painel de administração:\n\n👥 https://gestaoarcondicionado.lovable.app/portal`);
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}>
                  👥 Enviar link do Portal
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}