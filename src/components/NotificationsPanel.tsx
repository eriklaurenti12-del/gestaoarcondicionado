import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Gift, CreditCard, Calendar, TrendingUp, X, MessageCircle, Check, BellRing, Sparkles, Clock, AlertTriangle, FileText, ClipboardList } from "lucide-react";
import { toast } from 'sonner';
import { format, differenceInDays, differenceInYears, isToday, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'birthday' | 'installment' | 'appointment' | 'month_close' | 'quote' | 'service_order';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  data?: any;
  action?: () => void;
  secondaryAction?: () => void;
}

const fetchNotificationData = async () => {
  const today = new Date();
  
  const [
    { data: clients },
    { data: installments },
    { data: appointments },
    { data: quotes },
    { data: serviceOrders }
  ] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('installments').select('*, appointments(clients(name, telefone))').eq('is_paid', false),
    supabase.from('appointments').select('*, clients(name, telefone), products(name)').gte('appointment_date', today.toISOString().split('T')[0]),
    supabase.from('quotes').select('*, clients(name, telefone)').in('status', ['pendente', 'enviado']),
    supabase.from('service_orders').select('*, clients(name, telefone)').in('status', ['pendente', 'agendado'])
  ]);

  return { 
    clients: clients || [], 
    installments: installments || [], 
    appointments: appointments || [],
    quotes: quotes || [],
    serviceOrders: serviceOrders || []
  };
};

const NotificationsPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-data'],
    queryFn: fetchNotificationData,
    refetchInterval: 60000
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
        
        new Notification('Sistema AC', {
          body: 'Notificações ativadas com sucesso! Você receberá alertas importantes.',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png'
        });
      } else {
        toast.error('Permissão negada para notificações');
      }
    }
  };

  const markInstallmentAsPaid = async (id: string) => {
    const { error } = await supabase
      .from('installments')
      .update({ is_paid: true, paid_date: new Date().toISOString().split('T')[0] })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao marcar como paga');
    } else {
      toast.success('Parcela marcada como paga!');
      queryClient.invalidateQueries({ queryKey: ['notifications-data'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
        return;
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
        } : undefined,
        secondaryAction: () => markInstallmentAsPaid(inst.id)
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

    // Pending quotes notifications
    data.quotes.forEach((quote: any) => {
      const createdAt = new Date(quote.created_at);
      const daysSinceCreated = differenceInDays(today, createdAt);
      
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (daysSinceCreated >= 7) priority = 'high';
      else if (daysSinceCreated >= 3) priority = 'medium';

      notifications.push({
        id: `quote-${quote.id}`,
        type: 'quote',
        title: `📋 Orçamento #${quote.quote_number} pendente`,
        message: `${quote.clients?.name || 'Cliente'} - R$ ${Number(quote.total).toFixed(2)} (há ${daysSinceCreated} dia${daysSinceCreated !== 1 ? 's' : ''})`,
        priority,
        data: quote,
        action: quote.clients?.telefone ? () => {
          const phone = quote.clients.telefone.replace(/\D/g, '');
          const message = `Olá ${quote.clients.name}! Passando para saber se teve tempo de analisar o orçamento que enviamos. Posso ajudar com alguma dúvida?`;
          window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } : undefined
      });
    });

    // Pending service orders notifications
    data.serviceOrders.forEach((order: any) => {
      const createdAt = new Date(order.created_at);
      const daysSinceCreated = differenceInDays(today, createdAt);
      
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (order.status === 'agendado') priority = 'medium';
      if (daysSinceCreated >= 7) priority = 'high';

      notifications.push({
        id: `service-order-${order.id}`,
        type: 'service_order',
        title: `🔧 Serviço #${order.order_number} ${order.status}`,
        message: `${order.clients?.name || 'Cliente'} - ${order.title} (há ${daysSinceCreated} dia${daysSinceCreated !== 1 ? 's' : ''})`,
        priority,
        data: order,
        action: order.clients?.telefone ? () => {
          const phone = order.clients.telefone.replace(/\D/g, '');
          const message = order.status === 'agendado' 
            ? `Olá ${order.clients.name}! Confirmando a ordem de serviço "${order.title}". Aguardamos você!`
            : `Olá ${order.clients.name}! Sobre a ordem de serviço "${order.title}", gostaria de agendar a visita. Qual a melhor data?`;
          window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
        } : undefined
      });
    });

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  };

  const notifications = generateNotifications();
  
  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === activeTab);

  const counts = {
    all: notifications.length,
    birthday: notifications.filter(n => n.type === 'birthday').length,
    installment: notifications.filter(n => n.type === 'installment').length,
    appointment: notifications.filter(n => n.type === 'appointment').length,
    quote: notifications.filter(n => n.type === 'quote').length,
    service_order: notifications.filter(n => n.type === 'service_order').length,
  };

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

  const getTypeIcon = (type: string, size = 'w-4 h-4') => {
    const iconClass = size;
    switch (type) {
      case 'birthday': return <Gift className={iconClass} />;
      case 'installment': return <CreditCard className={iconClass} />;
      case 'appointment': return <Calendar className={iconClass} />;
      case 'month_close': return <TrendingUp className={iconClass} />;
      case 'quote': return <FileText className={iconClass} />;
      case 'service_order': return <ClipboardList className={iconClass} />;
      default: return <Bell className={iconClass} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'birthday': return 'text-pink-500 bg-pink-100 dark:bg-pink-900/30';
      case 'installment': return 'text-green-500 bg-green-100 dark:bg-green-900/30';
      case 'appointment': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      case 'month_close': return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30';
      case 'quote': return 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30';
      case 'service_order': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/20 animate-pulse">
              <BellRing className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">Central de Notificações</h3>
              <p className="text-xs text-muted-foreground">
                {notifications.length} pendência(s)
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-6 gap-1 mb-3">
          <div className="text-center p-1.5 rounded-lg bg-pink-100 dark:bg-pink-900/30">
            <Gift className="w-3 h-3 mx-auto text-pink-500" />
            <span className="text-[10px] font-bold">{counts.birthday}</span>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
            <CreditCard className="w-3 h-3 mx-auto text-green-500" />
            <span className="text-[10px] font-bold">{counts.installment}</span>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Calendar className="w-3 h-3 mx-auto text-blue-500" />
            <span className="text-[10px] font-bold">{counts.appointment}</span>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <FileText className="w-3 h-3 mx-auto text-cyan-500" />
            <span className="text-[10px] font-bold">{counts.quote}</span>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <ClipboardList className="w-3 h-3 mx-auto text-orange-500" />
            <span className="text-[10px] font-bold">{counts.service_order}</span>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="w-3 h-3 mx-auto text-red-500" />
            <span className="text-[10px] font-bold">{highPriorityCount}</span>
          </div>
        </div>

        {!notificationsEnabled && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={requestNotifications}
            className="w-full bg-background/80 hover:bg-background"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ativar Notificações no Celular
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-10 p-1 mx-0 rounded-none border-b">
          <TabsTrigger value="all" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Todos
          </TabsTrigger>
          <TabsTrigger value="birthday" className="text-xs data-[state=active]:bg-pink-500 data-[state=active]:text-white">
            🎂
          </TabsTrigger>
          <TabsTrigger value="installment" className="text-xs data-[state=active]:bg-green-500 data-[state=active]:text-white">
            💰
          </TabsTrigger>
          <TabsTrigger value="appointment" className="text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            📅
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="m-0">
          <ScrollArea className="h-[320px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="font-medium">Tudo em dia! 🎉</p>
                <p className="text-sm text-muted-foreground">Nenhuma pendência nesta categoria.</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map((notification, index) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-muted/50 transition-all duration-200 animate-in slide-in-from-right-5`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${getTypeColor(notification.type)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{notification.title}</p>
                          {notification.priority === 'high' && (
                            <Badge className="bg-red-500 text-white text-[10px] shrink-0">
                              Urgente
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                        
                        <div className="flex gap-1 mt-2">
                          {notification.action && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={notification.action}
                              className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-100 px-2"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                          {notification.secondaryAction && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={notification.secondaryAction}
                              className="h-7 text-xs text-primary hover:bg-primary/10 px-2"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Marcar Paga
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPanel;
