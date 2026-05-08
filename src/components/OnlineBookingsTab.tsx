import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Check, X, Trash2, Clock, User, Phone, CreditCard, ExternalLink, Copy, Loader2, RefreshCw, CalendarPlus, FileDown, Globe, Link, MessageCircle, CalendarCheck, CalendarClock, List, Edit } from "lucide-react";
import TabGuideCards from './TabGuideCards';
import { format, isAfter, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { recordFinancialEntry } from '@/utils/financialHelpers';

type OnlineBooking = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  service_name: string;
  preferred_date: string;
  preferred_time: string;
  payment_method: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

interface OnlineBookingsTabProps {
  userId: string;
}

const formatWhatsAppUrl = (phone: string, message: string) => {
  const clean = phone.replace(/\D/g, '');
  const fullNumber = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
};

const safeFormat = (date: any, formatStr: string, options?: any) => {
  try {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr, options);
  } catch (e) {
    return '-';
  }
};

const OnlineBookingsTab: React.FC<OnlineBookingsTabProps> = ({ userId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('futuras');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('online-booking-notifications') !== 'false';
  });

  // Edit states
  const [editingBooking, setEditingBooking] = useState<OnlineBooking | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editService, setEditService] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const bookingUrl = `${window.location.origin}/agendar?u=${userId}`;

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* silent fail */ }
  };

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem('online-booking-notifications', String(newVal));
    toast({ title: newVal ? "🔔 Notificações ativadas" : "🔕 Notificações desativadas" });
  };

  const loadBookings = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from('online_bookings') as any)
        .select('*')
        .eq('user_id', userId)
        .order('preferred_date', { ascending: true });
      if (data) setBookings(data);
      if (error) console.error('Error loading bookings:', error);
    } catch (e) {
      console.error('Exception loading bookings:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Realtime subscription + polling fallback
  useEffect(() => {
    loadBookings();
    
    let pollInterval: ReturnType<typeof setInterval>;
    
    const channel = supabase
      .channel(`online-bookings-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_bookings' }, (payload) => {
        loadBookings();
        if (payload.eventType === 'INSERT' && notificationsEnabled) {
          playNotificationSound();
          toast({ title: "🔔 Novo agendamento online!", description: `${(payload.new as any).client_name} - ${(payload.new as any).service_name}` });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Novo Agendamento Online!', {
              body: `${(payload.new as any).client_name} - ${(payload.new as any).service_name}`,
              icon: '/icon-192x192.png'
            });
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected - poll less frequently as backup
          pollInterval = setInterval(loadBookings, 30000);
        } else {
          // Disconnected - poll more frequently
          pollInterval = setInterval(loadBookings, 5000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [userId, notificationsEnabled, loadBookings]);

  // Auto-approve pending bookings (keeps manual edit available)
  const autoApprovedRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    const pendings = bookings.filter(b => b.status === 'pendente' && !autoApprovedRef.current.has(b.id));
    if (pendings.length === 0) return;
    (async () => {
      for (const b of pendings) {
        autoApprovedRef.current.add(b.id);
        await updateStatus(b.id, 'confirmado', b, true);
      }
      toast({ title: `✅ ${pendings.length} reserva(s) auto-aprovada(s)`, description: 'Adicionadas automaticamente à agenda' });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  // Categorize bookings
  const today = startOfDay(new Date());

  const pendingBookings = useMemo(() => 
    bookings.filter(b => b.status === 'pendente'), [bookings]);

  const confirmedBookings = useMemo(() =>
    bookings.filter(b => b.status === 'confirmado'), [bookings]);

  const todayBookings = useMemo(() =>
    bookings.filter(b => {
      const [y, m, d] = b.preferred_date.split('-').map(Number);
      const bookingDate = new Date(y, m - 1, d, 12, 0, 0);
      return isToday(bookingDate) && (b.status === 'confirmado' || b.status === 'pendente');
    }).sort((a, b) => a.preferred_time.localeCompare(b.preferred_time)),
    [bookings, today]
  );

  const futureBookings = useMemo(() => 
    bookings.filter(b => {
      const [y, m, d] = b.preferred_date.split('-').map(Number);
      const bookingDate = new Date(y, m - 1, d, 12, 0, 0);
      return (b.status === 'confirmado' || b.status === 'pendente') && 
             isAfter(bookingDate, today) && !isToday(bookingDate);
    }).sort((a, b) => new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime()),
    [bookings, today]
  );

  const historyBookings = useMemo(() =>
    bookings.filter(b => {
      const [y, m, d] = b.preferred_date.split('-').map(Number);
      const bookingDate = new Date(y, m - 1, d, 12, 0, 0);
      return isBefore(bookingDate, today) || b.status === 'recusado' || b.status === 'cancelado';
    }).sort((a, b) => new Date(b.preferred_date).getTime() - new Date(a.preferred_date).getTime()),
    [bookings, today]
  );

  const allBookings = useMemo(() => 
    [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [bookings]
  );

  const updateStatus = async (id: string, status: string, booking?: OnlineBooking, silent = false) => {
    const { error } = await (supabase.from('online_bookings') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      if (!silent) toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    
    if (status === 'confirmado' && booking) {
      await syncToAgenda(booking);
    }
    
    if (!silent) toast({ title: status === 'confirmado' ? "✅ Confirmado e adicionado à agenda!" : status === 'recusado' ? "❌ Recusado" : `Status: ${status}` });
    loadBookings();
    
    if (!silent && booking?.client_phone) {
      const addressMatch = booking.notes?.match(/📍\s*([^|]+)/);
      const cepMatch = booking.notes?.match(/CEP:\s*(\S+)/);
      const addressLine = addressMatch ? `\n📍 Endereço: ${addressMatch[1].trim()}` : '';
      const cepLine = cepMatch ? `\n🏷️ CEP: ${cepMatch[1].trim()}` : '';
      const mapsLink = addressMatch ? `\n🗺️ Ver no mapa: https://www.google.com/maps/search/${encodeURIComponent(addressMatch[1].trim())}` : '';
      
      const [y, m, d] = booking.preferred_date.split('-').map(Number);
      const dateForMsg = new Date(y, m - 1, d, 12, 0, 0);
      
      const statusMsg = status === 'confirmado' 
        ? `✅ Seu agendamento foi *CONFIRMADO*!\n\n📋 Serviço: ${booking.service_name}\n📅 Data: ${safeFormat(dateForMsg, 'dd/MM/yyyy')}\n⏰ Horário: ${booking.preferred_time}${addressLine}${cepLine}${mapsLink}\n\nAguardamos você! 🙏`
        : `❌ Infelizmente seu agendamento para ${booking.service_name} no dia ${safeFormat(dateForMsg, 'dd/MM/yyyy')} às ${booking.preferred_time} não pôde ser confirmado.\n\nEntre em contato para reagendar.`;
      
      window.open(formatWhatsAppUrl(booking.client_phone, statusMsg), '_blank');
    }
  };

  const syncToAgenda = async (booking: OnlineBooking) => {
    try {
      let clientId: number | null = null;
      const cleanPhone = booking.client_phone.replace(/\D/g, '');
      
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .or(`telefone.ilike.%${cleanPhone.slice(-8)}%,name.ilike.%${booking.client_name}%`)
        .limit(1);
      
      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id;
      } else {
        const { data: newClient } = await supabase
          .from('clients')
          .insert({ user_id: userId, name: booking.client_name, telefone: booking.client_phone })
          .select('id')
          .single();
        if (newClient) clientId = newClient.id;
      }

      let serviceId: number | null = null;
      let servicePrice = 0;
      let serviceCost = 0;
      const { data: serviceData } = await supabase
        .from('products')
        .select('id, price, cost_price')
        .eq('user_id', userId)
        .ilike('name', `%${booking.service_name}%`)
        .limit(1);
      if (serviceData && serviceData.length > 0) {
        serviceId = serviceData[0].id;
        servicePrice = Number(serviceData[0].price);
        serviceCost = Number(serviceData[0].cost_price);
      }

      const [year, month, day] = booking.preferred_date.split('-').map(Number);
      const [hour, minute] = booking.preferred_time.split(':').map(Number);
      const dateTime = new Date(year, month - 1, day, hour, minute);

      const { error } = await supabase.from('appointments').insert({
        user_id: userId,
        client_id: clientId,
        service_id: serviceId,
        appointment_date: dateTime.toISOString(),
        status: 'confirmado',
        notes: `Agendamento Online - ${booking.payment_method ? `Pagamento: ${booking.payment_method}` : ''}${booking.notes ? ` | ${booking.notes}` : ''}`
      });

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      }

      if (clientId && serviceId && servicePrice > 0) {
        const paymentMap: Record<string, string> = {
          'pix': 'PIX', 'dinheiro': 'Dinheiro', 'débito': 'Débito', 'debito': 'Débito',
          'crédito': 'Crédito', 'credito': 'Crédito', 'cartão': 'Crédito', 'cartao': 'Crédito'
        };
        const rawPayment = (booking.payment_method || 'PIX').toLowerCase();
        const mappedPayment = paymentMap[rawPayment] || 'PIX';

        await recordFinancialEntry({
          userId: userId,
          type: 'entrada',
          amount: servicePrice,
          description: `Venda Online: ${booking.service_name} - ${booking.client_name}`,
          paymentMethod: mappedPayment as any,
          category: 'Serviço',
          recordDate: dateTime.toISOString()
        });

        queryClient.invalidateQueries({ queryKey: ['financial-records'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    } catch (e) {
      console.error('Error syncing to agenda:', e);
    }
  };

  const deleteBooking = async (id: string) => {
    if (!window.confirm('Excluir este agendamento online?')) return;
    const { error } = await (supabase.from('online_bookings') as any).delete().eq('id', id);
    if (!error) {
      toast({ title: "Excluído" });
      loadBookings();
    }
  };

  const handleEditSubmit = async () => {
    if (!editingBooking) return;
    const { error } = await (supabase.from('online_bookings') as any)
      .update({
        preferred_date: editDate,
        preferred_time: editTime,
        service_name: editService,
        client_phone: editPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingBooking.id);
      
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Agendamento alterado com sucesso" });
      setEditingBooking(null);
      loadBookings();
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({ title: "Link copiado! 📋", description: "Compartilhe com seus clientes" });
  };

  const exportBookingsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Agendamentos Online', 14, 22);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Total: ${bookings.length}`, 14, 30);

    const tableData = bookings.map(b => {
      const [y, m, d] = b.preferred_date.split('-').map(Number);
      const dateForPdf = new Date(y, m - 1, d, 12, 0, 0);
      return [
        b.client_name, b.client_phone, b.service_name,
        safeFormat(dateForPdf, 'dd/MM/yyyy'),
        b.preferred_time, b.payment_method || '-',
        b.status === 'confirmado' ? 'Confirmado' : b.status === 'pendente' ? 'Pendente' : b.status === 'recusado' ? 'Recusado' : b.status,
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'Telefone', 'Serviço', 'Data', 'Hora', 'Pagamento', 'Status']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });
    doc.save('agendamentos-online.pdf');
    toast({ title: "PDF exportado!" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
      case 'confirmado': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Confirmado</Badge>;
      case 'recusado': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Recusado</Badge>;
      case 'cancelado': return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">🚫 Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const bookingDate = new Date(y, m - 1, d, 12, 0, 0);
    const diffMs = bookingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`;
    return `Em ${diffDays} dias`;
  };

  const renderBookingCard = (booking: OnlineBooking, showActions = true) => {
    const [y, m, d] = booking.preferred_date.split('-').map(Number);
    const bookingDate = new Date(y, m - 1, d, 12, 0, 0);
    const isPast = isBefore(bookingDate, today);
    const isTodayBooking = isToday(bookingDate);
    
    return (
      <div key={booking.id}
        className={`p-3 sm:p-4 rounded-xl border transition-all ${
          booking.status === 'pendente'
            ? 'border-amber-500/30 bg-amber-500/10 animate-pulse-subtle'
            : booking.status === 'confirmado'
              ? isTodayBooking ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-green-500/20 bg-green-500/10'
              : 'border-border bg-muted/30'
        }`}>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm sm:text-base truncate">{booking.client_name}</span>
                {getStatusBadge(booking.status)}
                {isTodayBooking && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">HOJE</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {safeFormat(bookingDate, 'dd/MM/yyyy')}
                  <span className="text-[10px] text-primary">({getDaysUntil(booking.preferred_date)})</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {booking.preferred_time}
                </span>
              </div>
              <div className="text-xs text-primary font-medium">{booking.service_name}</div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {booking.client_phone}
                </span>
                {booking.payment_method && (
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> {booking.payment_method}
                  </span>
                )}
              </div>
              {booking.notes && (() => {
                const addressMatch = booking.notes?.match(/📍\s*([^|]+)/);
                const cepMatch = booking.notes?.match(/CEP:\s*(\S+)/);
                const userNote = booking.notes?.replace(/📍[^|]*\|?\s*/g, '').replace(/CEP:\s*\S+\s*\|?\s*/g, '').trim();
                return (
                  <div className="space-y-0.5">
                    {addressMatch && (
                      <a href={`https://www.google.com/maps/search/${encodeURIComponent(addressMatch[1].trim())}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                        📍 {addressMatch[1].trim()}
                        {cepMatch && <span className="text-muted-foreground">| CEP: {cepMatch[1]}</span>}
                      </a>
                    )}
                    {userNote && <p className="text-[11px] text-muted-foreground italic">"{userNote}"</p>}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {booking.status === 'pendente' && (
                <>
                  <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmado', booking)}
                    className="text-xs h-8 bg-green-600 hover:bg-green-700">
                    <Check className="w-3 h-3 mr-1" /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8 text-amber-600 hover:text-amber-700 border-amber-200"
                    onClick={() => {
                      setEditingBooking(booking);
                      setEditDate(booking.preferred_date);
                      setEditTime(booking.preferred_time);
                      setEditService(booking.service_name);
                      setEditPhone(booking.client_phone);
                    }}>
                    <Edit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" onClick={() => updateStatus(booking.id, 'recusado', booking)}
                    variant="destructive" className="text-xs h-8">
                    <X className="w-3 h-3 mr-1" /> Recusar
                  </Button>
                </>
              )}
              {booking.client_phone && (
                <Button size="sm" variant="outline" className="text-xs h-8"
                  onClick={() => {
                    const addrMatch = booking.notes?.match(/📍\s*([^|]+)/);
                    const addrText = addrMatch ? `\n📍 Local: ${addrMatch[1].trim()}` : '';
                    const [y, m, d] = booking.preferred_date.split('-').map(Number);
                    const dateForWA = new Date(y, m - 1, d, 12, 0, 0);
                    const msg = booking.status === 'pendente'
                      ? `Olá ${booking.client_name}! Recebemos seu agendamento de ${booking.service_name} para ${safeFormat(dateForWA, 'dd/MM/yyyy')} às ${booking.preferred_time}. Estamos analisando e já confirmaremos! 🙏`
                      : `Olá ${booking.client_name}! Sobre seu agendamento de ${booking.service_name} no dia ${safeFormat(dateForWA, 'dd/MM/yyyy')} às ${booking.preferred_time}.${addrText}`;
                    window.open(formatWhatsAppUrl(booking.client_phone, msg), '_blank');
                  }}>
                  <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                onClick={() => deleteBooking(booking.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <TabGuideCards cards={[
        {
          icon: Globe,
          title: 'Agendamento Online',
          badge: 'Automático',
          badgeColor: 'blue',
          description: <>Seus clientes agendam <strong>direto pelo link</strong>. Você recebe notificação em tempo real.</>,
        },
        {
          icon: CalendarPlus,
          title: 'Sincronização',
          badge: 'Auto',
          badgeColor: 'cyan',
          description: <>Ao confirmar, o agendamento é <strong>adicionado à agenda</strong> e registra a venda.</>,
        },
      ]} />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-primary">{todayBookings.length}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Hoje</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-primary">{futureBookings.length}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Futuros</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-green-500">{confirmedBookings.length}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Confirmados</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-amber-500">{pendingBookings.length}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Pendentes</p>
        </div>
      </div>

      {/* Booking Link */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Link de Agendamento
            {pendingBookings.length > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse ml-2">{pendingBookings.length} pendente(s)</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-muted rounded-lg p-2 sm:p-3 border border-border truncate">
              <code className="text-primary text-xs sm:text-sm">{bookingUrl}</code>
            </div>
            <Button onClick={copyLink} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => window.open(bookingUrl, '_blank')}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => {
              const msg = `Olá! Agende seu serviço de Ar Condicionado online: ${bookingUrl}`;
              window.open(formatWhatsAppUrl('', msg), '_blank');
            }}>
              <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={loadBookings}>
              <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={exportBookingsPDF} disabled={bookings.length === 0}>
              <FileDown className="w-3 h-3 mr-1" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Bookings — tabs at top below stats */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tabs at top */}
          <div className="border-b border-border px-2 sm:px-4 pt-3 pb-2">
            <TabsList
              className="w-full grid grid-cols-4 h-auto gap-1 bg-muted/40 p-1 rounded-xl"
              aria-label="Filtrar agendamentos por período"
            >
              <TabsTrigger
                value="hoje"
                aria-label="Hoje — agendamentos confirmados ou pendentes para hoje"
                title="Hoje — agendamentos confirmados ou pendentes para hoje"
                className="flex-col sm:flex-row min-w-0 text-[11px] sm:text-sm gap-0.5 sm:gap-1.5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span className="truncate">Hoje</span>
                <Badge
                  variant={todayBookings.length > 0 ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 ml-0.5 bg-background/20 text-current border-0"
                >
                  {todayBookings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="futuras"
                aria-label="Futuros — próximos agendamentos a partir de amanhã"
                title="Futuros — próximos agendamentos a partir de amanhã"
                className="flex-col sm:flex-row min-w-0 text-[11px] sm:text-sm gap-0.5 sm:gap-1.5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span className="truncate">Futuros</span>
                <Badge
                  variant={futureBookings.length > 0 ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 ml-0.5 bg-background/20 text-current border-0"
                >
                  {futureBookings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="historico"
                aria-label="Histórico — agendamentos passados, recusados ou cancelados"
                title="Histórico — agendamentos passados, recusados ou cancelados"
                className="flex-col sm:flex-row min-w-0 text-[11px] sm:text-sm gap-0.5 sm:gap-1.5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="truncate">Histórico</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 ml-0.5 bg-background/20 text-current border-0"
                >
                  {historyBookings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="todos"
                aria-label="Todos — lista completa de agendamentos do mais recente ao mais antigo"
                title="Todos — lista completa de agendamentos"
                className="flex-col sm:flex-row min-w-0 text-[11px] sm:text-sm gap-0.5 sm:gap-1.5 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <List className="w-3.5 h-3.5" />
                <span className="truncate">Todos</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 ml-0.5 bg-background/20 text-current border-0"
                >
                  {allBookings.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="pt-4 pb-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="futuras" className="mt-0">
                  {futureBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum agendamento futuro.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {futureBookings.map(b => renderBookingCard(b))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="hoje" className="mt-0">
                  {todayBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum agendamento para hoje.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayBookings.map(b => renderBookingCard(b))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="todos" className="mt-0">
                  {allBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum agendamento online ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allBookings.map(b => renderBookingCard(b))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="historico" className="mt-0">
                  {historyBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum histórico disponível.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyBookings.map(b => renderBookingCard(b, false))}
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {/* Edit Booking Dialog */}
      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Solicitação de Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Serviço / Produto</Label>
              <Input value={editService} onChange={e => setEditService(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone / WhatsApp</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBooking(null)}>Cancelar</Button>
            <Button onClick={handleEditSubmit}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineBookingsTab;
