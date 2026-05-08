import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from 'sonner';
import { getCurrentCompanyBranding } from '@/lib/companyBranding';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildMonthDataset, parseDanfeXml, type DanfeParsed, buildMonthCsv, downloadCsv } from '@/utils/financialExport';
import {
  Calculator, TrendingUp, FileText, DollarSign, Users, Receipt, Download, Save,
  RefreshCw, Building2, Briefcase, Percent, Fuel, Package, Wrench, ChevronDown,
  ChevronUp, Upload, Trash2, FileSpreadsheet, FilePlus, ArrowUpRight, ArrowDownRight,
  Banknote
} from 'lucide-react';
import TabGuideCards from './TabGuideCards';

interface PayrollRow {
  member_id?: string;
  name: string;
  salary: number;
  vale: number;
  inss: number;
  fgts: number;
  expense_category?: string;
}

interface ProviderCostRow {
  name: string;
  monthly_cost: number;
}

interface XmlImport {
  id: string;
  chave?: string;
  emitente?: string;
  numero?: string;
  data?: string;
  valorProdutos: number;
  valorImpostos: number;
  valorTotal: number;
  itensCount: number;
  importedAt: string;
}

const ImpostosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [expandedSection, setExpandedSection] = useState<string | null>('faturamento');

  // Form state
  const [formData, setFormData] = useState({
    total_revenue: 0,
    revenue_from_services: 0,
    revenue_from_products: 0,
    das_value: 0,
    inss_value: 0,
    fgts_value: 0,
    irrf_value: 0,
    iss_value: 0,
    other_taxes: 0,
    employee_name: '',
    employee_salary: 0,
    employee_is_registered: false,
    employee_inss: 0,
    employee_fgts: 0,
    total_expenses: 0,
    fuel_expenses: 0,
    material_expenses: 0,
    equipment_expenses: 0,
    other_expenses: 0,
    notes: ''
  });

  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [providerCosts, setProviderCosts] = useState<ProviderCostRow[]>([]);
  const [xmlImports, setXmlImports] = useState<XmlImport[]>([]);
  const [danfePreview, setDanfePreview] = useState<DanfeParsed | null>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const autoPulledRef = useRef<string | null>(null);
  // Generate last 12 months for selection
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  // Fetch tax record for selected month
  const { data: taxRecord, isLoading } = useQuery({
    queryKey: ['tax-record', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_records')
        .select('*')
        .eq('month_year', selectedMonth)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch monthly revenue and expenses from centralized financial_records
  const { data: monthlyRevenue } = useQuery({
    queryKey: ['monthly-revenue-centralized', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      
      const { data: records, error } = await supabase
        .from('financial_records')
        .select('*')
        .gte('record_date', startDate)
        .lte('record_date', endDate);
      
      if (error) throw error;

      const results = {
        total: 0,
        products: 0,
        services: 0,
        expenses: { total: 0, fuel: 0, material: 0, equipment: 0, other: 0 }
      };

      records?.forEach(r => {
        const amount = Number(r.amount);
        if (r.type === 'entrada') {
          results.total += amount;
          if (r.category === 'Serviço') {
            results.services += amount;
          } else if (r.category === 'Produto') {
            results.products += amount;
          }
        } else if (r.type === 'saque') {
          results.expenses.total += amount;
          if (r.category === 'Combustível' || r.category === 'Combustivel') {
            results.expenses.fuel += amount;
          } else if (r.category === 'Material' || r.category === 'Peças') {
            results.expenses.material += amount;
          } else {
            results.expenses.other += amount;
          }
        }
      });

      // Also include fixed expenses
      const { data: fixedExps } = await supabase
        .from('fixed_expenses')
        .select('amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);
      
      fixedExps?.forEach(e => {
        const amt = Number(e.amount);
        results.expenses.total += amt;
        results.expenses.other += amt;
      });

      return results;
    }
  });

  // Auto-pull data when month changes and no saved record exists
  React.useEffect(() => {
    if (!taxRecord && monthlyRevenue) {
      setFormData(prev => ({
        ...prev,
        total_revenue: monthlyRevenue.total,
        revenue_from_services: monthlyRevenue.services,
        revenue_from_products: monthlyRevenue.products,
        total_expenses: monthlyRevenue.expenses.total,
        fuel_expenses: monthlyRevenue.expenses.fuel,
        material_expenses: monthlyRevenue.expenses.material,
        equipment_expenses: monthlyRevenue.expenses.equipment,
        other_expenses: monthlyRevenue.expenses.other
      }));
    }
  }, [monthlyRevenue, taxRecord, selectedMonth]);

  // Load form data + payroll/providers/xml when tax record changes
  React.useEffect(() => {
    if (taxRecord) {
      setFormData({
        total_revenue: Number(taxRecord.total_revenue) || 0,
        revenue_from_services: Number(taxRecord.revenue_from_services) || 0,
        revenue_from_products: Number(taxRecord.revenue_from_products) || 0,
        das_value: Number(taxRecord.das_value) || 0,
        inss_value: Number(taxRecord.inss_value) || 0,
        fgts_value: Number(taxRecord.fgts_value) || 0,
        irrf_value: Number(taxRecord.irrf_value) || 0,
        iss_value: Number(taxRecord.iss_value) || 0,
        other_taxes: Number(taxRecord.other_taxes) || 0,
        employee_name: taxRecord.employee_name || '',
        employee_salary: Number(taxRecord.employee_salary) || 0,
        employee_is_registered: taxRecord.employee_is_registered || false,
        employee_inss: Number(taxRecord.employee_inss) || 0,
        employee_fgts: Number(taxRecord.employee_fgts) || 0,
        total_expenses: Number(taxRecord.total_expenses) || 0,
        fuel_expenses: Number(taxRecord.fuel_expenses) || 0,
        material_expenses: Number(taxRecord.material_expenses) || 0,
        equipment_expenses: Number(taxRecord.equipment_expenses) || 0,
        other_expenses: Number(taxRecord.other_expenses) || 0,
        notes: taxRecord.notes || ''
      });
      setPayroll(Array.isArray((taxRecord as any).payroll_data) ? (taxRecord as any).payroll_data : []);
      setProviderCosts(Array.isArray((taxRecord as any).provider_costs) ? (taxRecord as any).provider_costs : []);
      setXmlImports(Array.isArray((taxRecord as any).xml_imports) ? (taxRecord as any).xml_imports : []);
    } else {
      setFormData(prev => ({
        ...prev,
        total_revenue: 0, revenue_from_services: 0, revenue_from_products: 0,
        das_value: 0, inss_value: 0, fgts_value: 0, irrf_value: 0, iss_value: 0, other_taxes: 0,
        employee_name: '', employee_salary: 0, employee_is_registered: false,
        employee_inss: 0, employee_fgts: 0,
        total_expenses: 0, fuel_expenses: 0, material_expenses: 0, equipment_expenses: 0, other_expenses: 0,
        notes: ''
      }));
      setPayroll([]); setProviderCosts([]); setXmlImports([]);
    }
  }, [taxRecord]);

  const pullMonthlyData = async (silent = false) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session) return;
    setSyncing(true);
    try {
      const ds = await buildMonthDataset(session.user.id, selectedMonth);
      setFormData(prev => ({
        ...prev,
        total_revenue: ds.totals.receitaBruta,
        revenue_from_services: ds.totals.receitaServicos,
        revenue_from_products: ds.totals.receitaProdutos,
        total_expenses: ds.totals.despesasTotais,
        fuel_expenses: monthlyRevenue?.expenses.fuel || prev.fuel_expenses,
        material_expenses: monthlyRevenue?.expenses.material || prev.material_expenses,
        equipment_expenses: monthlyRevenue?.expenses.equipment || prev.equipment_expenses,
        other_expenses: monthlyRevenue?.expenses.other || prev.other_expenses,
      }));
      // Merge payroll: keep manually-entered INSS/FGTS if member already there
      setPayroll(prev => ds.payroll.map(p => {
        const old = prev.find(x => x.name === p.name);
        return {
          name: p.name,
          salary: p.salary,
          vale: p.vale,
          expense_category: p.expense_category,
          inss: old?.inss || 0,
          fgts: old?.fgts || 0,
        };
      }));
      setProviderCosts(ds.providerCosts);
      setLastSyncedAt(new Date());
      if (!silent) {
        toast.success('✅ Dados sincronizados', { description: `${ds.payroll.length} funcionário(s), ${ds.providerCosts.length} prestador(es).` });
      }
    } catch (e: any) {
      if (!silent) toast.error('Erro ao sincronizar: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-pull once per month when there's no saved tax record yet
  React.useEffect(() => {
    if (!taxRecord && monthlyRevenue && autoPulledRef.current !== selectedMonth) {
      autoPulledRef.current = selectedMonth;
      pullMonthlyData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxRecord, monthlyRevenue, selectedMonth]);

  const handleXmlUpload = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseDanfeXml(text);
      setDanfePreview(parsed);
    } catch (e: any) {
      toast.error('XML inválido: ' + e.message);
    }
  };

  const confirmDanfeImport = (asMaterial: boolean) => {
    if (!danfePreview) return;
    const entry: XmlImport = {
      id: crypto.randomUUID(),
      chave: danfePreview.chave,
      emitente: danfePreview.emitente?.nome,
      numero: danfePreview.numero,
      data: danfePreview.dataEmissao,
      valorProdutos: danfePreview.valorProdutos,
      valorImpostos: danfePreview.valorImpostos,
      valorTotal: danfePreview.valorTotal,
      itensCount: danfePreview.itens.length,
      importedAt: new Date().toISOString(),
    };
    setXmlImports(prev => [...prev, entry]);
    if (asMaterial) {
      setFormData(prev => ({
        ...prev,
        material_expenses: prev.material_expenses + entry.valorProdutos,
        total_expenses: prev.total_expenses + entry.valorTotal,
      }));
    }
    setDanfePreview(null);
    if (xmlInputRef.current) xmlInputRef.current.value = '';
    toast.success('DANFE anexada!', { description: `Total R$ ${entry.valorTotal.toFixed(2)} registrado.` });
  };

  const removeXml = (id: string) => {
    const x = xmlImports.find(i => i.id === id);
    setXmlImports(prev => prev.filter(i => i.id !== id));
    if (x) {
      setFormData(prev => ({
        ...prev,
        material_expenses: Math.max(0, prev.material_expenses - x.valorProdutos),
        total_expenses: Math.max(0, prev.total_expenses - x.valorTotal),
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) {
        toast.error('Sessão expirada');
        return;
      }

      const recordData = {
        ...formData,
        user_id: session.user.id,
        month_year: selectedMonth,
        record_date: `${selectedMonth}-01`,
        payroll_data: payroll as any,
        provider_costs: providerCosts as any,
        xml_imports: xmlImports as any,
      };

      if (taxRecord?.id) {
        const { error } = await supabase
          .from('tax_records')
          .update(recordData)
          .eq('id', taxRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tax_records')
          .insert(recordData);
        if (error) throw error;
      }

      toast.success('Dados salvos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tax-record', selectedMonth] });
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const totalTaxes = formData.das_value + formData.inss_value + formData.fgts_value + 
    formData.irrf_value + formData.iss_value + formData.other_taxes;
  
  const employeeCosts = formData.employee_salary + formData.employee_inss + formData.employee_fgts;
  const netProfit = formData.total_revenue - totalTaxes - formData.total_expenses - employeeCosts;

  const generatePDFContabilidade = async () => {
    const doc = new jsPDF();
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const pageWidth = doc.internal.pageSize.getWidth();
    const branding = await getCurrentCompanyBranding();
    const logoBase64 = branding.logoBase64;
    const companyName = branding.companyName;
    const companyCnpj = branding.cnpjCpf;
    
    // Header
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    let headerX = 15;
    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', 15, 8, 30, 30); headerX = 50; } catch {}
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'Relatório Contábil', headerX, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text(`Período: ${monthLabel}`, headerX, 30);
    if (companyCnpj) doc.text(`CNPJ/CPF: ${companyCnpj}`, headerX, 37);
    
    let y = 60;
    doc.setTextColor(40, 40, 40);
    
    const addLine = (label: string, value: number, indent = 25) => {
      doc.setFontSize(10);
      doc.text(label, indent, y);
      doc.text(`R$ ${value.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
    };
    
    const addTitle = (title: string) => {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(title, 15, y);
      doc.setDrawColor(200, 200, 200);
      doc.line(15, y + 2, pageWidth - 15, y + 2);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
    };
    
    addTitle('FATURAMENTO');
    addLine('Faturamento Total', formData.total_revenue);
    addLine('  - Serviços', formData.revenue_from_services);
    addLine('  - Produtos', formData.revenue_from_products);
    y += 5;
    
    addTitle('IMPOSTOS E GUIAS');
    addLine('DAS (Simples Nacional)', formData.das_value);
    addLine('INSS', formData.inss_value);
    addLine('FGTS', formData.fgts_value);
    addLine('IRRF', formData.irrf_value);
    addLine('ISS', formData.iss_value);
    addLine('Outros', formData.other_taxes);
    doc.setFont('helvetica', 'bold');
    addLine('TOTAL IMPOSTOS', totalTaxes);
    doc.setFont('helvetica', 'normal');
    y += 5;
    
    addTitle('DESPESAS OPERACIONAIS');
    addLine('Combustível', formData.fuel_expenses);
    addLine('Materiais', formData.material_expenses);
    addLine('Equipamentos', formData.equipment_expenses);
    addLine('Outros', formData.other_expenses);
    doc.setFont('helvetica', 'bold');
    addLine('TOTAL DESPESAS', formData.total_expenses);
    doc.setFont('helvetica', 'normal');
    y += 5;
    
    if (formData.employee_name) {
      addTitle('FUNCIONÁRIO');
      doc.text(`Nome: ${formData.employee_name} • ${formData.employee_is_registered ? 'CLT' : 'Informal'}`, 25, y); y += 7;
      addLine('Salário', formData.employee_salary);
      addLine('INSS', formData.employee_inss);
      addLine('FGTS', formData.employee_fgts);
      doc.setFont('helvetica', 'bold');
      addLine('TOTAL FUNCIONÁRIO', employeeCosts);
      doc.setFont('helvetica', 'normal');
      y += 5;
    }
    
    // Summary box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(15, y, pageWidth - 30, 40, 3, 3, 'F');
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 24, 27);
    doc.text('RESUMO', 20, y); y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Faturamento: R$ ${formData.total_revenue.toFixed(2)}`, 20, y);
    doc.text(`(-) Impostos: R$ ${totalTaxes.toFixed(2)}`, pageWidth / 2, y);
    y += 7;
    doc.text(`(-) Despesas: R$ ${formData.total_expenses.toFixed(2)}`, 20, y);
    doc.text(`(-) Funcionário: R$ ${employeeCosts.toFixed(2)}`, pageWidth / 2, y);
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const profitColor = netProfit >= 0 ? [34, 197, 94] : [239, 68, 68];
    doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
    doc.text(`LUCRO LÍQUIDO: R$ ${netProfit.toFixed(2)}`, pageWidth / 2, y, { align: 'center' });
    
    // Tax percentage
    if (formData.total_revenue > 0) {
      y += 12;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Carga tributária: ${((totalTaxes / formData.total_revenue) * 100).toFixed(1)}% do faturamento`, pageWidth / 2, y, { align: 'center' });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`relatorio-contabilidade-${selectedMonth}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const SectionHeader = ({ id, title, icon: Icon, value }: { id: string; title: string; icon: any; value?: number }) => (
    <div 
      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <span className="font-medium">{title}</span>
        {value !== undefined && (
          <Badge variant="secondary" className="ml-2">
            R$ {value.toFixed(2)}
          </Badge>
        )}
      </div>
      {expandedSection === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </div>
  );

  return (
    <div className="space-y-6">
      <TabGuideCards cards={[
        {
          icon: Calculator,
          title: 'Impostos MEI/ME',
          badge: 'Obrigatório',
          badgeColor: 'rose',
          description: <>Registre <strong>DAS, INSS, FGTS e ISS</strong> mensalmente. Mantenha tudo organizado para o contador.</>,
        },
        {
          icon: FileText,
          title: 'PDF Contabilidade',
          badge: 'Exportar',
          badgeColor: 'blue',
          description: <>Gere relatórios <strong>prontos para o contador</strong> com receitas, despesas e impostos do mês.</>,
        },
      ]} />
      {/* Header com seleção de mês */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Gestão de Impostos
          </h2>
          <p className="text-muted-foreground text-sm">Controle faturamento, impostos e gastos para declaração</p>
        </div>
        
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]" aria-label="Selecionar mês de referência">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => pullMonthlyData(false)}
            disabled={syncing}
            title="Sincronizar com Financeiro, Funcionários e Prestadores"
            aria-label="Puxar dados do Financeiro, Funcionários e Prestadores"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Puxar Dados'}
          </Button>

          {lastSyncedAt && (
            <span className="text-[11px] text-muted-foreground" title={lastSyncedAt.toLocaleString('pt-BR')}>
              Sincronizado às {format(lastSyncedAt, 'HH:mm')}
            </span>
          )}
        </div>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Faturamento</span>
            </div>
            <div className="text-xl font-bold text-green-600 mt-1">
              R$ {formData.total_revenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <Receipt className="w-4 h-4" />
              <span className="text-xs font-medium">Impostos</span>
            </div>
            <div className="text-xl font-bold text-red-600 mt-1">
              R$ {totalTaxes.toFixed(2)}
            </div>
            {formData.total_revenue > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {((totalTaxes / formData.total_revenue) * 100).toFixed(1)}% do faturamento
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <div className="text-xl font-bold text-amber-600 mt-1">
              R$ {formData.total_expenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Funcionário</span>
            </div>
            <div className="text-xl font-bold text-purple-600 mt-1">
              R$ {employeeCosts.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800' : 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800'}`}>
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              <Calculator className="w-4 h-4" />
              <span className="text-xs font-medium">Lucro Líquido</span>
            </div>
            <div className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              R$ {netProfit.toFixed(2)}
            </div>
            {formData.total_revenue > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Margem: {((netProfit / formData.total_revenue) * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Formulário Acordeão */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {/* Faturamento */}
          <div className="border rounded-lg">
            <SectionHeader id="faturamento" title="Faturamento do Mês" icon={TrendingUp} value={formData.total_revenue} />
            {expandedSection === 'faturamento' && (
              <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Faturamento Total</Label>
                  <Input
                    type="number"
                    value={formData.total_revenue}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_revenue: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receita de Serviços</Label>
                  <Input
                    type="number"
                    value={formData.revenue_from_services}
                    onChange={(e) => setFormData(prev => ({ ...prev, revenue_from_services: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receita de Produtos</Label>
                  <Input
                    type="number"
                    value={formData.revenue_from_products}
                    onChange={(e) => setFormData(prev => ({ ...prev, revenue_from_products: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Impostos */}
          <div className="border rounded-lg">
            <SectionHeader id="impostos" title="Impostos e Guias" icon={Receipt} value={totalTaxes} />
            {expandedSection === 'impostos' && (
              <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>DAS (Simples Nacional)</Label>
                  <Input
                    type="number"
                    value={formData.das_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, das_value: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>INSS</Label>
                  <Input
                    type="number"
                    value={formData.inss_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, inss_value: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>FGTS</Label>
                  <Input
                    type="number"
                    value={formData.fgts_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, fgts_value: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IRRF</Label>
                  <Input
                    type="number"
                    value={formData.irrf_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, irrf_value: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ISS</Label>
                  <Input
                    type="number"
                    value={formData.iss_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, iss_value: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outros Impostos</Label>
                  <Input
                    type="number"
                    value={formData.other_taxes}
                    onChange={(e) => setFormData(prev => ({ ...prev, other_taxes: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Despesas */}
          <div className="border rounded-lg">
            <SectionHeader id="despesas" title="Despesas Operacionais" icon={Fuel} value={formData.total_expenses} />
            {expandedSection === 'despesas' && (
              <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total Despesas</Label>
                  <Input
                    type="number"
                    value={formData.total_expenses}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_expenses: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Combustível</Label>
                  <Input
                    type="number"
                    value={formData.fuel_expenses}
                    onChange={(e) => setFormData(prev => ({ ...prev, fuel_expenses: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Materiais</Label>
                  <Input
                    type="number"
                    value={formData.material_expenses}
                    onChange={(e) => setFormData(prev => ({ ...prev, material_expenses: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipamentos</Label>
                  <Input
                    type="number"
                    value={formData.equipment_expenses}
                    onChange={(e) => setFormData(prev => ({ ...prev, equipment_expenses: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outras Despesas</Label>
                  <Input
                    type="number"
                    value={formData.other_expenses}
                    onChange={(e) => setFormData(prev => ({ ...prev, other_expenses: Number(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Funcionário */}
          <div className="border rounded-lg">
            <SectionHeader id="funcionario" title="Gastos com Funcionário" icon={Users} value={employeeCosts} />
            {expandedSection === 'funcionario' && (
              <div className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Funcionário</Label>
                    <Input
                      value={formData.employee_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_name: e.target.value }))}
                      placeholder="Nome do funcionário (opcional)"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <Label>Registrado (CLT)?</Label>
                    <Switch
                      checked={formData.employee_is_registered}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, employee_is_registered: checked }))}
                    />
                    <Badge variant={formData.employee_is_registered ? "default" : "secondary"}>
                      {formData.employee_is_registered ? "Registrado" : "Não Registrado"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Salário</Label>
                    <Input
                      type="number"
                      value={formData.employee_salary}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_salary: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>INSS (Funcionário)</Label>
                    <Input
                      type="number"
                      value={formData.employee_inss}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_inss: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>FGTS (Funcionário)</Label>
                    <Input
                      type="number"
                      value={formData.employee_fgts}
                      onChange={(e) => setFormData(prev => ({ ...prev, employee_fgts: Number(e.target.value) }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="border rounded-lg">
            <SectionHeader id="notas" title="Observações / Notas" icon={FileText} />
            {expandedSection === 'notas' && (
              <div className="p-4 pt-0">
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações importantes para a contabilidade..."
                  rows={4}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button variant="outline" onClick={generatePDFContabilidade}>
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF Contabilidade
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Salvando...' : 'Salvar Dados'}
        </Button>
      </div>
    </div>
  );
};

export default ImpostosTab;