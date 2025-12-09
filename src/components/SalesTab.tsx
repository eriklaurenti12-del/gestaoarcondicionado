import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Search, PlusCircle, FileDown, TrendingUp, Wind, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Sale = {
  id: number;
  user_id: string;
  client_id: number;
  product_id: number;
  qty: number;
  sale_price: number;
  total_profit: number;
  payment_method: string;
  sale_date: string;
  clients?: { name: string } | null;
  products?: { name: string } | null;
};

const fetchSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, clients(name), products(name)')
    .order('sale_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Sale[];
};

const fetchClients = async () => {
  const { data, error } = await supabase.from('clients').select('id, name').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const fetchProducts = async () => {
  const { data, error } = await supabase.from('products').select('id, name, price, cost_price').order('name');
  if (error) throw new Error(error.message);
  return data;
};

const SalesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [userId, setUserId] = useState<string>("");

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUserId();
  }, []);

  const { data: sales, isLoading: isLoadingSales } = useQuery({ queryKey: ['sales'], queryFn: fetchSales });
  const { data: clients } = useQuery({ queryKey: ['clients-list'], queryFn: fetchClients });
  const { data: products } = useQuery({ queryKey: ['products-list'], queryFn: fetchProducts });

  const addSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('sales').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: "Sucesso!", description: "Ordem de serviço registrada." });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao registrar.", description: error.message });
    }
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast({ title: "Ordem removida!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const resetForm = () => {
    setSelectedClientId("");
    setSelectedProductId("");
    setQty(1);
    setPaymentMethod("Dinheiro");
  };

  const handleAddSale = () => {
    if (!selectedClientId || !selectedProductId) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Selecione cliente e serviço." });
      return;
    }

    const product = products?.find(p => p.id === parseInt(selectedProductId));
    if (!product) return;

    const salePrice = Number(product.price) * qty;
    const costPrice = Number(product.cost_price) * qty;
    const profit = salePrice - costPrice;

    addSaleMutation.mutate({
      user_id: userId,
      client_id: parseInt(selectedClientId),
      product_id: parseInt(selectedProductId),
      qty,
      sale_price: salePrice,
      total_profit: profit,
      payment_method: paymentMethod
    });
  };

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter((s) => {
      const matchesSearch = s.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
                           s.products?.name?.toLowerCase().includes(search.toLowerCase());
      const saleDate = new Date(s.sale_date);
      const matchesMonth = filterMonth === "todos" || (saleDate.getMonth() + 1) === parseInt(filterMonth);
      const matchesYear = filterYear === "todos" || saleDate.getFullYear() === parseInt(filterYear);
      return (search === "" || matchesSearch) && matchesMonth && matchesYear;
    });
  }, [sales, search, filterMonth, filterYear]);

  const availableYears = useMemo(() => {
    if (!sales) return [new Date().getFullYear()];
    const years = [...new Set(sales.map(s => new Date(s.sale_date).getFullYear()))];
    return years.sort((a, b) => b - a);
  }, [sales]);

  const totals = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.sale_price), 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + Number(s.total_profit), 0);
    return { totalRevenue, totalProfit, count: filteredSales.length };
  }, [filteredSales]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Ordens de Serviço - AC Service Pro', 14, 22);
    doc.setFontSize(11);
    doc.text(`Período: ${filterMonth}/${filterYear}`, 14, 30);
    doc.text(`Total: R$ ${totals.totalRevenue.toFixed(2)} | Lucro: R$ ${totals.totalProfit.toFixed(2)}`, 14, 38);

    const tableData = filteredSales.map(s => [
      format(parseISO(s.sale_date), 'dd/MM/yyyy'),
      s.clients?.name || '-',
      s.products?.name || '-',
      s.qty,
      s.payment_method,
      `R$ ${Number(s.sale_price).toFixed(2)}`,
      `R$ ${Number(s.total_profit).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Data', 'Cliente', 'Serviço', 'Qtd', 'Pagamento', 'Valor', 'Lucro']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 128, 192] },
    });

    doc.save(`ordens-servico-${filterMonth}-${filterYear}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  const getPaymentBadge = (method: string) => {
    const colors: Record<string, string> = {
      'Dinheiro': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      'PIX': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      'Débito': 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      'Crédito': 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    };
    return <Badge className={colors[method] || 'bg-gray-100'}>{method}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-200 dark:border-cyan-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900">
                <Wind className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-600">R$ {totals.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Faturamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">R$ {totals.totalProfit.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Lucro</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900">
                <Wrench className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-600">{totals.count}</p>
                <p className="text-xs text-muted-foreground">Ordens de Serviço</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <span className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-cyan-500" />
              Ordens de Serviço
            </span>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                <PlusCircle className="w-4 h-4 mr-1" />
                Nova O.S.
              </Button>
              <Button onClick={exportToPDF} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente ou serviço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Lucro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSales ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma ordem de serviço encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{format(parseISO(sale.sale_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{sale.clients?.name || '-'}</TableCell>
                      <TableCell>{sale.products?.name || '-'}</TableCell>
                      <TableCell>{sale.qty}</TableCell>
                      <TableCell>{getPaymentBadge(sale.payment_method)}</TableCell>
                      <TableCell className="font-semibold text-green-600">R$ {Number(sale.sale_price).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold text-blue-600">R$ {Number(sale.total_profit).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            if (window.confirm('Remover esta ordem de serviço?')) {
                              deleteSaleMutation.mutate(sale.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Sale Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serviço/Peça *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} - R$ {Number(p.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddSale} disabled={addSaleMutation.isPending} className="bg-gradient-to-r from-cyan-600 to-blue-600">
              Registrar O.S.
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesTab;
