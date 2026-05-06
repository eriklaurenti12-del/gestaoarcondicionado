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
  ExternalLink, Copy, AlertTriangle, Timer, ShoppingCart, Printer,
  Send, LifeBuoy
} from "lucide-react";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { forceUpdateApp } from "@/lib/updateApp";

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
      await forceUpdateApp();
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
        <div className="mt-4 text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-muted-foreground hover:text-primary gap-1.5"
            onClick={forceUpdateApp}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sincronizar Versão Publicada
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ SUBSCRIBER QUICK ACTIONS ============
function SubscriberQuickActions({ sub, statusBadge, borderColor, activatingUser, onActivate }: {
  sub: any; statusBadge: React.ReactNode; borderColor: string; activatingUser: string | null;
  onActivate: (id: string, activate: boolean, plan?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = sub.is_active && sub.status === 'aprovado';
  const quickDays = [
    { label: '1 Dia', plan: '1dia' },
    { label: '7 Dias', plan: '7dias' },
    { label: '30 Dias', plan: 'mensal' },
    { label: '90 Dias', plan: 'trimestral' },
    { label: '180 Dias', plan: 'semestral' },
    { label: '1 Ano', plan: 'anual' },
    { label: 'Vitalício', plan: 'vitalicio' },
  ];

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-green-500/10' : 'bg-muted'}`}>
            <span className={`text-sm font-bold ${isActive ? 'text-green-500' : 'text-muted-foreground'}`}>{sub.email?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{sub.email}</p>
            {statusBadge}
          </div>
          <div className="flex gap-1 shrink-0">
            {isActive ? (
              <Button size="sm" variant="destructive" className="h-8 px-3 text-xs gap-1"
                disabled={activatingUser === sub.id}
                onClick={(e) => { e.stopPropagation(); onActivate(sub.id, false); }}>
                {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserX className="w-3 h-3" /> Cancelar</>}
              </Button>
            ) : (
              <Button size="sm" className="h-8 px-3 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={activatingUser === sub.id}
                onClick={(e) => { e.stopPropagation(); onActivate(sub.id, true, 'mensal'); }}>
                {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserCheck className="w-3 h-3" /> Liberar</>}
              </Button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Liberar por período:</p>
            <div className="grid grid-cols-4 gap-1.5">
              {quickDays.map(d => (
                <Button key={d.plan} size="sm" variant="outline"
                  className="h-8 text-[10px] font-medium hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30"
                  disabled={activatingUser === sub.id}
                  onClick={() => onActivate(sub.id, true, d.plan)}>
                  {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : d.label}
                </Button>
              ))}
            </div>
            {isActive && (
              <Button variant="destructive" size="sm" className="w-full h-9 text-xs gap-1.5 mt-1"
                disabled={activatingUser === sub.id}
                onClick={() => onActivate(sub.id, false)}>
                {activatingUser === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserX className="w-3.5 h-3.5" /> Cancelar Acesso Imediatamente</>}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ PORTAL DASHBOARD ============
function PortalDashboard({ session, onLogout }: { session: PortalSession; onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("agenda");
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
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  // PDV state
  const [pdvClientSearch, setPdvClientSearch] = useState("");
  const [pdvClientId, setPdvClientId] = useState("");
  const [pdvProductSearch, setPdvProductSearch] = useState("");
  const [pdvItems, setPdvItems] = useState<{id: number; name: string; price: number; qty: number}[]>([]);
  const [pdvPayment, setPdvPayment] = useState("PIX");
  const [creatingSale, setCreatingSale] = useState(false);
  // Support form
  const [supportType, setSupportType] = useState("ajuda");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  const fetchPortalData = async (type: string, extra?: Record<string, any>) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2).toISOString();
    
    const { data, error } = await supabase.functions.invoke('team-portal-data', {
      body: { owner_id: session.ownerId, member_id: session.memberId, type, start, end, ...extra }
    });
    if (error) throw error;
    return data;
  };

  // === HEARTBEAT ===
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
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => {
      clearInterval(interval);
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

  const { data: pendingBookings = [] } = useQuery({
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

  const { data: portalSales = [], refetch: refetchSales } = useQuery({
    queryKey: ['portal-sales', session.ownerId],
    queryFn: async () => {
      const data = await fetchPortalData('sales');
      return data?.sales || [];
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
      const data = await fetchPortalData('subscribers');
      return data?.subscribers || [];
    },
    refetchInterval: 60000,
  });

  const pending = pendingBookings.length;
  const totalSales = (portalSales as any[]).reduce((s: number, r: any) => s + Number(r.sale_price || 0), 0);
  const totalClients = (portalClients as any[]).length;

  const filteredClients = (portalClients as any[]).filter((c: any) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.telefone?.includes(clientSearch)
  );

  const filteredSubscribers = (portalSubscribers as any[]).filter((s: any) =>
    s.email?.toLowerCase().includes(subscriberSearch.toLowerCase()) ||
    s.username?.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

  const pendingSubscribers = (portalSubscribers as any[]).filter((s: any) => s.status === 'pendente');
  const activeSubscribers = (portalSubscribers as any[]).filter((s: any) => s.status === 'aprovado' && s.is_active);
  const expiringSubscribers = (portalSubscribers as any[]).filter((s: any) => {
    if (!s.end_date || s.status !== 'aprovado') return false;
    const daysLeft = Math.ceil((new Date(s.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft >= 0;
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-'] });
    refetchApts();
    refetchClients();
    refetchSales();
    toast({ title: "Atualizado! ✓" });
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    try {
      const data = await fetchPortalData('add_client', {
        client_name: newClientName.trim(), client_phone: newClientPhone.trim(), client_address: newClientAddress.trim(),
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Cliente cadastrado!' });
      setNewClientName(''); setNewClientPhone(''); setNewClientAddress(''); setShowNewClient(false);
      refetchClients();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleResolveRequest = async (requestId: string) => {
    try {
      await fetchPortalData('resolve_request', { request_id: requestId });
      setSupportRequests(prev => prev.filter(r => r.id !== requestId));
      toast({ title: '✅ Solicitação resolvida!' });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleActivateSubscriber = async (targetUserId: string, activate: boolean, plan?: string) => {
    setActivatingUser(targetUserId);
    try {
      const data = await fetchPortalData('activate_subscriber', { target_user_id: targetUserId, plan: plan || selectedPlan, activate });
      if (data?.error) throw new Error(data.error);
      toast({ title: activate ? '✅ Acesso liberado!' : '🚫 Acesso bloqueado!' });
      refetchSubscribers();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setActivatingUser(null); }
  };

  const handleCreateAppointment = async () => {
    if (!scheduleClientId || !scheduleDate || !scheduleTime) {
      toast({ title: 'Preencha cliente, data e horário', variant: 'destructive' }); return;
    }
    setScheduling(true);
    try {
      const [y, m, d] = scheduleDate.split('-').map(Number);
      const [hh, mm] = scheduleTime.split(':').map(Number);
      const appointmentDate = new Date(y, m - 1, d, hh, mm).toISOString();
      const data = await fetchPortalData('create_appointment', {
        client_id: scheduleClientId, appointment_date: appointmentDate,
        notes: scheduleNotes || `Agendado via portal por ${session.memberName}`,
        service_id: scheduleServiceId || null,
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Serviço agendado!' });
      setScheduleClientId(''); setScheduleDate(''); setScheduleTime(''); setScheduleNotes(''); setScheduleServiceId('');
      setShowScheduleForm(false);
      refetchApts();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setScheduling(false); }
  };

  const handleCreateSale = async () => {
    if (!pdvClientId || pdvItems.length === 0) {
      toast({ title: 'Selecione cliente e produtos', variant: 'destructive' }); return;
    }
    setCreatingSale(true);
    try {
      for (const item of pdvItems) {
        await fetchPortalData('create_sale', {
          client_id: pdvClientId, product_id: item.id, qty: item.qty,
          sale_price: item.price * item.qty, payment_method: pdvPayment,
        });
      }
      toast({ title: '✅ Venda finalizada!' });
      setPdvClientId(''); setPdvItems([]); setPdvClientSearch(''); setPdvProductSearch('');
      refetchSales();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setCreatingSale(false); }
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim()) { toast({ title: 'Descreva sua necessidade', variant: 'destructive' }); return; }
    setSendingSupport(true);
    try {
      await fetchPortalData('create_support_request', {
        requester_name: session.memberName, request_type: supportType, message: supportMessage,
      });
      toast({ title: '✅ Solicitação enviada!' });
      setSupportMessage('');
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    finally { setSendingSupport(false); }
  };

  const addPdvItem = (product: any) => {
    const existing = pdvItems.find(i => i.id === product.id);
    if (existing) {
      setPdvItems(pdvItems.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setPdvItems([...pdvItems, { id: product.id, name: product.name, price: Number(product.price), qty: 1 }]);
    }
  };

  const pdvTotal = pdvItems.reduce((s, i) => s + i.price * i.qty, 0);

  // PDF exports
  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Agenda do Dia', 14, 20);
    doc.setFontSize(10); doc.text(`Equipe: ${session.memberName} | ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, { startY: 35, head: [['Horário', 'Cliente', 'Telefone', 'Status', 'Obs']],
      body: todayAppointments.map((a: any) => [a.time || '-', a.client_name || '-', a.phone || '-', a.status || '-', a.notes || '']),
    });
    doc.save('agenda-equipe.pdf'); toast({ title: '📄 PDF baixado!' });
  };

  const exportFinanceiroPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Relatório Financeiro', 14, 20);
    const totalR = totalSales;
    const totalL = (portalSales as any[]).reduce((s: number, r: any) => s + Number(r.total_profit || 0), 0);
    doc.setFontSize(10); doc.text(`Vendas: R$ ${totalR.toFixed(2)} | Lucro: R$ ${totalL.toFixed(2)}`, 14, 28);
    autoTable(doc, { startY: 35, head: [['Data', 'Produto', 'Pagamento', 'Valor', 'Lucro']],
      body: (portalSales as any[]).map((r: any) => [
        r.sale_date ? format(new Date(r.sale_date), 'dd/MM') : '-',
        r.products?.name || '-', r.payment_method || '-',
        `R$ ${Number(r.sale_price || 0).toFixed(2)}`, `R$ ${Number(r.total_profit || 0).toFixed(2)}`
      ]),
    });
    doc.save('financeiro.pdf'); toast({ title: '📄 PDF baixado!' });
  };

  const roleLabel: Record<string, string> = {
    admin: 'admin', gerente: 'gerente', suporte: 'suporte', sistema: 'sistema', tecnico: 'técnico', colaborador: 'colaborador', painel: 'painel',
  };

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
    if (ms <= 0) return { label: 'Trial expirado', expired: true };
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return { label: `${hours}h ${minutes}m restantes`, expired: false };
  };

  // Separate today and tomorrow appointments
  const tomorrowDate = addDays(new Date(), 1);
  const completedToday = todayAppointments.filter((a: any) => a.status === 'concluido');

  // PDV filtered
  const pdvFilteredClients = (portalClients as any[]).filter((c: any) =>
    pdvClientSearch && (c.name?.toLowerCase().includes(pdvClientSearch.toLowerCase()) || c.telefone?.includes(pdvClientSearch))
  );
  const pdvFilteredProducts = (portalProducts as any[]).filter((p: any) =>
    pdvProductSearch ? p.name?.toLowerCase().includes(pdvProductSearch.toLowerCase()) : true
  );

  const totalLucro = (portalSales as any[]).reduce((s: number, r: any) => s + Number(r.total_profit || 0), 0);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header - matching screenshot */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-foreground/20 backdrop-blur flex items-center justify-center">
                <Wind className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Olá, {session.memberName}!</h1>
                <p className="text-sm opacity-80">{session.memberName} • {roleLabel[session.role] || session.role}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={forceUpdateApp} title="Sincronizar Versão" className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9">
                <RefreshCw className="w-4 h-4" />
              </Button>
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

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* 4 Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 text-center">
              <CalendarDays className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{todayAppointments.length}</div>
              <div className="text-xs text-muted-foreground">Hoje</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardContent className="pt-4 pb-3 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <div className="text-2xl font-bold text-amber-500">{pending}</div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="pt-4 pb-3 text-center">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <div className="text-2xl font-bold text-green-500">R$ {totalSales.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Faturamento</div>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="pt-4 pb-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{totalClients}</div>
              <div className="text-xs text-muted-foreground">Clientes</div>
            </CardContent>
          </Card>
        </div>

        {/* Single row of 6 tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-6 h-10">
            <TabsTrigger value="agenda" className="text-xs gap-1"><CalendarDays className="w-3.5 h-3.5" /><span className="hidden sm:inline">Agenda</span></TabsTrigger>
            <TabsTrigger value="cadastros" className="text-xs gap-1"><Users className="w-3.5 h-3.5" /><span className="hidden sm:inline">Cadastros</span></TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs gap-1"><DollarSign className="w-3.5 h-3.5" /><span className="hidden sm:inline">Financeiro</span></TabsTrigger>
            <TabsTrigger value="vendas" className="text-xs gap-1"><ShoppingCart className="w-3.5 h-3.5" /><span className="hidden sm:inline">Vendas</span></TabsTrigger>
            <TabsTrigger value="admin" className="text-xs gap-1"><Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline">Admin</span></TabsTrigger>
            <TabsTrigger value="suporte" className="text-xs gap-1 relative">
              <Headphones className="w-3.5 h-3.5" /><span className="hidden sm:inline">Suporte</span>
              {supportRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {supportRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ========== AGENDA ========== */}
          <TabsContent value="agenda" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button className="flex-1 h-11 gap-2" onClick={() => setShowScheduleForm(!showScheduleForm)}>
                <Plus className="w-4 h-4" /> Novo Agendamento
              </Button>
              <Button variant="outline" className="h-11 gap-1" onClick={exportAgendaPDF}>
                <Printer className="w-4 h-4" /> PDF
              </Button>
            </div>

            {/* Schedule form */}
            {showScheduleForm && (
              <Card className="border-primary/30">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cliente *</Label>
                    <Select value={scheduleClientId} onValueChange={setScheduleClientId}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(portalClients as any[]).map((c: any) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Serviço</Label>
                    <Select value={scheduleServiceId} onValueChange={setScheduleServiceId}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {(portalProducts as any[]).filter((p: any) => p.type === 'service').map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} • R$ {Number(p.price).toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Data *</Label>
                      <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Horário *</Label>
                      <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="h-10" />
                    </div>
                  </div>
                  <Input placeholder="Observações..." value={scheduleNotes} onChange={e => setScheduleNotes(e.target.value)} className="h-10" />
                  <Button className="w-full h-11" onClick={handleCreateAppointment} disabled={scheduling}>
                    {scheduling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
                    Agendar Serviço
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Today's appointments */}
            {todayAppointments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <CalendarDays className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">Nenhum agendamento hoje</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Agendamento" para criar</p>
                </CardContent>
              </Card>
            ) : (
              todayAppointments.map((apt: any) => (
                <Card key={apt.id} className={`border-l-4 ${apt.status === 'concluido' ? 'border-l-green-500 opacity-60' : apt.status === 'cancelado' ? 'border-l-destructive opacity-50' : 'border-l-primary'}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{apt.client_name}</span>
                        <Badge variant={apt.status === 'concluido' ? 'secondary' : 'default'} className="text-[10px] h-5">
                          {apt.status === 'concluido' ? '✓ Concluído' : apt.status === 'confirmado' ? '✓ Confirmado' : '• Agendado'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.time}</span>
                        {apt.notes && <span className="truncate max-w-[200px]">📝 {apt.notes}</span>}
                      </div>
                    </div>
                    {apt.phone && (
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0"
                        onClick={() => window.open(`https://wa.me/55${apt.phone.replace(/\D/g, '')}`, '_blank')}>
                        <Phone className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}

            {/* Pending bookings */}
            {pendingBookings.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Pendentes ({pendingBookings.length})
                </h3>
                {pendingBookings.map((b: any) => (
                  <Card key={b.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{b.client_name}</p>
                        <p className="text-xs text-muted-foreground">{b.preferred_date} às {b.preferred_time} • {b.service_name}</p>
                      </div>
                      {b.client_phone && (
                        <Button size="icon" variant="outline" className="h-9 w-9"
                          onClick={() => window.open(`https://wa.me/55${b.client_phone?.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ========== CADASTROS ========== */}
          <TabsContent value="cadastros" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9 h-10" />
              </div>
              <Button className="h-10 gap-1" onClick={() => setShowNewClient(!showNewClient)}>
                <Users className="w-4 h-4" /> Novo
              </Button>
            </div>

            {showNewClient && (
              <Card className="border-primary/40">
                <CardContent className="p-4 space-y-2">
                  <Input placeholder="Nome completo *" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="h-10" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Telefone" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="h-10" />
                    <Input placeholder="Endereço" value={newClientAddress} onChange={e => setNewClientAddress(e.target.value)} className="h-10" />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddClient} className="flex-1 h-10"><Plus className="w-4 h-4 mr-1" /> Cadastrar</Button>
                    <Button variant="outline" className="h-10" onClick={() => setShowNewClient(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Client list */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {filteredClients.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                ) : (
                  filteredClients.slice(0, 50).map((client: any) => (
                    <div key={client.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{client.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{client.name}</p>
                          {client.telefone && <p className="text-xs text-muted-foreground">{client.telefone}</p>}
                        </div>
                      </div>
                      {client.telefone && (
                        <Button size="icon" variant="ghost" className="h-9 w-9"
                          onClick={() => window.open(`https://wa.me/55${client.telefone.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Services / Products */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Serviços / Produtos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {(portalProducts as any[]).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.service_duration && <span className="text-xs text-muted-foreground ml-1">({p.service_duration}min)</span>}
                    </div>
                    <span className="font-semibold text-sm text-green-500">R$ {Number(p.price).toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== FINANCEIRO ========== */}
          <TabsContent value="financeiro" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11 gap-2" onClick={exportFinanceiroPDF}>
                <Printer className="w-4 h-4" /> Imprimir Relatório PDF
              </Button>
              <Button variant="outline" className="h-11 gap-1" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" /> Atualizar
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-primary/30">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-primary mb-1">📈</div>
                  <div className="text-2xl font-bold">R$ {totalSales.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Vendas Total</div>
                </CardContent>
              </Card>
              <Card className="border-green-500/30">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-green-500 mb-1">💰</div>
                  <div className="text-2xl font-bold text-green-500">R$ {totalLucro.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Lucro Total</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent sales */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Últimas Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {(portalSales as any[]).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma venda registrada</div>
                ) : (
                  (portalSales as any[]).slice(0, 20).map((sale: any, idx: number) => (
                    <div key={sale.id || idx} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="text-sm font-medium">{sale.sale_date ? format(new Date(sale.sale_date), 'dd/MM') : '-'}</span>
                        <span className="text-sm text-muted-foreground ml-2">{sale.payment_method}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-green-500">R$ {Number(sale.sale_price || 0).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">Lucro: R$ {Number(sale.total_profit || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Completed today */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" /> Agendamentos Concluídos Hoje
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {completedToday.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground">Nenhum concluído hoje</p>
                ) : (
                  completedToday.map((apt: any) => (
                    <div key={apt.id} className="flex items-center justify-between py-2">
                      <span className="text-sm">{apt.client_name}</span>
                      <span className="text-xs text-muted-foreground">{apt.time}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== VENDAS (PDV) ========== */}
          <TabsContent value="vendas" className="mt-4 space-y-3">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Cliente</Label>
                <div className="relative">
                  <Input placeholder="Buscar cliente..." value={pdvClientSearch}
                    onChange={e => { setPdvClientSearch(e.target.value); setPdvClientId(''); }} className="h-10" />
                </div>
                {pdvClientSearch && pdvFilteredClients.length > 0 && !pdvClientId && (
                  <Card className="mt-1 max-h-40 overflow-y-auto">
                    <CardContent className="p-0 divide-y divide-border">
                      {pdvFilteredClients.slice(0, 8).map((c: any) => (
                        <button key={c.id} className="w-full text-left px-4 py-2 hover:bg-muted/50 text-sm"
                          onClick={() => { setPdvClientId(String(c.id)); setPdvClientSearch(c.name); }}>
                          {c.name}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold">Adicionar Produto/Serviço</Label>
                <Input placeholder="Buscar produto..." value={pdvProductSearch} onChange={e => setPdvProductSearch(e.target.value)} className="h-10" />
              </div>

              <div>
                <Label className="text-sm font-semibold">Pagamento</Label>
                <Select value={pdvPayment} onValueChange={setPdvPayment}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Débito">Débito</SelectItem>
                    <SelectItem value="Crédito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cart items */}
              {pdvItems.length > 0 && (
                <Card>
                  <CardContent className="p-3 space-y-2">
                    {pdvItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="text-sm">{item.name} x{item.qty}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">R$ {(item.price * item.qty).toFixed(2)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                            onClick={() => setPdvItems(pdvItems.filter((_, i) => i !== idx))}>
                            <UserX className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Total */}
              <Card className="border-primary/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-lg text-green-500">R$ {pdvTotal.toFixed(2)}</span>
                </CardContent>
              </Card>

              <Button className="w-full h-12 gap-2" onClick={handleCreateSale} disabled={creatingSale || pdvItems.length === 0 || !pdvClientId}>
                {creatingSale ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Finalizar Venda
              </Button>
            </div>

            {/* Product catalog */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">📋 Serviços / Produtos</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border">
                {pdvFilteredProducts.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.service_duration && <span className="text-xs text-muted-foreground ml-1">({p.service_duration}min)</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-green-500">R$ {Number(p.price).toFixed(2)}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addPdvItem(p)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ADMIN ========== */}
          <TabsContent value="admin" className="mt-4 space-y-4">
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
                { label: 'Total', val: (portalSubscribers as any[]).length, color: 'text-foreground' },
                { label: 'Ativos', val: activeSubscribers.length, color: 'text-green-500' },
                { label: 'Pendentes', val: pendingSubscribers.length, color: 'text-amber-500' },
                { label: 'Expirando', val: expiringSubscribers.length, color: 'text-red-500' },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Expiring */}
            {expiringSubscribers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-red-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> Prazos Expirando
                </h3>
                {expiringSubscribers.map((sub: any) => {
                  const remaining = getTimeRemaining(sub.end_date);
                  return (
                    <SubscriberQuickActions key={sub.id} sub={sub} statusBadge={<span className={`text-[11px] font-bold ${remaining.color}`}>⏱ {remaining.label}</span>} borderColor="border-l-red-500" activatingUser={activatingUser} onActivate={handleActivateSubscriber} />
                  );
                })}
              </div>
            )}

            {/* Pending */}
            {pendingSubscribers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" /> Aguardando Ativação ({pendingSubscribers.length})
                </h3>
                {pendingSubscribers.map((sub: any) => {
                  const trial = getTrialRemaining(sub.created_at);
                  return (
                    <SubscriberQuickActions key={sub.id} sub={sub} statusBadge={<span className={`text-[11px] font-bold ${trial.expired ? 'text-red-500' : 'text-amber-500'}`}>{trial.expired ? '⛔ ' : '⏱ '}{trial.label}</span>} borderColor={trial.expired ? 'border-l-red-500' : 'border-l-amber-500'} activatingUser={activatingUser} onActivate={handleActivateSubscriber} />
                  );
                })}
              </div>
            )}

            {/* All subscribers */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Todos os Usuários ({filteredSubscribers.length})</h3>
              {filteredSubscribers.map((sub: any) => {
                const isActive = sub.is_active && sub.status === 'aprovado';
                const isVitalicio = sub.plan === 'vitalicio';
                const remaining = sub.end_date ? getTimeRemaining(sub.end_date) : null;
                return (
                  <SubscriberQuickActions key={sub.id} sub={sub} statusBadge={
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge variant={isActive ? 'default' : sub.status === 'pendente' ? 'secondary' : 'destructive'} className="text-[9px] h-4">
                        {isActive ? '✓ Ativo' : sub.status === 'pendente' ? '⏳ Pendente' : '🚫 ' + sub.status}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4">{sub.plan}</Badge>
                      {isVitalicio && <span className="text-[10px] text-green-500 font-medium">🏆</span>}
                      {remaining && !isVitalicio && <span className={`text-[10px] font-medium ${remaining.color}`}>⏱ {remaining.label}</span>}
                    </div>
                  } borderColor={!isActive ? 'opacity-70' : ''} activatingUser={activatingUser} onActivate={handleActivateSubscriber} />
                );
              })}
            </div>
          </TabsContent>

          {/* ========== SUPORTE ========== */}
          <TabsContent value="suporte" className="mt-4 space-y-4">
            {/* Support request form */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="w-4 h-4" /> Solicitar Ajuda ou Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={supportType} onValueChange={setSupportType}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ajuda">🔧 Preciso de Suporte</SelectItem>
                    <SelectItem value="acesso">🔑 Preciso de Acesso</SelectItem>
                    <SelectItem value="bug">🐛 Reportar Bug</SelectItem>
                    <SelectItem value="outro">📝 Outro</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Descreva sua necessidade..." value={supportMessage} onChange={e => setSupportMessage(e.target.value)} className="h-10" />
                <Button className="w-full h-11 gap-2" onClick={handleSendSupport} disabled={sendingSupport}>
                  {sendingSupport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Solicitação
                </Button>
              </CardContent>
            </Card>

            {/* Online support members */}
            <Card className="border-green-500/20">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Headphones className="w-4 h-4" /> Suporte Online
                </CardTitle>
                <p className="text-xs text-muted-foreground">Membros ativos disponíveis para ajudar via WhatsApp.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {onlineMembers.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">Nenhum membro online no momento</p>
                ) : (
                  onlineMembers.map((m: any) => (
                    <Card key={m.member_id || m.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{m.member_name?.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{m.member_name}</span>
                              <Badge className="bg-green-500 text-white text-[9px] h-4">Online</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{m.member_role}</p>
                          </div>
                        </div>
                        {m.member_phone && (
                          <Button className="w-full h-10 gap-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => window.open(`https://wa.me/55${m.member_phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${m.member_name}, preciso de ajuda!`)}`, '_blank')}>
                            <MessageCircle className="w-4 h-4" /> Chamar no WhatsApp
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Pending support requests */}
            {supportRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider">
                  <MessageCircle className="w-3.5 h-3.5" /> Solicitações Pendentes ({supportRequests.length})
                </h3>
                {supportRequests.map((req: any) => (
                  <Card key={req.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-sm">{req.requester_name}</p>
                          <Badge variant="outline" className="text-[9px]">{req.request_type}</Badge>
                          {req.message && <p className="text-xs p-2 bg-muted rounded-lg">💬 {req.message}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {req.requester_phone && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs"
                              onClick={() => window.open(`https://wa.me/55${req.requester_phone.replace(/\D/g, '')}`, '_blank')}>
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

            {/* System support */}
            <Card className="border-amber-500/20">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-amber-500" /> Suporte do Sistema
                </CardTitle>
                <p className="text-xs text-muted-foreground">Problemas para acessar? Entre em contato direto.</p>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full h-10 gap-2"
                  onClick={() => window.open('https://wa.me/5500000000000?text=' + encodeURIComponent('Preciso de suporte técnico no sistema'), '_blank')}>
                  <Headphones className="w-4 h-4" /> Suporte Técnico
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}