import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wind, User, KeyRound, RefreshCw, LogOut, CalendarDays, ClipboardList, Clock, Users, DollarSign, Plus, Search, Phone, Download, ShoppingCart, FileText } from "lucide-react";
import { format, startOfDay } from "date-fns";
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
  const [clientSearch, setClientSearch] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);

  const { data: todayAppointments = [], refetch: refetchApts } = useQuery({
    queryKey: ['portal-today', session.ownerId],
    queryFn: async () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data, error } = await supabase.functions.invoke('team-portal-data', {
        body: { owner_id: session.ownerId, member_id: session.memberId, type: 'appointments', start, end }
      });
      if (error) throw error;
      return data?.appointments || [];
    },
    refetchInterval: 30000,
  });

  const { data: pendingBookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['portal-bookings', session.ownerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('team-portal-data', {
        body: { owner_id: session.ownerId, member_id: session.memberId, type: 'bookings' }
      });
      if (error) throw error;
      return data?.bookings || [];
    },
    refetchInterval: 30000,
  });

  const { data: portalClients = [], refetch: refetchClients } = useQuery({
    queryKey: ['portal-clients', session.ownerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('team-portal-data', {
        body: { owner_id: session.ownerId, member_id: session.memberId, type: 'clients' }
      });
      if (error) throw error;
      return data?.clients || [];
    },
  });

  const { data: portalFinancial = [] } = useQuery({
    queryKey: ['portal-financial', session.ownerId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('team-portal-data', {
        body: { owner_id: session.ownerId, member_id: session.memberId, type: 'financial' }
      });
      if (error) throw error;
      return data?.financial || [];
    },
  });

  const completed = todayAppointments.filter((a: any) => a.status === 'concluido').length;
  const pending = todayAppointments.filter((a: any) => a.status !== 'concluido' && a.status !== 'cancelado').length;

  const filteredClients = (portalClients as any[]).filter((c: any) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.telefone?.includes(clientSearch)
  );

  const handleRefresh = () => {
    refetchApts();
    refetchBookings();
    refetchClients();
    toast({ title: "Atualizado! ✓" });
  };

  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Agenda do Dia', 14, 20);
    doc.setFontSize(10);
    doc.text(`Equipe: ${session.memberName} | ${format(new Date(), 'dd/MM/yyyy')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Horário', 'Cliente', 'Serviço', 'Status']],
      body: todayAppointments.map((a: any) => [a.time || '-', a.client_name || '-', a.service || '-', a.status || '-']),
    });
    doc.save('agenda-equipe.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const exportClientesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Clientes', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Nome', 'Telefone', 'Endereço']],
      body: (portalClients as any[]).map((c: any) => [c.name || '-', c.telefone || '-', c.address || '-']),
    });
    doc.save('clientes-equipe.pdf');
    toast({ title: '📄 PDF baixado!' });
  };

  const canAccess = (feature: string) => {
    const role = session.role;
    if (role === 'admin' || role === 'gerente') return true;
    if (role === 'suporte') return ['agenda', 'clientes', 'financeiro', 'pendentes'].includes(feature);
    return ['agenda', 'pendentes'].includes(feature);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary-foreground/20">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Olá, {session.memberName}!</h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{session.role}</Badge>
                <span className="text-sm opacity-80">{pending} pendente{pending !== 1 ? 's' : ''}</span>
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

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CalendarDays className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-2xl font-bold">{todayAppointments.length}</div>
              <div className="text-xs text-muted-foreground">Hoje</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <ClipboardList className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold text-emerald-500">{completed}</div>
              <div className="text-xs text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold text-amber-500">{pendingBookings.length}</div>
              <div className="text-xs text-muted-foreground">Pendentes</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="today">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="today" className="flex-1 text-xs">📋 Agenda</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 text-xs">⏳ Pendentes</TabsTrigger>
            {canAccess('clientes') && <TabsTrigger value="clientes" className="flex-1 text-xs">👥 Clientes</TabsTrigger>}
            {canAccess('financeiro') && <TabsTrigger value="financeiro" className="flex-1 text-xs">💰 Financeiro</TabsTrigger>}
          </TabsList>

          <TabsContent value="today" className="mt-3 space-y-3">
            <Button size="sm" variant="outline" className="w-full gap-2" onClick={exportAgendaPDF}>
              <Download className="w-4 h-4" /> Exportar Agenda PDF
            </Button>
            {todayAppointments.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Nenhum serviço hoje</p>
                  <p className="text-sm text-muted-foreground">Quando tiver agendamentos, eles aparecerão aqui.</p>
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

          <TabsContent value="pending" className="mt-3 space-y-3">
            {pendingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium">Nenhum agendamento pendente</p>
                  <p className="text-sm text-muted-foreground">Novos agendamentos online aparecerão aqui.</p>
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

          {canAccess('clientes') && (
            <TabsContent value="clientes" className="mt-3 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9" />
                </div>
                <Button size="icon" variant="outline" onClick={exportClientesPDF}><Download className="w-4 h-4" /></Button>
              </div>

              {filteredClients.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum cliente encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                filteredClients.slice(0, 30).map((client: any) => (
                  <Card key={client.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{client.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.telefone || 'Sem telefone'}</p>
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

          {canAccess('financeiro') && (
            <TabsContent value="financeiro" className="mt-3 space-y-3">
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
              {(portalFinancial as any[]).slice(0, 10).map((rec: any, idx: number) => (
                <Card key={rec.id || idx}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rec.type === 'receita' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                        <DollarSign className={`w-4 h-4 ${rec.type === 'receita' ? 'text-green-500' : 'text-destructive'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rec.description || rec.category || 'Registro'}</p>
                        <p className="text-xs text-muted-foreground">{rec.record_date ? format(new Date(rec.record_date), 'dd/MM/yyyy') : '-'}</p>
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
        </Tabs>
      </div>
    </div>
  );
}
