import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { FileDown, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wrench, Package, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FinanceiroReportsTab: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ['report-sales', selectedMonth],
    queryFn: async () => {
      const startDate = startOfMonth(parseISO(selectedMonth + '-01'));
      const endDate = endOfMonth(startDate);
      
      const { data, error } = await supabase
        .from('sales')
        .select('*, clients(name), products(name, type, cost_price)')
        .gte('sale_date', startDate.toISOString())
        .lte('sale_date', endDate.toISOString())
        .order('sale_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: appointmentsData, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['report-appointments', selectedMonth],
    queryFn: async () => {
      const startDate = startOfMonth(parseISO(selectedMonth + '-01'));
      const endDate = endOfMonth(startDate);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name), products:service_id(name, price, cost_price)')
        .gte('appointment_date', startDate.toISOString())
        .lte('appointment_date', endDate.toISOString())
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
    queryKey: ['report-expenses', selectedMonth],
    queryFn: async () => {
      const startDate = startOfMonth(parseISO(selectedMonth + '-01'));
      const endDate = endOfMonth(startDate);
      
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .gte('expense_date', startDate.toISOString().split('T')[0])
        .lte('expense_date', endDate.toISOString().split('T')[0])
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const stats = useMemo(() => {
    const salesTotal = (salesData || []).reduce((sum, s) => sum + Number(s.sale_price) * s.qty, 0);
    const salesProfit = (salesData || []).reduce((sum, s) => sum + Number(s.total_profit), 0);
    const salesCount = salesData?.length || 0;

    const completedAppointments = (appointmentsData || []).filter(a => a.status === 'concluido' || a.status === 'concluído');
    const servicesTotal = completedAppointments.reduce((sum, a) => sum + Number((a as any).products?.price || 0), 0);
    const servicesCount = completedAppointments.length;

    const expensesTotal = (expensesData || []).reduce((sum, e) => sum + Number(e.amount), 0);

    const totalRevenue = salesTotal + servicesTotal;
    const netProfit = totalRevenue - expensesTotal;

    // Payment method breakdown
    const paymentBreakdown: Record<string, number> = {};
    (salesData || []).forEach(s => {
      const method = s.payment_method || 'Outro';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + Number(s.sale_price) * s.qty;
    });

    return {
      salesTotal, salesProfit, salesCount,
      servicesTotal, servicesCount,
      expensesTotal,
      totalRevenue, netProfit,
      paymentBreakdown,
      totalAppointments: appointmentsData?.length || 0,
      pendingAppointments: (appointmentsData || []).filter(a => a.status === 'agendado').length,
    };
  }, [salesData, appointmentsData, expensesData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const monthLabel = format(parseISO(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR });

  const exportFullReport = () => {
    const doc = new jsPDF();
    const title = `Relatório Completo - ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`;
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 28);

    // Summary
    doc.setFontSize(12);
    doc.text('Resumo Financeiro', 14, 40);
    autoTable(doc, {
      startY: 44,
      head: [['Descrição', 'Valor']],
      body: [
        ['Receita Total (Vendas + Serviços)', formatCurrency(stats.totalRevenue)],
        ['Vendas PDV', formatCurrency(stats.salesTotal)],
        ['Serviços Concluídos', formatCurrency(stats.servicesTotal)],
        ['Despesas', formatCurrency(stats.expensesTotal)],
        ['Lucro Líquido', formatCurrency(stats.netProfit)],
        ['Lucro das Vendas', formatCurrency(stats.salesProfit)],
      ],
      headStyles: { fillColor: [30, 100, 180] },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // Payment breakdown
    if (Object.keys(stats.paymentBreakdown).length > 0) {
      doc.text('Formas de Pagamento', 14, currentY);
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Método', 'Valor']],
        body: Object.entries(stats.paymentBreakdown).map(([method, value]) => [method, formatCurrency(value)]),
        headStyles: { fillColor: [30, 100, 180] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sales detail
    if (salesData && salesData.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.text('Detalhamento de Vendas (PDV)', 14, currentY);
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Data', 'Cliente', 'Produto', 'Qtd', 'Valor', 'Pagamento']],
        body: salesData.map(s => [
          format(new Date(s.sale_date), 'dd/MM/yy HH:mm'),
          (s as any).clients?.name || '-',
          (s as any).products?.name || '-',
          s.qty.toString(),
          formatCurrency(Number(s.sale_price) * s.qty),
          s.payment_method,
        ]),
        headStyles: { fillColor: [30, 100, 180] },
        styles: { fontSize: 8 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Expenses detail
    if (expensesData && expensesData.length > 0) {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.text('Detalhamento de Despesas', 14, currentY);
      autoTable(doc, {
        startY: currentY + 4,
        head: [['Data', 'Categoria', 'Descrição', 'Valor']],
        body: expensesData.map(e => [
          format(new Date(e.expense_date), 'dd/MM/yy'),
          e.category,
          e.description || '-',
          formatCurrency(Number(e.amount)),
        ]),
        headStyles: { fillColor: [30, 100, 180] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`relatorio-${selectedMonth}.pdf`);
  };

  const exportPDVHistory = () => {
    if (!salesData || salesData.length === 0) return;
    
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Histórico PDV - ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ${formatCurrency(stats.salesTotal)} | ${stats.salesCount} vendas | Lucro: ${formatCurrency(stats.salesProfit)}`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [['Data', 'Cliente', 'Produto', 'Qtd', 'Valor', 'Lucro', 'Pagamento']],
      body: salesData.map(s => [
        format(new Date(s.sale_date), 'dd/MM/yy HH:mm'),
        (s as any).clients?.name || 'Balcão',
        (s as any).products?.name || '-',
        s.qty.toString(),
        formatCurrency(Number(s.sale_price) * s.qty),
        formatCurrency(Number(s.total_profit)),
        s.payment_method,
      ]),
      headStyles: { fillColor: [30, 100, 180] },
      styles: { fontSize: 8 },
    });

    doc.save(`historico-pdv-${selectedMonth}.pdf`);
  };

  const isLoading = isLoadingSales || isLoadingAppointments || isLoadingExpenses;

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const value = format(date, 'yyyy-MM');
      const label = format(date, 'MMMM yyyy', { locale: ptBR });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Relatório Financeiro
            </CardTitle>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportFullReport} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-2" />
                Relatório PDF
              </Button>
              <Button onClick={exportPDVHistory} size="sm" variant="outline" disabled={!salesData?.length}>
                <ShoppingCart className="w-4 h-4 mr-2" />
                PDV PDF
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-lg font-bold">{isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : formatCurrency(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ShoppingCart className="w-6 h-6 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">Vendas PDV ({stats.salesCount})</p>
            <p className="text-lg font-bold">{isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : formatCurrency(stats.salesTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wrench className="w-6 h-6 mx-auto mb-1 text-cyan-500" />
            <p className="text-xs text-muted-foreground">Serviços ({stats.servicesCount})</p>
            <p className="text-lg font-bold">{isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : formatCurrency(stats.servicesTotal)}</p>
          </CardContent>
        </Card>
        <Card className={stats.netProfit >= 0 ? '' : 'border-destructive/50'}>
          <CardContent className="p-4 text-center">
            {stats.netProfit >= 0 ? (
              <TrendingUp className="w-6 h-6 mx-auto mb-1 text-green-500" />
            ) : (
              <TrendingDown className="w-6 h-6 mx-auto mb-1 text-destructive" />
            )}
            <p className="text-xs text-muted-foreground">Lucro Líquido</p>
            <p className={`text-lg font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : formatCurrency(stats.netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Breakdown */}
      {Object.keys(stats.paymentBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(stats.paymentBreakdown).map(([method, value]) => (
                <div key={method} className="p-2 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">{method}</p>
                  <p className="font-semibold text-sm">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Vendas do Mês ({stats.salesCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto/Serviço</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSales ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : !salesData?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma venda neste mês</TableCell></TableRow>
                ) : salesData.map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">{format(new Date(sale.sale_date), 'dd/MM HH:mm')}</TableCell>
                    <TableCell className="font-medium">{sale.clients?.name || 'Balcão'}</TableCell>
                    <TableCell>{sale.products?.name || '-'}</TableCell>
                    <TableCell className="text-center">{sale.qty}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sale.payment_method}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(sale.sale_price) * sale.qty)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(Number(sale.total_profit))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Despesas do Mês ({expensesData?.length || 0}) - Total: {formatCurrency(stats.expensesTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingExpenses ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : !expensesData?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma despesa neste mês</TableCell></TableRow>
                ) : expensesData.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">{format(new Date(expense.expense_date), 'dd/MM/yy')}</TableCell>
                    <TableCell><Badge variant="outline">{expense.category}</Badge></TableCell>
                    <TableCell>{expense.description || '-'}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatCurrency(Number(expense.amount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroReportsTab;
