import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, CheckCircle, DollarSign, AlertTriangle, Clock, 
  Phone, Mail, Trash2, ExternalLink, RefreshCw, UserPlus,
  ShieldCheck, MessageSquare, Send, Users, Filter
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
  user_id: string | null;
  is_read: boolean;
  metadata: {
    plan?: string;
    amount?: number;
    whatsapp_link?: string;
    username?: string;
    user_name?: string;
  };
  created_at: string;
}

const AdminNotificationsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [showMessageBox, setShowMessageBox] = useState<string | null>(null);

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 15000
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
      case 'new_user':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'payment_success':
        return <DollarSign className="w-4 h-4 text-green-400" />;
      case 'access_granted':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
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
      case 'new_user':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Novo Usuário</Badge>;
      case 'payment_success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pagamento</Badge>;
      case 'access_granted':
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Acesso Liberado</Badge>;
      case 'payment_error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
      case 'pending_activation':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  const getUserName = (notification: Notification) => {
    return notification.metadata?.username || notification.metadata?.user_name || notification.user_email?.split('@')[0] || 'Usuário';
  };

  const sendWhatsApp = (phone: string, message: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodedMessage}`, '_blank');
    setShowMessageBox(null);
    setWhatsappMessage('');
    toast.success('WhatsApp aberto!');
  };

  const filteredNotifications = notifications?.filter(n => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  }) || [];

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;
  const newUsersCount = notifications?.filter(n => n.type === 'new_user').length || 0;
  const paymentsCount = notifications?.filter(n => n.type === 'payment_success').length || 0;
  const accessCount = notifications?.filter(n => n.type === 'access_granted').length || 0;

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
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#1a1a24] border-[#2a2a3a] cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setFilterType('new_user')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <UserPlus className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{newUsersCount}</div>
              <div className="text-xs text-gray-400">Novos Usuários</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] cursor-pointer hover:border-green-500/50 transition-colors" onClick={() => setFilterType('payment_success')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{paymentsCount}</div>
              <div className="text-xs text-gray-400">Pagamentos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] cursor-pointer hover:border-cyan-500/50 transition-colors" onClick={() => setFilterType('access_granted')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{accessCount}</div>
              <div className="text-xs text-gray-400">Acessos Liberados</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a] cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setFilterType('all')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Bell className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{notifications?.length || 0}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-500" />
              Central de Notificações
              {unreadCount > 0 && (
                <Badge className="bg-cyan-500 text-white ml-2">{unreadCount} novas</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
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
          {/* Filter tabs */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {[
              { key: 'all', label: 'Todas', icon: Filter },
              { key: 'new_user', label: 'Novos Usuários', icon: UserPlus },
              { key: 'payment_success', label: 'Pagamentos', icon: DollarSign },
              { key: 'access_granted', label: 'Acesso Liberado', icon: ShieldCheck },
            ].map(f => (
              <Button 
                key={f.key}
                size="sm" 
                variant={filterType === f.key ? 'default' : 'ghost'}
                onClick={() => setFilterType(f.key)}
                className={filterType === f.key ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}
              >
                <f.icon className="w-3 h-3 mr-1" />
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma notificação {filterType !== 'all' ? 'nesta categoria' : 'ainda'}</p>
                <p className="text-xs mt-1">Notificações aparecerão aqui automaticamente</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a3a]">
                {filteredNotifications.map((notification) => (
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTypeBadge(notification.type)}
                          <span className="text-xs text-gray-500">
                            {format(new Date(notification.created_at), 'dd/MM HH:mm')}
                          </span>
                        </div>
                        
                        {/* User name prominently displayed */}
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-sm font-semibold text-cyan-300">
                            {getUserName(notification)}
                          </span>
                        </div>

                        <h4 className="text-sm font-medium text-white">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">{notification.message}</p>

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
                              R$ {Number(notification.metadata.amount).toFixed(2)} - {notification.metadata.plan}
                            </div>
                          )}
                        </div>

                        {/* WhatsApp message box */}
                        {showMessageBox === notification.id && notification.user_phone && (
                          <div className="mt-3 p-3 bg-[#0f0f17] rounded-lg border border-[#2a2a3a] space-y-2">
                            <Textarea
                              value={whatsappMessage}
                              onChange={(e) => setWhatsappMessage(e.target.value)}
                              placeholder="Digite sua mensagem..."
                              className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => sendWhatsApp(notification.user_phone!, whatsappMessage)}
                                disabled={!whatsappMessage.trim()}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Enviar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowMessageBox(null); setWhatsappMessage(''); }}
                                className="text-gray-400"
                              >
                                Cancelar
                              </Button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {[
                                'Olá! Bem-vindo ao sistema! 🎉',
                                'Seu pagamento foi confirmado! ✅',
                                'Seu acesso foi liberado com sucesso! 🚀'
                              ].map((msg, i) => (
                                <Button
                                  key={i}
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setWhatsappMessage(msg)}
                                  className="text-xs text-cyan-400 hover:text-cyan-300 h-6 px-2"
                                >
                                  {msg.slice(0, 30)}...
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {notification.user_phone && (
                            <>
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMessageBox(showMessageBox === notification.id ? null : notification.id);
                                  setWhatsappMessage('');
                                }}
                                className="h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Mensagem
                              </Button>
                            </>
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
                              Msg pronta
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
    </div>
  );
};

export default AdminNotificationsPanel;
