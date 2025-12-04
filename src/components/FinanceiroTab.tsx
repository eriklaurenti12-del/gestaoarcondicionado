import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, Loader2, DollarSign, CreditCard, Banknote, QrCode, FileDown, Receipt, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface FinancialRecord {
  id: string;
  type: "entrada" | "saque" | "reserva";
  amount: number;
  description: string | null;
  payment_method: string | null;
  installments: number | null;
  category: string | null;
  record_date: string;
}

interface Sale {
  id: number;
  sale_price: number;
  qty: number;
  total_profit: number;
  payment_method: string;
  sale_date: string;
  clients: { name: string } | null;
  products: { name: string; price: number; cost_price: number } | null;
}

export default function FinanceiroTab() {
  const { toast } = useToast();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  
  const [formData, setFormData] = useState({
    type: "entrada" as "entrada" | "saque" | "reserva",
    amount: "",
    description: "",
    payment_method: "Dinheiro",
    installments: "1",
    category: "",
  });

  // Fetch sales for the month
  const { data: sales } = useQuery({
    queryKey: ["sales-financial", selectedMonth],
    queryFn: async () => {
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;
      const { data, error } = await supabase
        .from("sales")
        .select("*, clients(name), products(name, price, cost_price)")
        .gte("sale_date", startDate)
        .lte("sale_date", endDate)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    }
  });

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth]);

  const fetchRecords = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      .eq("user_id", session.user.id)
      .gte("record_date", startDate)
      .lte("record_date", endDate)
      .order("record_date", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar registros", variant: "destructive" });
    } else {
      setRecords((data as FinancialRecord[]) || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("financial_records").insert({
      user_id: session.user.id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description || null,
      payment_method: formData.payment_method,
      installments: parseInt(formData.installments) || 1,
      category: formData.category || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar registro", variant: "destructive" });
    } else {
      toast({ title: "Registro salvo com sucesso!" });
      setDialogOpen(false);
      setFormData({
        type: "entrada",
        amount: "",
        description: "",
        payment_method: "Dinheiro",
        installments: "1",
        category: "",
      });
      fetchRecords();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("financial_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Registro excluído!" });
      fetchRecords();
    }
  };

  // Financial calculations
  const totalEntradas = records.filter(r => r.type === "entrada").reduce((acc, r) => acc + Number(r.amount), 0);
  const totalSaques = records.filter(r => r.type === "saque").reduce((acc, r) => acc + Number(r.amount), 0);
  const totalReservas = records.filter(r => r.type === "reserva").reduce((acc, r) => acc + Number(r.amount), 0);
  
  // Sales data
  const totalVendas = sales?.reduce((acc, s) => acc + Number(s.sale_price) * s.qty, 0) || 0;
  const lucroServicos = sales?.reduce((acc, s) => acc + Number(s.total_profit), 0) || 0;
  
  // Combined totals
  const totalGeral = totalEntradas + totalVendas;
  const saldoDisponivel = totalGeral - totalSaques - totalReservas;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "entrada": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "saque": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "reserva": return <Wallet className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const getPaymentIcon = (method: string | null) => {
    switch (method) {
      case "Dinheiro": return <Banknote className="h-4 w-4" />;
      case "PIX": return <QrCode className="h-4 w-4" />;
      case "Débito": case "Crédito": return <CreditCard className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  // Export beautiful bank statement PDF
  const exportStatementPDF = () => {
    const doc = new jsPDF();
    const monthName = format(new Date(selectedMonth + "-01"), "MMMM 'de' yyyy", { locale: ptBR });
    
    // Header with gradient effect (simulated with rectangles)
    doc.setFillColor(147, 51, 234);
    doc.rect(0, 0, 220, 45, 'F');
    doc.setFillColor(219, 39, 119);
    doc.rect(0, 35, 220, 10, 'F');
    
    // Logo/Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO FINANCEIRO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Salão de Beleza - ${monthName}`, 105, 30, { align: "center" });
    
    // Summary boxes
    doc.setTextColor(0, 0, 0);
    let yPos = 55;
    
    // Summary Cards
    const summaryData = [
      { label: "Total Entradas", value: totalGeral, color: [34, 197, 94] },
      { label: "Total Saques", value: totalSaques, color: [239, 68, 68] },
      { label: "Reservas", value: totalReservas, color: [59, 130, 246] },
      { label: "Saldo Disponível", value: saldoDisponivel, color: [147, 51, 234] },
    ];
    
    const cardWidth = 45;
    const startX = 14;
    
    summaryData.forEach((item, index) => {
      const x = startX + (index * (cardWidth + 4));
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(x, yPos, cardWidth, 20, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(item.label, x + cardWidth/2, yPos + 7, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`R$ ${item.value.toFixed(2)}`, x + cardWidth/2, yPos + 15, { align: "center" });
    });
    
    // Lucro section
    yPos += 30;
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(14, yPos, 182, 15, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("LUCRO LÍQUIDO DOS SERVIÇOS", 20, yPos + 6);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`R$ ${lucroServicos.toFixed(2)}`, 186, yPos + 10, { align: "right" });
    
    // Transactions section
    yPos += 25;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MOVIMENTAÇÕES", 14, yPos);
    
    // Combine all transactions
    const allTransactions: any[] = [];
    
    // Add financial records
    records.forEach(r => {
      allTransactions.push({
        date: r.record_date,
        description: r.description || (r.type === "entrada" ? "Entrada" : r.type === "saque" ? "Saque" : "Reserva"),
        type: r.type,
        method: r.payment_method,
        amount: Number(r.amount),
        isEntry: r.type === "entrada"
      });
    });
    
    // Add sales
    sales?.forEach(s => {
      allTransactions.push({
        date: s.sale_date,
        description: `${s.products?.name || "Serviço"} - ${s.clients?.name || "Cliente"}`,
        type: "venda",
        method: s.payment_method,
        amount: Number(s.sale_price) * s.qty,
        isEntry: true,
        profit: Number(s.total_profit)
      });
    });
    
    // Sort by date
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const tableData = allTransactions.map(t => [
      format(new Date(t.date), "dd/MM/yyyy"),
      t.description,
      t.method || "-",
      t.type === "venda" ? "Serviço" : t.type.charAt(0).toUpperCase() + t.type.slice(1),
      t.isEntry ? `+ R$ ${t.amount.toFixed(2)}` : `- R$ ${t.amount.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Data", "Descrição", "Forma Pgto", "Tipo", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { 
        fillColor: [147, 51, 234],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 245, 255] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 70 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: "right", fontStyle: "bold" }
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === "body") {
          const value = data.cell.raw as string;
          if (value.startsWith("+")) {
            data.cell.styles.textColor = [34, 197, 94];
          } else {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      }
    });
    
    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(147, 51, 234);
    doc.rect(0, pageHeight - 20, 220, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 10);
    doc.text("Salão de Beleza - Sistema de Gestão", 196, pageHeight - 10, { align: "right" });
    
    doc.save(`extrato-financeiro-${selectedMonth}.pdf`);
    toast({ title: "Extrato exportado!", description: "PDF salvo com sucesso." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Controle Financeiro</h2>
          <p className="text-muted-foreground">Gerencie suas entradas, saques e reservas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-auto"
          />
          <Button onClick={exportStatementPDF} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            Extrato PDF
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent">
                <Plus className="h-4 w-4 mr-2" /> Novo Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Registro Financeiro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada (Ganho)</SelectItem>
                      <SelectItem value="saque">Saque (Retirada)</SelectItem>
                      <SelectItem value="reserva">Reserva (Guardado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descrição do registro"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Débito">Débito</SelectItem>
                      <SelectItem value="Crédito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.payment_method === "Crédito" && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={formData.installments} onValueChange={(v) => setFormData({ ...formData, installments: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x {n === 1 ? "(à vista)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Categoria (opcional)</Label>
                  <Input
                    placeholder="Ex: Serviço, Produto, Despesa"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Registro"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Receipt className="h-3 w-3 text-green-500" />
              Vendas/Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-green-500">
              R$ {totalVendas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-emerald-500" />
              Lucro Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-emerald-500">
              R$ {lucroServicos.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-teal-500" />
              Outras Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-teal-500">
              R$ {totalEntradas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Saques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-red-500">
              R$ {totalSaques.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3 text-blue-500" />
              Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg sm:text-xl font-bold text-blue-500">
              R$ {totalReservas.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-primary" />
              Saldo Disponível
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg sm:text-xl font-bold ${saldoDisponivel >= 0 ? "text-primary" : "text-red-500"}`}>
              R$ {saldoDisponivel.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales from services */}
      {sales && sales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-500" />
              Vendas de Serviços - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.sale_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{sale.clients?.name || "-"}</TableCell>
                      <TableCell>{sale.products?.name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentIcon(sale.payment_method)}
                          {sale.payment_method}
                        </div>
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
          </CardContent>
        </Card>
      )}

      {/* Manual Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros Manuais - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro manual encontrado para este mês</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(record.type)}
                          <span className="capitalize">{record.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{record.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentIcon(record.payment_method)}
                          {record.payment_method || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.installments && record.installments > 1 ? `${record.installments}x` : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        record.type === "entrada" ? "text-green-500" : 
                        record.type === "saque" ? "text-red-500" : "text-blue-500"
                      }`}>
                        R$ {Number(record.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.record_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
