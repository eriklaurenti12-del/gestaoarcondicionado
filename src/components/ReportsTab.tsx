import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, TrendingUp, Users, Receipt, Target, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Badge } from "@/components/ui/badge";

interface SaleWithDetails {
  id: number;
  sale_price: number;
  qty: number;
  total_profit: number;
  payment_method: string;
  sale_date: string;
  clients: { name: string } | null;
  products: { name: string; price: number } | null;
}

interface AppointmentWithDetails {
  id: string;
  appointment_date: string;
  status: string;
  clients: { name: string } | null;
  products: { name: string; price: number } | null;
}

const fetchSalesReport = async (startDate?: string, endDate?: string) => {
    let query = supabase.from('sales').select('*, clients(name), products(name, price)');
    
    if (startDate && endDate) {
      query = query.gte('sale_date', startDate).lte('sale_date', endDate);
    }
    
    const { data: salesData, error } = await query.order('sale_date', { ascending: false });
    if (error) throw new Error(error.message);

    // Fetch appointments
    let appointmentsQuery = supabase.from('appointments').select('*, clients(name), products(name, price)');
    if (startDate && endDate) {
      appointmentsQuery = appointmentsQuery.gte('appointment_date', startDate).lte('appointment_date', endDate);
    }
    const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery.order('appointment_date', { ascending: false });
    if (appointmentsError) throw new Error(appointmentsError.message);

    const totalSales = salesData?.reduce((acc, sale) => acc + (Number(sale.sale_price) * sale.qty), 0) || 0;
    const totalProfit = salesData?.reduce((acc, sale) => acc + Number(sale.total_profit), 0) || 0;
    const totalItems = salesData?.reduce((acc, sale) => acc + sale.qty, 0) || 0;
    
    const { count: totalClients, error: clientError} = await supabase.from('clients').select('id', { count: 'exact', head: true });
    if(clientError) throw new Error(clientError.message);

    const productSales = (salesData || []).reduce((acc: any, sale: any) => {
      const productName = sale.products?.name || 'Desconhecido';
      if (!acc[productName]) {
        acc[productName] = { name: productName, qty: 0, revenue: 0, profit: 0 };
      }
      acc[productName].qty += sale.qty;
      acc[productName].revenue += Number(sale.sale_price) * sale.qty;
      acc[productName].profit += Number(sale.total_profit);
      return acc;
    }, {});

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 5);

    // Count appointment statuses
    const completedAppointments = appointmentsData?.filter(a => a.status === 'concluido').length || 0;
    const cancelledAppointments = appointmentsData?.filter(a => a.status === 'cancelado').length || 0;

    return { 
      totalSales, 
      totalProfit, 
      totalItems, 
      totalClients: totalClients || 0, 
      topProducts, 
      salesData: salesData as SaleWithDetails[],
      appointmentsData: appointmentsData as AppointmentWithDetails[],
      completedAppointments,
      cancelledAppointments
    };
};

const ReportsTab: React.FC = () => {
    const { toast } = useToast();
    const [period, setPeriod] = useState('thisMonth');
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

    const getPeriodText = () => {
      if (useCustomDates && customStartDate && customEndDate) {
        return `${format(new Date(customStartDate), 'dd/MM/yyyy')} - ${format(new Date(customEndDate), 'dd/MM/yyyy')}`;
      }
      switch (period) {
        case 'thisMonth': return format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
        case 'lastMonth': return format(subMonths(new Date(), 1), "MMMM 'de' yyyy", { locale: ptBR });
        case 'thisYear': return `Ano de ${new Date().getFullYear()}`;
        default: return 'Todos os períodos';
      }
    };

    // Beautiful bank statement style PDF
    const exportStatementPDF = () => {
      if (!salesReport) return;

      const doc = new jsPDF();
      const periodText = getPeriodText();
      
      // Header with gradient effect
      doc.setFillColor(147, 51, 234);
      doc.rect(0, 0, 220, 50, 'F');
      doc.setFillColor(219, 39, 119);
      doc.rect(0, 40, 220, 10, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text("EXTRATO DE ATENDIMENTOS", 105, 20, { align: "center" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Salão de Beleza", 105, 30, { align: "center" });
      doc.setFontSize(11);
      doc.text(periodText, 105, 38, { align: "center" });
      
      // Summary section
      let yPos = 60;
      
      // Summary cards row
      const summaryData = [
        { label: "Faturamento", value: salesReport.totalSales, color: [34, 197, 94] },
        { label: "Lucro Total", value: salesReport.totalProfit, color: [16, 185, 129] },
        { label: "Atendimentos", value: salesReport.totalItems, isCount: true, color: [59, 130, 246] },
        { label: "Clientes", value: salesReport.totalClients, isCount: true, color: [147, 51, 234] },
      ];
      
      const cardWidth = 43;
      const startX = 14;
      
      summaryData.forEach((item, index) => {
        const x = startX + (index * (cardWidth + 5));
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(x, yPos, cardWidth, 22, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(item.label.toUpperCase(), x + cardWidth/2, yPos + 8, { align: "center" });
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        const valueText = item.isCount ? String(item.value) : `R$ ${item.value.toFixed(2)}`;
        doc.text(valueText, x + cardWidth/2, yPos + 17, { align: "center" });
      });
      
      // Appointments status row
      yPos += 30;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      // Completed badge
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(14, yPos, 85, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(`✓ ${salesReport.completedAppointments} Serviços Concluídos`, 56.5, yPos + 8, { align: "center" });
      
      // Cancelled badge
      doc.setFillColor(239, 68, 68);
      doc.roundedRect(105, yPos, 85, 12, 2, 2, 'F');
      doc.text(`✗ ${salesReport.cancelledAppointments} Cancelados`, 147.5, yPos + 8, { align: "center" });
      
      // Transactions title
      yPos += 22;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EXTRATO DE MOVIMENTAÇÕES", 14, yPos);
      
      // Transactions table
      const transactions: any[] = [];
      
      // Add sales
      salesReport.salesData?.forEach(sale => {
        transactions.push({
          date: sale.sale_date,
          client: sale.clients?.name || '-',
          service: sale.products?.name || '-',
          status: 'Concluído',
          method: sale.payment_method,
          value: Number(sale.sale_price) * sale.qty,
          profit: Number(sale.total_profit),
          type: 'sale'
        });
      });
      
      // Add appointments
      salesReport.appointmentsData?.forEach(apt => {
        if (!transactions.find(t => t.date === apt.appointment_date && t.client === apt.clients?.name)) {
          transactions.push({
            date: apt.appointment_date,
            client: apt.clients?.name || '-',
            service: apt.products?.name || '-',
            status: apt.status === 'concluido' ? 'Concluído' : apt.status === 'cancelado' ? 'Cancelado' : 'Agendado',
            method: '-',
            value: apt.status === 'concluido' ? Number(apt.products?.price || 0) : 0,
            profit: 0,
            type: 'appointment'
          });
        }
      });
      
      // Sort by date
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const tableData = transactions.map(t => [
        format(new Date(t.date), 'dd/MM/yy'),
        t.client.substring(0, 15),
        t.service.substring(0, 18),
        t.status,
        t.method,
        t.value > 0 ? `R$ ${t.value.toFixed(2)}` : '-'
      ]);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Data", "Cliente", "Serviço", "Status", "Pgto", "Valor"]],
        body: tableData,
        theme: "striped",
        headStyles: { 
          fillColor: [147, 51, 234],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
          cellPadding: 3
        },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: [250, 245, 255] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 32 },
          2: { cellWidth: 40 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 28, halign: "right" }
        },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.section === "body") {
            const status = data.cell.raw as string;
            if (status === 'Concluído') {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'Cancelado') {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          if (data.column.index === 5 && data.section === "body") {
            const value = data.cell.raw as string;
            if (value !== '-') {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
      
      // Top services section
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      if (finalY < 240 && salesReport.topProducts.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("TOP 5 SERVIÇOS MAIS REALIZADOS", 14, finalY);
        
        const topData = salesReport.topProducts.map((p: any, i) => [
          `${i + 1}º`,
          p.name,
          `${p.qty} atend.`,
          `R$ ${p.revenue.toFixed(2)}`,
          `R$ ${p.profit.toFixed(2)}`
        ]);
        
        autoTable(doc, {
          startY: finalY + 5,
          head: [["#", "Serviço", "Qtd", "Receita", "Lucro"]],
          body: topData,
          theme: "plain",
          headStyles: { 
            fillColor: [219, 39, 119],
            textColor: 255,
            fontSize: 8
          },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 70 },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 35, halign: "right" },
            4: { cellWidth: 35, halign: "right" }
          }
        });
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(147, 51, 234);
      doc.rect(0, pageHeight - 18, 220, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 8);
      doc.text("Salão de Beleza - Sistema de Gestão", 196, pageHeight - 8, { align: "right" });

      doc.save(`extrato-atendimentos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: "PDF exportado!", description: "Extrato de atendimentos salvo." });
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
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Relatórios
          </h2>
          <p className="text-muted-foreground text-sm">{getPeriodText()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(val) => { setPeriod(val); setUseCustomDates(false); }}>
            <SelectTrigger className="w-[180px] transition-all bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">Todos os períodos</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
              <SelectItem value="thisYear">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportStatementPDF} size="sm" className="bg-gradient-to-r from-primary to-accent">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar Extrato
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtro Personalizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs">Data Final</Label>
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
              size="sm"
            >
              Aplicar Filtro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3 w-3 text-green-500" />
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-green-500">R$ {salesReport?.totalSales.toFixed(2)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-emerald-500" />
              Lucro Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-emerald-500">R$ {salesReport?.totalProfit.toFixed(2)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              Atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-blue-500">{salesReport?.totalItems}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 text-purple-500" />
              Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-purple-500">{salesReport?.totalClients}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-teal-500">{salesReport?.completedAppointments}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cancelados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-red-500">{salesReport?.cancelledAppointments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Histórico de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesReport?.salesData && salesReport.salesData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesReport.salesData.slice(0, 20).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">{format(new Date(sale.sale_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{sale.clients?.name || '-'}</TableCell>
                      <TableCell>{sale.products?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.payment_method}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-500">
                        R$ {(Number(sale.sale_price) * sale.qty).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-500">
                        R$ {Number(sale.total_profit).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Nenhuma venda registrada neste período.</p>
          )}
        </CardContent>
      </Card>

      {/* Top Services */}
      <Card>
        <CardHeader><CardTitle>Top 5 Serviços Mais Realizados</CardTitle></CardHeader>
        <CardContent>
          {salesReport?.topProducts.length === 0 ? (
            <p className="text-muted-foreground">Nenhum serviço realizado neste período.</p>
          ) : (
            <ul className="space-y-2">
              {salesReport?.topProducts.map((product: any, index: number) => (
                <li key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">{product.qty} atend.</span>
                    <span className="font-semibold text-green-500">R$ {product.revenue.toFixed(2)}</span>
                    <span className="font-semibold text-emerald-500">Lucro: R$ {product.profit.toFixed(2)}</span>
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
