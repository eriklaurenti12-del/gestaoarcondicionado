import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Bell, Calendar, Check, X, Trash2, Clock, User, Phone, CreditCard, ExternalLink, Copy, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const OnlineBookingsTab: React.FC<OnlineBookingsTabProps> = ({ userId }) => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const bookingUrl = `${window.location.origin}/agendar?u=${userId}`;

  useEffect(() => {
    loadBookings();

    // Realtime subscription
    const channel = supabase
      .channel('online-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_bookings' }, () => {
        loadBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadBookings = async () => {
    const { data, error } = await (supabase.from('online_bookings') as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setBookings(data);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase.from('online_bookings') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === 'confirmado' ? "Agendamento confirmado! ✅" : "Agendamento recusado" });
      loadBookings();
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

  const pendingCount = bookings.filter(b => b.status === 'pendente').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">⏳ Pendente</Badge>;
      case 'confirmado': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Confirmado</Badge>;
      case 'recusado': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Recusado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Booking Link */}
      <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-cyan-400" />
            Link de Agendamento Online
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white animate-pulse ml-2">{pendingCount} novo(s)</Badge>
            )}
          </CardTitle>
          <p className="text-cyan-300/60 text-sm">Compartilhe este link com seus clientes para agendamento automático</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-[#0a0a0f] rounded-lg p-3 border border-cyan-500/20 truncate">
              <code className="text-cyan-300 text-sm">{bookingUrl}</code>
            </div>
            <Button onClick={copyLink} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              <Copy className="w-4 h-4 mr-1" /> Copiar
            </Button>
            <Button onClick={() => window.open(bookingUrl, '_blank')} variant="outline"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={() => {
                const msg = `Olá! Agende seu serviço de Ar Condicionado online: ${bookingUrl}`;
                navigator.clipboard.writeText(msg);
                toast({ title: "Mensagem copiada! 📋" });
              }}>
              📱 Copiar para WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Agendamentos Online
            <Badge className="bg-[#2a2a3a] text-white border-0">{bookings.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p>Nenhum agendamento online ainda.</p>
              <p className="text-xs mt-1">Compartilhe o link acima com seus clientes!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(booking => (
                <div key={booking.id}
                  className={`p-4 rounded-xl border transition-all ${
                    booking.status === 'pendente'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : booking.status === 'confirmado'
                        ? 'border-green-500/20 bg-green-500/5'
                        : 'border-[#2a2a3a] bg-[#0f0f17]'
                  }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-semibold">{booking.client_name}</span>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(booking.preferred_date), 'dd/MM/yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {booking.preferred_time}
                        </span>
                        <span className="flex items-center gap-1 text-cyan-400">
                          {booking.service_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {booking.client_phone}
                        </span>
                        {booking.payment_method && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> {booking.payment_method}
                          </span>
                        )}
                      </div>
                      {booking.notes && (
                        <p className="text-xs text-slate-500 italic">"{booking.notes}"</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {booking.status === 'pendente' && (
                        <>
                          <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmado')}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-8">
                            <Check className="w-3 h-3 mr-1" /> Aceitar
                          </Button>
                          <Button size="sm" onClick={() => updateStatus(booking.id, 'recusado')}
                            variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8">
                            <X className="w-3 h-3 mr-1" /> Recusar
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400 h-8 w-8 p-0"
                        onClick={() => deleteBooking(booking.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {booking.client_phone && (
                        <Button size="sm" variant="ghost" className="text-green-400 h-8 w-8 p-0"
                          onClick={() => window.open(`https://wa.me/55${booking.client_phone.replace(/\D/g, '')}`, '_blank')}>
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
