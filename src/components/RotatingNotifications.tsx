import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, Bell, Lightbulb, TrendingUp, Calendar, Shield, Zap, Heart, Star, AlertTriangle, Clock, Users, DollarSign, Wrench, Gift, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, isToday, isTomorrow, format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
  priority: number; // Higher = more important
  type: 'alert' | 'tip' | 'info' | 'feature';
}

// Static tips about the system
const systemTips: Notification[] = [
  {
    id: 'tip-1',
    icon: <Lightbulb className="w-5 h-5" />,
    title: "Dica do dia",
    message: "Agende manutenções preventivas para fidelizar clientes!",
    color: "from-amber-500 to-orange-500",
    priority: 1,
    type: 'tip'
  },
  {
    id: 'tip-2',
    icon: <TrendingUp className="w-5 h-5" />,
    title: "Aumente suas vendas",
    message: "Orçamentos detalhados convertem até 30% mais!",
    color: "from-emerald-500 to-green-500",
    priority: 1,
    type: 'tip'
  },
  {
    id: 'tip-3',
    icon: <Shield className="w-5 h-5" />,
    title: "Segurança",
    message: "Seus dados estão protegidos com criptografia avançada.",
    color: "from-violet-500 to-purple-500",
    priority: 1,
    type: 'info'
  },
  {
    id: 'tip-4',
    icon: <Zap className="w-5 h-5" />,
    title: "Use o PDV",
    message: "Registre vendas rapidamente pelo Ponto de Venda!",
    color: "from-yellow-500 to-amber-500",
    priority: 1,
    type: 'feature'
  },
  {
    id: 'tip-5',
    icon: <Heart className="w-5 h-5" />,
    title: "WhatsApp integrado",
    message: "Envie orçamentos direto pelo WhatsApp do sistema.",
    color: "from-pink-500 to-rose-500",
    priority: 1,
    type: 'feature'
  },
  {
    id: 'tip-6',
    icon: <Star className="w-5 h-5" />,
    title: "Relatórios PDF",
    message: "Exporte relatórios profissionais para seus clientes.",
    color: "from-indigo-500 to-blue-500",
    priority: 1,
    type: 'feature'
  },
  {
    id: 'tip-7',
    icon: <HelpCircle className="w-5 h-5" />,
    title: "Precisa de ajuda?",
    message: "Clique no botão de suporte para falar conosco!",
    color: "from-cyan-500 to-blue-500",
    priority: 1,
    type: 'info'
  },
  {
    id: 'tip-8',
    icon: <Wrench className="w-5 h-5" />,
    title: "Contratos de manutenção",
    message: "Crie contratos recorrentes e automatize cobranças.",
    color: "from-slate-500 to-gray-600",
    priority: 1,
    type: 'feature'
  }
];

const RotatingNotifications: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Fetch real data for dynamic notifications
  const { data: installments } = useQuery({
    queryKey: ['rotating-installments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('installments')
        .select('*, clients(name)')
        .eq('is_paid', false)
        .order('due_date', { ascending: true })
        .limit(10);
      return data || [];
    },
    refetchInterval: 300000 // 5 minutes
  });

  const { data: appointments } = useQuery({
    queryKey: ['rotating-appointments'],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = addDays(today, 7);
      const { data } = await supabase
        .from('appointments')
        .select('*, clients(name), products(name)')
        .gte('appointment_date', today.toISOString())
        .lte('appointment_date', nextWeek.toISOString())
        .neq('status', 'concluído')
        .neq('status', 'cancelado')
        .order('appointment_date', { ascending: true })
        .limit(10);
      return data || [];
    },
    refetchInterval: 300000
  });

  const { data: maintenances } = useQuery({
    queryKey: ['rotating-maintenances'],
    queryFn: async () => {
      const today = new Date();
      const nextMonth = addDays(today, 30);
      const { data } = await supabase
        .from('scheduled_maintenance')
        .select('*, clients(name)')
        .eq('is_completed', false)
        .gte('scheduled_date', today.toISOString().split('T')[0])
        .lte('scheduled_date', nextMonth.toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })
        .limit(10);
      return data || [];
    },
    refetchInterval: 300000
  });

  const { data: clients } = useQuery({
    queryKey: ['rotating-birthdays'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, aniversario')
        .not('aniversario', 'is', null);
      return data || [];
    },
    refetchInterval: 3600000 // 1 hour
  });

  // Generate dynamic notifications based on real data
  const dynamicNotifications = useMemo(() => {
    const notifications: Notification[] = [];
    const today = new Date();

    // Overdue installments (highest priority)
    installments?.forEach((inst: any) => {
      const dueDate = new Date(inst.due_date);
      const daysUntil = differenceInDays(dueDate, today);
      const clientName = inst.clients?.name || 'Cliente';
      
      if (daysUntil < 0) {
        notifications.push({
          id: `inst-overdue-${inst.id}`,
          icon: <AlertTriangle className="w-5 h-5" />,
          title: "Parcela vencida!",
          message: `${clientName} tem parcela vencida há ${Math.abs(daysUntil)} dia(s) - R$ ${Number(inst.amount).toFixed(2)}`,
          color: "from-red-600 to-red-500",
          priority: 10,
          type: 'alert'
        });
      } else if (daysUntil === 0) {
        notifications.push({
          id: `inst-today-${inst.id}`,
          icon: <DollarSign className="w-5 h-5" />,
          title: "Parcela vence hoje!",
          message: `${clientName} - R$ ${Number(inst.amount).toFixed(2)}`,
          color: "from-orange-600 to-orange-500",
          priority: 9,
          type: 'alert'
        });
      } else if (daysUntil <= 3) {
        notifications.push({
          id: `inst-soon-${inst.id}`,
          icon: <Clock className="w-5 h-5" />,
          title: "Parcela próxima",
          message: `${clientName} vence em ${daysUntil} dia(s) - R$ ${Number(inst.amount).toFixed(2)}`,
          color: "from-yellow-600 to-amber-500",
          priority: 7,
          type: 'alert'
        });
      }
    });

    // Today's appointments
    appointments?.forEach((apt: any) => {
      const aptDate = new Date(apt.appointment_date);
      const clientName = apt.clients?.name || 'Cliente';
      const serviceName = apt.products?.name || 'Serviço';
      
      if (isToday(aptDate)) {
        const time = format(aptDate, 'HH:mm');
        notifications.push({
          id: `apt-today-${apt.id}`,
          icon: <Calendar className="w-5 h-5" />,
          title: "Agendamento hoje!",
          message: `${clientName} às ${time} - ${serviceName}`,
          color: "from-blue-600 to-cyan-500",
          priority: 8,
          type: 'alert'
        });
      } else if (isTomorrow(aptDate)) {
        const time = format(aptDate, 'HH:mm');
        notifications.push({
          id: `apt-tomorrow-${apt.id}`,
          icon: <Calendar className="w-5 h-5" />,
          title: "Agendamento amanhã",
          message: `${clientName} às ${time} - ${serviceName}`,
          color: "from-sky-500 to-blue-500",
          priority: 5,
          type: 'info'
        });
      }
    });

    // Upcoming maintenances
    maintenances?.forEach((maint: any) => {
      const maintDate = new Date(maint.scheduled_date);
      const daysUntil = differenceInDays(maintDate, today);
      const clientName = maint.clients?.name || 'Cliente';
      
      if (daysUntil <= 7) {
        notifications.push({
          id: `maint-${maint.id}`,
          icon: <Wrench className="w-5 h-5" />,
          title: "Manutenção próxima",
          message: `${clientName} - ${format(maintDate, "dd/MM", { locale: ptBR })} (${maint.maintenance_type})`,
          color: "from-purple-500 to-violet-500",
          priority: 6,
          type: 'info'
        });
      }
    });

    // Birthday notifications with age
    clients?.forEach((client: any) => {
      if (!client.aniversario) return;
      
      const birthday = new Date(client.aniversario);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      const daysUntil = differenceInDays(thisYearBirthday, today);
      const age = today.getFullYear() - birthday.getFullYear();
      
      if (daysUntil === 0) {
        notifications.push({
          id: `bday-today-${client.id}`,
          icon: <Gift className="w-5 h-5" />,
          title: "Aniversário hoje! 🎂",
          message: `${client.name} faz ${age} anos hoje! Envie parabéns!`,
          color: "from-pink-500 to-rose-500",
          priority: 8,
          type: 'alert'
        });
      } else if (daysUntil > 0 && daysUntil <= 3) {
        notifications.push({
          id: `bday-soon-${client.id}`,
          icon: <Gift className="w-5 h-5" />,
          title: "Aniversário próximo",
          message: `${client.name} faz ${age} anos em ${daysUntil} dia(s)!`,
          color: "from-fuchsia-500 to-pink-500",
          priority: 4,
          type: 'info'
        });
      }
    });

    return notifications;
  }, [installments, appointments, maintenances, clients]);

  // Combine and sort all notifications
  const allNotifications = useMemo(() => {
    const combined = [...dynamicNotifications, ...systemTips];
    // Sort by priority (highest first), then shuffle within same priority
    combined.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return Math.random() - 0.5;
    });
    return combined;
  }, [dynamicNotifications]);

  useEffect(() => {
    if (allNotifications.length === 0 || isDismissed) return;

    const showNext = () => {
      setIsExiting(true);
      
      setTimeout(() => {
        setIsVisible(false);
        
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % allNotifications.length);
          setIsExiting(false);
          setIsVisible(true);
        }, 500);
      }, 300);
    };

    // Show alerts longer (8s), tips shorter (5s)
    const currentNotification = allNotifications[currentIndex];
    const interval = currentNotification?.type === 'alert' ? 8000 : 5000;
    
    const timer = setInterval(showNext, interval);

    return () => clearInterval(timer);
  }, [allNotifications, currentIndex, isDismissed]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % allNotifications.length);
        setIsExiting(false);
        setIsVisible(true);
      }, 500);
    }, 300);
  };

  const handleDismissAll = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  if (allNotifications.length === 0 || isDismissed) return null;

  const currentNotification = allNotifications[currentIndex % allNotifications.length];

  if (!currentNotification || (!isVisible && !isExiting)) return null;

  // Count alerts vs tips
  const alertCount = dynamicNotifications.length;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300 ease-in-out",
        isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0",
        !isVisible && "hidden"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-lg shadow-lg border border-border/50",
          "bg-gradient-to-r",
          currentNotification.color
        )}
      >
        <div className="absolute inset-0 bg-black/20" />
        
        <div className="relative p-4">
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={handleDismissAll}
              className="p-1 rounded-full hover:bg-white/20 transition-colors text-white/60 hover:text-white text-xs"
              title="Ocultar todas"
            >
              ✕ Todas
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              title="Próxima"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-start gap-3 pr-16">
            <div className={cn(
              "p-2 rounded-full text-white",
              currentNotification.type === 'alert' ? "bg-white/30 animate-pulse" : "bg-white/20"
            )}>
              {currentNotification.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-white text-sm">
                  {currentNotification.title}
                </h4>
                {currentNotification.type === 'alert' && (
                  <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] text-white/90">
                    URGENTE
                  </span>
                )}
              </div>
              <p className="text-white/90 text-sm mt-1 line-clamp-2">
                {currentNotification.message}
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              key={currentNotification.id}
              className="h-full bg-white/60 animate-progress"
              style={{ animationDuration: currentNotification.type === 'alert' ? '8s' : '5s' }}
            />
          </div>
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex gap-1.5">
          {allNotifications.slice(0, 8).map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === (currentIndex % Math.min(allNotifications.length, 8))
                  ? "bg-primary w-3"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
          {allNotifications.length > 8 && (
            <span className="text-[10px] text-muted-foreground">+{allNotifications.length - 8}</span>
          )}
        </div>
        
        {alertCount > 0 && (
          <span className="text-[10px] text-destructive font-medium flex items-center gap-1">
            <Bell className="w-3 h-3" />
            {alertCount} alerta{alertCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default RotatingNotifications;
