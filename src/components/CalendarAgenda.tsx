import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Scissors } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const fetchAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, clients(name, telefone), products(name, price)')
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

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['calendar-appointments'],
    queryFn: fetchAppointments
  });

  const appointmentsByDate = useMemo(() => {
    if (!appointments) return {};
    const byDate: { [key: string]: typeof appointments } = {};
    appointments.forEach(apt => {
      const dateKey = format(parseISO(apt.appointment_date), 'yyyy-MM-dd');
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
    return appointments.filter(apt => 
      isSameDay(parseISO(apt.appointment_date), selectedDate)
    ).sort((a, b) => 
      new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
    );
  }, [selectedDate, appointments]);

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
      agendado: { variant: "secondary", label: "Agendado" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.agendado;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  // Custom day render for calendar
  const getDayContent = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayAppointments = appointmentsByDate[dateKey] || [];
    const hasAppointments = dayAppointments.length > 0;
    
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <span>{format(day, 'd')}</span>
        {hasAppointments && (
          <div className="absolute bottom-0 flex gap-0.5">
            {dayAppointments.slice(0, 3).map((apt, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full ${getStatusColor(apt.status)}`} 
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
                  ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
                  : `Semana de ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'dd/MM')}`
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
                className="rounded-md border w-full"
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
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayAppointments = appointmentsByDate[dateKey] || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  
                  return (
                    <div
                      key={dateKey}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all
                        ${isToday(day) ? 'border-primary bg-primary/5' : 'border-border'}
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        hover:bg-muted/50
                      `}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayAppointments.slice(0, 2).map((apt: any) => (
                          <div 
                            key={apt.id} 
                            className={`text-xs p-1 rounded ${getStatusColor(apt.status)} text-white truncate`}
                          >
                            {format(parseISO(apt.appointment_date), 'HH:mm')} - {apt.clients?.name?.split(' ')[0]}
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
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : 'Selecione um dia'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDayAppointments.length} agendamento(s)
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {selectedDayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <CalendarIcon className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum agendamento</p>
                  <p className="text-xs">neste dia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayAppointments.map((apt: any) => (
                    <Card key={apt.id} className="transition-all hover:shadow-md">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 text-primary font-semibold">
                            <Clock className="w-4 h-4" />
                            {format(parseISO(apt.appointment_date), 'HH:mm')}
                          </div>
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{apt.clients?.name || 'Cliente'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Scissors className="w-3 h-3" />
                            <span>{apt.products?.name || 'Serviço'}</span>
                          </div>
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground italic mt-2 pl-5">
                              "{apt.notes}"
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarAgenda;
