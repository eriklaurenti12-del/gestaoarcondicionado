import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const fetchChartData = async () => {
  const [salesRes, appointmentsRes, productsRes] = await Promise.all([
    supabase.from('sales').select('*, products(name)').order('sale_date'),
    supabase.from('appointments').select('*, products(name)').order('appointment_date'),
    supabase.from('products').select('id, name, price')
  ]);

  return {
    sales: salesRes.data || [],
    appointments: appointmentsRes.data || [],
    products: productsRes.data || []
  };
};

interface ChartsMetricsProps {
  className?: string;
}

const ChartsMetrics: React.FC<ChartsMetricsProps> = ({ className }) => {
  const [selectedYear, setSelectedYear] = React.useState(String(new Date().getFullYear()));

  const { data, isLoading } = useQuery({
    queryKey: ['charts-data'],
    queryFn: fetchChartData
  });

  // Monthly revenue data
  const monthlyRevenue = useMemo(() => {
    if (!data?.sales) return [];

    const months: { [key: string]: { revenue: number; profit: number; count: number } } = {};
    
    // Initialize all 12 months
    for (let i = 0; i < 12; i++) {
      const monthKey = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
      months[monthKey] = { revenue: 0, profit: 0, count: 0 };
    }

    data.sales.forEach((sale: any) => {
      const saleDate = parseISO(sale.sale_date);
      if (saleDate.getFullYear() === parseInt(selectedYear)) {
        const monthKey = format(saleDate, 'yyyy-MM');
        if (months[monthKey]) {
          months[monthKey].revenue += Number(sale.sale_price) * sale.qty;
          months[monthKey].profit += Number(sale.total_profit);
          months[monthKey].count += sale.qty;
        }
      }
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month: format(parseISO(`${month}-01`), 'MMM', { locale: ptBR }),
        faturamento: values.revenue,
        lucro: values.profit,
        atendimentos: values.count
      }));
  }, [data?.sales, selectedYear]);

  // Top services
  const topServices = useMemo(() => {
    if (!data?.appointments) return [];

    const serviceCount: { [key: string]: { name: string; count: number; revenue: number } } = {};

    data.appointments.forEach((apt: any) => {
      if (apt.products?.name && apt.status === 'concluido') {
        const name = apt.products.name;
        if (!serviceCount[name]) {
          serviceCount[name] = { name, count: 0, revenue: 0 };
        }
        serviceCount[name].count += 1;
        serviceCount[name].revenue += Number(apt.products?.price || 0);
      }
    });

    // Also add from sales
    data.sales.forEach((sale: any) => {
      if (sale.products?.name) {
        const name = sale.products.name;
        if (!serviceCount[name]) {
          serviceCount[name] = { name, count: 0, revenue: 0 };
        }
        serviceCount[name].count += sale.qty;
        serviceCount[name].revenue += Number(sale.sale_price) * sale.qty;
      }
    });

    return Object.values(serviceCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  // Month-over-month comparison
  const monthComparison = useMemo(() => {
    if (!data?.sales) return { current: 0, previous: 0, change: 0 };

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));

    let currentRevenue = 0;
    let previousRevenue = 0;

    data.sales.forEach((sale: any) => {
      const saleDate = parseISO(sale.sale_date);
      const revenue = Number(sale.sale_price) * sale.qty;

      if (saleDate >= currentMonthStart && saleDate <= currentMonthEnd) {
        currentRevenue += revenue;
      } else if (saleDate >= previousMonthStart && saleDate <= previousMonthEnd) {
        previousRevenue += revenue;
      }
    });

    const change = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0;

    return { current: currentRevenue, previous: previousRevenue, change };
  }, [data?.sales]);

  const availableYears = useMemo(() => {
    if (!data?.sales) return [new Date().getFullYear()];
    const years = [...new Set(data.sales.map((s: any) => parseISO(s.sale_date).getFullYear()))];
    if (years.length === 0) years.push(new Date().getFullYear());
    return years.sort((a, b) => b - a);
  }, [data?.sales]);

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Este Mês</p>
                <p className="text-2xl font-bold text-green-600">R$ {monthComparison.current.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mês Anterior</p>
                <p className="text-2xl font-bold text-blue-600">R$ {monthComparison.previous.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${monthComparison.change >= 0 ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-800' : 'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Variação</p>
                <p className={`text-2xl font-bold ${monthComparison.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {monthComparison.change >= 0 ? '+' : ''}{monthComparison.change.toFixed(1)}%
                </p>
              </div>
              <div className={`p-3 rounded-full ${monthComparison.change >= 0 ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-red-100 dark:bg-red-900'}`}>
                {monthComparison.change >= 0 ? (
                  <TrendingUp className={`w-5 h-5 ${monthComparison.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Faturamento Mensal
            </CardTitle>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Serviços Mais Realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topServices.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topServices}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {topServices.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${value} atendimentos (R$ ${props.payload.revenue.toFixed(2)})`,
                        props.payload.name
                      ]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Services Revenue List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Ranking de Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topServices.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum dado disponível
                </div>
              ) : (
                topServices.map((service, index) => (
                  <div key={service.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 transition-all hover:bg-muted">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm`}
                         style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{service.name}</p>
                      <p className="text-sm text-muted-foreground">{service.count} atendimentos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">R$ {service.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Evolução de Atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="atendimentos" name="Atendimentos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChartsMetrics;
