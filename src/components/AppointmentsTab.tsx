import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, PlusCircle, Calendar, Clock, Check, X, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Appointment = {
  id: string;
  user_id: string;
  client_id: number | null;
  service_id: number | null;
  appointment_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  clients?: { name: string; telefone: string | null } | null;
  products?: { name: string; price: number } | null;
};

const fetchAppointments = async (): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, clients(name, telefone), products(name, price)`)
    .order('appointment_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Appointment[];
};

const fetchClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name, telefone').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchServices = async () => {
  const { data, error } = await supabase.from('products').select('id, name, price').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const AppointmentsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({ 
    queryKey: ['appointments'], 
    queryFn: fetchAppointments 
  });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients });
  const { data: services } = useQuery({ queryKey: ['services-list'], queryFn: fetchServices });

  const addAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('appointments').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: "Sucesso!", description: "Agendamento criado." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao criar agendamento.", description: error.message });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: "Agendamento removido!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const resetForm = () => {
    setSelectedClientId("");
    setSelectedServiceId("");
    setAppointmentDate("");
    setAppointmentTime("");
    setNotes("");
  };

  const handleAddAppointment = () => {
    if (!selectedClientId || !appointmentDate || !appointmentTime) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Cliente, data e horário são obrigatórios." });
      return;
    }

    const dateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    
    addAppointmentMutation.mutate({
      user_id: userId,
      client_id: parseInt(selectedClientId),
      service_id: selectedServiceId ? parseInt(selectedServiceId) : null,
      appointment_date: dateTime.toISOString(),
      notes: notes || null,
      status: 'agendado'
    });
  };

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      const matchesSearch = a.clients?.name.toLowerCase().includes(search.toLowerCase()) || 
                           a.products?.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "todos" || a.status === filterStatus;
      return (search === "" || matchesSearch) && matchesStatus;
    });
  }, [appointments, search, filterStatus]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      agendado: { variant: "secondary", label: "Agendado" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.agendado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleWhatsApp = (phone: string | null | undefined, clientName: string, date: string) => {
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedDate = format(new Date(date), "dd/MM 'às' HH:mm", { locale: ptBR });
    const message = `Olá ${clientName}! Confirmando seu agendamento para ${formattedDate}. Podemos confirmar?`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const todayAppointments = useMemo(() => {
    if (!appointments) return 0;
    const today = new Date().toDateString();
    return appointments.filter(a => new Date(a.appointment_date).toDateString() === today && a.status !== 'cancelado').length;
  }, [appointments]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{todayAppointments}</div>
            <div className="text-xs text-muted-foreground">Hoje</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {appointments?.filter(a => a.status === 'agendado').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Agendados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {appointments?.filter(a => a.status === 'confirmado').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Confirmados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">
              {appointments?.filter(a => a.status === 'concluido').length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Concluídos</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Agendamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Agendamentos
            </span>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[130px] bg-background border-border">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="agendado">Agendados</SelectItem>
                  <SelectItem value="confirmado">Confirmados</SelectItem>
                  <SelectItem value="concluido">Concluídos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10"/>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Data/Hora</TableHead>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px]">Serviço</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAppointments ? (
                  Array.from({length: 3}).map((_,i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                  ))
                ) : filteredAppointments.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum agendamento encontrado</TableCell></TableRow>
                ) : (
                  filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        <div className="flex flex-col">
                          <span>{format(new Date(appointment.appointment_date), 'dd/MM/yyyy')}</span>
                          <span className="text-muted-foreground">{format(new Date(appointment.appointment_date), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm">{appointment.clients?.name || '-'}</span>
                          {appointment.clients?.telefone && (
                            <span className="text-xs text-muted-foreground">{appointment.clients.telefone}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{appointment.products?.name || '-'}</TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {appointment.clients?.telefone && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleWhatsApp(appointment.clients?.telefone, appointment.clients?.name || '', appointment.appointment_date)}
                            >
                              <Phone className="w-3 h-3" />
                            </Button>
                          )}
                          {appointment.status === 'agendado' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 w-8 p-0"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'confirmado' })}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          {appointment.status === 'confirmado' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="h-8 px-2 text-xs"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'concluido' })}
                            >
                              Concluir
                            </Button>
                          )}
                          {appointment.status !== 'cancelado' && appointment.status !== 'concluido' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 w-8 p-0"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'cancelado' })}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              if (window.confirm('Remover este agendamento?')) {
                                deleteAppointmentMutation.mutate(appointment.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Novo Agendamento */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Novo Agendamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name} {client.telefone && `- ${client.telefone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione o serviço (opcional)" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      {service.name} - R$ {Number(service.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário *</Label>
              <Input type="time" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
            </div>
            <Button onClick={handleAddAppointment} disabled={addAppointmentMutation.isPending} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              {addAppointmentMutation.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentsTab;
