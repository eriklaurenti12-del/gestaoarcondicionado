import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, CheckCircle, DollarSign, AlertTriangle, Clock, 
  Phone, Mail, Trash2, ExternalLink, RefreshCw, X
} from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  user_email: string | null;
  user_phone: string | null;
  is_read: boolean;
  metadata: {
    plan?: string;
    amount?: number;
    whatsapp_link?: string;
  };
  created_at: string;
}

const AdminNotificationsPanel: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 30000 // Refresh a cada 30 segundos
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Notificação removida');
    }
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Todas notificações marcadas como lidas');
    }
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment_success':
        return <DollarSign className="w-4 h-4 text-green-400" />;
      case 'payment_error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'pending_activation':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'payment_success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pagamento</Badge>;
      case 'payment_error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
      case 'pending_activation':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  if (isLoading) {
    return (
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a24] border-[#2a2a3a]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-500" />
            Central de Notificações
            {unreadCount > 0 && (
              <Badge className="bg-cyan-500 text-white ml-2">{unreadCount} novas</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => markAllAsRead.mutate()}
                className="text-gray-400 hover:text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Marcar lidas
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {notifications?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma notificação ainda</p>
              <p className="text-xs mt-1">Notificações de pagamento aparecerão aqui</p>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {notifications?.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-4 hover:bg-[#2a2a3a]/50 transition-colors ${
                    !notification.is_read ? 'bg-cyan-500/5 border-l-2 border-l-cyan-500' : ''
                  }`}
                  onClick={() => !notification.is_read && markAsReadMutation.mutate(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeBadge(notification.type)}
                        <span className="text-xs text-gray-500">
                          {format(new Date(notification.created_at), 'dd/MM HH:mm')}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white truncate">
                        {notification.title}
                      </h4>
                      <div className="mt-2 space-y-1">
                        {notification.user_email && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Mail className="w-3 h-3" />
                            {notification.user_email}
                          </div>
                        )}
                        {notification.user_phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />
                            {notification.user_phone}
                          </div>
                        )}
                        {notification.metadata?.amount && (
                          <div className="flex items-center gap-1 text-xs text-green-400">
                            <DollarSign className="w-3 h-3" />
                            R$ {notification.metadata.amount.toFixed(2)} - {notification.metadata.plan}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {notification.user_phone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://wa.me/55${notification.user_phone?.replace(/\D/g, '')}`, '_blank');
                            }}
                            className="h-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Button>
                        )}
                        {notification.metadata?.whatsapp_link && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(notification.metadata.whatsapp_link!, '_blank');
                            }}
                            className="h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Abrir msg pronta
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(notification.id);
                          }}
                          className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
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

export default AdminNotificationsPanel;
