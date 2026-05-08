import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentCompanyBranding } from '@/lib/companyBranding';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Fuel, Utensils, Users, MoreHorizontal, Calendar, FileDown, RefreshCw, Copy, MapPin, Zap, Globe, Megaphone, DollarSign, Wrench } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureMonthlyRecurringExpenses } from '@/utils/recurringSync';

const categories = [
  { value: 'combustivel', label: 'Combustível', icon: Fuel, color: 'text-amber-500' },
  { value: 'alimentacao', label: 'Alimentação', icon: Utensils, color: 'text-green-500' },
  { value: 'ajudante', label: 'Ajudante', icon: Users, color: 'text-blue-500' },
  { value: 'aluguel', label: 'Aluguel / Escritório', icon: MapPin, color: 'text-red-500' },
  { value: 'energia', label: 'Energia / Água', icon: Zap, color: 'text-yellow-500' },
  { value: 'internet', label: 'Internet / Telefone', icon: Globe, color: 'text-cyan-500' },
  { value: 'marketing', label: 'Marketing / Anúncios', icon: Megaphone, color: 'text-purple-500' },
  { value: 'pro-labore', label: 'Pró-labore / Salários', icon: DollarSign, color: 'text-emerald-500' },
  { value: 'manutencao', label: 'Manutenção / Ferramentas', icon: Wrench, color: 'text-orange-500' },
  { value: 'outros', label: 'Outros', icon: MoreHorizontal, color: 'text-gray-500' },
];

const fetchExpenses = async () => {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data;
};

const FixedExpensesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [category, setCategory] = useState('combustivel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [helperName, setHelperName] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [helpers, setHelpers] = useState<{ name: string; amount: string }[]>([]);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isRecurring, setIsRecurring] = useState(false);
  const [copyToMonth, setCopyToMonth] = useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [searchProvider, setSearchProvider] = useState('');
  const [providerName, setProviderName] = useState('_none');

  const { data: providers = [] } = useQuery({
    queryKey: ['service-providers'], // Use same key as ServiceProvidersTab
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'service_providers')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      let allProviders: any[] = [];
      if (data?.value) {
        try { allProviders = JSON.parse(data.value); } catch { allProviders = []; }
      }
      
      // Filter for specific technical roles as requested
      return allProviders.filter((p: any) => 
        p.active && 
        (p.specialty === 'Técnico de Ar' || p.specialty === 'Auxiliar Técnico' || p.specialty === 'Geral')
      );
    }
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['fixed-expenses'],
    queryFn: fetchExpenses
  });

  // Auto-ensure that every active employee + provider with monthly cost
  // is present in fixed_expenses for the filtered month.
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      try {
        const inserted = await ensureMonthlyRecurringExpenses(session.user.id, filterMonth);
        if (inserted.count > 0) {
          queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
        }
      } catch (e) {
        console.warn('ensureMonthlyRecurringExpenses failed', e);
      }
    })();
  }, [filterMonth, queryClient]);

  const addMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) throw new Error('Não autenticado');
      
      const { error } = await supabase.from('fixed_expenses').insert({
        ...expense,
        user_id: session.user.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      toast({ title: "Gasto adicionado!" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      toast({ title: "Gasto removido!" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const copyMutation = useMutation({
    mutationFn: async ({ fromMonth, toMonth }: { fromMonth: string; toMonth: string }) => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (!session) throw new Error('Não autenticado');

      // Get recurring expenses from source month
      const startDate = `${fromMonth}-01`;
      const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');
      
      const { data: recurringExpenses, error: fetchError } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('is_recurring', true)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (fetchError) throw fetchError;

      if (!recurringExpenses || recurringExpenses.length === 0) {
        throw new Error('Nenhum gasto recorrente encontrado neste mês');
      }

      // Create copies for target month
      const targetStartDate = parseISO(`${toMonth}-01`);
      const copies = recurringExpenses.map(exp => {
        const originalDate = parseISO(exp.expense_date);
        const dayOfMonth = originalDate.getDate();
        const targetDate = new Date(targetStartDate);
        targetDate.setDate(Math.min(dayOfMonth, endOfMonth(targetStartDate).getDate()));
        
        return {
          category: exp.category,
          description: exp.description,
          amount: exp.amount,
          helper_name: exp.helper_name,
          expense_date: format(targetDate, 'yyyy-MM-dd'),
          is_recurring: true,
          user_id: session.user.id
        };
      });

      const { error: insertError } = await supabase.from('fixed_expenses').insert(copies);
      if (insertError) throw insertError;

      return copies.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
      toast({ title: `${count} gasto(s) copiado(s) para o mês!` });
      setIsCopyDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const resetForm = () => {
    setCategory('combustivel');
    setDescription('');
    setAmount('');
    setHelperName('');
    setHelpers([]);
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsRecurring(false);
    setProviderName('_none');
    setIsDialogOpen(false);
  };

  const handleAddHelper = () => {
    if (!helperName.trim() || !amount) return;
    setHelpers([...helpers, { name: helperName.trim(), amount }]);
    setHelperName('');
    setAmount('');
  };

  const handleRemoveHelper = (index: number) => {
    setHelpers(helpers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (category === 'ajudante') {
      for (const helper of helpers) {
        await addMutation.mutateAsync({
          category,
          description: `Ajudante: ${helper.name}`,
          amount: parseFloat(helper.amount),
          helper_name: helper.name,
          expense_date: expenseDate,
          is_recurring: isRecurring
        });
      }
    } else {
      if (!amount || parseFloat(amount) <= 0) {
        toast({ variant: "destructive", title: "Valor inválido" });
        return;
      }
      await addMutation.mutateAsync({
        category,
        description,
        amount: parseFloat(amount),
        expense_date: expenseDate,
        is_recurring: isRecurring,
        helper_name: providerName !== '_none' ? providerName : null
      });
    }
  };

  const handleCopyToNextMonth = () => {
    copyMutation.mutate({ fromMonth: filterMonth, toMonth: copyToMonth });
  };

  const filteredExpenses = expenses?.filter(exp => {
    // Parse date-only string as local date to avoid timezone shift
    const parts = exp.expense_date.split('-');
    const expMonth = `${parts[0]}-${parts[1]}`;
    const monthMatch = expMonth === filterMonth;
    const providerMatch = !searchProvider || 
      (exp.helper_name || '').toLowerCase().includes(searchProvider.toLowerCase()) ||
      (exp.description || '').toLowerCase().includes(searchProvider.toLowerCase());
    return monthMatch && providerMatch;
  }) || [];

  const recurringExpenses = filteredExpenses.filter(exp => (exp as any).is_recurring);
  const nonRecurringExpenses = filteredExpenses.filter(exp => !(exp as any).is_recurring);

  const totalByCategory = filteredExpenses.reduce((acc: any, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {});

  const grandTotal = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const branding = await getCurrentCompanyBranding();
    const logoBase64 = branding.logoBase64;
    const companyName = branding.companyName;
    
    // Header
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    let headerX = 15;
    if (logoBase64) {
      try { doc.addImage(logoBase64, 'PNG', 15, 8, 28, 28); headerX = 48; } catch {}
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName || 'Relatório de Gastos', headerX, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    const [yr, mo] = filterMonth.split('-').map(Number);
    doc.text(`Gastos Fixos — ${format(new Date(yr, mo - 1, 1), 'MMMM yyyy', { locale: ptBR })}`, headerX, 30);

    const tableData = filteredExpenses.map(exp => [
      format(new Date(exp.expense_date + 'T12:00:00'), 'dd/MM/yyyy'),
      categories.find(c => c.value === exp.category)?.label || exp.category,
      exp.description || '-',
      exp.helper_name || '-',
      (exp as any).is_recurring ? 'Sim' : 'Não',
      `R$ ${Number(exp.amount).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 52,
      head: [['Data', 'Categoria', 'Descrição', 'Ajudante', 'Recorrente', 'Valor']],
      body: tableData,
      foot: [['', '', '', '', 'TOTAL:', `R$ ${grandTotal.toFixed(2)}`]],
      headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    // Category totals
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    let y = finalY + 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 24, 27);
    doc.text('Resumo por Categoria', 15, y); y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    categories.forEach(cat => {
      const val = totalByCategory[cat.value] || 0;
      if (val > 0) {
        doc.text(`${cat.label}: R$ ${val.toFixed(2)}`, 20, y); y += 7;
      }
    });
    
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 285, { align: 'center' });

    doc.save(`gastos-fixos-${filterMonth}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  const getCategoryIcon = (cat: string) => {
    const found = categories.find(c => c.value === cat);
    if (!found) return <MoreHorizontal className="w-4 h-4" />;
    const Icon = found.icon;
    return <Icon className={`w-4 h-4 ${found.color}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {categories.map(cat => (
          <Card key={cat.value} className="bg-gradient-to-br from-muted/50 to-muted/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <cat.icon className={`w-4 h-4 ${cat.color}`} />
                <span className="text-xs font-medium">{cat.label}</span>
              </div>
              <p className="text-lg font-bold">R$ {(totalByCategory[cat.value] || 0).toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="text-lg font-bold text-primary">R$ {grandTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-500" />
              Gastos Fixos
              {recurringExpenses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {recurringExpenses.length} recorrente(s)
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-[140px]"
              />
              <div className="relative">
                <Input
                  placeholder="Filtrar prestador/desc..."
                  value={searchProvider}
                  onChange={(e) => setSearchProvider(e.target.value)}
                  className="w-[180px] pl-8 text-xs"
                />
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button onClick={() => setIsCopyDialogOpen(true)} size="sm" variant="outline" title="Copiar recorrentes">
                <Copy className="w-4 h-4" />
              </Button>
              <Button onClick={exportToPDF} size="sm" variant="outline">
                <FileDown className="w-4 h-4" />
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum gasto registrado neste mês
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{format(new Date(exp.expense_date + 'T12:00:00'), 'dd/MM')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(exp.category)}
                        <span className="text-sm">{categories.find(c => c.value === exp.category)?.label}</span>
                        {(exp as any).is_recurring && (
                          <span title="Recorrente">
                            <RefreshCw className="w-3 h-3 text-blue-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {exp.helper_name ? `${exp.helper_name}` : exp.description || '-'}
                    </TableCell>
                    <TableCell className="font-semibold text-red-600">
                      R$ {Number(exp.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(exp.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Gasto Fixo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className={`w-4 h-4 ${cat.color}`} />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            {category === 'ajudante' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do ajudante"
                    value={helperName}
                    onChange={(e) => setHelperName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Valor"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-28"
                  />
                  <Button type="button" onClick={handleAddHelper} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {helpers.length > 0 && (
                  <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                    {helpers.map((h, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-sm">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">R$ {parseFloat(h.amount).toFixed(2)}</span>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveHelper(i)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-primary">
                        R$ {helpers.reduce((sum, h) => sum + parseFloat(h.amount || '0'), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={category === 'combustivel' ? 'Ex: Gasolina, Álcool...' : 'Descrição do gasto'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vincular a Prestador (Opcional)</Label>
                  <Select value={providerName} onValueChange={setProviderName}>
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {providers.map((p: any) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
              />
              <div>
                <Label htmlFor="recurring" className="cursor-pointer font-medium flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  Gasto Recorrente (Mensal)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pode ser copiado para outros meses
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button 
              onClick={handleSave} 
              disabled={addMutation.isPending || (category === 'ajudante' ? helpers.length === 0 : !amount)}
            >
              {addMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Copiar Gastos Recorrentes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Copiar os {recurringExpenses.length} gasto(s) recorrente(s) de{' '}
              <strong>{format(parseISO(filterMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}</strong> para outro mês.
            </p>
            <div className="space-y-2">
              <Label>Mês de Destino</Label>
              <Input
                type="month"
                value={copyToMonth}
                onChange={(e) => setCopyToMonth(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleCopyToNextMonth} 
              disabled={copyMutation.isPending || recurringExpenses.length === 0}
            >
              {copyMutation.isPending ? "Copiando..." : "Copiar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FixedExpensesTab;