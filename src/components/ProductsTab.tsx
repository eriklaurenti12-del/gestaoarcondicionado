import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Trash2, FileDown, Pencil, Wrench, Plus, X, Wind, Thermometer } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Product = Tables<'products'>;
type Expense = { name: string; value: number };

const serviceTypes = [
  { value: 'instalacao', label: 'Instalação', type: 'service' },
  { value: 'manutencao', label: 'Manutenção Preventiva', type: 'service' },
  { value: 'corretiva', label: 'Manutenção Corretiva', type: 'service' },
  { value: 'limpeza', label: 'Limpeza/Higienização', type: 'service' },
  { value: 'desinstalacao', label: 'Desinstalação', type: 'service' },
  { value: 'orcamento', label: 'Orçamento', type: 'service' },
  { value: 'peca', label: 'Peça/Material', type: 'piece' },
];

const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw new Error(error.message);
  return data as Product[];
};

const addProduct = async (product: TablesInsert<'products'>) => {
  const { error } = await supabase.from('products').insert(product);
  if (error) throw new Error(error.message);
};

const deleteProduct = async (productId: number) => {
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
};

const ProductsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");

  const [scannedBarcode, setScannedBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [baseCostPrice, setBaseCostPrice] = useState("");
  const [profitPercentage, setProfitPercentage] = useState("");
  const [qty, setQty] = useState(1);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [serviceType, setServiceType] = useState('instalacao');
  const [serviceDuration, setServiceDuration] = useState(60);

  // Expense tracking
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseValue, setNewExpenseValue] = useState("");

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const totalExpenses = React.useMemo(() => {
    return expenses.reduce((sum, exp) => sum + exp.value, 0);
  }, [expenses]);

  const totalCost = React.useMemo(() => {
    const base = parseFloat(baseCostPrice) || 0;
    return base + totalExpenses;
  }, [baseCostPrice, totalExpenses]);

  const calculateSalePrice = React.useCallback((cost: number, percentage: string) => {
    const percentValue = parseFloat(percentage);
    if (!isNaN(cost) && !isNaN(percentValue) && cost > 0 && percentValue >= 0) {
      const salePrice = cost + (cost * percentValue / 100);
      setProductPrice(salePrice.toFixed(2));
    }
  }, []);

  React.useEffect(() => {
    if (totalCost > 0 && profitPercentage) {
      calculateSalePrice(totalCost, profitPercentage);
    }
  }, [totalCost, profitPercentage, calculateSalePrice]);

  const profitInReais = React.useMemo(() => {
    const price = parseFloat(productPrice);
    if (!isNaN(totalCost) && !isNaN(price)) {
      return (price - totalCost).toFixed(2);
    }
    return "0.00";
  }, [totalCost, productPrice]);

  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  const addMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Serviço/Peça adicionado." });
      setScannedBarcode("");
      setProductName("");
      setProductPrice("");
      setBaseCostPrice("");
      setProfitPercentage("");
      setQty(1);
      setExpenses([]);
      setNewExpenseName("");
      setNewExpenseValue("");
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao adicionar.", description: error.message });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Item removido." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao remover.", description: error.message });
    }
  });

  const updateQtyMutation = useMutation({
    mutationFn: async ({ id, qty }: { id: number, qty: number }) => {
      const { error } = await supabase.from('products').update({ qty }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Quantidade atualizada." });
      setEditingProduct(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar quantidade.", description: error.message });
    }
  });

  const addExpense = () => {
    const name = newExpenseName.trim();
    const value = parseFloat(newExpenseValue);
    if (!name || isNaN(value) || value <= 0) {
      toast({ variant: "destructive", title: "Gasto inválido", description: "Informe nome e valor do gasto." });
      return;
    }
    setExpenses([...expenses, { name, value }]);
    setNewExpenseName("");
    setNewExpenseValue("");
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleAddProduct = () => {
    if (!productName || !productPrice || totalCost <= 0) {
        toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome, preço e custo são obrigatórios."});
        return;
    }
    
    if (serviceType === 'peca' && qty < 1) {
        toast({ variant: "destructive", title: "Quantidade inválida", description: "A quantidade mínima é 1."});
        return;
    }

    const isService = serviceTypes.find(t => t.value === serviceType)?.type === 'service';
    
    const productData = {
      name: productName.trim(),
      qty: isService ? 999 : Math.max(1, qty),
      price: parseFloat(productPrice),
      cost_price: totalCost,
      barcode: scannedBarcode?.trim() || null,
      supplier_id: null,
      warranty_months: 12,
      min_stock: isService ? 0 : minStockAlert,
      date_added: new Date().toISOString().split('T')[0],
      user_id: userId,
      service_duration: isService ? serviceDuration : null,
      type: isService ? 'service' : 'piece',
    };

    addMutation.mutate(productData);
  };

  const handleDeleteProduct = (productId: number) => {
    if (window.confirm("Tem certeza que deseja remover este item?")) {
      deleteMutation.mutate(productId);
    }
  };

  const handleEditQty = (product: Product) => {
    setEditingProduct(product);
    setEditQty(product.qty);
  };

  const handleUpdateQty = () => {
    if (editingProduct && editQty >= 0) {
      updateQtyMutation.mutate({ id: editingProduct.id, qty: editQty });
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Catálogo de Serviços e Peças - AC Service Pro', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableData = products?.map(p => [
      p.name,
      p.barcode || 'N/A',
      p.qty < 999 ? `${p.qty} un` : 'Serviço',
      `R$ ${Number(p.cost_price).toFixed(2)}`,
      `R$ ${Number(p.price).toFixed(2)}`
    ]) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Serviço/Peça', 'Código', 'Estoque', 'Custo', 'Preço']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });

    doc.save('servicos-pecas-ac.pdf');
    toast({ title: "PDF exportado!", description: "Catálogo salvo." });
  };

  const getServiceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('instalação') || lowerName.includes('instalacao')) return <Wind className="w-4 h-4 text-cyan-500" />;
    if (lowerName.includes('manutenção') || lowerName.includes('manutencao')) return <Wrench className="w-4 h-4 text-amber-500" />;
    if (lowerName.includes('limpeza') || lowerName.includes('higienização')) return <Thermometer className="w-4 h-4 text-green-500" />;
    return <Wrench className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 overflow-visible">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-500" />
              Serviços & Peças
            </span>
            <Button onClick={exportToPDF} size="sm" variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço/Peça</TableHead>
                    <TableHead className="hidden sm:table-cell">Código</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingProducts ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : products?.map((product) => (
                    <TableRow key={product.id} className={product.qty <= (product.min_stock || 0) && product.qty < 999 ? "bg-orange-50 dark:bg-orange-950" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getServiceIcon(product.name)}
                          {product.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{product.barcode || "-"}</TableCell>
                      <TableCell>
                        {product.qty >= 999 ? (
                          <span className="text-cyan-600 font-medium">Serviço</span>
                        ) : (
                          <span className={product.qty <= (product.min_stock || 0) ? "text-orange-600 font-semibold" : ""}>{product.qty}</span>
                        )}
                      </TableCell>
                      <TableCell>R$ {Number(product.cost_price).toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">R$ {Number(product.price).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {product.qty < 999 && (
                            <Button size="sm" variant="outline" onClick={() => handleEditQty(product)}><Pencil className="w-4 h-4" /></Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleDeleteProduct(product.id)} disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader><CardTitle>Cadastrar Serviço ou Peça</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Código (Opcional)</Label>
            <div className="flex items-center gap-2">
              <Input id="barcode" value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} placeholder="Código do serviço/peça (opcional)" />
              <BarcodeScanner onBarcodeDetected={setScannedBarcode} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name-barcode">Nome do Serviço/Peça</Label>
              <Input id="product-name-barcode" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Instalação Split 12000 BTUs, Gás R410A..."/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-cost-price">Custo Base (R$)</Label>
              <Input id="base-cost-price" type="number" step="0.01" value={baseCostPrice} onChange={(e) => setBaseCostPrice(e.target.value)} placeholder="0.00"/>
            </div>
          </div>

          {/* Expense Section */}
          <Card className="bg-muted/50">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Gastos Adicionais (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                  placeholder="Nome do gasto (ex: Tubo de cobre, Suporte)" 
                  value={newExpenseName} 
                  onChange={(e) => setNewExpenseName(e.target.value)} 
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="Valor (R$)" 
                  value={newExpenseValue} 
                  onChange={(e) => setNewExpenseValue(e.target.value)} 
                  className="w-full sm:w-32"
                />
                <Button type="button" onClick={addExpense} size="sm" variant="secondary">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              
              {expenses.length > 0 && (
                <div className="space-y-2">
                  {expenses.map((exp, index) => (
                    <div key={index} className="flex items-center justify-between bg-background p-2 rounded-md">
                      <span className="text-sm">{exp.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">R$ {exp.value.toFixed(2)}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeExpense(index)} className="h-6 w-6 p-0">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Total Gastos:</span>
                    <span className="text-orange-600">R$ {totalExpenses.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profit-percentage">Margem de Lucro (%)</Label>
              <Input 
                id="profit-percentage" 
                type="number" 
                step="0.01" 
                value={profitPercentage} 
                onChange={(e) => setProfitPercentage(e.target.value)} 
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Preço Final (R$)</Label>
              <Input 
                id="product-price" 
                type="number" 
                step="0.01" 
                value={productPrice} 
                onChange={(e) => setProductPrice(e.target.value)} 
                placeholder="0.00"
                className="font-semibold"
              />
            </div>
          </div>

          {/* Cost Summary */}
          {totalCost > 0 && (
            <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-cyan-200 dark:border-cyan-800">
              <CardContent className="py-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Custo Base:</span>
                    <p className="font-semibold">R$ {(parseFloat(baseCostPrice) || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">+ Gastos:</span>
                    <p className="font-semibold text-orange-600">R$ {totalExpenses.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">= Custo Total:</span>
                    <p className="font-semibold text-red-600">R$ {totalCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro Líquido:</span>
                    <p className="font-semibold text-green-600">R$ {profitInReais}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {serviceTypes.find(t => t.value === serviceType)?.type === 'service' && (
            <div className="space-y-2">
              <Label htmlFor="service-duration">Tempo de Serviço (minutos)</Label>
              <Input 
                id="service-duration" 
                type="number" 
                value={serviceDuration} 
                onChange={(e) => setServiceDuration(Math.max(15, Number(e.target.value)))} 
                min="15"
                step="15"
              />
              <p className="text-xs text-muted-foreground">
                Duração estimada do serviço (afeta bloqueio de horários na agenda)
              </p>
            </div>
          )}

          {serviceTypes.find(t => t.value === serviceType)?.type === 'piece' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-quantity-barcode">Quantidade</Label>
                <Input id="add-quantity-barcode" type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} min="1"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-stock">Estoque Mínimo</Label>
                <Input id="min-stock" type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(Number(e.target.value))} min="0"/>
              </div>
            </div>
          )}

          <Button 
            onClick={handleAddProduct} 
            disabled={addMutation.isPending}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {addMutation.isPending ? 'Adicionando...' : 'Adicionar Serviço/Peça'}
          </Button>
        </CardContent>
      </Card>

      {/* Edit Qty Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Quantidade - {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade em Estoque</Label>
              <Input
                type="number"
                min="0"
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button onClick={handleUpdateQty} disabled={updateQtyMutation.isPending}>
                {updateQtyMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsTab;
