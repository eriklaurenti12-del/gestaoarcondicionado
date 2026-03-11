import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bell, CheckCircle, DollarSign, AlertTriangle, Clock, 
  Phone, Mail, Trash2, ExternalLink, RefreshCw, UserPlus,
  ShieldCheck, MessageSquare, Send, Users, Filter, Volume2, VolumeX, BellRing
} from "lucide-react";
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AdminGuideCards } from "@/components/AdminGuideCards";

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
    platform?: string;
  };
  created_at: string;
}

const playAdminNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Pleasant chime - 3 notes ascending
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch {}
};

const AdminNotificationsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [showMessageBox, setShowMessageBox] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const prevCountRef = useRef<number>(0);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_notifications'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        const newNotif = payload.new as Notification;
        
        // Flash indicator
        setLiveIndicator(true);
        setTimeout(() => setLiveIndicator(false), 3000);
        
        // Sound
        if (soundEnabled) playAdminNotificationSound();
        
        // Toast
        toast.success(`🔔 ${newNotif.title}`, {
          description: newNotif.user_email || newNotif.message?.slice(0, 60),
          duration: 8000,
        });

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(newNotif.title, {
            body: newNotif.message?.slice(0, 100),
            icon: '/icon-192x192.png',
            tag: newNotif.id,
          });
        }
      })
      .subscribe();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [soundEnabled, queryClient]);

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
    refetchInterval: 30000
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Notificação removida');
    }
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Todas marcadas como lidas');
    }
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'new_user': return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'payment_success': return <DollarSign className="w-4 h-4 text-green-400" />;
      case 'access_granted': return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 'payment_error': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'pending_activation': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      new_user: { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Novo Usuário' },
      payment_success: { cls: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Pagamento' },
      access_granted: { cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', label: 'Acesso Liberado' },
      payment_error: { cls: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Erro Pagamento' },
      pending_activation: { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Pendente' },
    };
    const info = map[type] || { cls: '', label: 'Info' };
    return <Badge className={info.cls}>{info.label}</Badge>;
  };

  const getUserName = (n: Notification) =>
    n.metadata?.username || n.metadata?.user_name || n.user_email?.split('@')[0] || 'Usuário';

  const sendWhatsApp = (phone: string, message: string) => {
    const clean = phone.replace(/\D/g, '');
    const full = clean.startsWith('55') ? clean : `55${clean}`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(message)}`, '_blank');
    setShowMessageBox(null);
    setWhatsappMessage('');
  };

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  
  const filteredNotifications = notifications?.filter(n => {
    const typeMatch = filterType === 'all' || n.type === filterType;
    const platformMatch = platformFilter === 'all' || n.metadata?.platform === platformFilter;
    return typeMatch && platformMatch;
  }) || [];
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  // Unique platforms from notifications
  const platforms = [...new Set(notifications?.map(n => n.metadata?.platform).filter(Boolean) || [])];

  const stats = {
    newUsers: notifications?.filter(n => n.type === 'new_user').length || 0,
    payments: notifications?.filter(n => n.type === 'payment_success').length || 0,
    access: notifications?.filter(n => n.type === 'access_granted').length || 0,
    errors: notifications?.filter(n => n.type === 'payment_error').length || 0,
    pending: notifications?.filter(n => n.type === 'pending_activation').length || 0,
  };

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
      <AdminGuideCards tab="notifications" />
      {/* Live indicator */}
      {liveIndicator && (
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-xl p-3 flex items-center gap-3 animate-pulse">
          <BellRing className="w-5 h-5 text-green-400 animate-bounce" />
          <span className="text-green-300 font-semibold text-sm">🔔 Nova notificação recebida em tempo real!</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'all', label: 'Total', count: notifications?.length || 0, icon: Bell, color: 'purple' },
          { key: 'new_user', label: 'Novos', count: stats.newUsers, icon: UserPlus, color: 'blue' },
          { key: 'payment_success', label: 'Pagamentos', count: stats.payments, icon: DollarSign, color: 'green' },
          { key: 'access_granted', label: 'Acessos', count: stats.access, icon: ShieldCheck, color: 'cyan' },
          { key: 'payment_error', label: 'Erros', count: stats.errors, icon: AlertTriangle, color: 'red' },
        ].map(s => (
          <Card key={s.key} 
            className={`bg-[#1a1a24] border-[#2a2a3a] cursor-pointer hover:border-${s.color}-500/50 transition-colors ${filterType === s.key ? `border-${s.color}-500/60` : ''}`}
            onClick={() => setFilterType(s.key)}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`w-4 h-4 text-${s.color}-400`} />
              <div>
                <div className="text-lg font-bold text-white">{s.count}</div>
                <div className="text-[10px] text-gray-400">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-cyan-500" />
              Central de Notificações
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white animate-pulse">{unreadCount} novas</Badge>
              )}
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                AO VIVO
              </span>
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-gray-400 hover:text-white" title={soundEnabled ? 'Desativar som' : 'Ativar som'}>
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-gray-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllAsRead.mutate()} className="text-gray-400 hover:text-white">
                  <CheckCircle className="w-4 h-4 mr-1" /> Marcar lidas
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma notificação {filterType !== 'all' ? 'nesta categoria' : 'ainda'}</p>
                <p className="text-xs mt-1">Notificações aparecem em tempo real automaticamente</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2a2a3a]">
                {filteredNotifications.map((notification) => (
                  <div key={notification.id}
                    className={`p-4 hover:bg-[#2a2a3a]/50 transition-colors ${
                      !notification.is_read ? 'bg-cyan-500/5 border-l-2 border-l-cyan-500' : ''
                    }`}
                    onClick={() => !notification.is_read && markAsReadMutation.mutate(notification.id)}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getTypeIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTypeBadge(notification.type)}
                          {notification.metadata?.platform && (
                            <Badge variant="outline" className="text-[10px] border-gray-600 text-gray-400">
                              {notification.metadata.platform}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {format(new Date(notification.created_at), 'dd/MM HH:mm')}
                          </span>
                          {!notification.is_read && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-sm font-semibold text-cyan-300">{getUserName(notification)}</span>
                        </div>

                        <h4 className="text-sm font-medium text-white">{notification.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.message}</p>

                        <div className="mt-2 space-y-1">
                          {notification.user_email && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Mail className="w-3 h-3" /> {notification.user_email}
                            </div>
                          )}
                          {notification.user_phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Phone className="w-3 h-3" /> {notification.user_phone}
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
                            <Textarea value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)}
                              placeholder="Digite sua mensagem..." className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm min-h-[60px]" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => sendWhatsApp(notification.user_phone!, whatsappMessage)}
                                disabled={!whatsappMessage.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                                <Send className="w-3 h-3 mr-1" /> Enviar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setShowMessageBox(null); setWhatsappMessage(''); }}
                                className="text-gray-400">Cancelar</Button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {['Olá! Bem-vindo ao sistema! 🎉', 'Seu pagamento foi confirmado! ✅', 'Seu acesso foi liberado! 🚀'].map((msg, i) => (
                                <Button key={i} size="sm" variant="ghost" onClick={() => setWhatsappMessage(msg)}
                                  className="text-xs text-cyan-400 hover:text-cyan-300 h-6 px-2">{msg.slice(0, 30)}...</Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {notification.user_phone && (
                            <>
                              <Button size="sm" variant="ghost"
                                onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${notification.user_phone?.replace(/\D/g, '')}`, '_blank'); }}
                                className="h-7 text-green-400 hover:text-green-300 hover:bg-green-500/10">
                                <Phone className="w-3 h-3 mr-1" /> WhatsApp
                              </Button>
                              <Button size="sm" variant="ghost"
                                onClick={(e) => { e.stopPropagation(); setShowMessageBox(showMessageBox === notification.id ? null : notification.id); }}
                                className="h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                                <MessageSquare className="w-3 h-3 mr-1" /> Mensagem
                              </Button>
                            </>
                          )}
                          {notification.metadata?.whatsapp_link && (
                            <Button size="sm" variant="ghost"
                              onClick={(e) => { e.stopPropagation(); window.open(notification.metadata.whatsapp_link!, '_blank'); }}
                              className="h-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                              <ExternalLink className="w-3 h-3 mr-1" /> Msg pronta
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(notification.id); }}
                            className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto">
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
