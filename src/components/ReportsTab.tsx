import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const fetchSalesReport = async () => {
    const { data, error } = await supabase.from('sales').select('sale_price, qty, total_profit');
    if (error) throw new Error(error.message);

    const totalSales = data.reduce((acc, sale) => acc + (Number(sale.sale_price) * sale.qty), 0);
    const totalProfit = data.reduce((acc, sale) => acc + Number(sale.total_profit), 0);
    const totalItems = data.reduce((acc, sale) => acc + sale.qty, 0);
    
    const { count: totalClients, error: clientError } = await supabase.from('clients').select('id', { count: 'exact', head: true });
    if(clientError) throw new Error(clientError.message);

    return { totalSales, totalProfit, totalItems, totalClients: totalClients || 0 };
};


const ReportsTab: React.FC = () => {
    const { data: salesReport, isLoading } = useQuery({
        queryKey: ['reports'],
        queryFn: fetchSalesReport
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
                <span className="font-bold text-lg">
                  R$ {(salesReport?.totalClients || 0) > 0 ? (salesReport!.totalSales / salesReport!.totalClients).toFixed(2) : "0.00"}
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
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Em breve...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsTab;
