import React, { useState } from 'react';
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
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import {
  Calculator,
  TrendingUp,
  FileText,
  DollarSign,
  Users,
  Receipt,
  Download,
  Save,
  RefreshCw,
  Building2,
  Briefcase,
  Percent,
  Fuel,
  Package,
  Wrench,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

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

  // Fetch monthly revenue from sales
  const { data: monthlyRevenue } = useQuery({
    queryKey: ['monthly-revenue', selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      
      const [salesResult, appointmentsResult, expensesResult] = await Promise.all([
        supabase
          .from('sales')
          .select('sale_price, qty, products(type)')
          .gte('sale_date', startDate)
          .lte('sale_date', endDate),
        supabase
          .from('appointments')
          .select('*, products(price, type)')
          .eq('status', 'concluído')
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate),
        supabase
          .from('fixed_expenses')
          .select('amount, category')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate)
      ]);

      const productRevenue = salesResult.data?.reduce((sum, sale) => 
        sum + (Number(sale.sale_price) * sale.qty), 0) || 0;
      
      const serviceRevenue = appointmentsResult.data?.reduce((sum, apt) => 
        sum + (Number(apt.products?.price) || 0), 0) || 0;

      const expenses = expensesResult.data?.reduce((acc, exp) => {
        acc.total += Number(exp.amount);
        if (exp.category === 'combustível' || exp.category === 'combustivel') {
          acc.fuel += Number(exp.amount);
        } else if (exp.category === 'material' || exp.category === 'peças') {
          acc.material += Number(exp.amount);
        } else if (exp.category === 'equipamento') {
          acc.equipment += Number(exp.amount);
        } else {
          acc.other += Number(exp.amount);
        }
        return acc;
      }, { total: 0, fuel: 0, material: 0, equipment: 0, other: 0 }) || { total: 0, fuel: 0, material: 0, equipment: 0, other: 0 };

      return {
        total: productRevenue + serviceRevenue,
        products: productRevenue,
        services: serviceRevenue,
        expenses
      };
    }
  });

  // Load form data when tax record changes
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
    } else {
      // Reset form when no record exists
      setFormData(prev => ({
        ...prev,
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
      }));
    }
  }, [taxRecord]);

  const pullMonthlyData = () => {
    if (monthlyRevenue) {
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
      toast.success('Dados do mês importados com sucesso!');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada');
        return;
      }

      const recordData = {
        ...formData,
        user_id: session.user.id,
        month_year: selectedMonth,
        record_date: `${selectedMonth}-01`
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

  const generatePDFContabilidade = () => {
    const doc = new jsPDF();
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    
    doc.setFontSize(18);
    doc.text('Relatório para Contabilidade', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Período: ${monthLabel}`, 105, 30, { align: 'center' });
    
    let y = 45;
    
    // Faturamento
    doc.setFontSize(14);
    doc.text('FATURAMENTO', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Faturamento Total: R$ ${formData.total_revenue.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Serviços: R$ ${formData.revenue_from_services.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Produtos: R$ ${formData.revenue_from_products.toFixed(2)}`, 25, y); y += 12;
    
    // Impostos
    doc.setFontSize(14);
    doc.text('IMPOSTOS E GUIAS', 20, y); y += 10;
    doc.setFontSize(10);
    doc.text(`DAS (Simples Nacional): R$ ${formData.das_value.toFixed(2)}`, 25, y); y += 7;
    doc.text(`INSS: R$ ${formData.inss_value.toFixed(2)}`, 25, y); y += 7;
    doc.text(`FGTS: R$ ${formData.fgts_value.toFixed(2)}`, 25, y); y += 7;
    doc.text(`IRRF: R$ ${formData.irrf_value.toFixed(2)}`, 25, y); y += 7;
    doc.text(`ISS: R$ ${formData.iss_value.toFixed(2)}`, 25, y); y += 7;
    doc.text(`Outros: R$ ${formData.other_taxes.toFixed(2)}`, 25, y); y += 7;
    doc.text(`TOTAL IMPOSTOS: R$ ${totalTaxes.toFixed(2)}`, 25, y); y += 12;
    
    // Despesas
    doc.setFontSize(14);
    doc.text('DESPESAS OPERACIONAIS', 20, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Total Despesas: R$ ${formData.total_expenses.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Combustível: R$ ${formData.fuel_expenses.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Materiais: R$ ${formData.material_expenses.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Equipamentos: R$ ${formData.equipment_expenses.toFixed(2)}`, 25, y); y += 7;
    doc.text(`  - Outros: R$ ${formData.other_expenses.toFixed(2)}`, 25, y); y += 12;
    
    // Funcionário
    if (formData.employee_name) {
      doc.setFontSize(14);
      doc.text('GASTOS COM FUNCIONÁRIO', 20, y); y += 10;
      doc.setFontSize(10);
      doc.text(`Nome: ${formData.employee_name}`, 25, y); y += 7;
      doc.text(`Registrado: ${formData.employee_is_registered ? 'Sim' : 'Não'}`, 25, y); y += 7;
      doc.text(`Salário: R$ ${formData.employee_salary.toFixed(2)}`, 25, y); y += 7;
      doc.text(`INSS Funcionário: R$ ${formData.employee_inss.toFixed(2)}`, 25, y); y += 7;
      doc.text(`FGTS Funcionário: R$ ${formData.employee_fgts.toFixed(2)}`, 25, y); y += 7;
      doc.text(`TOTAL FUNCIONÁRIO: R$ ${employeeCosts.toFixed(2)}`, 25, y); y += 12;
    }
    
    // Resumo
    doc.setFontSize(14);
    doc.text('RESUMO', 20, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Faturamento: R$ ${formData.total_revenue.toFixed(2)}`, 25, y); y += 7;
    doc.text(`(-) Impostos: R$ ${totalTaxes.toFixed(2)}`, 25, y); y += 7;
    doc.text(`(-) Despesas: R$ ${formData.total_expenses.toFixed(2)}`, 25, y); y += 7;
    doc.text(`(-) Funcionário: R$ ${employeeCosts.toFixed(2)}`, 25, y); y += 7;
    doc.setFontSize(12);
    doc.text(`= LUCRO LÍQUIDO: R$ ${netProfit.toFixed(2)}`, 25, y);
    
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
      {/* Header com seleção de mês */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Gestão de Impostos
          </h2>
          <p className="text-muted-foreground text-sm">Controle faturamento, impostos e gastos para declaração</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
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
          
          <Button variant="outline" onClick={pullMonthlyData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Puxar Dados
          </Button>
        </div>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Faturamento</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
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
            <div className="text-2xl font-bold text-red-600 mt-1">
              R$ {totalTaxes.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Despesas</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              R$ {formData.total_expenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800' : 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800'}`}>
          <CardContent className="p-4">
            <div className={`flex items-center gap-2 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              <Calculator className="w-4 h-4" />
              <span className="text-xs font-medium">Lucro Líquido</span>
            </div>
            <div className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              R$ {netProfit.toFixed(2)}
            </div>
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