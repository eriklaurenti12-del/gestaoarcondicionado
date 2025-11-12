import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';

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
    
    const { count: totalClients, error: clientError } = await supabase.from('clients').select('id', { count: 'exact', head: true });
    if(clientError) throw new Error(clientError.message);

    // Top produtos
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

    return { totalSales, totalProfit, totalItems, totalClients: totalClients || 0, topProducts };
};

const ReportsTab: React.FC = () => {
    const [period, setPeriod] = useState('all');
    
    const getDateRange = () => {
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
        queryKey: ['reports', period],
        queryFn: () => fetchSalesReport(dateRange.start, dateRange.end)
    });

  if (isLoading) {
      return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Relatório de Vendas</CardTitle></CardHeader>
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="thisMonth">Este mês</SelectItem>
            <SelectItem value="lastMonth">Mês passado</SelectItem>
            <SelectItem value="thisYear">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatório de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Bruto em Vendas</span>
                <span className="font-bold text-lg text-green-600">
                  R$ {salesReport?.totalSales.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lucro Total</span>
                <span className="font-bold text-lg text-blue-600">
                  R$ {salesReport?.totalProfit.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Itens Vendidos</span>
                <span className="font-bold text-lg">{salesReport?.totalItems || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Ticket Médio</span>
                <span className="font-bold text-lg text-orange-600">
                  R$ {(salesReport?.totalItems || 0) > 0 ? (salesReport!.totalSales / salesReport!.totalItems).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesReport?.topProducts && salesReport.topProducts.length > 0 ? (
                salesReport.topProducts.map((product: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.qty} vendidos</p>
                    </div>
                    <span className="font-bold text-green-600">
                      R$ {product.revenue.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma venda registrada neste período.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
