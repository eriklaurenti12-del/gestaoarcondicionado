import React, { useState } from 'react';
import { FileText, Download } from "lucide-react";
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

const DocumentsUnifiedTab: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: companyData } = useQuery({
    queryKey: ["company-data"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_data").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  const generateMonthlyPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const monthLabel = format(new Date(selectedMonth + '-01'), "MMMM 'de' yyyy", { locale: ptBR });

    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(companyData?.company_name || "AC Service Pro", 14, 16);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório de Orçamentos - ${monthLabel}`, 14, 28);
    doc.setFontSize(9);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth - 14, 28, { align: "right" });

    let y = 50;

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
    } else {
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Nenhum orçamento neste mês.", 14, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${companyData?.company_name || "AC Service Pro"} - Relatório gerado automaticamente`, pageWidth / 2, 285, { align: "center" });

    doc.save(`relatorio-orcamentos-${selectedMonth}.pdf`);
    toast.success("PDF do relatório gerado!");
  };

  return (
    <div className="space-y-4">
      {/* Guide card */}
      <Card className="border-2 border-blue-500/30 bg-blue-500/5">
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
                Crie e envie orçamentos. Quando o cliente <strong>aprovar</strong>, converta diretamente em agendamento com prestador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          {(monthlyQuotes?.length || 0)} orçamento(s) neste mês
        </span>
      </div>

      <QuotesTab />
    </div>
  );
};

export default DocumentsUnifiedTab;
