import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Gift, CreditCard, Calendar, Users, TrendingUp, X, MessageCircle, Check } from "lucide-react";
import { toast } from 'sonner';
import { format, differenceInDays, differenceInYears, isToday, isTomorrow, endOfMonth, startOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'birthday' | 'installment' | 'appointment' | 'month_close';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  data?: any;
  action?: () => void;
}

const fetchNotificationData = async () => {
  const today = new Date();
  
  const [
    { data: clients },
    { data: installments },
    { data: appointments }
  ] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('installments').select('*, appointments(clients(name, telefone))').eq('is_paid', false),
    supabase.from('appointments').select('*, clients(name, telefone), products(name)').gte('appointment_date', today.toISOString().split('T')[0])
  ]);

  return { clients: clients || [], installments: installments || [], appointments: appointments || [] };
};

const NotificationsPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-data'],
    queryFn: fetchNotificationData,
    refetchInterval: 60000 // Refetch every minute
  });

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notificações ativadas!');
        
        // Test notification
        new Notification('Salão de Beleza', {
          body: 'Notificações ativadas com sucesso! Você receberá alertas importantes.',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png'
        });
      } else {
        toast.error('Permissão negada para notificações');
      }
    }
  };

  const generateNotifications = (): Notification[] => {
    if (!data) return [];
    
    const notifications: Notification[] = [];
    const today = new Date();

    // Birthday notifications
    data.clients.forEach((client: any) => {
      if (!client.aniversario) return;
      
      const birthday = new Date(client.aniversario);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      
      // If birthday already passed this year, check next year
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      
      const daysUntil = differenceInDays(thisYearBirthday, today);
      const age = differenceInYears(thisYearBirthday, birthday);
      
      if (daysUntil >= 0 && daysUntil <= 7) {
        let priority: 'high' | 'medium' | 'low' = 'low';
        let title = '';
        
        if (daysUntil === 0) {
          priority = 'high';
          title = `🎂 ${client.name} faz ${age} anos HOJE!`;
        } else if (daysUntil === 1) {
          priority = 'high';
          title = `🎂 ${client.name} faz ${age} anos AMANHÃ!`;
        } else {
          priority = 'medium';
          title = `🎂 ${client.name} faz ${age} anos em ${daysUntil} dias`;
        }

        notifications.push({
          id: `birthday-${client.id}`,
          type: 'birthday',
          title,
          message: `Data: ${format(thisYearBirthday, "dd 'de' MMMM", { locale: ptBR })}`,
          priority,
          data: client,
          action: client.telefone ? () => {
            const phone = client.telefone.replace(/\D/g, '');
            const message = daysUntil === 0 
              ? `Olá ${client.name}! 🎂 Feliz aniversário! Que seu dia seja repleto de alegrias! Aproveitamos para lembrar que temos promoções especiais para aniversariantes. Venha nos visitar!`
              : `Olá ${client.name}! Estamos ansiosos para celebrar seu aniversário em ${format(thisYearBirthday, "dd/MM")}! Temos uma surpresa especial para você. 🎁`;
            window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
          } : undefined
        });
      }
    });

    // Installment notifications
    data.installments.forEach((inst: any) => {
      const dueDate = new Date(inst.due_date);
      const daysUntil = differenceInDays(dueDate, today);
      
      let priority: 'high' | 'medium' | 'low' = 'low';
      let title = '';
      
      if (daysUntil < 0) {
        priority = 'high';
        title = `💰 Parcela VENCIDA há ${Math.abs(daysUntil)} dia(s)`;
      } else if (daysUntil === 0) {
        priority = 'high';
        title = `💰 Parcela vence HOJE!`;
      } else if (daysUntil <= 3) {
        priority = 'high';
        title = `💰 Parcela vence em ${daysUntil} dia(s)`;
      } else if (daysUntil <= 7) {
        priority = 'medium';
        title = `💰 Parcela vence em ${daysUntil} dias`;
      } else {
        return; // Skip if more than 7 days
      }

      const clientName = inst.appointments?.clients?.name || 'Cliente';
      const clientPhone = inst.appointments?.clients?.telefone;

      notifications.push({
        id: `installment-${inst.id}`,
        type: 'installment',
        title,
        message: `${clientName} - Parcela ${inst.installment_number}/${inst.total_installments} - R$ ${Number(inst.amount).toFixed(2)}`,
        priority,
        data: inst,
        action: clientPhone ? () => {
          const phone = clientPhone.replace(/\D/g, '');
          const message = `Olá ${clientName}, tudo bem? Passando para lembrar da parcela ${inst.installment_number}/${inst.total_installments} no valor de R$ ${Number(inst.amount).toFixed(2)} com vencimento em ${format(dueDate, 'dd/MM/yyyy')}.`;
          window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } : undefined
      });
    });

    // Today's appointments
    data.appointments
      .filter((apt: any) => {
        const aptDate = new Date(apt.appointment_date);
        return isToday(aptDate) && apt.status !== 'concluído' && apt.status !== 'cancelado';
      })
      .forEach((apt: any) => {
        notifications.push({
          id: `appointment-${apt.id}`,
          type: 'appointment',
          title: `📅 Atendimento pendente hoje`,
          message: `${apt.clients?.name || 'Cliente'} - ${apt.products?.name || 'Serviço'} às ${format(new Date(apt.appointment_date), 'HH:mm')}`,
          priority: 'high',
          data: apt,
          action: apt.clients?.telefone ? () => {
            const phone = apt.clients.telefone.replace(/\D/g, '');
            const message = `Olá ${apt.clients.name}! Lembrando do seu agendamento hoje às ${format(new Date(apt.appointment_date), 'HH:mm')}. Esperamos você! 💇‍♀️`;
            window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
          } : undefined
        });
      });

    // Month end closing reminder
    const daysUntilMonthEnd = differenceInDays(endOfMonth(today), today);
    if (daysUntilMonthEnd <= 3) {
      notifications.push({
        id: 'month-close',
        type: 'month_close',
        title: `📊 Fechamento do mês`,
        message: daysUntilMonthEnd === 0 
          ? 'Último dia do mês! Verifique os relatórios.'
          : `Faltam ${daysUntilMonthEnd} dia(s) para o fechamento do mês`,
        priority: daysUntilMonthEnd === 0 ? 'high' : 'medium'
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  };

  const notifications = generateNotifications();
  const highPriorityCount = notifications.filter(n => n.priority === 'high').length;

  const sendPushNotification = (notification: Notification) => {
    if (notificationsEnabled && 'Notification' in window) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: notification.id,
        requireInteraction: notification.priority === 'high'
      });
    }
  };

  // Auto-send high priority notifications
  useEffect(() => {
    if (notificationsEnabled && notifications.length > 0) {
      const highPriority = notifications.filter(n => n.priority === 'high');
      const sentNotifications = JSON.parse(localStorage.getItem('sent-notifications') || '[]');
      const today = new Date().toDateString();
      
      highPriority.forEach(n => {
        const key = `${n.id}-${today}`;
        if (!sentNotifications.includes(key)) {
          sendPushNotification(n);
          sentNotifications.push(key);
        }
      });
      
      localStorage.setItem('sent-notifications', JSON.stringify(sentNotifications));
    }
  }, [notifications, notificationsEnabled]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-yellow-500 text-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'birthday': return <Gift className="w-4 h-4" />;
      case 'installment': return <CreditCard className="w-4 h-4" />;
      case 'appointment': return <Calendar className="w-4 h-4" />;
      case 'month_close': return <TrendingUp className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          Carregando notificações...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-primary/20">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            Notificações
            {highPriorityCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs">
                {highPriorityCount} urgente(s)
              </Badge>
            )}
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {!notificationsEnabled && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={requestNotifications}
            className="mt-2 w-full"
          >
            <Bell className="w-4 h-4 mr-2" />
            Ativar Notificações Push
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>Tudo em dia! Nenhuma pendência.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors ${
                    notification.priority === 'high' ? 'bg-red-50 dark:bg-red-950/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      notification.priority === 'high' ? 'bg-red-100 dark:bg-red-900' :
                      notification.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900' :
                      'bg-muted'
                    }`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                          {notification.priority === 'high' ? 'Urgente' : 
                           notification.priority === 'medium' ? 'Atenção' : 'Info'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      {notification.action && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={notification.action}
                          className="mt-2 h-7 text-green-600 hover:text-green-700 hover:bg-green-100 p-0 px-2"
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Enviar WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;
