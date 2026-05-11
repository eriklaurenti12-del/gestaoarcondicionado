import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { reconcileFinancialMonth, ensureMonthlyRecurringExpenses, type ReconcileResult } from '@/utils/recurringSync';
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, Loader2, DollarSign, CreditCard, Banknote, QrCode, FileDown, Receipt, Target, Fuel, RefreshCw, Wrench, Package, Info, CheckCircle2, Calculator, BarChart3, Utensils, FileSpreadsheet, HelpCircle } from "lucide-react";
import { buildMonthDataset, buildMonthCsv, downloadCsv, DEFAULT_CSV_FILTERS, type CsvFilters } from '@/utils/financialExport';
import { Checkbox } from "@/components/ui/checkbox";
import TabGuideCards from './TabGuideCards';
import { useToast } from "@/hooks/use-toast";
import { format, endOfMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const safeFormat = (date: any, formatStr: string, options?: any) => {
  try {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr, options);
  } catch {
    return '-';
  }
};

const safeIsToday = (date: any) => {
  try {
    if (!date) return false;
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    return isToday(d);
  } catch {
    return false;
  }
};

interface FinancialRecord {
  id: string;
  type: "entrada" | "saque" | "reserva";
  amount: number;
  description: string | null;
  payment_method: string | null;
  installments: number | null;
  category: string | null;
  record_date: string;
  appointment_id?: string | null;
  sale_id?: number | null;
}

interface Sale {
  id: number;
  sale_price: number;
  qty: number;
  total_profit: number;
  payment_method: string;
  sale_date: string;
  clients: { name: string } | null;
  products: { name: string; price: number; cost_price: number; type?: string | null } | null;
}

export default function FinanceiroTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => safeFormat(new Date(), "yyyy-MM"));
  const [refreshing, setRefreshing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvFilters, setCsvFilters] = useState<CsvFilters>(DEFAULT_CSV_FILTERS);
  const [csvBusy, setCsvBusy] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    type: "entrada" as "entrada" | "saque" | "reserva",
    amount: "",
    description: "",
    payment_method: "Dinheiro",
    installments: "1",
    category: "",
  });

  const { data: sales, refetch: refetchSales } = useQuery({
    queryKey: ["sales-financial", selectedMonth],
    queryFn: async () => {
      const monthStart = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1);
      const monthEnd = endOfMonth(monthStart);
      const startDate = safeFormat(monthStart, 'yyyy-MM-dd');
      const endDateStr = safeFormat(monthEnd, 'yyyy-MM-dd') + 'T23:59:59.999Z';
      const { data, error } = await supabase
        .from("sales")
        .select("*, clients(name), products(name, price, cost_price, type)")
        .gte("sale_date", startDate)
        .lte("sale_date", endDateStr)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    }
  });

  const { data: fixedExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ["fixed-expenses-summary", selectedMonth],
    queryFn: async () => {
      const monthStart = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1);
      const monthEnd = endOfMonth(monthStart);
      const startDate = safeFormat(monthStart, 'yyyy-MM-dd');
      const endDate = safeFormat(monthEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("fixed_expenses")
        .select("amount")
        .gte("expense_date", startDate)
        .lte("expense_date", endDate);
      if (error) throw error;
      return data;
    }
  });

  const { data: pendingAppointments } = useQuery({
    queryKey: ["pending-appointments-financial", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("notes, products(price)")
        .in("status", ["pendente", "confirmado"])
        .gte("appointment_date", selectedMonth + "-01");
      if (error) throw error;
      return data;
    }
  });

  // Fetch completed appointments for synchronization
  const { data: completedAppointments } = useQuery({
    queryKey: ["completed-appointments-financial", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, notes, appointment_date, client_id, service_id, products(name, price), clients(name)")
        .eq("status", "concluido")
        .gte("appointment_date", selectedMonth + "-01");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedMonth,
  });

  // NOTE: Creation/removal of financial entries from concluded appointments
  // is handled exclusively by AppointmentsTab (linked via appointment_id).
  // This avoids duplicates that previously appeared because two places
  // inserted the same row with slightly different descriptions/categories.

  // Auto-reconcile whenever the selected month changes: removes orphans /
  // duplicates and re-syncs recurring expenses (employees + providers) so the
  // numbers stay consistent without the user having to click anything.
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      try {
        await reconcileFinancialMonth(session.user.id, selectedMonth, 'auto');
        queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
        queryClient.invalidateQueries({ queryKey: ['fixed-expenses-summary', selectedMonth] });
        queryClient.invalidateQueries({ queryKey: ['sales-financial', selectedMonth] });
      } catch (e) {
        console.warn('auto-reconcile failed', e);
        // Fallback: at least ensure recurring rows exist.
        try {
          await ensureMonthlyRecurringExpenses(session.user.id, selectedMonth);
          queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const getAppointmentPrice = (apt: any) => {
    if (apt.notes) {
      const match = apt.notes.match(/\[VALOR:([\d.]+)\]/);
      if (match) return Number(match[1]);
    }
    return Number(apt.products?.price) || 0;
  };

  const receitaPrevista = pendingAppointments?.reduce((acc, a: any) => acc + getAppointmentPrice(a), 0) || 0;

  // Check if month is locked
  useEffect(() => {
    const checkLock = async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) return;
      
      const { data } = await (supabase as any)
        .from('financial_locks')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('locked_date', selectedMonth + "-01")
        .maybeSingle();
      
      setIsLocked(!!data);
    };
    checkLock();
  }, [selectedMonth]);

  const handleQuickAdd = async (category: string, amount: number, description: string) => {
    const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
    if (!session) return;
    
    setSaving(true);
    try {
      const { error } = await recordFinancialEntry({
        userId: session.user.id,
        type: 'saque',
        amount,
        description: description,
        paymentMethod: 'Dinheiro',
        category,
        recordDate: new Date().toISOString()
      });
      if (error) throw error;
      toast({ title: `Lançado: R$ ${amount.toFixed(2)} (${category})` });
      fetchRecords();
    } catch (error: any) {
      toast({ title: "Erro no lançamento rápido", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async () => {
    const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
    if (!session) return;

    if (isLocked) {
      // Unlock
      const { error } = await (supabase as any)
        .from('financial_locks')
        .delete()
        .eq('user_id', session.user.id)
        .eq('locked_date', selectedMonth + "-01");
      
      if (!error) {
        setIsLocked(false);
        toast({ title: "Mês desbloqueado!" });
      }
    } else {
      // Lock
      const { error } = await (supabase as any)
        .from('financial_locks')
        .insert({
          user_id: session.user.id,
          locked_date: selectedMonth + "-01"
        });
      
      if (!error) {
        setIsLocked(true);
        toast({ title: "Mês bloqueado com sucesso!", description: "Edições e exclusões foram desabilitadas." });
      } else {
        toast({ title: "Erro ao bloquear", variant: "destructive" });
      }
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
    if (!session) return;

    const monthStart = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    const startDate = safeFormat(monthStart, 'yyyy-MM-dd');
    const endDateStr = safeFormat(monthEnd, 'yyyy-MM-dd') + 'T23:59:59.999Z';

    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      // Removed .eq("user_id", session.user.id) to make it global
      .gte("record_date", startDate)
      .lte("record_date", endDateStr)
      .order("record_date", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar registros", variant: "destructive" });
    } else {
      setRecords((data as FinancialRecord[]) || []);
    }
    setLoading(false);
  };

  const handleExportCsv = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return;
    setCsvBusy(true);
    try {
      const ds = await buildMonthDataset(session.user.id, selectedMonth);
      const csv = buildMonthCsv(ds, csvFilters);
      downloadCsv(`extrato-financeiro-${selectedMonth}.csv`, csv);
      toast({ title: '📊 CSV exportado', description: 'Arquivo pronto para abrir no Excel.' });
      setCsvDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao exportar CSV', description: e.message, variant: 'destructive' });
    } finally {
      setCsvBusy(false);
    }
  };

  const handleReconcile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return;
    setRefreshing(true);
    try {
      const result = await reconcileFinancialMonth(session.user.id, selectedMonth, 'manual');
      await Promise.all([fetchRecords(), refetchSales(), refetchExpenses()]);
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      setReconcileResult(result);
      setReconcileDialogOpen(true);
      const removed = result.dupRecords + result.dupSales + result.orphanRecords + result.orphanSales;
      toast({
        title: '✅ Mês reconciliado',
        description: `${removed} item(ns) removido(s) · ${result.insertedRecurring} recorrente(s) sincronizada(s).`,
      });
    } catch (e: any) {
      toast({ title: 'Erro ao reconciliar', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncContracts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return;
    setRefreshing(true);
    try {
      const result = await ensureMonthlyRecurringExpenses(session.user.id, selectedMonth);
      const contractRows = (result?.rows || []).filter((r: any) => /^auto:contract:/i.test(r.description));
      const contractCount = contractRows.length;
      await Promise.all([fetchRecords(), refetchSales(), refetchExpenses()]);
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial_records'] });
      if (contractCount === 0) {
        toast({ title: '🔄 Contratos já sincronizados', description: 'Nenhum contrato pendente para este mês.' });
      } else {
        toast({
          title: `🔄 ${contractCount} contrato(s) sincronizado(s)`,
          description: `Lançamento mensal criado em Receitas para o mês ${selectedMonth}.`,
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao sincronizar contratos', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      // 1) Hard fix: remove duplicates/orphans and ensure recurring rows for the month.
      let reconcile: ReconcileResult | null = null;
      if (session) {
        try {
          reconcile = await reconcileFinancialMonth(session.user.id, selectedMonth, 'manual');
        } catch (e) {
          console.warn('refresh reconcile failed', e);
        }
      }

      // 2) Invalidate every related cache so the UI shows fresh numbers.
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses-summary', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['sales-financial', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['financial_records'] });
      queryClient.invalidateQueries({ queryKey: ['completed-appointments-financial', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['pending-appointments-financial', selectedMonth] });

      // 3) Refetch source-of-truth datasets used by the totals on screen.
      await Promise.all([
        fetchRecords(),
        refetchSales(),
        refetchExpenses(),
      ]);

      const removed = reconcile
        ? reconcile.dupRecords + reconcile.dupSales + reconcile.orphanRecords + reconcile.orphanSales
        : 0;
      toast({
        title: '✅ Dados atualizados!',
        description: reconcile
          ? `${removed} duplicata(s)/órfão(s) removido(s) · ${reconcile.insertedRecurring} recorrente(s) sincronizada(s).`
          : 'Todos os dados financeiros foram recarregados.',
      });
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
    setRefreshing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
    if (!session) {
      setSaving(false);
      return;
    }

    const { error } = await recordFinancialEntry({
      userId: session.user.id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description,
      paymentMethod: formData.payment_method,
      category: formData.category || 'Manual',
      installments: parseInt(formData.installments) || 1,
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
  // Normaliza categorias para evitar bugs de variantes ("Serviço", "Serviços",
  // "Serviço Concluído", etc.) inseridas por diferentes fluxos do sistema.
  const normalizeCat = (c: string | null) => (c || '').toString().trim().toLowerCase();
  const isServicoCat = (c: string | null) => {
    const n = normalizeCat(c);
    return n.startsWith('serviç') || n.startsWith('servic');
  };
  const isProdutoCat = (c: string | null) => {
    const n = normalizeCat(c);
    return n.startsWith('produto') || n === 'pdv' || n.startsWith('venda');
  };

  const entradas = records.filter(r => r.type === "entrada");
  const linkedSaleIds = new Set(records.map((r) => r.sale_id).filter(Boolean));
  const serviceSales = (sales || []).filter((s) => (s.products?.type || 'service') === 'service');
  const productSales = (sales || []).filter((s) => (s.products?.type || 'service') !== 'service');
  const sumSales = (rows: Sale[]) => rows.reduce((acc, s) => acc + Number(s.sale_price) * Number(s.qty || 1), 0);
  const serviceSalesWithoutRecord = serviceSales.filter((s) => !linkedSaleIds.has(s.id));
  const productSalesWithoutRecord = productSales.filter((s) => !linkedSaleIds.has(s.id));
  const totalServicosFR = entradas.filter(r => isServicoCat(r.category)).reduce((acc, r) => acc + Number(r.amount), 0);
  const totalServicos = totalServicosFR + sumSales(serviceSalesWithoutRecord);
  const totalProdutosFR = entradas.filter(r => isProdutoCat(r.category)).reduce((acc, r) => acc + Number(r.amount), 0);
  const totalProdutos = totalProdutosFR + sumSales(productSalesWithoutRecord);
  const totalOutrasEntradas = entradas
    .filter(r => !isServicoCat(r.category) && !isProdutoCat(r.category))
    .reduce((acc, r) => acc + Number(r.amount), 0);

  const totalEntradas = totalServicos + totalProdutos + totalOutrasEntradas;
  const totalSaques = records.filter(r => r.type === "saque").reduce((acc, r) => acc + Number(r.amount), 0);
  const totalReservas = records.filter(r => r.type === "reserva").reduce((acc, r) => acc + Number(r.amount), 0);

  const totalGastosRotas = records
    .filter(r => r.type === "saque" && (normalizeCat(r.category) === 'alimentação' || normalizeCat(r.category) === 'alimentacao' || normalizeCat(r.category) === 'combustível' || normalizeCat(r.category) === 'combustivel'))
    .reduce((acc, r) => acc + Number(r.amount), 0);
  
  // Total profit from sales table (business performance)
  const lucroProdutos = sales?.reduce((acc, s) => acc + Number(s.total_profit), 0) || 0;
  
  // Balance calculation (Source of truth: financial_records + fixed_expenses)
  const totalGastosFixos = fixedExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;
  const saldoDisponivel = totalEntradas - totalSaques - totalReservas - totalGastosFixos;

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2)}`;

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

  const exportStatementPDF = () => {
    const doc = new jsPDF();
    const [yr, mo] = selectedMonth.split('-').map(Number);
    const monthName = safeFormat(new Date(yr, mo - 1, 1), "MMMM 'de' yyyy", { locale: ptBR });
    
    doc.setFillColor(147, 51, 234);
    doc.rect(0, 0, 220, 45, 'F');
    doc.setFillColor(219, 39, 119);
    doc.rect(0, 35, 220, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO FINANCEIRO", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${monthName}`, 105, 30, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    let yPos = 55;
    
    const summaryData = [
      { label: "Total Entradas", value: totalEntradas, color: [34, 197, 94] },
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
      doc.text(formatCurrency(item.value), x + cardWidth/2, yPos + 15, { align: "center" });
    });
    
    yPos += 30;
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(14, yPos, 182, 15, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("LUCRO LÍQUIDO DOS SERVIÇOS", 20, yPos + 6);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(lucroProdutos), 186, yPos + 10, { align: "right" });
    
    yPos += 25;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MOVIMENTAÇÕES", 14, yPos);
    
    const allTransactions: any[] = [];
    
    records.forEach(r => {
      allTransactions.push({
        date: r.record_date,
        description: r.description || (r.type === "entrada" ? "Entrada" : r.type === "saque" ? "Saque" : "Reserva"),
        type: r.category || (r.type === "entrada" ? "Entrada" : r.type === "saque" ? "Despesa" : "Reserva"),
        method: r.payment_method,
        amount: Number(r.amount),
        isEntry: r.type === "entrada"
      });
    });
    
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const tableData = allTransactions.map(t => [
      safeFormat(new Date(t.date + (t.date.length === 10 ? 'T12:00:00' : '')), "dd/MM/yyyy"),
      t.description,
      t.method || "-",
      t.type,
      t.isEntry ? `+ ${formatCurrency(t.amount)}` : `- ${formatCurrency(t.amount)}`
    ]);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Data", "Descrição", "Forma Pgto", "Tipo", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [147, 51, 234], textColor: 255, fontStyle: "bold", fontSize: 9 },
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
    
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(147, 51, 234);
    doc.rect(0, pageHeight - 20, 220, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${safeFormat(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 10);
    doc.text("Sistema de Gestão", 196, pageHeight - 10, { align: "right" });
    
    doc.save(`extrato-financeiro-${selectedMonth}.pdf`);
    toast({ title: "Extrato exportado!", description: "PDF salvo com sucesso." });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <TabGuideCards cards={[
        {
          icon: TrendingUp,
          title: 'Entradas e Vendas',
          badge: 'Receita',
          badgeColor: 'green',
          description: <>Total de <strong>Serviços</strong> e <strong>Produtos</strong> vendidos. Tudo o que entra no caixa do seu negócio.</>,
        },
        {
          icon: Fuel,
          title: 'Gastos de Rota',
          badge: 'Despesas',
          badgeColor: 'amber',
          description: <>Gastos com <strong>Combustível</strong> e <strong>Alimentação</strong> lançados automaticamente pelos prestadores.</>,
        },
        {
          icon: Calculator,
          title: 'Impostos e Lucro',
          badge: 'Inteligente',
          badgeColor: 'blue',
          description: <>Cálculo automático de <strong>Imposto (6%)</strong> e o lucro real após descontar custos e despesas fixas.</>,
        },
        {
          icon: Wallet,
          title: 'Saldo Disponível',
          badge: 'Caixa',
          badgeColor: 'purple',
          description: <>O valor que você tem <strong>em mãos agora</strong>, após descontar reservas e todos os gastos do mês.</>,
        },
      ]} />

      {/* Quick Actions Bar for Agility */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button 
          variant="outline" 
          onClick={() => handleQuickAdd('Combustível', 50, 'Abastecimento rápido')}
          className="h-16 flex flex-col gap-1 border-blue-500/30 hover:bg-blue-500/5 text-blue-600"
          disabled={saving || isLocked}
        >
          <Fuel className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Combustível R$50</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleQuickAdd('Alimentação', 30, 'Refeição rápida')}
          className="h-16 flex flex-col gap-1 border-orange-500/30 hover:bg-orange-500/5 text-orange-600"
          disabled={saving || isLocked}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Almoço R$30</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => handleQuickAdd('Peças', 100, 'Compra de material/peças')}
          className="h-16 flex flex-col gap-1 border-emerald-500/30 hover:bg-emerald-500/5 text-emerald-600"
          disabled={saving || isLocked}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Peças R$100</span>
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setDialogOpen(true)}
          className="h-16 flex flex-col gap-1 border-primary/30 hover:bg-primary/5 text-primary"
          disabled={saving || isLocked}
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase">Novo Personalizado</span>
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Controle Financeiro</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas entradas, saques e reservas</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2 py-1 rounded-md bg-muted">
              <strong>Atualizar</strong>: recarrega tudo e já reconcilia o mês (remove duplicatas/órfãos e sincroniza recorrentes).
            </span>
            <span className="px-2 py-1 rounded-md bg-muted">
              <strong>Reconciliar</strong>: remove duplicatas e órfãos do mês.
            </span>
            <span className="px-2 py-1 rounded-md bg-muted">
              <strong>Contratos do mês</strong>: força lançamento dos recorrentes.
            </span>
            <span className="px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
              <kbd className="font-mono">Ctrl+Shift+R</kbd>: limpa cache + corrige tudo.
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-auto min-w-[140px]"
          />
          <Button onClick={handleRefreshAll} variant="outline" size="sm" disabled={refreshing} className="min-w-[44px]">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button onClick={handleReconcile} variant="outline" size="sm" disabled={refreshing} className="min-w-[44px]" title="Remove duplicatas, órfãos e ressincroniza o mês">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Reconciliar</span>
          </Button>
          <Button onClick={handleSyncContracts} variant="outline" size="sm" disabled={refreshing} className="min-w-[44px] border-blue-300 text-blue-700 hover:bg-blue-50" title="Força o lançamento mensal dos contratos ativos">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-1">🔄 Contratos do mês</span>
          </Button>
          <Button onClick={exportStatementPDF} variant="outline" size="sm" className="min-w-[44px]">
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Extrato PDF</span>
          </Button>
          <Button onClick={() => setCsvDialogOpen(true)} variant="outline" size="sm" className="min-w-[44px]" title="Exportar CSV (Excel) com filtros">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">CSV</span>
          </Button>
          
          {/* Lock Button - Only for Owners */}
          {!localStorage.getItem('portal_member_name') && (
            <Button 
              variant={isLocked ? "destructive" : "outline"} 
              size="sm" 
              onClick={() => handleToggleLock()}
              disabled={refreshing}
              className="gap-2"
            >
              {isLocked ? <Wrench className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isLocked ? "Mês Bloqueado" : "Bloquear Mês"}</span>
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={(open) => !isLocked && setDialogOpen(open)}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent min-w-[44px]" disabled={isLocked}>
                <Plus className="h-4 w-4" />
                <span className="ml-1">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
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

      {/* Summary Cards - responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span className="truncate">Serviços</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-blue-600 truncate">{formatCurrency(totalServicos)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3 text-green-500 flex-shrink-0" />
              <span className="truncate">Produtos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-green-600 truncate">{formatCurrency(totalProdutos)}</p>
            <p className="text-[9px] text-emerald-600 mt-0.5">Lucro: {formatCurrency(lucroProdutos)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-teal-500 flex-shrink-0" />
              <span className="truncate">Contratos/Outras</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-teal-600 truncate">{formatCurrency(totalOutrasEntradas)}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Mensalidades/manuais</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Fuel className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <span className="truncate">Gastos Rotas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-orange-600 truncate">{formatCurrency(totalGastosRotas)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />
              <span className="truncate">Gastos Fixos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-red-600 truncate">{formatCurrency(totalGastosFixos)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-700/10 to-red-800/5 border-red-700/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3 w-3 text-red-700 flex-shrink-0" />
              <span className="truncate">Saques</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-red-700 truncate">{formatCurrency(totalSaques)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-indigo-500 flex-shrink-0" />
              <span className="truncate">Reservas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-indigo-600 truncate">{formatCurrency(totalReservas)}</p>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20 col-span-2 sm:col-span-1"
          title={`Entradas ${formatCurrency(totalEntradas)} − Saques ${formatCurrency(totalSaques)} − Reservas ${formatCurrency(totalReservas)} − Gastos Fixos ${formatCurrency(totalGastosFixos)} = ${formatCurrency(saldoDisponivel)}`}
        >
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="truncate">Saldo em Caixa</span>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="Como o Saldo em Caixa é calculado"
                className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/10 text-primary"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="w-full text-left"
              title="Clique para ver a fórmula completa"
            >
              <p className={`text-sm sm:text-lg font-bold truncate ${saldoDisponivel >= 0 ? "text-primary" : "text-red-500"}`}>
                {formatCurrency(saldoDisponivel)}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5 truncate underline decoration-dotted">
                Como calculamos?
              </p>
            </button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 col-span-2 sm:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3 text-amber-500 flex-shrink-0" />
              <span className="truncate">Imposto Previsto</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <p className="text-sm sm:text-lg font-bold text-amber-600 truncate">{formatCurrency(totalServicos * 0.06)}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Est. 6% sobre Serviços</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales from services */}
      {sales && sales.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              Vendas Registradas - {safeFormat(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Item</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Pagamento</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const hasLinkedRecord = linkedSaleIds.has(sale.id);
                    return (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs sm:text-sm py-2">{safeFormat(sale.sale_date, "dd/MM", { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs sm:text-sm font-medium py-2 max-w-[100px] truncate">{sale.clients?.name || "-"}</TableCell>
                      <TableCell className="text-xs sm:text-sm py-2 hidden sm:table-cell max-w-[120px] truncate">{sale.products?.name || "-"}</TableCell>
                      <TableCell className="text-xs sm:text-sm py-2 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          {getPaymentIcon(sale.payment_method)}
                          <span className="hidden lg:inline">{sale.payment_method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right font-medium text-green-500 py-2">
                        {formatCurrency(Number(sale.sale_price) * sale.qty)}
                        {!hasLinkedRecord && <div className="text-[9px] text-amber-600">incluído no total</div>}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm text-right font-medium text-emerald-500 py-2">
                        {formatCurrency(Number(sale.total_profit))}
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring Contracts */}
      {(() => {
        const contractRows = records.filter((r) => {
          const d = (r.description || '').toLowerCase().trim();
          const c = (r.category || '').toLowerCase().trim();
          return r.type === 'entrada' && (c === 'contrato' || d.startsWith('auto:contract:'));
        });
        if (contractRows.length === 0) return null;
        const totalContracts = contractRows.reduce((a, r) => a + Number(r.amount), 0);
        const cleanDesc = (d: string) => {
          // Remove tag técnica "auto:contract:xxx | mensal |" e mostra só o nome legível
          const parts = (d || '').split('|').map((s) => s.trim());
          if (parts[0]?.toLowerCase().startsWith('auto:contract:')) {
            return parts.slice(2).join(' - ') || parts[parts.length - 1] || d;
          }
          return d;
        };
        return (
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-teal-500" />
                Contratos Recorrentes - {safeFormat(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), "MMMM yyyy", { locale: ptBR })}
                <span className="ml-auto text-xs sm:text-sm font-semibold text-teal-600">{formatCurrency(totalContracts)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Contrato</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Pagamento</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs sm:text-sm py-2">{safeFormat(r.record_date, "dd/MM", { locale: ptBR })}</TableCell>
                        <TableCell className="text-xs sm:text-sm py-2 max-w-[260px] truncate">{cleanDesc(r.description || '')}</TableCell>
                        <TableCell className="text-xs sm:text-sm py-2 hidden md:table-cell">
                          <div className="flex items-center gap-1">{getPaymentIcon(r.payment_method)}<span className="hidden lg:inline">{r.payment_method}</span></div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-right font-medium text-teal-600 py-2">{formatCurrency(Number(r.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Manual Records Table */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base">
              Registros Manuais - {safeFormat(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1), "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchRecords} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {(() => {
            // Mostrar APENAS lançamentos verdadeiramente manuais.
            // Tudo que é gerado automaticamente (baixa de agendamento, PDV,
            // contrato recorrente, despesas auto) tem seu próprio bloco acima
            // e deve ser ocultado aqui para não confundir o cliente.
            const isAuto = (r: FinancialRecord) => {
              if (r.appointment_id) return true;
              if (r.sale_id) return true;
              const d = (r.description || '').toLowerCase().trim();
              const c = (r.category || '').toLowerCase().trim();
              if (d.startsWith('auto:')) return true;
              if (d.includes('serviço concluído') || d.includes('servico concluido')) return true;
              if (c.startsWith('serviç') || c.startsWith('servic')) return true;
              if (c === 'contrato') return true;
              return false;
            };
            const manualRecords = records.filter((r) => !isAuto(r));
            if (loading) {
              return (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              );
            }
            if (manualRecords.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Nenhum registro manual encontrado para este mês</p>
                  <p className="text-[10px] mt-1 opacity-70">Lançamentos automáticos de agendamentos/PDV aparecem nas seções acima.</p>
                </div>
              );
            }
            return (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Pagamento</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Parcelas</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Data</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          {getTypeIcon(record.type)}
                          <span className="capitalize text-xs sm:text-sm">{record.type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm py-2 max-w-[100px] sm:max-w-[200px] truncate">{record.description || "-"}</TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          {getPaymentIcon(record.payment_method)}
                          <span className="text-xs hidden lg:inline">{record.payment_method || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2 hidden md:table-cell">
                        {record.installments && record.installments > 1 ? `${record.installments}x` : "-"}
                      </TableCell>
                      <TableCell className={`text-xs sm:text-sm text-right font-medium py-2 ${
                        record.type === "entrada" ? "text-green-500" : 
                        record.type === "saque" ? "text-red-500" : "text-blue-500"
                      }`}>
                        {formatCurrency(Number(record.amount))}
                      </TableCell>
                      <TableCell className="text-xs py-2 hidden sm:table-cell">
                        {safeFormat(record.record_date, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          disabled={isLocked}
                          className="text-destructive hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            );
          })()}
        </CardContent>
      </Card>
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Exportar CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o que incluir no extrato do mês <strong>{selectedMonth}</strong>. O resumo total é sempre incluído.
            </p>
            {([
              ['vendas', 'Vendas (PDV / Agenda)'],
              ['movimentacoes', 'Movimentações (entradas e saídas)'],
              ['salarios', 'Salários dos funcionários'],
              ['vale', 'Vales / Adiantamentos'],
              ['prestadores', 'Custo mensal de prestadores'],
              ['despesasFixas', 'Despesas fixas (todas)'],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={csvFilters[k]}
                  onCheckedChange={(v) => setCsvFilters((f) => ({ ...f, [k]: v === true }))}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleExportCsv} disabled={csvBusy}>
              {csvBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Baixar CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reconciliation result panel */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Reconciliação · {selectedMonth}
            </DialogTitle>
          </DialogHeader>
          {reconcileResult && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Vendas órfãs removidas</div>
                  <div className="text-2xl font-semibold text-rose-600">{reconcileResult.orphanSales}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Lançamentos órfãos removidos</div>
                  <div className="text-2xl font-semibold text-rose-600">{reconcileResult.orphanRecords}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Vendas duplicadas removidas</div>
                  <div className="text-2xl font-semibold text-amber-600">{reconcileResult.dupSales}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Lançamentos duplicados removidos</div>
                  <div className="text-2xl font-semibold text-amber-600">{reconcileResult.dupRecords}</div>
                </div>
                <div className="rounded-md border p-3 col-span-2">
                  <div className="text-xs text-muted-foreground">Despesas recorrentes inseridas</div>
                  <div className="text-2xl font-semibold text-emerald-600">{reconcileResult.insertedRecurring}</div>
                </div>
              </div>

              {reconcileResult.details.insertedRecurringRows.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Recorrentes adicionadas</div>
                  <ul className="space-y-1 text-xs max-h-40 overflow-y-auto">
                    {reconcileResult.details.insertedRecurringRows.map((r, i) => (
                      <li key={i} className="flex justify-between gap-2 border-b last:border-0 py-1">
                        <span className="truncate">
                          <span className="font-medium">{r.helper_name || r.category}</span>
                          <span className="text-muted-foreground"> · {r.category}</span>
                        </span>
                        <span className="tabular-nums">R$ {r.amount.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(reconcileResult.details.orphanSaleIds.length > 0 ||
                reconcileResult.details.orphanRecordIds.length > 0 ||
                reconcileResult.details.dupSaleIds.length > 0 ||
                reconcileResult.details.dupRecordIds.length > 0) && (
                <div>
                  <div className="font-medium mb-1">IDs removidos</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {reconcileResult.details.orphanSaleIds.length > 0 && (
                      <div><strong>Vendas órfãs:</strong> {reconcileResult.details.orphanSaleIds.join(', ')}</div>
                    )}
                    {reconcileResult.details.dupSaleIds.length > 0 && (
                      <div><strong>Vendas dup.:</strong> {reconcileResult.details.dupSaleIds.join(', ')}</div>
                    )}
                    {reconcileResult.details.orphanRecordIds.length > 0 && (
                      <div className="break-all"><strong>Lanç. órfãos:</strong> {reconcileResult.details.orphanRecordIds.join(', ')}</div>
                    )}
                    {reconcileResult.details.dupRecordIds.length > 0 && (
                      <div className="break-all"><strong>Lanç. dup.:</strong> {reconcileResult.details.dupRecordIds.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Registro salvo no log de auditoria (financial_reconciliation_log).
              </p>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setReconcileDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
