import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, User, Wrench, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  appointment_date: string;
  status: string;
  clients?: { name: string; telefone: string | null } | null;
  products?: { name: string; price: number; service_duration?: number } | null;
}

const timeSlots = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00', '23:30'
];

export default function ScheduleBoard() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch appointments with real-time subscription
  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ['appointments-board'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone), products(name, price, service_duration)')
        .gte('appointment_date', startOfDay(new Date()).toISOString())
        .order('appointment_date');
      if (error) throw error;
      return data as Appointment[];
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['appointments-board'] });
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter appointments for selected date
  const dayAppointments = useMemo(() => {
    if (!appointments) return [];
    return appointments.filter(a => 
      isSameDay(new Date(a.appointment_date), selectedDate) && 
      a.status !== 'cancelado'
    );
  }, [appointments, selectedDate]);

  // Map appointments to time slots with duration blocking
  const slotMap = useMemo(() => {
    const map: Record<string, { appointment: Appointment; isBlocked: boolean }> = {};
    
    dayAppointments.forEach(apt => {
      const aptTime = new Date(apt.appointment_date);
      const time = format(aptTime, 'HH:mm');
      const duration = apt.products?.service_duration || 60; // default 60 min
      const slots = Math.ceil(duration / 30); // each slot is 30 min
      
      // Mark the main slot
      map[time] = { appointment: apt, isBlocked: false };
      
      // Block subsequent slots based on duration
      for (let i = 1; i < slots; i++) {
        const blockedTime = new Date(aptTime.getTime() + i * 30 * 60000);
        const blockedSlot = format(blockedTime, 'HH:mm');
        if (!map[blockedSlot]) {
          map[blockedSlot] = { appointment: apt, isBlocked: true };
        }
      }
    });
    
    return map;
  }, [dayAppointments]);

  // Check if slot is in the past
  const isSlotPast = (time: string) => {
    if (!isToday(selectedDate)) return isBefore(selectedDate, startOfDay(new Date()));
    const [hours, minutes] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    return isBefore(slotTime, currentTime);
  };

  // Check if slot is current
  const isCurrentSlot = (time: string) => {
    if (!isToday(selectedDate)) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const currentHour = currentTime.getHours();
    const currentMin = currentTime.getMinutes();
    
    if (hours === currentHour) {
      if (minutes === 0 && currentMin < 30) return true;
      if (minutes === 30 && currentMin >= 30) return true;
    }
    return false;
  };

  const navigateDay = (direction: number) => {
    const newDate = addDays(selectedDate, direction);
    if (!isBefore(newDate, startOfDay(new Date()))) {
      setSelectedDate(newDate);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado': return 'bg-green-500';
      case 'concluido': return 'bg-blue-500';
      case 'agendado': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Quadro de Horários
          </CardTitle>
          
          {/* Real-time Clock */}
          <div className="flex items-center gap-4">
            <div className="text-2xl font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateDay(-1)}
            disabled={isSameDay(selectedDate, new Date())}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex-1 text-center">
            <p className="font-medium">
              {isToday(selectedDate) ? 'Hoje' : format(selectedDate, 'EEEE', { locale: ptBR })}
            </p>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          
          <Button variant="outline" size="sm" onClick={() => navigateDay(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <div className="divide-y">
              {timeSlots.map((time) => {
                const slotData = slotMap[time];
                const appointment = slotData?.appointment;
                const isBlocked = slotData?.isBlocked;
                const isPast = isSlotPast(time);
                const isCurrent = isCurrentSlot(time);
                
                return (
                  <div 
                    key={time}
                    className={`flex items-stretch transition-colors ${
                      isCurrent ? 'bg-primary/20 border-l-4 border-primary' :
                      isPast ? 'bg-muted/50 opacity-60' :
                      isBlocked ? 'bg-orange-50 dark:bg-orange-950/20' :
                      appointment ? 'bg-green-50 dark:bg-green-950/20' : ''
                    }`}
                  >
                    {/* Time Column */}
                    <div className={`w-16 flex-shrink-0 p-2 text-center font-mono text-sm border-r ${
                      isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'
                    }`}>
                      {time}
                    </div>
                    
                    {/* Appointment Column */}
                    <div className="flex-1 p-2 min-h-[48px]">
                      {isBlocked && !slotData?.appointment ? (
                        <span className="text-xs text-orange-600 dark:text-orange-400">⏳ Em serviço</span>
                      ) : appointment && !isBlocked ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(appointment.status)}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {appointment.clients?.name || 'Cliente'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                {appointment.products?.name || 'Serviço'}
                                {appointment.products?.service_duration && (
                                  <span className="ml-1 text-orange-500">({appointment.products.service_duration}min)</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {appointment.status === 'agendado' ? 'Agendado' :
                             appointment.status === 'confirmado' ? 'Confirmado' :
                             appointment.status === 'concluido' ? 'Concluído' : appointment.status}
                          </Badge>
                        </div>
                      ) : isPast ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">Disponível</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
