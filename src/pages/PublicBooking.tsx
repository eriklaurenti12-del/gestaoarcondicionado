import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Wind, Calendar, Clock, User, Phone, Mail, CreditCard, CheckCircle, Loader2, Snowflake, ChevronLeft, ChevronRight, Search, Trash2, XCircle, MapPin, Instagram } from "lucide-react";
import { format, addDays, isBefore, startOfDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ServiceOption = { id: number; name: string; price: number; service_duration?: number; image_url?: string };
type CompanyInfo = { company_name: string; whatsapp?: string; address?: string; logo_url?: string; instagram?: string };
type BookingResult = {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  preferred_date: string;
  preferred_time: string;
  payment_method: string | null;
  status: string;
  created_at: string;
};

const PAYMENT_METHODS = [
  { id: 'pix', label: 'PIX', icon: '💰' },
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
  { id: 'cartao_debito', label: 'Cartão Débito', icon: '💳' },
];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

const formatWhatsAppUrl = (phone: string, message: string) => {
  const clean = phone.replace(/\D/g, '');
  const fullNumber = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
};

export default function PublicBooking() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('u');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [company, setCompany] = useState<CompanyInfo>({ company_name: 'AC Service Pro' });
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'agendar' | 'consultar'>('agendar');

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientBairro, setClientBairro] = useState('');
  const [clientCidade, setClientCidade] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  // Lookup state
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResults, setLookupResults] = useState<BookingResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);

  // Calendar navigation
  const [calendarStart, setCalendarStart] = useState(startOfDay(new Date()));

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${userId}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.company) setCompany(data.company);
      if (data.services) setServices(data.services);
      if (data.busySlots) setBusySlots(data.busySlots);
    } catch (e) {
      console.error('Error loading booking data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setClientCep(cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2'));
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setClientAddress(data.logradouro || '');
        setClientBairro(data.bairro || '');
        setClientCidade(`${data.localidade || ''} - ${data.uf || ''}`);
      }
    } catch { /* ignore */ } finally { setLoadingCep(false); }
  };

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const day = addDays(calendarStart, i);
      if (!isBefore(day, startOfDay(new Date()))) {
        days.push(day);
      }
    }
    return days;
  }, [calendarStart]);

  const availableTimes = useMemo(() => {
    if (!selectedDate) return TIME_SLOTS;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const busyTimes = busySlots
      .filter(s => s.startsWith(dateStr))
      .map(s => format(new Date(s), 'HH:mm'));

    return TIME_SLOTS.filter(t => {
      if (isToday(selectedDate)) {
        const now = new Date();
        const [h, m] = t.split(':').map(Number);
        if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) return false;
      }
      return !busyTimes.includes(t);
    });
  }, [selectedDate, busySlots]);

  const handleSubmit = async () => {
    if (!userId || !selectedDate || !selectedTime || !selectedService) return;
    setSubmitting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${userId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: clientName,
            client_phone: clientPhone,
            client_email: clientEmail || undefined,
            client_address: [clientAddress, clientBairro, clientCidade].filter(Boolean).join(', ') || undefined,
            client_cep: clientCep || undefined,
            service_name: selectedService.name,
            preferred_date: format(selectedDate, 'yyyy-MM-dd'),
            preferred_time: selectedTime,
            payment_method: paymentMethod || undefined,
            notes: notes || undefined,
          })
        }
      );
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        throw new Error(data.error || 'Erro ao agendar');
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async () => {
    if (!userId || lookupPhone.length < 8) {
      toast({ title: "Digite seu telefone completo", variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    setLookupDone(false);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const cleanPhone = lookupPhone.replace(/\D/g, '');
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${userId}&action=lookup&phone=${cleanPhone}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      setLookupResults(data.bookings || []);
      setLookupDone(true);
    } catch (e) {
      toast({ title: "Erro ao consultar", variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, action: 'cancel' })
        }
      );
      const data = await res.json();
      if (data.success) {
        toast({ title: "Agendamento cancelado" });
        handleLookup();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return { text: '⏳ Pendente', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'confirmado': return { text: '✅ Confirmado', cls: 'bg-green-500/20 text-green-300 border-green-500/30' };
      case 'recusado': return { text: '❌ Recusado', cls: 'bg-red-500/20 text-red-300 border-red-500/30' };
      case 'cancelado': return { text: '🚫 Cancelado', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
      default: return { text: status, cls: 'bg-slate-500/20 text-slate-300' };
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/80 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <Snowflake className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">Link inválido</h2>
            <p className="text-slate-400">Este link de agendamento não é válido. Solicite um novo link ao prestador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (submitted) {
    const whatsappMsg = `Olá ${company.company_name}! Acabei de solicitar um agendamento:\n\n📋 Serviço: ${selectedService?.name}\n📅 Data: ${selectedDate && format(selectedDate, "dd/MM/yyyy")}\n⏰ Horário: ${selectedTime}\n👤 Nome: ${clientName}\n📱 Telefone: ${clientPhone}\n\nAguardo confirmação!`;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/80 border-green-500/30 max-w-md w-full animate-scale-in">
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-white text-2xl font-bold">Agendamento Solicitado! 🎉</h2>
            <p className="text-slate-300">
              Seu pedido de agendamento foi enviado para <strong className="text-cyan-400">{company.company_name}</strong>.
            </p>
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 text-left">
              <p className="text-slate-400 text-sm"><span className="text-white font-medium">Serviço:</span> {selectedService?.name}</p>
              <p className="text-slate-400 text-sm"><span className="text-white font-medium">Data:</span> {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
              <p className="text-slate-400 text-sm"><span className="text-white font-medium">Horário:</span> {selectedTime}</p>
              {paymentMethod && <p className="text-slate-400 text-sm"><span className="text-white font-medium">Pagamento:</span> {paymentMethod}</p>}
            </div>
            <p className="text-slate-500 text-xs">Você receberá a confirmação em breve.</p>
            
            {company.whatsapp && (
              <Button onClick={() => window.open(formatWhatsAppUrl(company.whatsapp!, whatsappMsg), '_blank')}
                className="bg-green-600 hover:bg-green-700 text-white w-full mt-2">
                <Phone className="w-4 h-4 mr-2" /> Falar no WhatsApp
              </Button>
            )}

            {company.instagram && (
              <a
                href={`https://instagram.com/${company.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-3"
              >
                <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-xl p-[1px]">
                  <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                    <Instagram className="w-5 h-5 text-pink-400 flex-shrink-0" />
                    <span className="text-white text-sm font-medium">Siga @{company.instagram.replace('@', '')}</span>
                  </div>
                </div>
              </a>
            )}

            <div className="border-t border-slate-700 pt-4 mt-4">
              <p className="text-cyan-300 text-sm font-medium mb-2">🙏 Obrigado por agendar conosco!</p>
              <p className="text-slate-500 text-xs">Ficamos felizes em atendê-lo. Qualquer dúvida, entre em contato.</p>
            </div>

            <Button variant="outline" onClick={() => { setMode('consultar'); setSubmitted(false); setLookupPhone(clientPhone); }}
              className="w-full border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 mt-2">
              <Search className="w-4 h-4 mr-2" /> Consultar Meus Agendamentos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canProceed = () => {
    if (step === 1) return !!selectedService;
    if (step === 2) return !!selectedDate && !!selectedTime;
    if (step === 3) return clientName.length > 2 && clientPhone.length > 7;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 pb-24">
      {/* Header */}
      <div className="max-w-lg mx-auto text-center mb-6 pt-4">
        <div className="flex justify-center mb-4">
          {company.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.company_name} 
              className="h-20 max-w-[200px] object-contain drop-shadow-lg" 
            />
          ) : (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Wind className="w-8 h-8 text-cyan-400" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{company.company_name}</h1>
        <p className="text-cyan-300/60 text-sm">Agendamento Online</p>
      </div>

      {/* Mode Toggle */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex rounded-xl overflow-hidden border border-slate-700">
          <button onClick={() => setMode('agendar')}
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'agendar' ? 'bg-cyan-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}>
            <Calendar className="w-4 h-4" /> Agendar
          </button>
          <button onClick={() => setMode('consultar')}
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'consultar' ? 'bg-cyan-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}>
            <Search className="w-4 h-4" /> Consultar
          </button>
        </div>
      </div>

      {/* Consultar Mode */}
      {mode === 'consultar' && (
        <div className="max-w-lg mx-auto space-y-4 animate-fade-in">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-400" /> Consultar Agendamentos
          </h2>
          <p className="text-slate-400 text-sm">Digite seu telefone para ver seus agendamentos</p>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input value={lookupPhone} onChange={e => setLookupPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
            </div>
            <Button onClick={handleLookup} disabled={lookupLoading}
              className="bg-cyan-500 hover:bg-cyan-600 text-white">
              {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {lookupDone && lookupResults.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum agendamento encontrado para este telefone.</p>
            </div>
          )}

          {lookupResults.map(booking => {
            const st = getStatusLabel(booking.status);
            return (
              <div key={booking.id} className="p-4 rounded-xl border border-slate-700 bg-slate-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{booking.service_name}</span>
                  <Badge className={st.cls}>{st.text}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {booking.preferred_time}</span>
                </div>
                {booking.payment_method && (
                  <p className="text-xs text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3" /> {booking.payment_method}</p>
                )}
                {/* Action buttons based on status */}
                <div className="flex flex-col gap-2 pt-2">
                  {(booking.status === 'pendente' || booking.status === 'confirmado') && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCancelBooking(booking.id)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs flex-1">
                        <XCircle className="w-3 h-3 mr-1" /> Desagendar
                      </Button>
                      {company.whatsapp && (
                        <Button size="sm" variant="outline" onClick={() => {
                          const msg = `Olá! Gostaria de falar sobre meu agendamento de ${booking.service_name} no dia ${format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')} às ${booking.preferred_time}.`;
                          window.open(formatWhatsAppUrl(company.whatsapp!, msg), '_blank');
                        }}
                          className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs flex-1">
                          <Phone className="w-3 h-3 mr-1" /> WhatsApp
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Confirmed: show contact to request service */}
                  {booking.status === 'confirmado' && company.whatsapp && (
                    <Button size="sm" onClick={() => {
                      const msg = `Olá ${company.company_name}! Meu agendamento de *${booking.service_name}* para o dia *${format(new Date(booking.preferred_date + 'T12:00:00'), 'dd/MM/yyyy')}* às *${booking.preferred_time}* foi confirmado.\n\n👤 *${booking.client_name}*\n📱 ${booking.client_phone}\n\nEstou te aguardando! Solicito o serviço conforme combinado.`;
                      window.open(formatWhatsAppUrl(company.whatsapp!, msg), '_blank');
                    }}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs w-full">
                      <Phone className="w-3 h-3 mr-1" /> 📞 Chamar Empresa - Solicitar Serviço
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Agendar Mode */}
      {mode === 'agendar' && (
        <>
          {/* Progress */}
          <div className="max-w-lg mx-auto mb-6">
            <div className="flex items-center justify-between">
              {['Serviço', 'Data/Hora', 'Seus Dados', 'Confirmar'].map((label, i) => (
                <div key={i} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step > i + 1 ? 'bg-green-500 text-white' :
                    step === i + 1 ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  {i < 3 && <div className={`w-8 sm:w-12 h-0.5 ${step > i + 1 ? 'bg-green-500' : 'bg-slate-700'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {['Serviço', 'Data/Hora', 'Dados', 'Confirmar'].map((label, i) => (
                <span key={i} className={`text-[10px] ${step === i + 1 ? 'text-cyan-400' : 'text-slate-500'}`}>{label}</span>
              ))}
            </div>
          </div>

          <div className="max-w-lg mx-auto">
            {/* Step 1: Select Service */}
            {step === 1 && (
              <div className="space-y-3 animate-fade-in">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                  <Snowflake className="w-5 h-5 text-cyan-400" /> Escolha o Serviço
                </h2>
                {services.length === 0 ? (
                  <Card className="bg-slate-800/60 border-slate-700">
                    <CardContent className="pt-6 text-center text-slate-400">
                      Nenhum serviço disponível no momento.
                    </CardContent>
                  </Card>
                ) : (
                  services.map(service => (
                    <button key={service.id} onClick={() => setSelectedService(service)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedService?.id === service.id
                          ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                          : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                      }`}>
                      <div className="flex items-center gap-3">
                        {service.image_url ? (
                          <img src={service.image_url} alt={service.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                            <Snowflake className="w-6 h-6 text-cyan-400/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${selectedService?.id === service.id ? 'text-white' : 'text-slate-200'}`}>
                            {service.name}
                          </p>
                          {service.service_duration && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" /> {service.service_duration} min
                            </p>
                          )}
                        </div>
                        <Badge className={`text-sm flex-shrink-0 ${selectedService?.id === service.id
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-700 text-slate-300'}`}>
                          R$ {service.price.toFixed(2)}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step 2: Date & Time */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" /> Escolha Data e Horário
                </h2>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-8 w-8 p-0"
                      onClick={() => setCalendarStart(prev => addDays(prev, -7))}
                      disabled={isBefore(addDays(calendarStart, -7), startOfDay(new Date()))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-slate-300 text-sm font-medium">
                      {format(calendarStart, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-8 w-8 p-0"
                      onClick={() => setCalendarStart(prev => addDays(prev, 7))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map(day => {
                      const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                      const isSunday = day.getDay() === 0;
                      return (
                        <button key={day.toISOString()} onClick={() => { setSelectedDate(day); setSelectedTime(''); }}
                          disabled={isSunday}
                          className={`p-2 rounded-lg text-center transition-all ${
                            isSunday ? 'opacity-30 cursor-not-allowed' :
                            isSelected ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' :
                            isToday(day) ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                            'bg-slate-800/60 text-slate-300 hover:bg-slate-700 border border-slate-700'
                          }`}>
                          <div className="text-[10px] text-slate-500">{format(day, 'EEE', { locale: ptBR })}</div>
                          <div className="text-sm font-bold">{format(day, 'dd')}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedDate && (
                  <div>
                    <p className="text-slate-400 text-sm mb-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horários disponíveis para {format(selectedDate, "dd/MM")}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {availableTimes.length === 0 ? (
                        <p className="col-span-4 text-center text-slate-500 py-4">Sem horários disponíveis neste dia.</p>
                      ) : (
                        availableTimes.map(time => (
                          <button key={time} onClick={() => setSelectedTime(time)}
                            className={`py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                              selectedTime === time
                                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700 border border-slate-700'
                            }`}>
                            {time}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Client Info + Payment */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" /> Seus Dados
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-300 text-xs">Nome completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Seu nome"
                        className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs">WhatsApp / Telefone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(11) 99999-9999"
                        className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                  </div>
                </div>

                {/* Address with CEP */}
                <div className="space-y-3 p-3 rounded-xl border border-slate-700 bg-slate-800/30">
                  <Label className="text-slate-300 text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Endereço do Serviço
                  </Label>
                  <div>
                    <Label className="text-slate-400 text-[10px]">CEP</Label>
                    <div className="relative">
                      <Input value={clientCep} onChange={e => handleCepLookup(e.target.value)} placeholder="00000-000" maxLength={9}
                        className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                      {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-cyan-400" />}
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-[10px]">Rua / Logradouro</Label>
                    <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Rua, nº, complemento"
                      className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-slate-400 text-[10px]">Bairro</Label>
                      <Input value={clientBairro} onChange={e => setClientBairro(e.target.value)} placeholder="Bairro"
                        className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-[10px]">Cidade - UF</Label>
                      <Input value={clientCidade} onChange={e => setClientCidade(e.target.value)} placeholder="Cidade - UF"
                        className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                    </div>
                  </div>
                </div>
                  <div>
                    <Label className="text-slate-300 text-xs">Email (opcional)</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="seu@email.com"
                        className="pl-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs flex items-center gap-1 mb-2">
                    <CreditCard className="w-3 h-3" /> Forma de pagamento preferida
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(pm => (
                      <button key={pm.id} onClick={() => setPaymentMethod(pm.label)}
                        className={`p-3 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                          paymentMethod === pm.label
                            ? 'border-cyan-400 bg-cyan-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600'
                        }`}>
                        <span>{pm.icon}</span> {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Observações (opcional)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alguma informação adicional..."
                    className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 min-h-[60px]" />
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Confirme seu Agendamento
                </h2>
                <Card className="bg-slate-800/60 border-cyan-500/20">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Serviço</span>
                      <span className="text-white font-medium">{selectedService?.name}</span>
                    </div>
                    <div className="h-px bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Valor</span>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        R$ {selectedService?.price.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="h-px bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Data</span>
                      <span className="text-white">{selectedDate && format(selectedDate, "dd 'de' MMMM, EEEE", { locale: ptBR })}</span>
                    </div>
                    <div className="h-px bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Horário</span>
                      <span className="text-cyan-400 font-bold text-lg">{selectedTime}</span>
                    </div>
                    <div className="h-px bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Cliente</span>
                      <span className="text-white">{clientName}</span>
                    </div>
                    <div className="h-px bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Telefone</span>
                      <span className="text-white">{clientPhone}</span>
                    </div>
                    {paymentMethod && (
                      <>
                        <div className="h-px bg-slate-700" />
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 text-sm">Pagamento</span>
                          <span className="text-white">{paymentMethod}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Instagram Follow CTA */}
            {company.instagram && (
              <div className="mb-24 mt-6">
                <a
                  href={`https://instagram.com/${company.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-lg mx-auto"
                >
                  <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-2xl p-[1px]">
                    <div className="bg-slate-900/90 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">Siga-nos no Instagram!</p>
                        <p className="text-slate-400 text-xs truncate">@{company.instagram.replace('@', '')}</p>
                      </div>
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex-shrink-0">
                        Seguir
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            )}

            {/* Navigation */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
              <div className="max-w-lg mx-auto flex gap-3">
                {step > 1 && (
                  <Button onClick={() => setStep(s => s - 1)} variant="outline"
                    className="flex-1 h-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                    Voltar
                  </Button>
                )}
                {step < 4 ? (
                  <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
                    className="flex-1 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium disabled:opacity-50">
                    Continuar
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '✓ Confirmar Agendamento'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
