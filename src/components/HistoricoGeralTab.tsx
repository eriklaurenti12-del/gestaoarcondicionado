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
import { Search, FileDown, History, Calendar, DollarSign, Users, CheckCircle, ClipboardList, ShoppingCart, FileText, RefreshCw, AlertTriangle, Clock, TrendingUp, MessageSquare, MapPin, Phone } from 'lucide-react';
import { format, parseISO, addMonths, isPast, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import TabGuideCards from './TabGuideCards';
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
}

export default function HistoricoGeralTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selectedClientHistory, setSelectedClientHistory] = useState<any>(null);
  const [renewingItem, setRenewingItem] = useState<HistoryItem | null>(null);
  const [renewDate, setRenewDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      
      const { error } = await supabase.from('appointments').insert({
        user_id: session.user.id,
        client_id: vars.clientId,
        service_id: vars.serviceId,
        appointment_date: vars.date,
        status: 'agendado',
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
        type: 'venda', // We'll use a specific badge for expenses
        description: `⛽ Gasto de Rota: ${e.description || e.category}`,
        value: -Number(e.amount || 0),
        status: 'pago',
        provider: e.helper_name,
      });
    });

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [appointments, sales, quotes, productMap]);

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
    return {
      total: filtered.length,
      agendamentos: agendamentos.length,
      concluidos: agendamentos.filter(a => a.status === 'concluido').length,
      vendas: vendas.length,
      totalVendas: vendas.reduce((s, v) => s + v.value, 0),
      totalProfit: vendas.reduce((s, v) => s + (v.profit || 0), 0),
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

  const getHistoryItemBadge = (item: HistoryItem) => {
    if (item.value < 0) return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"><Fuel className="w-3 h-3 mr-1" />Gasto</Badge>;
    return getTypeBadge(item.type);
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
              <span className="text-xs font-medium text-muted-foreground">Vendas (Faturado)</span>
            </div>
            <p className="text-xl font-bold text-green-500">R$ {stats.totalVendas.toFixed(2)}</p>
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
              <TrendingUp className="w-3 h-3" />
              Lucro: R$ {stats.totalProfit.toFixed(2)}
            </div>
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
              <span className="text-xs font-medium text-muted-foreground">Total Itens</span>
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
            <div className="flex items-center gap-2 px-2 bg-muted/50 rounded-lg border h-10">
              <Checkbox 
                id="showAllMonths" 
                checked={showAllMonths} 
                onCheckedChange={(checked) => setShowAllMonths(!!checked)}
              />
              <Label htmlFor="showAllMonths" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                Exibir Tudo
              </Label>
            </div>
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
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 pb-16">
              {filtered.map(item => {
                const expirationDate = item.warrantyMonths && item.warrantyMonths > 0 
                  ? addMonths(new Date(item.date), item.warrantyMonths) 
                  : null;
                const isExpired = expirationDate && isPast(expirationDate);
                const isNearing = expirationDate && isBefore(expirationDate, addDays(new Date(), 15)) && !isExpired;

                return (
                  <div key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border transition-colors hover:bg-muted/30`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {getHistoryItemBadge(item)}
                      <div className="min-w-0" onClick={() => item.clientObj?.id && setSelectedClientHistory(item.clientObj)}>
                        <p className="font-medium text-sm truncate hover:underline cursor-pointer">{item.client}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        
                        {expirationDate && (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                Realizado em: {format(new Date(item.date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3 h-3 ${isExpired ? 'text-red-500' : isNearing ? 'text-amber-500' : 'text-green-500'}`} />
                              <span className={`text-[10px] font-bold ${isExpired ? 'text-red-500' : isNearing ? 'text-amber-500' : 'text-green-500'}`}>
                                Próxima Manutenção: {format(expirationDate, 'dd/MM/yyyy')}
                                {isExpired ? ' (VENCIDO)' : isNearing ? ' (Vence em breve)' : ' (Garantia Ativa)'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2 mr-2">
                        {item.provider && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            <Users className="w-2.5 h-2.5 mr-1" />{item.provider}
                          </Badge>
                        )}
                        {item.value > 0 && (
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-xs text-green-600">
                              R$ {item.value.toFixed(2)}
                            </span>
                            {item.profit !== undefined && item.profit > 0 && (
                              <span className="text-[9px] text-green-500/80 font-medium">
                                + R$ {item.profit.toFixed(2)} lucro
                              </span>
                            )}
                          </div>
                        )}
                        {getStatusBadge(item.status)}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.date), 'dd/MM/yy')}
                        </span>
                      </div>
                      
                      {/* Connectivity Buttons */}
                      <div className="flex items-center gap-1">
                        {item.clientObj?.telefone && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              const phone = item.clientObj.telefone.replace(/\D/g, '');
                              window.open(`https://wa.me/55${phone}`, '_blank');
                            }}
                            title="Chamar no WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        )}
                        {item.clientObj?.address && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.clientObj.address)}`, '_blank');
                            }}
                            title="Ver no Google Maps"
                          >
                            <MapPin className="w-4 h-4" />
                          </Button>
                        )}
                        {item.type === 'agendamento' && item.status === 'concluido' && (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 gap-1 text-[10px] border-amber-200 bg-amber-50/30 hover:bg-amber-100 text-amber-700"
                              onClick={() => {
                                setRenewingItem(item);
                                if (item.warrantyMonths) {
                                  setRenewDate(format(addMonths(new Date(item.date), item.warrantyMonths), 'yyyy-MM-dd'));
                                }
                              }}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Renovar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 gap-1 text-[10px] border-blue-200 bg-blue-50/30 hover:bg-blue-100 text-blue-700"
                              onClick={() => {
                                const doc = new jsPDF();
                                doc.setFontSize(18);
                                doc.text("RECIBO DE SERVIÇO", 105, 20, { align: 'center' });
                                doc.setFontSize(12);
                                doc.text(`Cliente: ${item.client}`, 20, 40);
                                doc.text(`Serviço: ${item.description}`, 20, 50);
                                doc.text(`Data: ${format(new Date(item.date), 'dd/MM/yyyy')}`, 20, 60);
                                if (expirationDate) {
                                  doc.text(`Próxima Manutenção: ${format(expirationDate, 'dd/MM/yyyy')}`, 20, 70);
                                }
                                doc.text(`Valor: R$ ${item.value.toFixed(2)}`, 20, 80);
                                doc.line(20, 100, 190, 100);
                                doc.text("Assinatura do Prestador", 105, 110, { align: 'center' });
                                doc.save(`recibo-${item.client.replace(/\s/g, '-')}.pdf`);
                                toast.success("Recibo gerado com sucesso!");
                              }}
                            >
                              <FileDown className="w-3 h-3" />
                              Recibo
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal Dialog */}
      <Dialog open={!!renewingItem} onOpenChange={(open) => !open && setRenewingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RefreshCw className="w-5 h-5" />
              Renovação de Manutenção
            </DialogTitle>
            <DialogDescription>
              Agende uma nova manutenção para {renewingItem?.client} referente ao serviço: {renewingItem?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-bold">Atenção</p>
                <p>A renovação criará um novo agendamento na agenda para a data escolhida abaixo.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Próxima Manutenção</Label>
                <Input type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={renewTime} onChange={e => setRenewTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Manutenção</Label>
              <Select defaultValue="preventiva">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventiva">🔧 Preventiva (Recorrência)</SelectItem>
                  <SelectItem value="corretiva">🛠️ Corretiva / Refazer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewingItem(null)}>Cancelar</Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700"
              disabled={renewMutation.isPending}
              onClick={() => {
                if (!renewingItem || !renewingItem.clientObj?.id || !renewingItem.serviceId) return;
                
                renewMutation.mutate({
                  clientId: renewingItem.clientObj.id,
                  serviceId: renewingItem.serviceId,
                  date: `${renewDate}T${renewTime}:00`,
                  notes: `[RENOVAÇÃO] Manutenção baseada no serviço realizado em ${format(new Date(renewingItem.date), 'dd/MM/yyyy')}`
                });
              }}
            >
              {renewMutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
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
