import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { MapPin, Car, Utensils, Send, CheckCircle2, Calendar, FileDown, RefreshCw, Trash2, LayoutDashboard, ListTodo, ClipboardCheck, ArrowRight, UserCheck, DollarSign, Printer, Share2, Map, ChevronRight, Activity } from 'lucide-react';
import { ServiceProvider } from './ServiceProvidersTab';
import { Badge } from "@/components/ui/badge";
import ProviderDailyRouteDialog from './ProviderDailyRouteDialog';

export default function RouteAllocationTab({ providers }: { providers: ServiceProvider[] }) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');
  const [diaria, setDiaria] = useState('');
  const [motorista, setMotorista] = useState('');
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showAssigned, setShowAssigned] = useState(false);
  const [moveToToday, setMoveToToday] = useState(true);
  const [routeProvider, setRouteProvider] = useState<ServiceProvider | null>(null);

  // Fetch all appointments for the operational flow
  const { data: allAppointmentsRaw, isLoading } = useQuery({
    queryKey: ['route-appointments', filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address), products(name, price)')
        .order('appointment_date', { ascending: true });
        
      if (error) throw error;
      return data || [];
    }
  });

  const unassignedAppointments = useMemo(() => {
    if (!allAppointmentsRaw) return [];
    return allAppointmentsRaw.filter(a => {
      const hasProvider = a.notes?.includes('[PRESTADOR:');
      const matchesDate = !filterDate || a.appointment_date.startsWith(filterDate);
      const isPendingStatus = ['agendado', 'confirmado', 'futura', 'pendente', 'enviado_prestador'].includes(a.status);
      
      if (showAssigned) return matchesDate && isPendingStatus;
      return !hasProvider && matchesDate && isPendingStatus;
    });
  }, [allAppointmentsRaw, filterDate, showAssigned]);

  const assignedAppointments = useMemo(() => {
    if (!allAppointmentsRaw) return [];
    return allAppointmentsRaw.filter(a => {
      const hasProvider = a.notes?.includes('[PRESTADOR:');
      if (!hasProvider) return false;
      return !filterDate || a.appointment_date.startsWith(filterDate);
    });
  }, [allAppointmentsRaw, filterDate]);

  const routesByProvider = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    assignedAppointments.forEach(a => {
      const match = a.notes?.match(/\[PRESTADOR:(.+?)\]/);
      const provName = match?.[1] || 'Outros';
      if (!grouped[provName]) grouped[provName] = [];
      grouped[provName].push(a);
    });
    return grouped;
  }, [assignedAppointments]);

  const toggleAppointment = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  React.useEffect(() => {
    if (selectedProviderId) {
      const provider = providers.find(p => p.id === selectedProviderId);
      if (provider && provider.is_recurring_expenses !== false) {
        setCombustivel(provider.fuel_allowance ? String(provider.fuel_allowance) : '');
        setAlimentacao(provider.food_allowance ? String(provider.food_allowance) : '');
        setDiaria(provider.daily_rate ? String(provider.daily_rate) : '');
        setMotorista(provider.driver_cost ? String(provider.driver_cost) : '');
      } else {
        setCombustivel(''); setAlimentacao(''); setDiaria(''); setMotorista('');
      }
    }
  }, [selectedProviderId, providers]);

  const allocateRouteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      
      const provider = providers.find(p => p.id === selectedProviderId);
      if (!provider) throw new Error('Prestador não encontrado');

      const appointmentsToUpdate = unassignedAppointments?.filter(a => selectedAppointments.includes(a.id)) || [];
      
      for (const apt of appointmentsToUpdate) {
        const newNotes = apt.notes 
          ? `[PRESTADOR:${provider.name}]\n${apt.notes}` 
          : `[PRESTADOR:${provider.name}]`;
          
        let updateData: any = { notes: newNotes, status: 'enviado_prestador' };
        if (moveToToday) {
          const todayDate = new Date();
          const aptDate = new Date(apt.appointment_date);
          todayDate.setHours(aptDate.getHours(), aptDate.getMinutes(), 0, 0);
          updateData.appointment_date = todayDate.toISOString();
        }

        const { error } = await supabase.from('appointments').update(updateData).eq('id', apt.id);
        if (error) throw error;
      }

      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];

      if (combustivel) expensesToInsert.push({ user_id: session.user.id, category: 'Combustível', amount: parseFloat(combustivel), expense_date: today, description: `Saída Rota: ${provider.name}`, helper_name: provider.name });
      if (alimentacao) expensesToInsert.push({ user_id: session.user.id, category: 'Alimentação', amount: parseFloat(alimentacao), expense_date: today, description: `Saída Rota: ${provider.name}`, helper_name: provider.name });
      if (diaria) expensesToInsert.push({ user_id: session.user.id, category: 'Diária', amount: parseFloat(diaria), expense_date: today, description: `Saída Rota: ${provider.name}`, helper_name: provider.name });
      if (motorista) expensesToInsert.push({ user_id: session.user.id, category: 'Motorista', amount: parseFloat(motorista), expense_date: today, description: `Saída Rota: ${provider.name}`, helper_name: provider.name });

      if (expensesToInsert.length > 0) {
        await supabase.from('fixed_expenses').insert(expensesToInsert);
      }
    },
    onSuccess: () => {
      toast.success('Rota enviada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['route-appointments'] });
      setSelectedAppointments([]);
      setSelectedProviderId('');
    },
    onError: (error: any) => toast.error(error.message)
  });

  const exportRoutePDF = (provName: string, appts: any[]) => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

    appts.forEach((apt, index) => {
      if (index > 0) doc.addPage();
      doc.setFillColor(11, 17, 32); doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('ORDEM DE ROTA OPERACIONAL', 105, 20, { align: 'center' });
      doc.setFontSize(10); doc.text(`HVAC CONTROL - ${dateStr}`, 105, 30, { align: 'center' });
      doc.setFontSize(12); doc.text(`TÉCNICO: ${provName.toUpperCase()}`, 105, 38, { align: 'center' });

      doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.text('DADOS DO ATENDIMENTO', 20, 60);
      doc.setDrawColor(200); doc.line(20, 62, 190, 62);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal');
      doc.text(`CLIENTE: ${apt.clients?.name || 'N/A'}`, 20, 72);
      doc.text(`TEL: ${apt.clients?.telefone || 'N/A'}`, 20, 80);
      doc.setFont('helvetica', 'bold'); doc.text('ENDEREÇO:', 20, 88); doc.setFont('helvetica', 'normal');
      const addressLines = doc.splitTextToSize(apt.clients?.address || 'N/A', 160);
      doc.text(addressLines, 20, 94);

      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('DESCRIÇÃO DO SERVIÇO', 20, 120);
      doc.line(20, 122, 190, 122);
      doc.setFillColor(245, 245, 245); doc.rect(20, 128, 170, 30, 'F');
      doc.setFontSize(12); doc.text(`${apt.products?.name || 'Serviço Personalizado'}`, 25, 138);
      doc.setFontSize(10); doc.text(`HORÁRIO: ${format(parseISO(apt.appointment_date), 'HH:mm')}`, 25, 148);
      const price = apt.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1] || apt.products?.price || '0.00';
      doc.setFontSize(12); doc.text(`VALOR: R$ ${Number(price).toFixed(2)}`, 110, 148);

      doc.line(20, 240, 100, 240); doc.text('Assinatura do Técnico', 60, 245, { align: 'center' });
      doc.line(110, 240, 190, 240); doc.text('Visto do Cliente', 150, 245, { align: 'center' });
    });

    doc.save(`ROTA-${provName.toUpperCase()}-${format(new Date(), 'dd-MM')}.pdf`);
    toast.success('Folha de Rota Gerada!');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Central Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-blue-500" />
            OPERACIONAL DE CAMPO
          </h1>
          <p className="text-xs text-slate-500 font-black uppercase tracking-[0.2em]">Gestão de Rotas e Equipes Externas</p>
        </div>
        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 p-2 rounded-2xl shadow-xl">
          <Calendar className="w-4 h-4 text-blue-500 ml-2" />
          <Input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-transparent border-none text-white font-black h-10 focus-visible:ring-0 w-40 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Selection */}
        <div className="lg:col-span-7 space-y-6">
          <div className="op-card bg-[#111827]/80 backdrop-blur-xl border-white/5">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">Serviços Disponíveis</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{unassignedAppointments.length} Itens pendentes</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase px-4"
                  onClick={() => setSelectedAppointments(unassignedAppointments.map(a => a.id))}
                >
                  Selecionar Tudo
                </Button>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-black/20 rounded-xl border border-white/5">
                  <Checkbox id="show-ass" checked={showAssigned} onCheckedChange={(c) => setShowAssigned(!!c)} />
                  <Label htmlFor="show-ass" className="text-[10px] font-black text-slate-400 uppercase cursor-pointer">Ver Atribuídos</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-3 custom-scrollbar">
              {isLoading ? (
                <div className="py-24 text-center">
                  <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Sincronizando base...</p>
                </div>
              ) : unassignedAppointments.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <ClipboardCheck className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sem pendências para esta data</p>
                </div>
              ) : (
                unassignedAppointments.map(apt => (
                  <div 
                    key={apt.id}
                    onClick={() => toggleAppointment(apt.id)}
                    className={`group relative flex items-center gap-5 p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                      selectedAppointments.includes(apt.id) 
                      ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${selectedAppointments.includes(apt.id) ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <Checkbox checked={selectedAppointments.includes(apt.id)} onCheckedChange={() => toggleAppointment(apt.id)} className="h-5 w-5 rounded-lg border-white/20" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-white font-black text-base group-hover:text-blue-400 transition-colors uppercase tracking-tight">{apt.clients?.name}</span>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-blue-500 font-black font-mono text-xs">{format(new Date(apt.appointment_date), 'HH:mm')}</span>
                            <span className="text-slate-500 font-black text-[10px] uppercase">{apt.clients?.telefone}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 py-1 ${
                          apt.status === 'concluido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                          apt.status === 'enviado_prestador' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          {apt.status === 'enviado_prestador' ? 'Na Rota' : apt.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.03]">
                        <p className="text-slate-400 text-[10px] font-bold flex items-center gap-2 truncate flex-1">
                          <MapPin className="w-3 h-3 text-red-500" /> {apt.clients?.address || 'Sem endereço'}
                        </p>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter">{apt.products?.name || 'Serviço'}</span>
                          <span className="text-green-500 text-xs font-black">R$ {Number(apt.products?.price || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-blue-500 transition-all ${selectedAppointments.includes(apt.id) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="op-card sticky top-8 border-blue-500/30 bg-gradient-to-br from-[#111827] to-[#0B1120]">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Configurar Rota do Dia</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Atribuição e Custos Operacionais</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 text-center shadow-2xl">
                  <span className="text-5xl font-black text-blue-500">{selectedAppointments.length}</span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Visitas</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-6 text-center shadow-2xl">
                  <span className="text-2xl font-black text-green-500">
                    R$ {unassignedAppointments.filter(a => selectedAppointments.includes(a.id)).reduce((sum, a) => sum + Number(a.products?.price || 0), 0).toFixed(0)}
                  </span>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Receita</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Técnico Encarregado</Label>
                <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                  <SelectTrigger className="op-input h-14 font-black text-base border-white/10">
                    <SelectValue placeholder="Selecione o Profissional..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#111827] border-white/10 text-white shadow-2xl">
                    {providers.filter(p => p.active).map(p => (
                      <SelectItem key={p.id} value={p.id} className="focus:bg-blue-600 focus:text-white font-bold h-12">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shadow-lg shadow-blue-500/50" style={{ backgroundColor: p.color }} />
                          {p.name.toUpperCase()}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matriz de Despesas da Rota</p>
                  <RefreshCw className="w-3 h-3 text-slate-700 cursor-pointer hover:text-blue-500 transition-colors" />
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><Car className="w-3.5 h-3.5 text-orange-500" /> Combustível</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">R$</span>
                      <Input type="number" value={combustivel} onChange={e => setCombustivel(e.target.value)} className="op-input h-12 pl-8 font-black text-sm" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><Utensils className="w-3.5 h-3.5 text-amber-500" /> Alimentação</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">R$</span>
                      <Input type="number" value={alimentacao} onChange={e => setAlimentacao(e.target.value)} className="op-input h-12 pl-8 font-black text-sm" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-blue-500" /> Diária</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">R$</span>
                      <Input type="number" value={diaria} onChange={e => setDiaria(e.target.value)} className="op-input h-12 pl-8 font-black text-sm" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Motorista</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">R$</span>
                      <Input type="number" value={motorista} onChange={e => setMotorista(e.target.value)} className="op-input h-12 pl-8 font-black text-sm" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => setMoveToToday(!moveToToday)}>
                <Checkbox checked={moveToToday} onCheckedChange={(c) => setMoveToToday(!!c)} className="h-5 w-5" />
                <Label className="text-[11px] font-black text-slate-300 uppercase tracking-wide cursor-pointer select-none">Mover visitas selecionadas para HOJE</Label>
              </div>

              <Button 
                onClick={() => allocateRouteMutation.mutate()}
                disabled={selectedAppointments.length === 0 || !selectedProviderId || allocateRouteMutation.isPending}
                className="op-btn-primary w-full h-16 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-500/20 gap-3 group"
              >
                {allocateRouteMutation.isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                FINALIZAR E ENVIAR ROTA
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Monitoring */}
        <div className="lg:col-span-12 mt-12 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Monitoramento em Tempo Real</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(routesByProvider).map(([provName, appts]) => {
              const provider = providers.find(p => p.name === provName);
              const totalRevenue = appts.reduce((sum, a) => sum + Number(a.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1] || a.products?.price || 0), 0);
              const completedCount = appts.filter(a => a.status === 'concluido').length;
              
              return (
                <div key={provName} className="op-card relative overflow-hidden group border-white/10 hover:border-blue-500/20 bg-gradient-to-b from-[#111827] to-[#0D1424]">
                  <div className="absolute top-0 right-0 p-4">
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-black text-[10px] uppercase px-3 py-1 rounded-full">{appts.length} PONTOS</Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-xl ring-4 ring-white/5" style={{ backgroundColor: provider?.color || '#333' }}>
                      {provName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-white font-black text-base uppercase tracking-tight">{provName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{completedCount} de {appts.length} Visitas</span>
                        <div className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] text-green-500 font-bold uppercase">{Math.round((completedCount / appts.length) * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Faturamento</p>
                      <p className="text-white font-black text-lg">R$ {totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Status Rota</p>
                      <Badge variant="outline" className="mt-1 bg-green-500/10 text-green-500 border-green-500/20 text-[9px] font-black px-2">EM CAMPO</Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-8">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-11 flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase gap-2"
                      onClick={() => exportRoutePDF(provName, appts)}
                    >
                      <Printer className="w-4 h-4" /> IMPRIMIR
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-11 flex-1 bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[10px] gap-2 shadow-lg shadow-green-500/10"
                      onClick={() => setRouteProvider(provider || null)}
                    >
                      <CheckCircle2 className="w-4 h-4" /> AUDITAR
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {appts.map(a => (
                      <div key={a.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group/item hover:bg-white/5 transition-colors">
                        <div className="flex flex-col min-w-0">
                          <span className="text-white text-[11px] font-black uppercase truncate">{a.clients?.name}</span>
                          <span className="text-[9px] text-slate-500 font-bold uppercase truncate">{a.products?.name}</span>
                        </div>
                        <Badge variant="outline" className={`text-[8px] font-black uppercase px-2 h-5 ${
                          a.status === 'concluido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                          a.status === 'cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                          'bg-blue-500/5 text-slate-500 border-white/10'
                        }`}>
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <Button 
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Confirmar limpeza da rota de ${provName}?`)) return;
                      for (const apt of appts) {
                        const cleanNotes = apt.notes?.replace(new RegExp(`\\[PRESTADOR:${provName}\\]`, 'g'), '').trim();
                        await supabase.from('appointments').update({ notes: cleanNotes, status: 'confirmado' }).eq('id', apt.id);
                      }
                      queryClient.invalidateQueries({ queryKey: ['route-appointments'] });
                    }}
                    className="w-full mt-6 h-10 text-[9px] font-black text-slate-700 hover:text-red-500 hover:bg-red-500/5 transition-all uppercase tracking-widest"
                  >
                    Desvincular Todos
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ProviderDailyRouteDialog
        isOpen={!!routeProvider}
        onOpenChange={(open) => !open && setRouteProvider(null)}
        provider={routeProvider}
        allAppointments={assignedAppointments || []}
      />
    </div>
  );
}
