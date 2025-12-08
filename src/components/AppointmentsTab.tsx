import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Search, PlusCircle, Calendar, Clock, Check, X, Phone, FileDown, List, CalendarRange } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import CalendarAgenda from './CalendarAgenda';

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
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  // Payment fields
  const [paymentMethod, setPaymentMethod] = useState<string>("Dinheiro");
  const [installments, setInstallments] = useState<number>(1);
  const [firstDueDate, setFirstDueDate] = useState<string>("");

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
      const { payment_method, installments: numInstallments, first_due_date, installment_amount, ...appointmentData } = data;
      
      // Insert appointment
      const { data: newAppointment, error } = await supabase.from('appointments').insert(appointmentData).select().single();
      if (error) throw error;
      
      // If there are installments > 1 and service selected, create installment records
      if (numInstallments > 1 && appointmentData.service_id && first_due_date) {
        const installmentRecords = [];
        const baseDate = new Date(first_due_date);
        
        for (let i = 0; i < numInstallments; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          
          installmentRecords.push({
            user_id: userId,
            appointment_id: newAppointment.id,
            installment_number: i + 1,
            total_installments: numInstallments,
            amount: installment_amount,
            due_date: dueDate.toISOString().split('T')[0],
            is_paid: false,
            payment_method: payment_method
          });
        }
        
        const { error: installmentError } = await supabase.from('installments').insert(installmentRecords);
        if (installmentError) console.error('Error creating installments:', installmentError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      toast({ title: "Sucesso!", description: "Agendamento criado." });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao criar agendamento.", description: error.message });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, appointment }: { id: string; status: string; appointment?: Appointment }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;
      
      // If completing the appointment and has a service, register the sale
      if (status === 'concluido' && appointment?.service_id && appointment?.client_id && appointment?.products) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const salePrice = Number(appointment.products.price);
          const costPrice = 0; // We'd need to fetch this from products table
          
          // Fetch product cost price
          const { data: productData } = await supabase
            .from('products')
            .select('cost_price')
            .eq('id', appointment.service_id)
            .maybeSingle();
          
          const actualCostPrice = productData?.cost_price || 0;
          const profit = salePrice - Number(actualCostPrice);
          
          await supabase.from('sales').insert({
            user_id: session.user.id,
            client_id: appointment.client_id,
            product_id: appointment.service_id,
            qty: 1,
            sale_price: salePrice,
            total_profit: profit,
            payment_method: 'Dinheiro' as const, // Default, can be changed
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-financial'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
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
    setPaymentMethod("Dinheiro");
    setInstallments(1);
    setFirstDueDate("");
  };

  const handleAddAppointment = async () => {
    if (!selectedClientId || !appointmentDate || !appointmentTime) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Cliente, data e horário são obrigatórios." });
      return;
    }

    const dateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    
    // Get service price for installments
    const service = services?.find(s => s.id === parseInt(selectedServiceId));
    const servicePrice = service?.price || 0;
    const installmentAmount = servicePrice / installments;
    
    addAppointmentMutation.mutate({
      user_id: userId,
      client_id: parseInt(selectedClientId),
      service_id: selectedServiceId ? parseInt(selectedServiceId) : null,
      appointment_date: dateTime.toISOString(),
      notes: notes || null,
      status: 'agendado',
      payment_method: paymentMethod,
      installments: installments,
      first_due_date: firstDueDate || null,
      installment_amount: installmentAmount
    });
  };

  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter((a) => {
      const matchesSearch = a.clients?.name.toLowerCase().includes(search.toLowerCase()) || 
                           a.products?.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === "todos" || a.status === filterStatus;
      
      // Filter by month/year
      const appointmentDateObj = new Date(a.appointment_date);
      const matchesMonth = filterMonth === "todos" || (appointmentDateObj.getMonth() + 1) === parseInt(filterMonth);
      const matchesYear = filterYear === "todos" || appointmentDateObj.getFullYear() === parseInt(filterYear);
      
      return (search === "" || matchesSearch) && matchesStatus && matchesMonth && matchesYear;
    });
  }, [appointments, search, filterStatus, filterMonth, filterYear]);

  // Get unique years from appointments
  const availableYears = useMemo(() => {
    if (!appointments) return [new Date().getFullYear()];
    const years = [...new Set(appointments.map(a => new Date(a.appointment_date).getFullYear()))];
    return years.sort((a, b) => b - a);
  }, [appointments]);

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

  // Generate available time slots - 24 hours (every 30 min)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 0; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get booked times for a specific date
  const getBookedTimes = (date: string) => {
    if (!appointments) return [];
    return appointments
      .filter(a => {
        const appointmentDate = new Date(a.appointment_date);
        return appointmentDate.toISOString().split('T')[0] === date && a.status !== 'cancelado';
      })
      .map(a => format(new Date(a.appointment_date), 'HH:mm'));
  };

  // Export PDF with available times
  const exportAvailableTimesPDF = () => {
    const doc = new jsPDF();
    const selectedDate = appointmentDate || new Date().toISOString().split('T')[0];
    const bookedTimes = getBookedTimes(selectedDate);
    
    doc.setFontSize(18);
    doc.text('Horários Disponíveis', 14, 22);
    doc.setFontSize(12);
    doc.text(`Data: ${format(new Date(selectedDate + 'T12:00:00'), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}`, 14, 32);
    
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));
    const tableData = availableSlots.map(slot => [slot, '✅ Disponível']);

    autoTable(doc, {
      startY: 40,
      head: [['Horário', 'Status']],
      body: tableData,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [147, 51, 234] },
    });

    doc.save(`horarios-disponiveis-${selectedDate}.pdf`);
    toast({ title: "PDF exportado!", description: "Horários disponíveis salvos." });
  };

  // Export PDF with scheduled appointments
  const exportScheduledPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Agenda de Atendimentos', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

    const scheduledAppointments = appointments?.filter(a => a.status !== 'cancelado') || [];
    const tableData = scheduledAppointments.map(a => [
      format(new Date(a.appointment_date), 'dd/MM/yyyy'),
      format(new Date(a.appointment_date), 'HH:mm'),
      a.clients?.name || '-',
      a.clients?.telefone || '-',
      a.products?.name || '-',
      a.status === 'agendado' ? 'Agendado' : a.status === 'confirmado' ? 'Confirmado' : 'Concluído'
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['Data', 'Hora', 'Cliente', 'Telefone', 'Serviço', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [147, 51, 234] },
    });

    doc.save('agenda-atendimentos.pdf');
    toast({ title: "PDF exportado!", description: "Agenda de atendimentos salva." });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* View Toggle + Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-none min-h-[44px] px-4"
          >
            <List className="w-4 h-4 mr-2" />
            Lista
          </Button>
          <Button 
            variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="rounded-none min-h-[44px] px-4"
          >
            <CalendarRange className="w-4 h-4 mr-2" />
            Calendário
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={() => setShowAddDialog(true)} className="min-h-[44px] flex-1 sm:flex-none">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
          <Button onClick={exportScheduledPDF} variant="outline" className="min-h-[44px]">
            <FileDown className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Exportar PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold">{todayAppointments}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Hoje</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-500">
              {appointments?.filter(a => a.status === 'agendado').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Agendados</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-green-500">
              {appointments?.filter(a => a.status === 'confirmado').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Confirmados</div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
          <CardContent className="p-4">
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              {appointments?.filter(a => a.status === 'concluido').length || 0}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Concluídos</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarAgenda className="animate-fade-in" />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agendamentos
              </span>
              <Button onClick={exportAvailableTimesPDF} size="sm" variant="outline" className="min-h-[44px]">
                <FileDown className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Horários Disponíveis</span>
                <span className="sm:hidden">Horários</span>
              </Button>
            </CardTitle>
          </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente ou serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 transition-all duration-200"/>
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="1">Janeiro</SelectItem>
                <SelectItem value="2">Fevereiro</SelectItem>
                <SelectItem value="3">Março</SelectItem>
                <SelectItem value="4">Abril</SelectItem>
                <SelectItem value="5">Maio</SelectItem>
                <SelectItem value="6">Junho</SelectItem>
                <SelectItem value="7">Julho</SelectItem>
                <SelectItem value="8">Agosto</SelectItem>
                <SelectItem value="9">Setembro</SelectItem>
                <SelectItem value="10">Outubro</SelectItem>
                <SelectItem value="11">Novembro</SelectItem>
                <SelectItem value="12">Dezembro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full sm:w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="agendado">Agendados</SelectItem>
                <SelectItem value="confirmado">Confirmados</SelectItem>
                <SelectItem value="concluido">Concluídos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Data/Hora</TableHead>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px]">Serviço</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Ações</TableHead>
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
                        <div className="flex flex-wrap gap-1.5">
                          {appointment.clients?.telefone && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target"
                              onClick={() => handleWhatsApp(appointment.clients?.telefone, appointment.clients?.name || '', appointment.appointment_date)}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                          {appointment.status === 'agendado' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'confirmado', appointment })}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {appointment.status === 'confirmado' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="h-10 px-3 text-sm touch-target"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'concluido', appointment })}
                            >
                              Concluir
                            </Button>
                          )}
                          {appointment.status !== 'cancelado' && appointment.status !== 'concluido' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-10 w-10 p-0 touch-target text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                              onClick={() => updateStatusMutation.mutate({ id: appointment.id, status: 'cancelado', appointment })}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-10 w-10 p-0 touch-target text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm('Remover este agendamento?')) {
                                deleteAppointmentMutation.mutate(appointment.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}

      {/* Dialog Novo Agendamento */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Novo Agendamento
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do novo agendamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      {service.name} - R$ {Number(service.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {timeSlots.map((slot) => {
                      const isBooked = appointmentDate ? getBookedTimes(appointmentDate).includes(slot) : false;
                      return (
                        <SelectItem 
                          key={slot} 
                          value={slot}
                          disabled={isBooked}
                          className={isBooked ? "text-muted-foreground line-through" : ""}
                        >
                          {slot} {isBooked ? "(ocupado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." />
            </div>

            {/* Payment Section */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-semibold text-muted-foreground mb-3 block">Pagamento</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                      <SelectItem value="PIX">📱 PIX</SelectItem>
                      <SelectItem value="Débito">💳 Débito</SelectItem>
                      <SelectItem value="Crédito">💳 Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select value={String(installments)} onValueChange={(v) => setInstallments(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Parcelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">À vista</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="3">3x</SelectItem>
                      <SelectItem value="4">4x</SelectItem>
                      <SelectItem value="5">5x</SelectItem>
                      <SelectItem value="6">6x</SelectItem>
                      <SelectItem value="10">10x</SelectItem>
                      <SelectItem value="12">12x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {installments > 1 && (
                <div className="space-y-2 mt-4 p-3 bg-muted/50 rounded-lg animate-fade-in">
                  <Label>Data do 1º Vencimento *</Label>
                  <Input 
                    type="date" 
                    value={firstDueDate} 
                    onChange={(e) => setFirstDueDate(e.target.value)}
                  />
                  {selectedServiceId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Valor por parcela: R$ {((services?.find(s => s.id === parseInt(selectedServiceId))?.price || 0) / installments).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleAddAppointment} disabled={addAppointmentMutation.isPending}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {addAppointmentMutation.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsTab;
