import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Check, X, Trash2, Clock, User, Phone, CreditCard, ExternalLink, Copy, Loader2, RefreshCw, CalendarPlus, FileDown, Globe, Link } from "lucide-react";
import TabGuideCards from './TabGuideCards';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const OnlineBookingsTab: React.FC<OnlineBookingsTabProps> = ({ userId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('online-booking-notifications') !== 'false';
  });
  const [prevCount, setPrevCount] = useState<number | null>(null);

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

  useEffect(() => {
    loadBookings();
    const channel = supabase
      .channel('online-bookings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_bookings' }, (payload) => {
        loadBookings();
        if (notificationsEnabled) {
          playNotificationSound();
          toast({ title: "🔔 Novo agendamento online!", description: `${(payload.new as any).client_name} - ${(payload.new as any).service_name}` });
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Novo Agendamento Online!', {
              body: `${(payload.new as any).client_name} - ${(payload.new as any).service_name}`,
              icon: '/icon-192x192.png'
            });
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_bookings' }, () => {
        loadBookings();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'online_bookings' }, () => {
        loadBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [notificationsEnabled]);

  const loadBookings = async () => {
    const { data } = await (supabase.from('online_bookings') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setBookings(data);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, booking?: OnlineBooking) => {
    const { error } = await (supabase.from('online_bookings') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    
    // If confirming, sync to manual agenda
    if (status === 'confirmado' && booking) {
      await syncToAgenda(booking);
    }
    
    toast({ title: status === 'confirmado' ? "✅ Confirmado, adicionado à agenda e ao histórico de vendas!" : "Agendamento recusado" });
    loadBookings();
    
    // Send WhatsApp notification
    if (booking?.client_phone) {
      // Extract address from notes if available
      const addressMatch = booking.notes?.match(/📍\s*([^|]+)/);
      const cepMatch = booking.notes?.match(/CEP:\s*(\S+)/);
      const addressLine = addressMatch ? `\n📍 Endereço: ${addressMatch[1].trim()}` : '';
      const cepLine = cepMatch ? `\n🏷️ CEP: ${cepMatch[1].trim()}` : '';
      const mapsLink = addressMatch ? `\n🗺️ Ver no mapa: https://www.google.com/maps/search/${encodeURIComponent(addressMatch[1].trim())}` : '';
      
      const statusMsg = status === 'confirmado' 
        ? `✅ Seu agendamento foi *CONFIRMADO*!\n\n📋 Serviço: ${booking.service_name}\n📅 Data: ${format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')}\n⏰ Horário: ${booking.preferred_time}${addressLine}${cepLine}${mapsLink}\n\nAguardamos você! 🙏`
        : `❌ Infelizmente seu agendamento para ${booking.service_name} no dia ${format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')} às ${booking.preferred_time} não pôde ser confirmado.\n\nEntre em contato para reagendar.`;
      
      window.open(formatWhatsAppUrl(booking.client_phone, statusMsg), '_blank');
    }
  };

  const syncToAgenda = async (booking: OnlineBooking) => {
    try {
      // Find or create client
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

      // Find service
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

      // Create appointment
      const dateTime = new Date(`${booking.preferred_date}T${booking.preferred_time}:00`);
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

      // Create sale record so it appears in dashboard and PDV history
      if (clientId && serviceId && servicePrice > 0) {
        const paymentMap: Record<string, string> = {
          'pix': 'PIX', 'dinheiro': 'Dinheiro', 'débito': 'Débito', 'debito': 'Débito',
          'crédito': 'Crédito', 'credito': 'Crédito', 'cartão': 'Crédito', 'cartao': 'Crédito'
        };
        const rawPayment = (booking.payment_method || 'PIX').toLowerCase();
        const mappedPayment = paymentMap[rawPayment] || 'PIX';

        const { error: saleError } = await supabase.from('sales').insert({
          product_id: serviceId,
          client_id: clientId,
          qty: 1,
          sale_price: servicePrice,
          total_profit: servicePrice - serviceCost,
          payment_method: mappedPayment as any,
          user_id: userId,
        });

        if (!saleError) {
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          queryClient.invalidateQueries({ queryKey: ['sales-history'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
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

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({ title: "Link copiado! 📋", description: "Compartilhe com seus clientes" });
  };

  const checkForUpdates = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.update().then(() => {
          toast({ title: "🔍 Verificando atualizações...", description: "Se houver uma nova versão, será aplicada automaticamente." });
        });
      });
    } else {
      window.location.reload();
    }
  };

  const exportBookingsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Agendamentos Online', 14, 22);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | Total: ${bookings.length}`, 14, 30);

    const tableData = bookings.map(b => [
      b.client_name,
      b.client_phone,
      b.service_name,
      format(new Date(b.preferred_date + 'T12:00:00'), 'dd/MM/yyyy'),
      b.preferred_time,
      b.payment_method || '-',
      b.status === 'confirmado' ? 'Confirmado' : b.status === 'pendente' ? 'Pendente' : b.status === 'recusado' ? 'Recusado' : b.status,
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'Telefone', 'Serviço', 'Data', 'Hora', 'Pagamento', 'Status']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });
    doc.save('agendamentos-online.pdf');
    toast({ title: "PDF exportado!" });
  };

  const pendingCount = bookings.filter(b => b.status === 'pendente').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
      case 'confirmado': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Confirmado</Badge>;
      case 'recusado': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Recusado</Badge>;
      case 'cancelado': return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">🚫 Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <TabGuideCards cards={[
        {
          icon: Globe,
          title: 'Agendamento Online',
          badge: 'Automático',
          badgeColor: 'blue',
          description: <>Seus clientes agendam <strong>direto pelo link</strong>. Você recebe notificação em tempo real e aprova ou recusa.</>,
        },
        {
          icon: Link,
          title: 'Link Compartilhável',
          badge: 'Marketing',
          badgeColor: 'emerald',
          description: <>Compartilhe o link nas <strong>redes sociais e WhatsApp</strong>. Aumente seus atendimentos sem esforço.</>,
        },
      ]} />
      {/* Booking Link */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-primary" />
            Link de Agendamento Online
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse ml-2">{pendingCount} novo(s)</Badge>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-sm">Compartilhe este link com seus clientes para agendamento automático</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-muted rounded-lg p-3 border border-border truncate">
              <code className="text-primary text-sm">{bookingUrl}</code>
            </div>
            <Button onClick={copyLink} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </Button>
            <Button onClick={() => window.open(bookingUrl, '_blank')} variant="outline">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline"
              onClick={() => {
                const msg = `Olá! Agende seu serviço de Ar Condicionado online: ${bookingUrl}`;
                window.open(formatWhatsAppUrl('', msg), '_blank');
              }}>
              📱 Enviar via WhatsApp
            </Button>
            <Button size="sm" variant="outline"
              onClick={toggleNotifications}>
              {notificationsEnabled ? <><Bell className="w-3 h-3 mr-1" /> Notificações ON</> : <><Bell className="w-3 h-3 mr-1" /> Notificações OFF</>}
            </Button>
            <Button size="sm" variant="outline"
              onClick={checkForUpdates}>
              <RefreshCw className="w-3 h-3 mr-1" /> Procurar Atualização
            </Button>
            <Button size="sm" variant="outline" onClick={exportBookingsPDF} disabled={bookings.length === 0}>
              <FileDown className="w-3 h-3 mr-1" /> Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Agendamentos Online
            <Badge variant="secondary">{bookings.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum agendamento online ainda.</p>
              <p className="text-xs mt-1">Compartilhe o link acima com seus clientes!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(booking => (
                <div key={booking.id}
                  className={`p-4 rounded-xl border transition-all ${
                    booking.status === 'pendente'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : booking.status === 'confirmado'
                        ? 'border-green-500/20 bg-green-500/10'
                        : 'border-border bg-muted/30'
                  }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{booking.client_name}</span>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {booking.preferred_time}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          {booking.service_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                          <div className="space-y-1">
                            {addressMatch && (
                              <a 
                                href={`https://www.google.com/maps/search/${encodeURIComponent(addressMatch[1].trim())}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                📍 {addressMatch[1].trim()}
                                {cepMatch && <span className="text-muted-foreground">| CEP: {cepMatch[1]}</span>}
                              </a>
                            )}
                            {userNote && <p className="text-xs text-muted-foreground italic">"{userNote}"</p>}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {booking.status === 'pendente' && (
                        <>
                          <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmado', booking)}
                            className="text-xs h-8">
                            <Check className="w-3 h-3 mr-1" /> Aceitar
                          </Button>
                          <Button size="sm" onClick={() => updateStatus(booking.id, 'recusado', booking)}
                            variant="destructive" className="text-xs h-8">
                            <X className="w-3 h-3 mr-1" /> Recusar
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                        onClick={() => deleteBooking(booking.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {booking.client_phone && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                          onClick={() => {
                          const addrMatch = booking.notes?.match(/📍\s*([^|]+)/);
                            const addrText = addrMatch ? `\n📍 Local: ${addrMatch[1].trim()}` : '';
                            const msg = `Olá ${booking.client_name}! Sobre seu agendamento de ${booking.service_name} no dia ${format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')} às ${booking.preferred_time}.${addrText}`;
                            window.open(formatWhatsAppUrl(booking.client_phone, msg), '_blank');
                          }}>
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlineBookingsTab;
