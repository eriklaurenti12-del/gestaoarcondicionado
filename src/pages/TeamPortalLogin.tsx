import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wind, User, KeyRound, RefreshCw, LogOut, CalendarDays, ClipboardList, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Portal login + dashboard in one page
export default function TeamPortalLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [nameOrPhone, setNameOrPhone] = useState("");
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<any>(null);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if already logged in as team member
    const checkSession = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        // Check if this is a team member
        const { data: invite } = await supabase
          .from('team_invites')
          .select('team_role, accepted_email')
          .eq('accepted_by', s.user.id)
          .eq('status', 'accepted')
          .maybeSingle();
        
        if (invite) {
          setSession(s);
          setTeamRole(invite.team_role);
          setMemberName(invite.accepted_email || s.user.user_metadata?.username || 'Membro');
        }
      }
      setCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOrPhone.trim() || pin.length !== 4) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: loginResult, error: loginError } = await supabase.functions.invoke('team-portal-login', {
        body: { member_name: nameOrPhone.trim(), pin }
      });

      if (loginError || loginResult?.error) {
        throw new Error(loginResult?.error || loginError?.message || "Erro ao fazer login");
      }

      if (loginResult?.email && loginResult?.password) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: loginResult.email,
          password: loginResult.password,
        });
        if (signInError) throw signInError;
        
        // Fetch team role
        if (data.session?.user) {
          const { data: invite } = await supabase
            .from('team_invites')
            .select('team_role, accepted_email')
            .eq('accepted_by', data.session.user.id)
            .eq('status', 'accepted')
            .maybeSingle();
          
          setSession(data.session);
          setTeamRole(invite?.team_role || 'sistema');
          setMemberName(invite?.accepted_email || nameOrPhone.trim());
        }
        
        toast({ title: `Olá, ${nameOrPhone.trim()}!`, description: "Bem-vindo ao portal." });
      } else {
        throw new Error("Credenciais não encontradas");
      }
    } catch (error: any) {
      toast({ title: "Erro no acesso", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setTeamRole(null);
    setMemberName("");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // LOGGED IN - Show portal dashboard
  if (session && teamRole) {
    return <PortalDashboard memberName={memberName} teamRole={teamRole} onLogout={handleLogout} />;
  }

  // LOGIN FORM
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border border-border/50 shadow-lg rounded-2xl">
          <CardContent className="p-8 space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <Wind className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Portal da Equipe</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Entre com seu <strong className="text-primary">nome</strong> ou{" "}
                  <strong className="text-primary">número de telefone</strong> e sua senha
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome ou WhatsApp</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome ou telefone"
                    value={nameOrPhone}
                    onChange={e => setNameOrPhone(e.target.value)}
                    required
                    className="pl-10 h-12 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Senha (4 dígitos)</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    maxLength={4}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="pl-10 h-12 rounded-lg text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Primeiro acesso? Use o PIN enviado pelo administrador.
                </p>
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

// Portal Dashboard Component
function PortalDashboard({ memberName, teamRole, onLogout }: { memberName: string; teamRole: string; onLogout: () => void }) {
  const { toast } = useToast();

  // Fetch today's appointments
  const { data: todayAppointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['portal-appointments-today'],
    queryFn: async () => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address)')
        .gte('appointment_date', startOfDay)
        .lt('appointment_date', endOfDay)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch pending online bookings
  const { data: pendingBookings = [], refetch: refetchBookings } = useQuery({
    queryKey: ['portal-pending-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('online_bookings')
        .select('*')
        .eq('status', 'pendente')
        .order('preferred_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const completedToday = todayAppointments.filter((a: any) => a.status === 'concluido').length;
  const pendingToday = todayAppointments.filter((a: any) => a.status !== 'concluido' && a.status !== 'cancelado').length;

  const handleRefresh = () => {
    refetchAppointments();
    refetchBookings();
    toast({ title: "Atualizado! ✓" });
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === 'concluido' ? "✓ Concluído!" : "Status atualizado" });
      refetchAppointments();
    }
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
              <h1 className="font-bold text-lg">Olá, {memberName}!</h1>
              <p className="text-sm opacity-80">{pendingToday} serviço{pendingToday !== 1 ? 's' : ''} pendente{pendingToday !== 1 ? 's' : ''}</p>
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
              <div className="text-2xl font-bold text-emerald-500">{completedToday}</div>
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
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1 text-xs">📋 Agenda Hoje</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 text-xs">⏳ Pendentes</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-3 space-y-3">
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
                          <span className="font-semibold">{(apt.clients as any)?.name || 'Cliente'}</span>
                          <Badge variant={apt.status === 'concluido' ? 'secondary' : 'default'} className="text-[10px]">
                            {apt.status === 'concluido' ? '✓ Feito' : apt.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          🕐 {format(new Date(apt.appointment_date), 'HH:mm', { locale: ptBR })}
                        </p>
                        {(apt.clients as any)?.address && (
                          <p className="text-xs text-muted-foreground mt-1">📍 {(apt.clients as any).address}</p>
                        )}
                        {apt.notes && (
                          <p className="text-xs text-muted-foreground mt-1">📝 {apt.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(apt.clients as any)?.telefone && (
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                            onClick={() => window.open(`https://wa.me/55${(apt.clients as any).telefone.replace(/\D/g, '')}`, '_blank')}>
                            📱
                          </Button>
                        )}
                        {apt.status !== 'concluido' && (
                          <Button size="sm" className="h-8 text-xs"
                            onClick={() => updateAppointmentStatus(apt.id, 'concluido')}>
                            ✓ Concluir
                          </Button>
                        )}
                      </div>
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
              pendingBookings.map((booking: any) => (
                <Card key={booking.id} className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{booking.client_name}</p>
                        <p className="text-xs text-muted-foreground">📱 {booking.client_phone}</p>
                        <p className="text-xs text-muted-foreground">🔧 {booking.service_name}</p>
                        <p className="text-xs text-muted-foreground">
                          📅 {format(new Date(booking.preferred_date), 'dd/MM/yyyy')} às {booking.preferred_time}
                        </p>
                        {booking.notes && <p className="text-xs text-muted-foreground mt-1">📝 {booking.notes}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                        onClick={() => window.open(`https://wa.me/55${booking.client_phone.replace(/\D/g, '')}`, '_blank')}>
                        📱
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
