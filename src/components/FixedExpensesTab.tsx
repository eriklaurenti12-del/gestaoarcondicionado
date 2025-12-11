import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Fuel, Utensils, Users, MoreHorizontal, Calendar, FileDown } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const categories = [
  { value: 'combustivel', label: 'Combustível', icon: Fuel, color: 'text-amber-500' },
  { value: 'alimentacao', label: 'Alimentação', icon: Utensils, color: 'text-green-500' },
  { value: 'ajudante', label: 'Ajudante', icon: Users, color: 'text-blue-500' },
  { value: 'outros', label: 'Outros', icon: MoreHorizontal, color: 'text-gray-500' },
];

const fetchExpenses = async () => {
  const { data, error } = await supabase
    .from('fixed_expenses')
    .select('*, appointments(clients(name), products(name))')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data;
};

const FixedExpensesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [category, setCategory] = useState('combustivel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [helperName, setHelperName] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [helpers, setHelpers] = useState<{ name: string; amount: string }[]>([]);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['fixed-expenses'],
    queryFn: fetchExpenses
  });

  const addMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data: { session } } = await supabase.auth.getSession();
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

  const resetForm = () => {
    setCategory('combustivel');
    setDescription('');
    setAmount('');
    setHelperName('');
    setHelpers([]);
    setExpenseDate(new Date().toISOString().split('T')[0]);
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
      // Save multiple helpers
      for (const helper of helpers) {
        await addMutation.mutateAsync({
          category,
          description: `Ajudante: ${helper.name}`,
          amount: parseFloat(helper.amount),
          helper_name: helper.name,
          expense_date: expenseDate
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
        expense_date: expenseDate
      });
    }
  };

  const filteredExpenses = expenses?.filter(exp => {
    const expMonth = format(new Date(exp.expense_date), 'yyyy-MM');
    return expMonth === filterMonth;
  }) || [];

  const totalByCategory = filteredExpenses.reduce((acc: any, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
    return acc;
  }, {});

  const grandTotal = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Gastos Fixos', 14, 22);
    doc.setFontSize(11);
    doc.text(`Período: ${format(new Date(filterMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}`, 14, 30);

    const tableData = filteredExpenses.map(exp => [
      format(new Date(exp.expense_date), 'dd/MM/yyyy'),
      categories.find(c => c.value === exp.category)?.label || exp.category,
      exp.description || '-',
      exp.helper_name || '-',
      `R$ ${Number(exp.amount).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Categoria', 'Descrição', 'Ajudante', 'Valor']],
      body: tableData,
      foot: [['', '', '', 'TOTAL:', `R$ ${grandTotal.toFixed(2)}`]],
      headStyles: { fillColor: [0, 128, 192] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

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
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-[160px]"
              />
              <Button onClick={exportToPDF} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Novo Gasto
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
                  <TableHead>Ajudante</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{format(new Date(exp.expense_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(exp.category)}
                        {categories.find(c => c.value === exp.category)?.label}
                      </div>
                    </TableCell>
                    <TableCell>{exp.description || '-'}</TableCell>
                    <TableCell>{exp.helper_name || '-'}</TableCell>
                    <TableCell className="font-semibold text-red-600">
                      R$ {Number(exp.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
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
              </>
            )}
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
    </div>
  );
};

export default FixedExpensesTab;
