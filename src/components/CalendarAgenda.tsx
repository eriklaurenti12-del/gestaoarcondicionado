import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Wrench, AlertCircle, MapPin, Navigation, Check, X, Play, Phone } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['calendar-appointments'],
    queryFn: fetchAppointments
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentMethod, appointment }: { id: string; status: string; paymentMethod?: string; appointment?: any }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;

      // Reverse financial entries when leaving "concluido"
      if (status !== 'concluido') {
        await supabase.from('sales').delete().eq('user_id', session.user.id).eq('appointment_id', id);
        await supabase.from('financial_records').delete().eq('user_id', session.user.id).eq('appointment_id', id);
        return;
      }

      if (status === 'concluido' && appointment?.client_id) {
        const finalPm = paymentMethod || 'Dinheiro';
        const salePrice = Number(appointment.products?.price) || 0;
        if (salePrice <= 0) return;

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

        await recordFinancialEntry({
          userId: session.user.id,
          type: 'entrada',
          amount: salePrice,
          description: `Serviço concluído: ${appointment.products?.name || 'Serviço'} - ${appointment.clients?.name || 'Cliente'}`,
          paymentMethod: finalPm,
          category: 'Serviço',
          appointmentId: id,
          recordDate: appointment.appointment_date,
        });
      }
    },
    onSuccess: (_, { status }) => {
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
              <div className="grid grid-cols-7 gap-2">
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

          <div className="grid gap-2">
            <Button
              className="w-full"
              onClick={() => {
                if (!decisionAppointment) return;
                updateStatusMutation.mutate({ id: decisionAppointment.id, status: 'concluido' });
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
    </div>
  );
};

export default CalendarAgenda;
