import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Wrench, AlertCircle, MapPin, Navigation, Check, X, Play, Phone, Truck, UserCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { toast } from 'sonner';
import ProviderDailyRouteDialog from './ProviderDailyRouteDialog';

const safeFormat = (date: any, formatStr: string, options?: any) => {
  try {
    if (!date) return '-';
    const d = (typeof date === 'string') ? parseISO(date) : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr, options);
  } catch {
    return '-';
  }
};

const fetchAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients(name, telefone, address), products(name, price)')
    .order('appointment_date');
  if (error) throw error;
  return data || [];
};

interface CalendarAgendaProps {
  className?: string;
}

const CalendarAgenda: React.FC<CalendarAgendaProps> = ({ className }) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [decisionAppointment, setDecisionAppointment] = useState<any | null>(null);
  const [decisionPaymentMethod, setDecisionPaymentMethod] = useState<string>('Dinheiro');
  const [serviceSummary, setServiceSummary] = useState<{
    clientName: string;
    serviceName: string;
    salePrice: number;
    profit: number;
    paymentMethod: string;
    description: string;
    isUpdate: boolean;
    waLink?: string;
    waMessage?: string;
    hasPhone?: boolean;
  } | null>(null);
  const [routeProvider, setRouteProvider] = useState<any | null>(null);
  const [pendingAssign, setPendingAssign] = useState<{ apt: any; provider: any } | null>(null);
  const [assignFuel, setAssignFuel] = useState('');
  const [assignFood, setAssignFood] = useState('');
  const [assignDaily, setAssignDaily] = useState('');
  const [assignDriver, setAssignDriver] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [assignErrors, setAssignErrors] = useState<{ fuel?: string; food?: string; daily?: string; driver?: string; date?: string }>({});
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['calendar-appointments'],
    queryFn: fetchAppointments
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['calendar-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_providers' as any)
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) return [];
      return (data as any[]) || [];
    },
  });

  const assignProviderMutation = useMutation({
    mutationFn: async ({ apt, providerName }: { apt: any; providerName: string | null }) => {
      const stripped = (apt.notes || '').replace(/\[PRESTADOR:[^\]]+\]\n?/g, '').trim();
      const newNotes = providerName
        ? (stripped ? `[PRESTADOR:${providerName}]\n${stripped}` : `[PRESTADOR:${providerName}]`)
        : (stripped || null);
      const updateData: any = { notes: newNotes };
      if (providerName && apt.status === 'pendente') updateData.status = 'confirmado';
      const { error } = await supabase.from('appointments').update(updateData).eq('id', apt.id);
      if (error) throw error;
      return { providerName };
    },
    onSuccess: ({ providerName }) => {
      toast.success(providerName ? `Encaminhado para ${providerName} ✓` : 'Prestador removido');
      queryClient.invalidateQueries({ queryKey: ['calendar-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['route-appointments'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentMethod, appointment }: { id: string; status: string; paymentMethod?: string; appointment?: any }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return { status } as any;

      if (status !== 'concluido') {
        await supabase.from('sales').delete().eq('user_id', session.user.id).eq('appointment_id', id);
        await supabase.from('financial_records').delete().eq('user_id', session.user.id).eq('appointment_id', id);
        return { status } as any;
      }

      if (status === 'concluido' && appointment?.client_id) {
        const finalPm = paymentMethod || 'Dinheiro';
        const salePrice = Number(appointment.products?.price) || 0;
        if (salePrice <= 0) return { status } as any;

        const { data: productData } = appointment.service_id ? await supabase
          .from('products').select('cost_price').eq('id', appointment.service_id).maybeSingle() : { data: null };
        const profit = salePrice - Number(productData?.cost_price || 0);

        const { data: existingSale } = await supabase
          .from('sales').select('id')
          .eq('user_id', session.user.id).eq('appointment_id', id).maybeSingle();

        if (!existingSale) {
          await supabase.from('sales').insert({
            user_id: session.user.id,
            client_id: appointment.client_id,
            product_id: appointment.service_id || null,
            qty: 1,
            sale_price: salePrice,
            total_profit: profit,
            payment_method: finalPm as any,
            sale_date: appointment.appointment_date,
            appointment_id: id,
          } as any);
        } else {
          await supabase.from('sales').update({ payment_method: finalPm as any }).eq('id', existingSale.id);
        }

        const description = `Serviço concluído: ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`;
        await recordFinancialEntry({
          userId: session.user.id,
          type: 'entrada',
          amount: salePrice,
          description,
          paymentMethod: finalPm,
          category: 'Serviço',
          appointmentId: id,
          recordDate: appointment.appointment_date,
        });

        // Build WhatsApp confirmation message (link wa.me - same pattern as the rest of the system)
        const { data: companyData } = await supabase
          .from('company_data')
          .select('company_name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        const companyName = companyData?.company_name || '';
        const firstName = (appointment.clients?.name || 'Cliente').split(' ')[0];
        const dateLabel = safeFormat(appointment.appointment_date, "dd/MM/yyyy 'às' HH:mm");
        const waMessage =
          `Olá ${firstName}! 👋\n\n` +
          `Confirmamos a *conclusão* do serviço *${appointment.products?.name || 'Serviço'}* em ${dateLabel}.\n\n` +
          `💰 Valor: R$ ${salePrice.toFixed(2)}\n` +
          `💳 Forma de pagamento: ${finalPm}\n\n` +
          `Muito obrigado pela preferência! 🙏${companyName ? `\n\n— ${companyName}` : ''}`;
        const rawPhone = (appointment.clients?.telefone || '').replace(/\D/g, '');
        const waLink = rawPhone
          ? `https://wa.me/${rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`}?text=${encodeURIComponent(waMessage)}`
          : '';

        return {
          status,
          summary: {
            clientName: appointment.clients?.name || 'Cliente',
            serviceName: appointment.products?.name || 'Serviço',
            salePrice,
            profit,
            paymentMethod: finalPm,
            description,
            isUpdate: !!existingSale,
            waLink,
            waMessage,
            hasPhone: !!rawPhone,
          },
        } as any;
      }
      return { status } as any;
    },
    onSuccess: (result: any, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['financial_records'] });
      const labels: Record<string, string> = {
        pendente: '📅 Reagendado',
        confirmado: '✓ Confirmado',
        concluido: '✅ Concluído',
        cancelado: '❌ Cancelado',
      };
      toast.success(labels[status] || 'Status atualizado');
      if (result?.summary) {
        setServiceSummary(result.summary);
        // Auto-open WhatsApp confirmation message (same wa.me pattern used across the system)
        if (result.summary.waLink) {
          try {
            window.open(result.summary.waLink, '_blank', 'noopener');
            toast.success('💬 WhatsApp aberto com a mensagem de conclusão');
          } catch {}
        }
      }
    }
  });

  const appointmentsByDate = useMemo(() => {
    if (!appointments) return {};
    const byDate: { [key: string]: typeof appointments } = {};
    appointments.forEach(apt => {
      if (!apt.appointment_date) return;
      const dateKey = safeFormat(apt.appointment_date, 'yyyy-MM-dd');
      if (dateKey === '-') return;
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(apt);
    });
    return byDate;
  }, [appointments]);

  const daysInView = useMemo(() => {
    if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate || !appointments) return [];
    return appointments.filter(apt => {
      if (!apt.appointment_date) return false;
      try {
        return isSameDay(parseISO(apt.appointment_date), selectedDate);
      } catch (e) {
        return false;
      }
    }).sort((a, b) => {
      const dateA = new Date(a.appointment_date).getTime();
      const dateB = new Date(b.appointment_date).getTime();
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });
  }, [selectedDate, appointments]);

  // Check if selected date is in the past
  const isSelectedDatePast = useMemo(() => {
    if (!selectedDate) return false;
    return isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  }, [selectedDate]);

  const canUseQuickDecision = (appointmentDate: string, status: string) => {
    const isPendingStatus = status === 'pendente' || status === 'confirmado';
    return isPendingStatus && isBefore(parseISO(appointmentDate), new Date());
  };

  const navigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-green-500';
      case 'concluido': return 'bg-blue-500';
      case 'cancelado': return 'bg-red-500';
      default: return 'bg-amber-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pendente: { variant: "secondary", label: "Pendente" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.pendente;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  // Check if a date is past
  const isDayPast = (day: Date) => {
    return isBefore(startOfDay(day), startOfDay(new Date()));
  };

  // Custom day render for calendar
  const getDayContent = (day: Date) => {
    const dateKey = safeFormat(day, 'yyyy-MM-dd');
    const dayAppointments = appointmentsByDate[dateKey] || [];
    const hasAppointments = dayAppointments.length > 0;
    const isPastDay = isDayPast(day);
    
    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center ${isPastDay ? 'opacity-50' : ''}`}>
        <span className={isPastDay ? 'text-muted-foreground line-through' : ''}>{safeFormat(day, 'd')}</span>
        {hasAppointments && (
          <div className="absolute bottom-0 flex gap-0.5">
            {dayAppointments.slice(0, 3).map((apt, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full ${getStatusColor(apt.status)} ${isPastDay ? 'opacity-60' : ''}`} 
              />
            ))}
            {dayAppointments.length > 3 && (
              <span className="text-[8px] text-muted-foreground">+{dayAppointments.length - 3}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Agenda Visual
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                  <Button 
                    variant={viewMode === 'month' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('month')}
                    className="rounded-none"
                  >
                    Mês
                  </Button>
                  <Button 
                    variant={viewMode === 'week' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('week')}
                    className="rounded-none"
                  >
                    Semana
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="font-semibold text-lg">
                {viewMode === 'month' 
                  ? safeFormat(currentDate, 'MMMM yyyy', { locale: ptBR })
                  : `Semana de ${safeFormat(startOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM')} - ${safeFormat(endOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM')}`
                }
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'month' ? (
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentDate}
                onMonthChange={setCurrentDate}
                locale={ptBR}
                className="rounded-md border w-full pointer-events-auto"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                  month: "space-y-4 w-full",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem]",
                  row: "flex w-full mt-2",
                  cell: "h-12 w-full text-center text-sm relative p-0 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                  day: "h-12 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  day_today: "bg-accent text-accent-foreground font-bold",
                  day_outside: "text-muted-foreground opacity-50",
                }}
                components={{
                  DayContent: ({ date }) => getDayContent(date),
                }}
              />
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
              <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[640px]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {daysInView.map(day => {
                  const dateKey = safeFormat(day, 'yyyy-MM-dd');
                  const dayAppointments = appointmentsByDate[dateKey] || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPastDay = isDayPast(day);
                  
                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all
                        ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        ${isPastDay ? 'bg-muted/30 opacity-70' : ''}
                        hover:bg-muted/50
                      `}
                    >
                      <div className={`text-sm font-medium mb-1 flex items-center gap-1 ${isToday(day) ? 'text-primary' : ''} ${isPastDay ? 'text-muted-foreground line-through' : ''}`}>
                        {safeFormat(day, 'd')}
                        {isPastDay && <span className="text-[10px] text-muted-foreground">(passado)</span>}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 2).map((apt: any) => (
                          <div 
                            key={apt.id} 
                            className={`text-xs p-1 rounded ${getStatusColor(apt.status)} text-white truncate ${isPastDay ? 'opacity-60' : ''}`}
                          >
                            {safeFormat(apt.appointment_date, 'HH:mm')} - {apt.clients?.name?.split(' ')[0]}
                          </div>
                        ))}
                        {dayAppointments.length > 2 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{dayAppointments.length - 2} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-muted-foreground">Agendado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Confirmado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-muted-foreground">Concluído</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Cancelado</span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-3 h-3 rounded bg-muted/50 border border-dashed" />
                <span className="text-sm text-muted-foreground">Dia Passado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedDate ? safeFormat(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
              {isSelectedDatePast && (
                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Dia Passado
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDayAppointments.length} agendamento(s)
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {selectedDayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Nenhum agendamento</p>
                  <p className="text-xs">neste dia</p>
                  {isSelectedDatePast && (
                    <p className="text-xs text-amber-500 mt-2">Este dia já passou</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayAppointments.map((apt: any) => {
                    const canQuickDecide = canUseQuickDecision(apt.appointment_date, apt.status);
                    const prestadorMatch = apt.notes?.match(/\[PRESTADOR:([^\]]+)\]/);
                    const assignedProvider = prestadorMatch ? prestadorMatch[1] : null;
                    const assignedColor = assignedProvider
                      ? (providers as any[]).find(p => p.name === assignedProvider)?.color || '#6366f1'
                      : null;

                    return (
                      <Card
                        key={apt.id}
                        onClick={() => canQuickDecide && setDecisionAppointment(apt)}
                        className={`transition-all hover:shadow-md ${isSelectedDatePast ? 'opacity-70' : ''} ${canQuickDecide ? 'cursor-pointer border-primary/30 bg-primary/5' : ''}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 text-primary font-semibold">
                              <Clock className="w-4 h-4" />
                              {safeFormat(apt.appointment_date, 'HH:mm')}
                            </div>
                            {getStatusBadge(apt.status)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium">{apt.clients?.name || 'Cliente'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Wrench className="w-3 h-3" />
                              <span>{apt.products?.name || 'Serviço'}</span>
                            </div>
                            {apt.clients?.address && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate text-xs">{apt.clients.address}</span>
                              </div>
                            )}
                            {apt.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1 pl-5">
                                "{apt.notes}"
                              </p>
                            )}
                            {canQuickDecide && (
                              <p className="text-xs text-primary mt-2 pl-5">
                                Toque no card para decidir: serviço feito ou não feito.
                              </p>
                            )}
                          </div>

                          {/* Status Action Buttons */}
                          {!canQuickDecide && apt.status !== 'concluido' && apt.status !== 'cancelado' && (
                            <div className="flex gap-1.5 mt-3 pt-2 border-t">
                              {apt.status !== 'confirmado' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 flex-1 border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: apt.id, status: 'confirmado' });
                                  }}
                                >
                                  <Play className="w-3 h-3 mr-1" /> Confirmar
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 flex-1 border-green-500/30 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDecisionPaymentMethod('Dinheiro');
                                  setDecisionAppointment(apt);
                                }}
                              >
                                <Check className="w-3 h-3 mr-1" /> Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 flex-1 border-red-500/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatusMutation.mutate({ id: apt.id, status: 'cancelado' });
                                }}
                              >
                                <X className="w-3 h-3 mr-1" /> Cancelar
                              </Button>
                            </div>
                          )}
                          {!canQuickDecide && (apt.status === 'concluido' || apt.status === 'cancelado') && (
                            <div className="flex gap-1.5 mt-3 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatusMutation.mutate({ id: apt.id, status: 'pendente' });
                                }}
                              >
                                ↩️ Reabrir
                              </Button>
                            </div>
                          )}

                          {/* Encaminhar para prestador */}
                          {apt.status !== 'concluido' && apt.status !== 'cancelado' && (
                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t">
                              {assignedProvider ? (
                                <>
                                  <Badge
                                    className="text-[10px] gap-1 border-0 text-white"
                                    style={{ backgroundColor: assignedColor || '#6366f1' }}
                                  >
                                    <UserCheck className="w-3 h-3" /> {assignedProvider}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[10px] h-6 px-2 ml-auto"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const prov = (providers as any[]).find((p: any) => p.name === assignedProvider);
                                      if (prov) setRouteProvider(prov);
                                      else toast.error('Prestador não encontrado no cadastro');
                                    }}
                                    title="Abrir Roteiro Diário"
                                  >
                                    <Navigation className="w-3 h-3 mr-1" /> Roteiro
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[10px] h-6 px-2 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignProviderMutation.mutate({ apt, providerName: null });
                                    }}
                                  >
                                    <X className="w-3 h-3" /> Remover
                                  </Button>
                                </>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7 w-full border-purple-500/30 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={assignProviderMutation.isPending}
                                    >
                                      <Truck className="w-3 h-3 mr-1" /> Encaminhar para prestador
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuLabel className="text-xs">Selecione o prestador</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {(providers as any[]).length === 0 ? (
                                      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                        Nenhum prestador ativo cadastrado
                                      </DropdownMenuItem>
                                    ) : (
                                      (providers as any[]).map((p: any) => (
                                        <DropdownMenuItem
                                          key={p.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingAssign({ apt, provider: p });
                                            setAssignFuel(p.fuel_allowance ? String(p.fuel_allowance) : '');
                                            setAssignFood(p.food_allowance ? String(p.food_allowance) : '');
                                            setAssignDaily(p.daily_rate ? String(p.daily_rate) : '');
                                            setAssignDriver(p.driver_cost ? String(p.driver_cost) : '');
                                            // Default expense date = appointment date, fallback = tomorrow
                                            let defDate = '';
                                            try {
                                              if (apt.appointment_date) {
                                                defDate = new Date(apt.appointment_date).toISOString().split('T')[0];
                                              } else {
                                                const t = new Date(); t.setDate(t.getDate() + 1);
                                                defDate = t.toISOString().split('T')[0];
                                              }
                                            } catch {
                                              const t = new Date(); t.setDate(t.getDate() + 1);
                                              defDate = t.toISOString().split('T')[0];
                                            }
                                            setAssignDate(defDate);
                                            setAssignErrors({});
                                          }}
                                          className="text-sm gap-2"
                                        >
                                          <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: p.color || '#6366f1' }}
                                          />
                                          {p.name}
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}

                          {/* Navigation + Contact */}
                          <div className="flex gap-1.5 mt-2">
                            {apt.clients?.address && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 flex-1 text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.clients.address)}`, '_blank');
                                  }}
                                >
                                  <Navigation className="w-3 h-3 mr-1" /> Maps
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-6 flex-1 text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://waze.com/ul?q=${encodeURIComponent(apt.clients.address)}`, '_blank');
                                  }}
                                >
                                  <MapPin className="w-3 h-3 mr-1" /> Waze
                                </Button>
                              </>
                            )}
                            {apt.clients?.telefone && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6 text-muted-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`https://wa.me/55${apt.clients.telefone.replace(/\D/g, '')}`, '_blank');
                                }}
                              >
                                <Phone className="w-3 h-3 mr-1" /> WhatsApp
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Services List for the day */}
            {selectedDayAppointments.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Serviços do Dia
                </h4>
                <div className="space-y-1">
                  {[...new Set(selectedDayAppointments.map(apt => apt.products?.name).filter(Boolean))].map((serviceName, idx) => {
                    const count = selectedDayAppointments.filter(apt => apt.products?.name === serviceName).length;
                    const servicePrice = selectedDayAppointments.find(apt => apt.products?.name === serviceName)?.products?.price;
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                        <span>{serviceName}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{count}x</Badge>
                          {servicePrice && (
                            <span className="text-xs text-muted-foreground">
                              R$ {(Number(servicePrice) * count).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {selectedDayAppointments.some(apt => apt.products?.price) && (
                    <div className="flex justify-between items-center text-sm p-2 bg-primary/10 rounded font-semibold mt-2">
                      <span>Total Estimado</span>
                      <span>
                        R$ {selectedDayAppointments.reduce((sum, apt) => sum + (Number(apt.products?.price) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!decisionAppointment} onOpenChange={(open) => !open && setDecisionAppointment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar atendimento</DialogTitle>
            <DialogDescription>
              {decisionAppointment
                ? `${decisionAppointment.clients?.name || 'Cliente'} • ${format(parseISO(decisionAppointment.appointment_date), "dd/MM 'às' HH:mm")}`
                : 'Selecione a decisão do atendimento'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label className="text-xs flex items-center gap-1">💳 Forma de Pagamento</Label>
              <Select value={decisionPaymentMethod} onValueChange={setDecisionPaymentMethod}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="PIX">📱 PIX</SelectItem>
                  <SelectItem value="Débito">💳 Débito</SelectItem>
                  <SelectItem value="Crédito">💳 Crédito</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Será gravada na venda e no Financeiro.</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!decisionAppointment) return;
                updateStatusMutation.mutate({
                  id: decisionAppointment.id,
                  status: 'concluido',
                  paymentMethod: decisionPaymentMethod,
                  appointment: decisionAppointment,
                });
                setDecisionAppointment(null);
              }}
            >
              <Check className="w-4 h-4 mr-2" /> Serviço feito
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                if (!decisionAppointment) return;
                updateStatusMutation.mutate({ id: decisionAppointment.id, status: 'cancelado' });
                setDecisionAppointment(null);
              }}
            >
              <X className="w-4 h-4 mr-2" /> Serviço não feito
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setDecisionAppointment(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service completion summary */}
      <Dialog open={!!serviceSummary} onOpenChange={(open) => !open && setServiceSummary(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" /> Serviço lançado com sucesso
            </DialogTitle>
            <DialogDescription>
              Confira o que foi registrado em Vendas e no Financeiro.
            </DialogDescription>
          </DialogHeader>
          {serviceSummary && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{serviceSummary.clientName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Serviço</span><span className="font-medium">{serviceSummary.serviceName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Forma de pagamento</span><span className="font-medium">{serviceSummary.paymentMethod}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-green-50 p-3">
                  <p className="text-[11px] text-green-700 uppercase font-semibold">Valor (Venda + Financeiro)</p>
                  <p className="text-lg font-bold text-green-700">R$ {serviceSummary.salePrice.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border bg-blue-50 p-3">
                  <p className="text-[11px] text-blue-700 uppercase font-semibold">Lucro</p>
                  <p className="text-lg font-bold text-blue-700">R$ {serviceSummary.profit.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                {serviceSummary.isUpdate
                  ? '↻ Venda existente foi atualizada com a nova forma de pagamento.'
                  : '✓ Nova venda criada e entrada lançada no Financeiro.'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold">Descrição registrada:</span> {serviceSummary.description}
              </p>
              {serviceSummary.hasPhone && serviceSummary.waLink ? (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => window.open(serviceSummary.waLink!, '_blank', 'noopener')}
                >
                  <Phone className="w-4 h-4 mr-2" /> Reenviar mensagem no WhatsApp
                </Button>
              ) : (
                <p className="text-[11px] text-amber-600 italic">⚠ Cliente sem telefone cadastrado — mensagem não enviada.</p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setServiceSummary(null)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Roteiro Diário direto do cartão */}
      <ProviderDailyRouteDialog
        isOpen={!!routeProvider}
        onOpenChange={(open) => { if (!open) setRouteProvider(null); }}
        provider={routeProvider}
        allAppointments={appointments || []}
      />

      {/* Diálogo de confirmação de encaminhamento com despesas opcionais */}
      <Dialog open={!!pendingAssign} onOpenChange={(open) => { if (!open) setPendingAssign(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encaminhar para {pendingAssign?.provider?.name}</DialogTitle>
            <DialogDescription>
              Defina a data da rota e os custos previstos. Os valores serão lançados como despesa vinculada ao agendamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Data das despesas (rota)</Label>
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => { setAssignDate(e.target.value); setAssignErrors(prev => ({ ...prev, date: undefined })); }}
              />
              {assignErrors.date && <p className="text-[11px] text-destructive">{assignErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'fuel', label: 'Combustível (R$)', value: assignFuel, set: setAssignFuel, err: assignErrors.fuel },
                { key: 'food', label: 'Alimentação (R$)', value: assignFood, set: setAssignFood, err: assignErrors.food },
                { key: 'daily', label: 'Diária (R$)', value: assignDaily, set: setAssignDaily, err: assignErrors.daily },
                { key: 'driver', label: 'Motorista (R$)', value: assignDriver, set: setAssignDriver, err: assignErrors.driver },
              ] as const).map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={f.value}
                    onChange={(e) => { f.set(e.target.value); setAssignErrors(prev => ({ ...prev, [f.key]: undefined })); }}
                    placeholder="0,00"
                    className={f.err ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {f.err && <p className="text-[11px] text-destructive">{f.err}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Use 0 para campos que não se aplicam. Valores negativos não são permitidos.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingAssign(null)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!pendingAssign) return;
                const { apt, provider } = pendingAssign;

                // Validate
                const errs: typeof assignErrors = {};
                if (!assignDate) errs.date = 'Informe a data';
                const checkField = (raw: string): string | undefined => {
                  if (raw === '' || raw === null || raw === undefined) return 'Obrigatório';
                  const n = Number(raw);
                  if (isNaN(n)) return 'Valor inválido';
                  if (n < 0) return 'Não pode ser negativo';
                  return undefined;
                };
                errs.fuel = checkField(assignFuel);
                errs.food = checkField(assignFood);
                errs.daily = checkField(assignDaily);
                errs.driver = checkField(assignDriver);
                const hasErrors = Object.values(errs).some(Boolean);
                if (hasErrors) {
                  setAssignErrors(errs);
                  toast.error('Corrija os campos destacados antes de confirmar.');
                  return;
                }
                setAssignErrors({});

                try {
                  await assignProviderMutation.mutateAsync({ apt, providerName: provider.name });
                  const { data: sessionData } = await supabase.auth.getSession();
                  const session = sessionData?.session;
                  if (session) {
                    const items = [
                      { cat: 'Combustível', val: Number(assignFuel) },
                      { cat: 'Alimentação', val: Number(assignFood) },
                      { cat: 'Diária', val: Number(assignDaily) },
                      { cat: 'Motorista', val: Number(assignDriver) },
                    ].filter(i => i.val > 0);
                    if (items.length > 0) {
                      const rows = items.map(i => ({
                        user_id: session.user.id,
                        appointment_id: apt.id,
                        category: i.cat,
                        amount: i.val,
                        expense_date: assignDate,
                        description: `${i.cat} - Rota ${provider.name}`,
                        helper_name: provider.name,
                      }));
                      const { error } = await supabase.from('fixed_expenses').insert(rows);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
                      toast.success(`Despesas registradas (${items.length}) em ${assignDate}`);
                    }
                  }
                  setPendingAssign(null);
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao encaminhar');
                }
              }}
              disabled={assignProviderMutation.isPending}
            >
              {assignProviderMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarAgenda;
