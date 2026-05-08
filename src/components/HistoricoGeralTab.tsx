import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Search, FileDown, History, Calendar, DollarSign, Users, CheckCircle, ClipboardList, ShoppingCart, FileText, RefreshCw, AlertTriangle, Clock, TrendingUp, MessageSquare, Fuel, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { format, parseISO, addMonths, isPast, isBefore, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ClientHistoryDialog from './ClientHistoryDialog';

interface HistoryItem {
  id: string;
  dbId: string | number;
  date: string;
  client: string;
  clientObj?: any;
  type: 'agendamento' | 'venda' | 'orcamento';
  description: string;
  value: number;
  status: string;
  provider?: string;
  serviceId?: number;
  warrantyMonths?: number;
  profit?: number;
  isRecurring?: boolean;
}

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

export default function HistoricoGeralTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(safeFormat(new Date(), 'yyyy-MM'));
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selectedClientHistory, setSelectedClientHistory] = useState<any>(null);
  const [renewingItem, setRenewingItem] = useState<HistoryItem | null>(null);
  const [renewDate, setRenewDate] = useState(safeFormat(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [renewTime, setRenewTime] = useState("08:00");

  const { data: appointments, isLoading: loadAppts } = useQuery({
    queryKey: ['hist-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments')
        .select('*, clients(id, name, telefone, address), products(id, name, warranty_months)')
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sales, isLoading: loadSales } = useQuery({
    queryKey: ['hist-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('*, clients(id, name, telefone, preferences), products(name, type)')
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: quotes, isLoading: loadQuotes } = useQuery({
    queryKey: ['hist-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes')
        .select('*, clients(id, name, telefone, preferences)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: fixedExpenses, isLoading: loadExpenses } = useQuery({
    queryKey: ['hist-fixed-expenses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['hist-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name');
      if (error) throw error;
      return data || [];
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (vars: { clientId: number; serviceId: number; date: string; notes: string }) => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) throw new Error("Não autenticado");
      
      const { error } = await supabase.from('appointments').insert({
        user_id: session.user.id,
        client_id: vars.clientId,
        service_id: vars.serviceId,
        appointment_date: vars.date,
        status: 'pendente',
        notes: vars.notes
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['hist-appointments'] });
      toast.success("Renovação agendada com sucesso!");
      setRenewingItem(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao renovar: " + error.message);
    }
  });

  const isLoading = loadAppts || loadSales || loadQuotes || loadExpenses;
  const productMap = useMemo(() => {
    const m: Record<number, string> = {};
    (products || []).forEach((p: any) => { m[p.id] = p.name; });
    return m;
  }, [products]);

  const extractProvider = (notes: string | null) => {
    if (!notes) return undefined;
    const match = notes.match(/\[PRESTADOR:(.+?)\]/);
    return match?.[1];
  };

  const allItems: HistoryItem[] = useMemo(() => {
    const items: HistoryItem[] = [];

    (appointments || []).forEach((a: any) => {
      items.push({
        id: `a-${a.id}`,
        dbId: a.id,
        date: a.appointment_date,
        client: a.clients?.name || 'Cliente removido',
        clientObj: a.clients,
        type: 'agendamento',
        description: productMap[a.service_id] || 'Serviço',
        value: 0,
        status: a.status,
        provider: extractProvider(a.notes),
        serviceId: a.service_id,
        warrantyMonths: a.products?.warranty_months || 0,
        isRecurring: !!(a.products?.warranty_months && a.products.warranty_months > 0),
      });
    });

    (sales || []).forEach((s: any) => {
      const isService = s.products?.type === 'service';
      items.push({
        id: `s-${s.id}`,
        dbId: s.id,
        date: s.sale_date || s.created_at,
        client: s.clients?.name || s.client_name || 'Consumidor',
        clientObj: s.clients,
        type: 'venda',
        description: `${isService ? '🛠️ Serviço' : '📦 Produto'}: ${s.products?.name || `Venda #${s.id}`}`,
        value: Number(s.sale_price || 0) * (s.qty || 1),
        status: s.payment_method || 'pago',
        profit: Number(s.total_profit || 0),
      });
    });

    (quotes || []).forEach((q: any) => {
      items.push({
        id: `q-${q.id}`,
        dbId: q.id,
        date: q.created_at,
        client: q.clients?.name || 'Cliente removido',
        clientObj: q.clients,
        type: 'orcamento',
        description: q.title || 'Orçamento',
        value: Number(q.total || 0),
        status: q.status,
      });
    });

    (fixedExpenses || []).forEach((e: any) => {
      items.push({
        id: `e-${e.id}`,
        dbId: e.id,
        date: e.expense_date,
        client: e.helper_name || 'Gasto Geral',
        type: 'venda', 
        description: `⛽ Gasto: ${e.description || e.category}`,
        value: -Number(e.amount || 0),
        status: 'pago',
        provider: e.helper_name,
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [appointments, sales, quotes, fixedExpenses, productMap]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const dateStr = item.date?.split('T')[0] || '';
      const monthMatch = showAllMonths || dateStr.startsWith(filterMonth);
      const typeMatch = filterType === 'all' || item.type === filterType;
      const searchMatch = search === '' ||
        item.client.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.provider || '').toLowerCase().includes(search.toLowerCase());
      return monthMatch && typeMatch && searchMatch;
    });
  }, [allItems, filterMonth, showAllMonths, filterType, search]);

  const stats = useMemo(() => {
    const agendamentos = filtered.filter(i => i.type === 'agendamento');
    const vendas = filtered.filter(i => i.type === 'venda');
    const orcamentos = filtered.filter(i => i.type === 'orcamento');
    const expenses = filtered.filter(i => i.value < 0);
    
    return {
      total: filtered.length,
      agendamentos: agendamentos.length,
      concluidos: agendamentos.filter(a => a.status === 'concluido').length,
      vendas: vendas.length,
      revenue: vendas.filter(v => v.value > 0).reduce((s, v) => s + v.value, 0),
      expenses: Math.abs(expenses.reduce((s, e) => s + e.value, 0)),
      totalProfit: vendas.reduce((s, v) => s + (v.profit || 0), 0),
      orcamentos: orcamentos.length,
      totalOrcamentos: orcamentos.reduce((s, o) => s + o.value, 0),
    };
  }, [filtered]);

  // Próximos Vencimentos por Cliente — usa último serviço CONCLUÍDO + warranty_months
  const upcomingByClient = useMemo(() => {
    const map = new Map<string, { client: string; clientObj?: any; service: string; lastDate: string; dueDate: Date; months: number; phone?: string }>();
    (appointments || []).forEach((a: any) => {
      if (a.status !== 'concluido') return;
      const months = a.products?.warranty_months || 0;
      if (months <= 0) return;
      const clientName = a.clients?.name || '—';
      const due = addMonths(new Date(a.appointment_date), months);
      const existing = map.get(clientName);
      // Mantém o serviço mais recente por cliente
      if (!existing || new Date(a.appointment_date) > new Date(existing.lastDate)) {
        map.set(clientName, {
          client: clientName,
          clientObj: a.clients,
          service: a.products?.name || 'Serviço',
          lastDate: a.appointment_date,
          dueDate: due,
          months,
          phone: a.clients?.telefone,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [appointments]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pendente: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      confirmado: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      concluido: 'bg-green-500/10 text-green-500 border-green-500/20',
      cancelado: 'bg-red-500/10 text-red-500 border-red-500/20',
      aprovado: 'bg-green-500/10 text-green-500 border-green-500/20',
      pago: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
    return (
      <Badge variant="outline" className={`${map[status] || 'bg-white/5 text-slate-400 border-white/10'} text-[9px] font-black uppercase tracking-tight`}>
        {status}
      </Badge>
    );
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRATO OPERACIONAL - HISTÓRICO', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${showAllMonths ? 'Todo o Período' : filterMonth} — ${filtered.length} registros`, 14, 32);

    autoTable(doc, {
      startY: 48,
      head: [['Data', 'Tipo', 'Cliente', 'Descrição', 'Valor', 'Status', 'Prestador']],
      body: filtered.map(i => [
        safeFormat(i.date, 'dd/MM/yy HH:mm'),
        i.type === 'agendamento' ? 'Agenda' : i.type === 'venda' ? 'PDV' : 'Orçamento',
        i.client, i.description,
        i.value !== 0 ? `R$ ${i.value.toFixed(2)}` : '-',
        i.status, i.provider || '-',
      ]),
      headStyles: { fillColor: [11, 17, 32] },
      styles: { fontSize: 8 },
    });

    doc.save(`historico-gestao-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Premium Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="op-card p-6 bg-gradient-to-br from-blue-600/10 to-transparent">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <Badge variant="outline" className="border-blue-500/30 text-blue-500 text-[10px] font-black">AGENDA</Badge>
          </div>
          <p className="text-3xl font-black text-white">{stats.agendamentos}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Serviços Totais</p>
          <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(stats.concluidos / (stats.agendamentos || 1)) * 100}%` }} />
          </div>
          <p className="text-[10px] text-blue-400 font-black mt-2 uppercase">{stats.concluidos} CONCLUÍDOS</p>
        </div>

        <div className="op-card p-6 bg-gradient-to-br from-green-600/10 to-transparent">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-500/10 rounded-2xl border border-green-500/20">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px] font-black">RECURSOS</Badge>
          </div>
          <p className="text-3xl font-black text-white">R$ {stats.revenue.toFixed(2)}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Receita Bruta</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-black text-green-500 uppercase tracking-widest">
            <TrendingUp className="w-3 h-3" />
            Margem: R$ {stats.totalProfit.toFixed(2)}
          </div>
        </div>

        <div className="op-card p-6 bg-gradient-to-br from-red-600/10 to-transparent">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
              <Fuel className="w-5 h-5 text-red-500" />
            </div>
            <Badge variant="outline" className="border-red-500/30 text-red-500 text-[10px] font-black">CUSTOS</Badge>
          </div>
          <p className="text-3xl font-black text-white">R$ {stats.expenses.toFixed(2)}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Despesas Operacionais</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] font-black text-red-500 uppercase tracking-widest">
            <ArrowDownRight className="w-3 h-3" />
            Saída de Caixa
          </div>
        </div>

        <div className="op-card p-6 bg-gradient-to-br from-purple-600/10 to-transparent">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <Badge variant="outline" className="border-purple-500/30 text-purple-500 text-[10px] font-black">NEGÓCIOS</Badge>
          </div>
          <p className="text-3xl font-black text-white">{stats.orcamentos}</p>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Orçamentos Gerados</p>
          <p className="text-[10px] text-purple-400 font-black mt-4 uppercase">R$ {stats.totalOrcamentos.toFixed(2)} EM PROSPECÇÃO</p>
        </div>
      </div>

      {/* Próximos Vencimentos por Cliente */}
      {upcomingByClient.length > 0 && (
        <div className="op-card">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Próximos Vencimentos por Cliente</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Calculado a partir do último serviço + prazo de validade</p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500/30 text-amber-500 text-[10px] font-black">{upcomingByClient.length} CLIENTES</Badge>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto">
            {upcomingByClient.map((u, idx) => {
              const expired = isPast(u.dueDate);
              const nearing = !expired && isBefore(u.dueDate, addDays(new Date(), 30));
              const tone = expired ? 'border-red-500/30 bg-red-500/5' : nearing ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]';
              const dot = expired ? 'text-red-500' : nearing ? 'text-amber-500' : 'text-green-500';
              return (
                <div key={idx} className={`p-4 rounded-2xl border ${tone} hover:border-white/20 transition cursor-pointer`} onClick={() => u.clientObj?.id && setSelectedClientHistory(u.clientObj)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-black text-white truncate">{u.client}</span>
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${dot}`} />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase truncate mb-2">{u.service}</p>
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                    <span className="text-slate-500">Último: {safeFormat(u.lastDate, 'dd/MM/yy')}</span>
                    <span className={dot}>
                      {expired ? 'Vencido' : 'Vence'} {safeFormat(u.dueDate, 'dd/MM/yy')}
                    </span>
                  </div>
                  {u.phone && (
                    <Button size="sm" variant="ghost" className="w-full mt-3 h-8 bg-green-500/5 hover:bg-green-500/10 text-green-500 text-[10px] font-black uppercase gap-1" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${u.phone!.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${u.client}, está chegando a hora da próxima manutenção do seu serviço (${u.service}). Vamos agendar?`)}`, '_blank'); }}>
                      <MessageSquare className="w-3 h-3" /> Lembrar via WhatsApp
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Ledger Control */}
      <div className="op-card">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Livro de Histórico</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Registro Unificado de Operações</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Filtrar por cliente, técnico ou serviço..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="op-input pl-9 w-full md:w-[300px] h-10 text-xs font-black"
              />
            </div>
            <Button variant="outline" onClick={exportPDF} className="h-10 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black uppercase gap-2">
              <FileDown className="w-4 h-4 text-blue-500" /> EXPORTAR
            </Button>
          </div>
        </div>

        <div className="p-4 bg-white/5 border-b border-white/5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tipo:</span>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] h-8 bg-black/40 border-white/10 text-[10px] font-black uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0B1120] border-white/10">
                <SelectItem value="all">TODOS</SelectItem>
                <SelectItem value="agendamento">AGENDAMENTOS</SelectItem>
                <SelectItem value="venda">VENDAS PDV</SelectItem>
                <SelectItem value="orcamento">ORÇAMENTOS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl">
            <Checkbox 
              id="showAllMonths" 
              checked={showAllMonths} 
              onCheckedChange={(checked) => setShowAllMonths(!!checked)}
              className="w-3.5 h-3.5 border-white/20"
            />
            <Label htmlFor="showAllMonths" className="text-[9px] font-black text-slate-300 uppercase cursor-pointer tracking-wider">Exibir Histórico Completo</Label>
          </div>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full bg-white/5 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center">
              <History className="w-16 h-16 mx-auto mb-4 text-slate-700 opacity-20" />
              <p className="text-lg font-black text-slate-400 uppercase tracking-widest">Nada encontrado</p>
              <p className="text-xs text-slate-600 font-bold uppercase mt-1">Ajuste os filtros de busca</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Data / Hora</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Cliente / Operação</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Técnico / Responsável</th>
                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest">Valor Líquido</th>
                    <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(item => {
                    const expirationDate = item.warrantyMonths && item.warrantyMonths > 0 
                      ? addMonths(new Date(item.date), item.warrantyMonths) 
                      : null;
                    const isExpired = expirationDate && isPast(expirationDate);
                    const isNearing = expirationDate && isBefore(expirationDate, addDays(new Date(), 15)) && !isExpired;

                    return (
                      <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-white">{safeFormat(item.date, 'dd/MM/yyyy')}</span>
                            <span className="text-[10px] text-slate-500 font-bold">{safeFormat(item.date, 'HH:mm')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white hover:text-primary cursor-pointer transition-colors" onClick={() => item.clientObj?.id && setSelectedClientHistory(item.clientObj)}>
                                {item.client}
                              </span>
                              {item.isRecurring && (
                                <div className="p-1 bg-amber-500/10 rounded-lg" title="Serviço Recorrente">
                                  <Zap className="w-2.5 h-2.5 text-amber-500" />
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5 line-clamp-1">{item.description}</span>
                            {expirationDate && (
                              <div className={`flex items-center gap-1.5 mt-2 text-[9px] font-black uppercase ${isExpired ? 'text-red-500' : isNearing ? 'text-amber-500' : 'text-green-500'}`}>
                                <ShieldCheck className="w-3 h-3" />
                                Garantia até {safeFormat(expirationDate, 'dd/MM/yy')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {item.provider ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-primary border border-primary/20 uppercase">
                                {item.provider.charAt(0)}
                              </div>
                              <span className="text-xs font-black text-slate-300 uppercase">{item.provider}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">NÃO ATRIBUÍDO</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-col">
                            <span className={`text-sm font-black ${item.value < 0 ? 'text-red-500' : item.value > 0 ? 'text-green-500' : 'text-blue-500'}`}>
                              {item.value < 0 ? `- R$ ${Math.abs(item.value).toFixed(2)}` : 
                               item.value > 0 ? `R$ ${item.value.toFixed(2)}` : 'RESERVA'}
                            </span>
                            {item.profit && item.profit > 0 && (
                              <span className="text-[9px] text-green-500/60 font-bold uppercase">Lucro: R$ {item.profit.toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.clientObj?.telefone && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 rounded-xl" onClick={() => window.open(`https://wa.me/55${item.clientObj.telefone.replace(/\D/g, '')}`, '_blank')}>
                                <MessageSquare className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {item.type === 'agendamento' && item.status === 'concluido' && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl" onClick={() => setRenewingItem(item)}>
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Renewal Dialog */}
      <Dialog open={!!renewingItem} onOpenChange={(open) => !open && setRenewingItem(null)}>
        <DialogContent className="max-w-md bg-[#0B1120] border-white/10 text-white p-0 overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/5">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-amber-500">
              <Zap className="w-5 h-5" /> RE-AGENDAMENTO RECORRENTE
            </DialogTitle>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gerar nova ordem para {renewingItem?.client}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-200 font-bold uppercase leading-relaxed">
                Esta ação criará um novo agendamento preventivo baseado no serviço anterior: <span className="text-white underline">{renewingItem?.description}</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nova Data</Label>
                <Input type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} className="op-input font-black h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase ml-1">Horário</Label>
                <Input type="time" value={renewTime} onChange={e => setRenewTime(e.target.value)} className="op-input font-black h-11" />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-white/5 border-t border-white/5">
            <Button variant="ghost" onClick={() => setRenewingItem(null)} className="text-slate-400 font-black uppercase text-xs">Cancelar</Button>
            <Button 
              className="op-btn-primary h-12 px-6 font-black uppercase text-xs"
              disabled={renewMutation.isPending}
              onClick={() => {
                if (!renewingItem || !renewingItem.clientObj?.id || !renewingItem.serviceId) return;
                renewMutation.mutate({
                  clientId: renewingItem.clientObj.id,
                  serviceId: renewingItem.serviceId,
                  date: `${renewDate}T${renewTime}:00`,
                  notes: `[RECORRÊNCIA] Manutenção programada baseada no serviço de ${safeFormat(renewingItem.date, 'dd/MM/yyyy')}`
                });
              }}
            >
              {renewMutation.isPending ? "Processando..." : "Confirmar Novo Ciclo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientHistoryDialog 
        isOpen={!!selectedClientHistory}
        onOpenChange={(open) => !open && setSelectedClientHistory(null)}
        client={selectedClientHistory}
      />
    </div>
  );
}

// Extra Icons
const ShieldCheck = ({ className }: { className?: string }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>;
