import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';
import { Search, FileDown, History, Calendar, DollarSign, Users, CheckCircle, ClipboardList, ShoppingCart, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import TabGuideCards from './TabGuideCards';

interface HistoryItem {
  id: string;
  date: string;
  client: string;
  type: 'agendamento' | 'venda' | 'orcamento';
  description: string;
  value: number;
  status: string;
  provider?: string;
}

export default function HistoricoGeralTab() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: appointments, isLoading: loadAppts } = useQuery({
    queryKey: ['hist-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments')
        .select('*, clients(name)').order('appointment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sales, isLoading: loadSales } = useQuery({
    queryKey: ['hist-sales'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales')
        .select('*, clients(name)').order('sale_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: quotes, isLoading: loadQuotes } = useQuery({
    queryKey: ['hist-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes')
        .select('*, clients(name)').order('created_at', { ascending: false });
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

  const isLoading = loadAppts || loadSales || loadQuotes;
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
        date: a.appointment_date,
        client: a.clients?.name || 'Cliente removido',
        type: 'agendamento',
        description: productMap[a.service_id] || 'Serviço',
        value: 0,
        status: a.status,
        provider: extractProvider(a.notes),
      });
    });

    (sales || []).forEach((s: any) => {
      items.push({
        id: `s-${s.id}`,
        date: s.sale_date || s.created_at,
        client: s.clients?.name || s.client_name || 'Consumidor',
        type: 'venda',
        description: `Venda #${s.id}`,
        value: Number(s.total || 0),
        status: s.payment_method || 'pago',
      });
    });

    (quotes || []).forEach((q: any) => {
      items.push({
        id: `q-${q.id}`,
        date: q.created_at,
        client: q.clients?.name || 'Cliente removido',
        type: 'orcamento',
        description: q.title || 'Orçamento',
        value: Number(q.total || 0),
        status: q.status,
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [appointments, sales, quotes, productMap]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const dateStr = item.date?.split('T')[0] || '';
      const monthMatch = dateStr.startsWith(filterMonth);
      const typeMatch = filterType === 'all' || item.type === filterType;
      const searchMatch = search === '' ||
        item.client.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.provider || '').toLowerCase().includes(search.toLowerCase());
      return monthMatch && typeMatch && searchMatch;
    });
  }, [allItems, filterMonth, filterType, search]);

  const stats = useMemo(() => {
    const agendamentos = filtered.filter(i => i.type === 'agendamento');
    const vendas = filtered.filter(i => i.type === 'venda');
    const orcamentos = filtered.filter(i => i.type === 'orcamento');
    return {
      total: filtered.length,
      agendamentos: agendamentos.length,
      concluidos: agendamentos.filter(a => a.status === 'concluido').length,
      vendas: vendas.length,
      totalVendas: vendas.reduce((s, v) => s + v.value, 0),
      orcamentos: orcamentos.length,
      totalOrcamentos: orcamentos.reduce((s, o) => s + o.value, 0),
    };
  }, [filtered]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'agendamento': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"><Calendar className="w-3 h-3 mr-1" />Agenda</Badge>;
      case 'venda': return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"><ShoppingCart className="w-3 h-3 mr-1" />PDV</Badge>;
      case 'orcamento': return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"><FileText className="w-3 h-3 mr-1" />Orçamento</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      concluido: 'bg-green-100 text-green-700', pendente: 'bg-amber-100 text-amber-700',
      agendado: 'bg-blue-100 text-blue-700', cancelado: 'bg-red-100 text-red-700',
      aprovado: 'bg-green-100 text-green-700', rascunho: 'bg-gray-100 text-gray-700',
      pago: 'bg-green-100 text-green-700',
    };
    return <Badge className={map[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Histórico Geral de Serviços', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const [yr, mo] = filterMonth.split('-').map(Number);
    doc.text(`${format(new Date(yr, mo - 1, 1), 'MMMM yyyy', { locale: ptBR })} — ${filtered.length} registros`, 14, 32);

    autoTable(doc, {
      startY: 48,
      head: [['Data', 'Tipo', 'Cliente', 'Descrição', 'Valor', 'Status', 'Prestador']],
      body: filtered.map(i => [
        format(new Date(i.date), 'dd/MM/yy HH:mm'),
        i.type === 'agendamento' ? 'Agenda' : i.type === 'venda' ? 'PDV' : 'Orçamento',
        i.client, i.description,
        i.value > 0 ? `R$ ${i.value.toFixed(2)}` : '-',
        i.status, i.provider || '-',
      ]),
      headStyles: { fillColor: [24, 24, 27] },
      styles: { fontSize: 8 },
    });

    doc.save(`historico-${filterMonth}.pdf`);
    toast.success('PDF exportado!');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <TabGuideCards cards={[
        {
          icon: History,
          title: 'Histórico Completo',
          badge: 'Visão Geral',
          badgeColor: 'blue',
          description: <>Todos os <strong>serviços, vendas e orçamentos</strong> em um só lugar. Filtre por mês, tipo ou cliente.</>,
        },
      ]} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Agendamentos</span>
            </div>
            <p className="text-xl font-bold text-blue-500">{stats.agendamentos}</p>
            <p className="text-[10px] text-muted-foreground">{stats.concluidos} concluído(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Vendas PDV</span>
            </div>
            <p className="text-xl font-bold text-green-500">{stats.vendas}</p>
            <p className="text-[10px] text-muted-foreground">R$ {stats.totalVendas.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Orçamentos</span>
            </div>
            <p className="text-xl font-bold text-purple-500">{stats.orcamentos}</p>
            <p className="text-[10px] text-muted-foreground">R$ {stats.totalOrcamentos.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-amber-500">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Serviços
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileDown className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente, descrição, prestador..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="w-[150px]" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendamento">Agendamentos</SelectItem>
                <SelectItem value="venda">Vendas PDV</SelectItem>
                <SelectItem value="orcamento">Orçamentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum registro encontrado</p>
              <p className="text-sm mt-1">Ajuste os filtros ou selecione outro mês</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map(item => (
                <div key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {getTypeBadge(item.type)}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.client}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {item.provider && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />{item.provider}
                      </Badge>
                    )}
                    {item.value > 0 && (
                      <span className="font-semibold text-sm text-green-600">
                        R$ {item.value.toFixed(2)}
                      </span>
                    )}
                    {getStatusBadge(item.status)}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(item.date), 'dd/MM/yy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
