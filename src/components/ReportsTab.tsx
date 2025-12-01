import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fetchSalesReport = async (startDate?: string, endDate?: string) => {
    let query = supabase.from('sales').select('sale_price, qty, total_profit, sale_date, products(name)');
    
    if (startDate && endDate) {
      query = query.gte('sale_date', startDate).lte('sale_date', endDate);
    }
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const totalSales = data.reduce((acc, sale) => acc + (Number(sale.sale_price) * sale.qty), 0);
    const totalProfit = data.reduce((acc, sale) => acc + Number(sale.total_profit), 0);
    const totalItems = data.reduce((acc, sale) => acc + sale.qty, 0);
    
    const { count: totalClients, error: clientError} = await supabase.from('clients').select('id', { count: 'exact', head: true });
    if(clientError) throw new Error(clientError.message);

    const productSales = data.reduce((acc: any, sale: any) => {
      const productName = sale.products?.name || 'Desconhecido';
      if (!acc[productName]) {
        acc[productName] = { name: productName, qty: 0, revenue: 0 };
      }
      acc[productName].qty += sale.qty;
      acc[productName].revenue += Number(sale.sale_price) * sale.qty;
      return acc;
    }, {});

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 5);

    return { totalSales, totalProfit, totalItems, totalClients: totalClients || 0, topProducts, salesData: data };
};

const ReportsTab: React.FC = () => {
    const { toast } = useToast();
    const [period, setPeriod] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [useCustomDates, setUseCustomDates] = useState(false);
    
    const getDateRange = () => {
      if (useCustomDates && customStartDate && customEndDate) {
        return { start: customStartDate, end: customEndDate };
      }
      
      const now = new Date();
      switch (period) {
        case 'thisMonth':
          return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
        case 'lastMonth':
          const lastMonth = subMonths(now, 1);
          return { start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), end: format(endOfMonth(lastMonth), 'yyyy-MM-dd') };
        case 'thisYear':
          return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
        default:
          return { start: undefined, end: undefined };
      }
    };

    const dateRange = getDateRange();
    
    const { data: salesReport, isLoading } = useQuery({
        queryKey: ['reports', period, customStartDate, customEndDate, useCustomDates],
        queryFn: () => fetchSalesReport(dateRange.start, dateRange.end)
    });

    const exportToPDF = () => {
      if (!salesReport) return;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Relatório do Salão', 14, 22);
      doc.setFontSize(11);
      
      let periodText = 'Todos os períodos';
      if (useCustomDates && customStartDate && customEndDate) {
        periodText = `${new Date(customStartDate).toLocaleDateString('pt-BR')} - ${new Date(customEndDate).toLocaleDateString('pt-BR')}`;
      } else if (period === 'thisMonth') {
        periodText = 'Este mês';
      } else if (period === 'lastMonth') {
        periodText = 'Mês passado';
      } else if (period === 'thisYear') {
        periodText = 'Este ano';
      }
      
      doc.text(`Período: ${periodText}`, 14, 30);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);

      doc.setFontSize(14);
      doc.text('Resumo:', 14, 46);
      doc.setFontSize(11);
      doc.text(`Faturamento: R$ ${salesReport.totalSales.toFixed(2)}`, 14, 54);
      doc.text(`Lucro Total: R$ ${salesReport.totalProfit.toFixed(2)}`, 14, 60);
      doc.text(`Atendimentos: ${salesReport.totalItems}`, 14, 66);
      doc.text(`Total de Clientes: ${salesReport.totalClients}`, 14, 72);

      if (salesReport.topProducts.length > 0) {
        doc.setFontSize(14);
        doc.text('Top 5 Serviços:', 14, 84);
        
        const topProductsData = salesReport.topProducts.map((p: any) => [
          p.name,
          `${p.qty} un`,
          `R$ ${p.revenue.toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: 88,
          head: [['Produto', 'Quantidade', 'Receita']],
          body: topProductsData,
        });
      }

      doc.save(`relatorio-salao-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: "PDF exportado!", description: "Relatório do salão salvo." });
    };

  if (isLoading) {
      return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Relatório do Salão</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold">Relatórios</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(val) => { setPeriod(val); setUseCustomDates(false); }}>
            <SelectTrigger className="w-[200px] sm:w-48 transition-all bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
              <SelectItem value="thisYear">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToPDF} size="sm" variant="outline">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro Personalizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
            <Button 
              onClick={() => setUseCustomDates(true)} 
              disabled={!customStartDate || !customEndDate}
            >
              Aplicar Filtro
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader><CardTitle>Faturamento</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold text-green-600">R$ {salesReport?.totalSales.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lucro Total</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold text-blue-600">R$ {salesReport?.totalProfit.toFixed(2)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Atendimentos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold">{salesReport?.totalItems}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total de Clientes</CardTitle></CardHeader>
            <CardContent><p className="text-2xl sm:text-3xl font-bold">{salesReport?.totalClients}</p></CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Top 5 Serviços Mais Realizados</CardTitle></CardHeader>
        <CardContent>
          {salesReport?.topProducts.length === 0 ? (
            <p className="text-muted-foreground">Nenhum serviço realizado neste período.</p>
          ) : (
            <ul className="space-y-2">
              {salesReport?.topProducts.map((product: any, index: number) => (
                <li key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">{product.name}</span>
                  <div className="flex gap-4">
                    <span className="text-sm text-muted-foreground">{product.qty} atendimentos</span>
                    <span className="font-semibold text-green-600">R$ {product.revenue.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
