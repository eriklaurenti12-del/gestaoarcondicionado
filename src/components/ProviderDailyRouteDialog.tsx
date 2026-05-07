import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, Utensils, CheckCircle, Clock, FileDown, Send, CheckCircle2, XCircle, DollarSign, UserCheck, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { ServiceProvider } from './ServiceProvidersTab';

interface ProviderDailyRouteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ServiceProvider | null;
  allAppointments: any[];
}

export default function ProviderDailyRouteDialog({ isOpen, onOpenChange, provider, allAppointments }: ProviderDailyRouteDialogProps) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<Record<string, string>>({}); // id -> status
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');
  const [diaria, setDiaria] = useState('');
  const [motorista, setMotorista] = useState('');

  // Get today's appointments for this provider
  const todaysAppointments = (allAppointments || []).filter(a => {
    if (!provider) return false;
    const isProv = a.notes?.includes(`[PRESTADOR:${provider.name}]`);
    const date = a.appointment_date ? new Date(a.appointment_date) : null;
    return isProv && date && isToday(date);
  });

  // Pre-fill default allowances when dialog opens
  useEffect(() => {
    if (isOpen && provider) {
      setCombustivel(provider.fuel_allowance ? String(provider.fuel_allowance) : '');
      setAlimentacao(provider.food_allowance ? String(provider.food_allowance) : '');
      setDiaria(provider.daily_rate ? String(provider.daily_rate) : '');
      setMotorista(provider.driver_cost ? String(provider.driver_cost) : '');
      
      const initialStatus: Record<string, string> = {};
      todaysAppointments.forEach(a => {
        initialStatus[a.id] = a.status === 'concluido' ? 'concluido' : 'concluido';
      });
      setSelectedAppointments(initialStatus);
    }
  }, [isOpen, provider]);

  const registerClosingAuditMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !provider) throw new Error('Dados incompletos');

      const completedIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'concluido');
      const canceledIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'cancelado');
      const rescheduledIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'pendente');

      const completedAppts = todaysAppointments.filter(a => completedIds.includes(a.id));
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Record Expenses (Outflow)
      const expenses = [
        { cat: 'Combustível', val: parseFloat(combustivel) },
        { cat: 'Alimentação', val: parseFloat(alimentacao) },
        { cat: 'Diária', val: parseFloat(diaria) },
        { cat: 'Motorista', val: parseFloat(motorista) }
      ].filter(e => e.val > 0);

      for (const exp of expenses) {
        await recordFinancialEntry({
          userId: session.user.id,
          type: 'saída',
          amount: exp.val,
          description: `FECHAMENTO ROTA: ${provider.name} - ${exp.cat}`,
          paymentMethod: 'Dinheiro',
          category: exp.cat,
          providerName: provider.name
        });
      }

      // 2. Update Appointment Statuses
      if (completedIds.length > 0) await supabase.from('appointments').update({ status: 'concluido' }).in('id', completedIds);
      if (canceledIds.length > 0) await supabase.from('appointments').update({ status: 'cancelado' }).in('id', canceledIds);
      if (rescheduledIds.length > 0) await supabase.from('appointments').update({ status: 'agendado' }).in('id', rescheduledIds);

      // 3. Revenue Recognition (Inflow)
      let totalRevenue = 0;
      for (const apt of completedAppts) {
        let price = Number(apt.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1]) || Number(apt.products?.price) || 0;
        totalRevenue += price;
        
        // Create individual sale records for better tracking
        await supabase.from('sales').insert({
          user_id: session.user.id,
          client_id: apt.client_id,
          service_id: apt.service_id,
          amount: price,
          sale_date: todayStr,
          status: 'concluido',
          payment_method: 'Dinheiro',
          notes: `Auditado via Rota: ${provider.name}`
        });
      }

      if (totalRevenue > 0) {
        await recordFinancialEntry({
          userId: session.user.id,
          type: 'entrada',
          amount: totalRevenue,
          description: `RECEITA ROTA: ${provider.name} (${completedAppts.length} serv)`,
          paymentMethod: 'Dinheiro',
          category: 'Serviços',
          providerName: provider.name
        });
      }
    },
    onSuccess: () => {
      toast.success('Auditoria finalizada e financeiro atualizado!');
      queryClient.invalidateQueries({ queryKey: ['route-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['financial_records'] });
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error.message)
  });

  const totals = useMemo(() => {
    let revenue = 0;
    Object.entries(selectedAppointments).forEach(([id, status]) => {
      if (status !== 'concluido') return;
      const apt = todaysAppointments.find(a => a.id === id);
      if (apt) revenue += Number(apt.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1]) || Number(apt.products?.price) || 0;
    });
    const exp = (parseFloat(combustivel) || 0) + (parseFloat(alimentacao) || 0) + (parseFloat(diaria) || 0) + (parseFloat(motorista) || 0);
    return { revenue, expenses: exp, net: revenue - exp };
  }, [selectedAppointments, todaysAppointments, combustivel, alimentacao, diaria, motorista]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-[#0B1120] border-white/10 text-white p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-white/5">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Auditoria de Retorno</DialogTitle>
            </div>
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-black px-2 py-1 uppercase text-[10px]">
              {todaysAppointments.length} Serviços em Rota
            </Badge>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{provider?.name} • {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-8 custom-scrollbar">
          {/* Step 1: Services Check */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <ListTodo className="w-3 h-3" /> 1. CONFERÊNCIA DE SERVIÇOS
            </h3>
            
            <div className="space-y-2">
              {todaysAppointments.map(apt => (
                <div key={apt.id} className={`p-4 rounded-2xl border transition-all ${selectedAppointments[apt.id] === 'concluido' ? 'bg-green-500/5 border-green-500/20 shadow-lg shadow-green-500/5' : 'bg-white/5 border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-white truncate">{apt.clients?.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-blue-500" /> {format(parseISO(apt.appointment_date), 'HH:mm')} • {apt.products?.name}
                      </p>
                      <p className="text-xs font-black text-green-500 mt-2">
                        R$ {(Number(apt.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1]) || Number(apt.products?.price) || 0).toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
                        {[
                          { id: 'concluido', icon: CheckCircle2, color: 'text-green-500', label: 'OK' },
                          { id: 'cancelado', icon: XCircle, color: 'text-red-500', label: 'CANC' },
                          { id: 'pendente', icon: AlertTriangle, color: 'text-amber-500', label: 'ADIA' }
                        ].map(st => (
                          <button
                            key={st.id}
                            onClick={() => setSelectedAppointments(prev => ({ ...prev, [apt.id]: st.id }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${selectedAppointments[apt.id] === st.id ? `bg-white/10 ${st.color} shadow-sm` : 'text-slate-500 hover:text-white'}`}
                          >
                            <st.icon className="w-3 h-3" /> {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Step 2: Expenses Check */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> 2. CONFERÊNCIA DE GASTOS
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'fuel', label: 'Combustível', value: combustivel, setter: setCombustivel, icon: Car, color: 'text-orange-500' },
                { id: 'food', label: 'Alimentação', value: alimentacao, setter: setAlimentacao, icon: Utensils, color: 'text-amber-500' },
                { id: 'daily', label: 'Diária', value: diaria, setter: setDiaria, icon: DollarSign, color: 'text-blue-500' },
                { id: 'driver', label: 'Motorista', value: motorista, setter: setMotorista, icon: UserCheck, color: 'text-indigo-500' }
              ].map(field => (
                <div key={field.id} className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5 ml-1">
                    <field.icon className={`w-3 h-3 ${field.color}`} /> {field.label}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-500 text-xs font-black">R$</span>
                    <Input 
                      type="number" 
                      value={field.value} 
                      onChange={e => field.setter(e.target.value)} 
                      className="op-input pl-8 h-10 font-black text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Step 3: Financial Summary */}
          <div className="bg-[#111827] border border-blue-500/20 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
            <div className="relative z-10 flex justify-between items-end">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Resultado da Rota</p>
                  <p className={`text-4xl font-black ${totals.net >= 0 ? 'text-white' : 'text-red-500'}`}>
                    R$ {totals.net.toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-[9px] font-black text-green-500/60 uppercase mb-0.5">Receita Bruta</p>
                    <p className="text-sm font-black text-green-500">R$ {totals.revenue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-red-500/60 uppercase mb-0.5">Custos Totais</p>
                    <p className="text-sm font-black text-red-500">R$ {totals.expenses.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-2">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Lucratividade</p>
                  <p className="text-xl font-black text-white">{totals.revenue > 0 ? ((totals.net / totals.revenue) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-white/5 border-t border-white/5 flex gap-3 sm:gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 font-black uppercase text-xs hover:text-white">Cancelar</Button>
          <Button 
            onClick={() => registerClosingAuditMutation.mutate()}
            disabled={registerClosingAuditMutation.isPending}
            className="op-btn-primary flex-1 h-12 font-black uppercase tracking-widest text-xs"
          >
            {registerClosingAuditMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Confirmar e Liquidar Financeiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper icons
const ListTodo = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /><path d="M8 18h8" /><path d="M8 6h8" /></svg>;
const RefreshCw = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>;
