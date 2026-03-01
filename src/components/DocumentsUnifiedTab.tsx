import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Briefcase, Info, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QuotesTab from './QuotesTab';
import ServiceOrdersTab from './ServiceOrdersTab';

const DocumentsUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("quotes");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Fetch company data for PDF
  const { data: companyData } = useQuery({
    queryKey: ["company-data"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_data").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch quotes for monthly report
  const { data: monthlyQuotes } = useQuery({
    queryKey: ["monthly-quotes", selectedMonth],
    queryFn: async () => {
      const start = startOfMonth(new Date(selectedMonth + '-01'));
      const end = endOfMonth(start);
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(name)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch service orders for monthly report
  const { data: monthlyOrders } = useQuery({
    queryKey: ["monthly-orders", selectedMonth],
    queryFn: async () => {
      const start = startOfMonth(new Date(selectedMonth + '-01'));
      const end = endOfMonth(start);
      const { data, error } = await supabase
        .from("service_orders")
        .select("*, clients(name)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const generateMonthlyPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthLabel = format(new Date(selectedMonth + '-01'), "MMMM 'de' yyyy", { locale: ptBR });

    // Header
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyData?.company_name || "AC Service Pro", 14, 16);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório Mensal - ${monthLabel}`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth - 14, 28, { align: "right" });

    let y = 50;

    // Quotes section
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Orçamentos (${monthlyQuotes?.length || 0})`, 14, y);
    y += 4;

    if (monthlyQuotes && monthlyQuotes.length > 0) {
      const quotesTotal = monthlyQuotes.reduce((s, q) => s + (q.total || 0), 0);
      const quotesData = monthlyQuotes.map((q: any) => [
        `#${q.quote_number}`,
        q.title,
        q.clients?.name || '-',
        q.status,
        `R$ ${(q.total || 0).toFixed(2)}`,
        format(new Date(q.created_at), "dd/MM/yyyy"),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Nº", "Título", "Cliente", "Status", "Total", "Data"]],
        body: quotesData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Orçamentos: R$ ${quotesTotal.toFixed(2)}`, pageWidth - 14, y, { align: "right" });
      y += 12;
    } else {
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Nenhum orçamento neste mês.", 14, y);
      y += 12;
    }

    // Service Orders section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Ordens de Serviço (${monthlyOrders?.length || 0})`, 14, y);
    y += 4;

    if (monthlyOrders && monthlyOrders.length > 0) {
      const ordersTotal = monthlyOrders.reduce((s, o) => s + (o.total || 0), 0);
      const ordersData = monthlyOrders.map((o: any) => [
        `#${o.order_number}`,
        o.title,
        o.clients?.name || '-',
        o.status,
        `R$ ${(o.total || 0).toFixed(2)}`,
        format(new Date(o.created_at), "dd/MM/yyyy"),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Nº", "Título", "Cliente", "Status", "Total", "Data"]],
        body: ordersData,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 9 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total O.S.: R$ ${ordersTotal.toFixed(2)}`, pageWidth - 14, y, { align: "right" });
    } else {
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Nenhuma O.S. neste mês.", 14, y);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${companyData?.company_name || "AC Service Pro"} - Relatório gerado automaticamente`, pageWidth / 2, 285, { align: "center" });

    doc.save(`relatorio-${selectedMonth}.pdf`);
    toast.success("PDF do relatório mensal gerado!");
  };

  return (
    <div className="space-y-4">
      {/* Guide cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={`border-2 cursor-pointer transition-all ${activeSubTab === 'quotes' ? 'border-blue-500 bg-blue-500/5 shadow-lg' : 'border-border hover:border-blue-300'}`}
          onClick={() => setActiveSubTab('quotes')}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Orçamentos</h3>
                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">Proposta</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Envie <strong>antes</strong> do serviço. O cliente aprova → você agenda.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 cursor-pointer transition-all ${activeSubTab === 'orders' ? 'border-emerald-500 bg-emerald-500/5 shadow-lg' : 'border-border hover:border-emerald-300'}`}
          onClick={() => setActiveSubTab('orders')}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Briefcase className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Ordens de Serviço</h3>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">Execução</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie <strong>durante/após</strong> o serviço. Documenta o que foi feito + assinatura.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly PDF export */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[44px]"
        />
        <Button variant="outline" size="sm" onClick={generateMonthlyPDF} className="min-h-[44px] gap-2">
          <Download className="w-4 h-4" />
          Exportar Relatório PDF
        </Button>
        <span className="text-xs text-muted-foreground">
          {(monthlyQuotes?.length || 0)} orçamentos • {(monthlyOrders?.length || 0)} O.S. neste mês
        </span>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="quotes" className="flex items-center gap-1.5 px-2">
            <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
            <span className="truncate">Orçamentos</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-1.5 px-2">
            <Briefcase className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            <span className="truncate">Ordens de Serviço</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <QuotesTab />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <ServiceOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentsUnifiedTab;
