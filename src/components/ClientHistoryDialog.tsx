import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Wind, Save, Sparkles, AlertCircle, Phone, Bell, Plus, CalendarRange, CheckCircle } from "lucide-react";
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClientHistoryDialogProps {
  client: {
    id: number;
    name: string;
    telefone?: string | null;
    aniversario?: string | null;
    preferences?: string | null;
  } | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const fetchClientHistory = async (clientId: number) => {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*, products(name, price)')
    .eq('client_id', clientId)
    .order('appointment_date', { ascending: false });

  if (error) throw error;

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*, products(name)')
    .eq('client_id', clientId)
    .order('sale_date', { ascending: false });

  if (salesError) throw salesError;

  const { data: serviceOrders, error: soError } = await supabase
    .from('service_orders')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (soError) throw soError;

  const { data: maintenance, error: maintError } = await supabase
    .from('scheduled_maintenance')
    .select('*')
    .eq('client_id', clientId)
    .order('scheduled_date', { ascending: true });

  if (maintError) throw maintError;

  return { 
    appointments: appointments || [], 
    sales: sales || [], 
    serviceOrders: serviceOrders || [],
    maintenance: maintenance || []
  };
};

const ClientHistoryDialog: React.FC<ClientHistoryDialogProps> = ({ client, isOpen, onOpenChange }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState(client?.preferences || '');
  const [maintType, setMaintType] = useState('Higienização');
  const [maintInterval, setMaintInterval] = useState('6');
  const [maintDate, setMaintDate] = useState('');

  React.useEffect(() => {
    if (client) {
      setPreferences(client.preferences || '');
    }
  }, [client]);

  const { data: history, isLoading } = useQuery({
    queryKey: ['client-history', client?.id],
    queryFn: () => fetchClientHistory(client!.id),
    enabled: !!client?.id && isOpen,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ preferences: newPreferences })
        .eq('id', client!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: "Sucesso!", description: "Preferências salvas." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      agendado: { variant: "secondary", label: "Agendado" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.agendado;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  const scheduleMaintenanceMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      
      const nextDate = maintDate || format(addMonths(new Date(), parseInt(maintInterval)), 'yyyy-MM-dd');
      
      const { error } = await supabase.from('scheduled_maintenance').insert({
        user_id: session.user.id,
        client_id: client!.id,
        maintenance_type: maintType,
        interval_months: parseInt(maintInterval),
        scheduled_date: nextDate,
        is_completed: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-history', client?.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: "Agendado!", description: "Vencimento programado com sucesso." });
      setMaintDate('');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const markMaintenanceCompleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_maintenance')
        .update({ is_completed: true, completed_date: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-history', client?.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: "Concluído", description: "Manutenção marcada como feita." });
    }
  });

  if (!client) return null;

  const totalSpent = history?.sales?.reduce((sum, s) => sum + Number(s.sale_price) * s.qty, 0) || 0;
  const totalAppointments = history?.appointments?.length || 0;
  const completedAppointments = history?.appointments?.filter(a => a.status === 'concluido').length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Histórico de {client.name}
            </div>
            {client.telefone && (
              <Button 
                size="sm" 
                variant="outline" 
                className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700"
                onClick={() => {
                  const phone = client.telefone?.replace(/\D/g, '');
                  window.open(`https://wa.me/55${phone}`, '_blank');
                }}
              >
                <Phone className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Visualize o histórico completo e gerencie as preferências do cliente
          </DialogDescription>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-primary">{totalAppointments}</div>
              <div className="text-xs text-muted-foreground">Atendimentos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-green-600">{completedAppointments}</div>
              <div className="text-xs text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-blue-600">R$ {totalSpent.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Total Gasto</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-10">
            <TabsTrigger value="history">Agenda</TabsTrigger>
            <TabsTrigger value="sales">Vendas</TabsTrigger>
            <TabsTrigger value="orders">Serviços</TabsTrigger>
            <TabsTrigger value="maintenance">Vencimentos</TabsTrigger>
            <TabsTrigger value="preferences">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : history?.appointments?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
                  <p>Nenhum atendimento registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.appointments?.map((apt: any) => (
                    <Card key={apt.id} className="transition-all hover:shadow-md">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Wind className="w-4 h-4 text-primary" />
                              <span className="font-medium">{apt.products?.name || 'Serviço não especificado'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(apt.appointment_date), "HH:mm")}
                              </span>
                            </div>
                            {apt.notes && (
                              <p className="text-xs text-muted-foreground italic">"{apt.notes}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(apt.status)}
                            {apt.products?.price && (
                              <span className="text-sm font-semibold text-green-600">
                                R$ {Number(apt.products.price).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sales" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {history?.sales?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma venda registrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history?.sales?.map((sale: any) => (
                    <Card key={sale.id} className="transition-all hover:shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{sale.products?.name || 'Produto'}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.sale_date), "dd/MM/yyyy HH:mm", { locale: ptBR })} • {sale.payment_method} • {sale.qty}x
                            </p>
                          </div>
                          <span className="font-bold text-green-600 text-sm">
                            R$ {(Number(sale.sale_price) * sale.qty).toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {history?.serviceOrders?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum Serviço registrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history?.serviceOrders?.map((order: any) => (
                    <Card key={order.id} className="transition-all hover:shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">Serviço #{order.order_number} - {order.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant={order.status === 'concluido' ? 'outline' : order.status === 'cancelado' ? 'destructive' : 'secondary'} className="text-[10px]">
                                {order.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                          <span className="font-bold text-primary text-sm">
                            R$ {Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
              {/* List */}
              <ScrollArea className="pr-4 border-r">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" /> Vencimentos Programados
                </h3>
                {history?.maintenance?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CalendarRange className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum vencimento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history?.maintenance?.map((m: any) => (
                      <Card key={m.id} className={`transition-all ${m.is_completed ? 'opacity-50' : 'hover:shadow-sm border-amber-200'}`}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm flex items-center gap-1">
                                {m.maintenance_type}
                                {m.is_completed && <CheckCircle className="w-3 h-3 text-green-500 ml-1" />}
                              </p>
                              <p className={`text-xs ${m.is_completed ? 'text-muted-foreground' : 'text-amber-600 font-semibold'}`}>
                                Data: {format(parseISO(m.scheduled_date), "dd/MM/yyyy")}
                              </p>
                            </div>
                            {!m.is_completed && (
                              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => markMaintenanceCompleteMutation.mutate(m.id)}>
                                Feito
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
              
              {/* Form */}
              <div className="pl-2 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> Novo Vencimento
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Serviço</Label>
                    <Select value={maintType} onValueChange={setMaintType}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Higienização">Higienização</SelectItem>
                        <SelectItem value="Manutenção Preventiva">Manutenção Preventiva</SelectItem>
                        <SelectItem value="Limpeza">Limpeza</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Intervalo Automático</Label>
                    <Select value={maintInterval} onValueChange={setMaintInterval}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Daqui 3 meses</SelectItem>
                        <SelectItem value="6">Daqui 6 meses</SelectItem>
                        <SelectItem value="12">Daqui 1 ano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ou Escolha Data Específica</Label>
                    <Input type="date" value={maintDate} onChange={e => setMaintDate(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <Button 
                    className="w-full h-8 text-xs mt-2" 
                    onClick={() => scheduleMaintenanceMutation.mutate()}
                    disabled={scheduleMaintenanceMutation.isPending}
                  >
                    Salvar Vencimento
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="preferences" className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Notas e Preferências
                </Label>
                <Textarea
                  id="preferences"
                  placeholder="Ex: Equipamento LG 9000 BTUs Inverter (quarto), acesso difícil no telhado, precisa de escada grande..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Registre informações importantes sobre os equipamentos, acessibilidade do local, voltagem, etc.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button 
            onClick={() => updatePreferencesMutation.mutate(preferences)}
            disabled={updatePreferencesMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientHistoryDialog;
