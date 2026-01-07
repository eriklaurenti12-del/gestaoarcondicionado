import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { format, addMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Wrench, Search, Calendar, MapPin, DollarSign, 
  Clock, MessageSquare, Plus, AlertTriangle, CheckCircle,
  User, History
} from 'lucide-react';

interface ServiceHistory {
  id: string;
  clientId: number;
  clientName: string;
  clientAddress: string | null;
  clientPhone: string | null;
  serviceName: string;
  serviceDate: string;
  servicePrice: number;
  status: string;
  notes: string | null;
  nextMaintenanceDate: string | null;
  daysUntilMaintenance: number | null;
}

const ServicesHistoryTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceHistory | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('6');

  // Fetch all completed services with client info
  const { data: services, isLoading } = useQuery({
    queryKey: ['services-history'],
    queryFn: async () => {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          status,
          notes,
          clients(id, name, address, telefone),
          products(id, name, price)
        `)
        .eq('status', 'concluido')
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      // Get scheduled maintenances
      const { data: maintenances } = await supabase
        .from('scheduled_maintenance')
        .select('*')
        .eq('is_completed', false);

      const maintenanceMap = new Map(
        maintenances?.map(m => [`${m.client_id}`, m]) || []
      );

      const today = new Date();
      const result: ServiceHistory[] = [];

      (appointments || []).forEach((apt: any) => {
        if (!apt.clients || !apt.products) return;

        const maintenance = maintenanceMap.get(`${apt.clients.id}`);
        let nextDate = null;
        let daysUntil = null;

        if (maintenance) {
          nextDate = maintenance.scheduled_date;
          daysUntil = differenceInDays(new Date(maintenance.scheduled_date), today);
        }

        result.push({
          id: apt.id,
          clientId: apt.clients.id,
          clientName: apt.clients.name,
          clientAddress: apt.clients.address,
          clientPhone: apt.clients.telefone,
          serviceName: apt.products.name,
          serviceDate: apt.appointment_date,
          servicePrice: apt.products.price,
          status: apt.status,
          notes: apt.notes,
          nextMaintenanceDate: nextDate,
          daysUntilMaintenance: daysUntil
        });
      });

      return result;
    }
  });

  // Fetch all clients for filter dropdown
  const { data: clients } = useQuery({
    queryKey: ['clients-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Create scheduled maintenance
  const scheduleMutation = useMutation({
    mutationFn: async ({ clientId, date, notes, interval }: { clientId: number; date: string; notes: string; interval: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Check if there's already a maintenance scheduled
      const { data: existing } = await supabase
        .from('scheduled_maintenance')
        .select('id')
        .eq('client_id', clientId)
        .eq('is_completed', false)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('scheduled_maintenance')
          .update({
            scheduled_date: date,
            notes,
            interval_months: interval
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('scheduled_maintenance')
          .insert({
            user_id: user.id,
            client_id: clientId,
            scheduled_date: date,
            notes,
            interval_months: interval,
            maintenance_type: 'limpeza'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-history'] });
      toast.success('Próxima manutenção agendada!');
      setScheduleDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setMaintenanceDate('');
    setMaintenanceNotes('');
    setIntervalMonths('6');
    setSelectedService(null);
  };

  const openScheduleDialog = (service: ServiceHistory) => {
    setSelectedService(service);
    const defaultDate = format(addMonths(new Date(service.serviceDate), 6), 'yyyy-MM-dd');
    setMaintenanceDate(defaultDate);
    setScheduleDialogOpen(true);
  };

  const sendMaintenanceReminder = (service: ServiceHistory) => {
    if (!service.clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    const phone = service.clientPhone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${service.clientName}! 🌬️\n\n` +
      `Está na hora de fazer a manutenção do seu ar condicionado!\n\n` +
      `📅 Último serviço: ${format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: ptBR })}\n` +
      `🔧 Serviço: ${service.serviceName}\n\n` +
      `Entre em contato para agendar sua limpeza e manter seu equipamento funcionando perfeitamente! ❄️`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
    toast.success('Mensagem enviada!');
  };

  // Filter services based on search, client, and status
  const filteredServices = services?.filter(s => {
    const matchesSearch = s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.serviceName.toLowerCase().includes(search.toLowerCase());
    const matchesClient = selectedClientId === 'all' || s.clientId.toString() === selectedClientId;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'overdue' && s.daysUntilMaintenance !== null && s.daysUntilMaintenance < 0) ||
      (filterStatus === 'upcoming' && s.daysUntilMaintenance !== null && s.daysUntilMaintenance >= 0 && s.daysUntilMaintenance <= 30) ||
      (filterStatus === 'scheduled' && s.daysUntilMaintenance !== null) ||
      (filterStatus === 'not-scheduled' && s.daysUntilMaintenance === null);
    return matchesSearch && matchesClient && matchesStatus;
  }) || [];

  // Get unique clients from services for quick stats
  const uniqueClients = new Set(services?.map(s => s.clientId) || []);

  const getMaintenanceStatus = (daysUntil: number | null) => {
    if (daysUntil === null) return null;
    if (daysUntil < 0) {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Vencido ({Math.abs(daysUntil)}d)
      </Badge>;
    }
    if (daysUntil <= 30) {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
        <Clock className="w-3 h-3 mr-1" />
        Em {daysUntil}d
      </Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
      <CheckCircle className="w-3 h-3 mr-1" />
      Em {daysUntil}d
    </Badge>;
  };

  // Stats
  const totalServices = services?.length || 0;
  const totalRevenue = services?.reduce((sum, s) => sum + Number(s.servicePrice), 0) || 0;
  const pendingMaintenances = services?.filter(s => s.daysUntilMaintenance !== null && s.daysUntilMaintenance <= 30).length || 0;
  const overdueMaintenances = services?.filter(s => s.daysUntilMaintenance !== null && s.daysUntilMaintenance < 0).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alerts for overdue maintenances */}
      {overdueMaintenances > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {overdueMaintenances} manutenção(ões) vencida(s)!
                </p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  Clientes aguardando limpeza de ar condicionado. Envie lembretes para reagendar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{totalServices}</p>
                <p className="text-xs text-muted-foreground">Serviços</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <User className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{uniqueClients.size}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">R$ {totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Receita</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{pendingMaintenances}</p>
                <p className="text-xs text-muted-foreground">Próximas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Histórico de Serviços
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou serviço..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1 block">Filtrar por Cliente</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1 block">Status da Manutenção</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="overdue">🔴 Vencidas</SelectItem>
                    <SelectItem value="upcoming">🟡 Próximas (30 dias)</SelectItem>
                    <SelectItem value="scheduled">🟢 Com agendamento</SelectItem>
                    <SelectItem value="not-scheduled">⚪ Sem agendamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(selectedClientId !== 'all' || filterStatus !== 'all') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setSelectedClientId('all'); setFilterStatus('all'); setSearch(''); }}
                  className="mt-auto"
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum serviço encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Próx. Manut.</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {service.clientName}
                        </div>
                      </TableCell>
                      <TableCell>{service.serviceName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(service.serviceDate), 'dd/MM/yy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          R$ {Number(service.servicePrice).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {service.clientAddress ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground max-w-[150px] truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{service.clientAddress}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {service.nextMaintenanceDate ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs">
                              {format(new Date(service.nextMaintenanceDate), 'dd/MM/yy')}
                            </span>
                            {getMaintenanceStatus(service.daysUntilMaintenance)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Não agendada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openScheduleDialog(service)}
                            title="Agendar próxima manutenção"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => sendMaintenanceReminder(service)}
                            disabled={!service.clientPhone}
                            title="Enviar lembrete WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Schedule Maintenance Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agendar Próxima Manutenção
            </DialogTitle>
            <DialogDescription>
              Agende a próxima manutenção para {selectedService?.clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Input value={selectedService?.clientName || ''} disabled />
            </div>

            <div>
              <Label>Último Serviço</Label>
              <Input 
                value={selectedService ? `${selectedService.serviceName} - ${format(new Date(selectedService.serviceDate), 'dd/MM/yyyy')}` : ''} 
                disabled 
              />
            </div>

            <div>
              <Label>Intervalo (meses)</Label>
              <Select value={intervalMonths} onValueChange={setIntervalMonths}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data da Próxima Manutenção</Label>
              <Input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Ex: Limpeza preventiva, verificar gás..."
                value={maintenanceNotes}
                onChange={(e) => setMaintenanceNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedService || !maintenanceDate) {
                  toast.error('Preencha a data da manutenção');
                  return;
                }
                scheduleMutation.mutate({
                  clientId: selectedService.clientId,
                  date: maintenanceDate,
                  notes: maintenanceNotes,
                  interval: parseInt(intervalMonths)
                });
              }}
              disabled={scheduleMutation.isPending}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesHistoryTab;