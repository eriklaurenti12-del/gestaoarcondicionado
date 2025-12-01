
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scissors, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';

const fetchDashboardData = async () => {
    const productsPromise = supabase.from('products').select('*');
    const clientsPromise = supabase.from('clients').select('id', { count: 'exact', head: true });
    const salesPromise = supabase.from('sales').select('sale_price, qty, total_profit');

    const [{ data: products, error: pError }, { count: clientsCount, error: cError }, { data: sales, error: sError }] = await Promise.all([productsPromise, clientsPromise, salesPromise]);

    if (pError || cError || sError) {
        console.error(pError || cError || sError);
        throw new Error("Failed to fetch dashboard data");
    }

    const lowStockProducts = products!.filter(p => p.qty <= (p.min_stock || 0));
    const totalSales = sales!.reduce((sum, s) => sum + (Number(s.sale_price) * s.qty), 0);
    const totalProfit = sales!.reduce((sum, s) => sum + Number(s.total_profit), 0);
    const totalItems = sales!.reduce((sum, s) => sum + s.qty, 0);
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    return {
        servicesCount: products!.length,
        clientsCount: clientsCount || 0,
        lowStockProducts,
        salesReport: { totalSales, totalItems, totalProfit, profitMargin }
    };
};

const Dashboard: React.FC = () => {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['dashboard'],
        queryFn: fetchDashboardData
    });

    if (isLoading) return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
    if (isError) return <div>Error loading dashboard: {(error as Error).message}</div>

    const { servicesCount, clientsCount, lowStockProducts, salesReport } = data!;

    return (
    <div className="space-y-6">
      {lowStockProducts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">Alerta de Estoque Baixo!</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {lowStockProducts.length} produto(s) com estoque baixo: {lowStockProducts.map(p => p.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5" />Serviços & Produtos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{servicesCount}</div>
            <p className="text-sm text-muted-foreground">{lowStockProducts.length} com estoque baixo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Total de Clientes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{clientsCount}</div>
            <p className="text-sm text-muted-foreground">Clientes cadastrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Faturamento</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-green-600">R$ {salesReport.totalSales.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Em {salesReport.totalItems} atendimentos</p>
             <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lucro Total</span>
                    <span className="font-bold text-blue-600">R$ {salesReport.totalProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Margem de Lucro</span>
                    <span className="font-bold">{salesReport.profitMargin.toFixed(2)}%</span>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
          <CardHeader><CardTitle>Produtos com Estoque Baixo</CardTitle></CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((product, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-orange-600 font-semibold">{product.qty} restantes</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

export default Dashboard;
