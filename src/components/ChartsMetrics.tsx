import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, Activity, Calendar, FileDown, Trophy } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAY_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

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

  // Best days of week data
  const bestDaysOfWeek = useMemo(() => {
    if (!data?.sales) return [];

    const dayData: { [key: number]: { revenue: number; profit: number; count: number; services: number } } = {};
    
    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      dayData[i] = { revenue: 0, profit: 0, count: 0, services: 0 };
    }

    data.sales.forEach((sale: any) => {
      const saleDate = parseISO(sale.sale_date);
      if (saleDate.getFullYear() === parseInt(selectedYear)) {
        const dayOfWeek = getDay(saleDate);
        dayData[dayOfWeek].revenue += Number(sale.sale_price) * sale.qty;
        dayData[dayOfWeek].profit += Number(sale.total_profit);
        dayData[dayOfWeek].count += 1;
        dayData[dayOfWeek].services += sale.qty;
      }
    });

    // Convert to array with day names - reorder to start from Monday (1) to Sunday (0)
    const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
    return orderedDays.map(dayIndex => ({
      day: DAY_NAMES[dayIndex],
      shortDay: DAY_NAMES[dayIndex].substring(0, 3),
      faturamento: dayData[dayIndex].revenue,
      lucro: dayData[dayIndex].profit,
      quantidade: dayData[dayIndex].count,
      servicos: dayData[dayIndex].services,
      dayIndex
    }));
  }, [data?.sales, selectedYear]);

  // Best day calculation
  const bestDay = useMemo(() => {
    if (bestDaysOfWeek.length === 0) return null;
    return bestDaysOfWeek.reduce((best, current) => 
      current.lucro > best.lucro ? current : best
    , bestDaysOfWeek[0]);
  }, [bestDaysOfWeek]);

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

  // Export best days to PDF
  const exportBestDaysPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 220, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISE POR DIA DA SEMANA', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ano: ${selectedYear}`, 105, 32, { align: 'center' });
    
    // Best day highlight
    if (bestDay) {
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(14, 55, 182, 25, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('🏆 MELHOR DIA DA SEMANA', 20, 63);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${bestDay.day} - Lucro: R$ ${bestDay.lucro.toFixed(2)}`, 20, 74);
    }

    // Table
    const tableData = bestDaysOfWeek.map(d => [
      d.day,
      d.quantidade.toString(),
      d.servicos.toString(),
      `R$ ${d.faturamento.toFixed(2)}`,
      `R$ ${d.lucro.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['Dia', 'Vendas', 'Serviços', 'Faturamento', 'Lucro']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' }
      },
      didParseCell: (data) => {
        // Highlight best day row
        if (data.section === 'body' && bestDay && data.row.index === bestDaysOfWeek.findIndex(d => d.day === bestDay.day)) {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`analise-dias-semana-${selectedYear}.pdf`);
  };

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

      {/* Best Day of Week Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Melhor Dia da Semana
              </CardTitle>
              {bestDay && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 rounded-full">
                  <Trophy className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">{bestDay.day}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
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
              <Button onClick={exportBestDaysPDF} variant="outline" size="sm">
                <FileDown className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bestDaysOfWeek}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="shortDay" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toFixed(2)}`, 
                    name === 'faturamento' ? 'Faturamento' : 'Lucro'
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      const dayData = payload[0].payload;
                      return `${dayData.day} - ${dayData.quantidade} vendas, ${dayData.servicos} serviços`;
                    }
                    return label;
                  }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Best day summary */}
          {bestDay && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {bestDaysOfWeek.slice(0, 4).map((day, index) => (
                <div 
                  key={day.day}
                  className={`p-3 rounded-lg ${day.day === bestDay.day ? 'bg-green-100 dark:bg-green-900/50 border-2 border-green-500' : 'bg-muted/50'}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {day.day === bestDay.day && <Trophy className="w-3 h-3 text-green-600" />}
                    <span className="text-xs font-medium">{day.day}</span>
                  </div>
                  <p className="text-sm font-bold text-green-600">R$ {day.lucro.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{day.servicos} serviços</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Faturamento Mensal
            </CardTitle>
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
