import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, FileDown, Pencil } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ProductWithSupplier = Tables<'products'> & { suppliers: Pick<Tables<'suppliers'>, 'name'> | null };

const fetchProducts = async (): Promise<ProductWithSupplier[]> => {
  const { data, error } = await supabase.from('products').select(`*, suppliers(name)`).order('name');
  if (error) throw new Error(error.message);
  return data as ProductWithSupplier[];
};

const fetchSuppliers = async () => {
  const { data, error } = await supabase.from('suppliers').select('id, name').order('name');
  if (error) throw new Error(error.message);
  return data;
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
  const [costPrice, setCostPrice] = useState("");
  const [profitPercentage, setProfitPercentage] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>();
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [editingProduct, setEditingProduct] = useState<ProductWithSupplier | null>(null);
  const [editQty, setEditQty] = useState(0);

  // Obter userId da sessão
  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  // Calcula o preço de venda baseado no custo e na porcentagem de lucro
  const calculateSalePrice = (cost: string, percentage: string) => {
    const costValue = parseFloat(cost);
    const percentValue = parseFloat(percentage);
    
    if (!isNaN(costValue) && !isNaN(percentValue) && costValue > 0 && percentValue >= 0) {
      const salePrice = costValue + (costValue * percentValue / 100);
      setProductPrice(salePrice.toFixed(2));
    }
  };

  // Atualiza o preço de venda quando custo ou porcentagem mudam
  React.useEffect(() => {
    if (costPrice && profitPercentage) {
      calculateSalePrice(costPrice, profitPercentage);
    }
  }, [costPrice, profitPercentage]);

  // Calcula o lucro em reais
  const profitInReais = React.useMemo(() => {
    const cost = parseFloat(costPrice);
    const price = parseFloat(productPrice);
    if (!isNaN(cost) && !isNaN(price)) {
      return (price - cost).toFixed(2);
    }
    return "0.00";
  }, [costPrice, productPrice]);

  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery({ queryKey: ['suppliers'], queryFn: fetchSuppliers });

  const addMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Produto adicionado ao estoque." });
      setScannedBarcode("");
      setProductName("");
      setProductPrice("");
      setCostPrice("");
      setProfitPercentage("");
      setQty(1);
      setSelectedSupplier(undefined);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao adicionar produto.", description: error.message });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Produto removido." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao remover produto.", description: error.message });
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

  const handleAddProduct = () => {
    console.log('[ProductsTab] handleAddProduct called', {
      productName,
      productPrice,
      costPrice,
      qty,
      scannedBarcode,
      selectedSupplier,
      warrantyMonths,
      minStockAlert
    });

    if (!productName || !productPrice || !costPrice) {
        toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome, preço e custo são obrigatórios."});
        return;
    }
    
    if (qty < 1) {
        toast({ variant: "destructive", title: "Quantidade inválida", description: "A quantidade mínima é 1."});
        return;
    }

    const productData = {
      name: productName.trim(),
      qty: Math.max(1, qty),
      price: parseFloat(productPrice),
      cost_price: parseFloat(costPrice),
      barcode: scannedBarcode?.trim() || null,
      supplier_id: selectedSupplier && selectedSupplier !== "none" ? Number(selectedSupplier) : null,
      warranty_months: warrantyMonths,
      min_stock: minStockAlert,
      date_added: new Date().toISOString().split('T')[0],
      user_id: userId,
    };

    console.log('[ProductsTab] Sending product data', productData);
    addMutation.mutate(productData);
  };

  const handleDeleteProduct = (productId: number) => {
    if (window.confirm("Tem certeza que deseja remover este produto?")) {
      deleteMutation.mutate(productId);
    }
  };

  const handleEditQty = (product: ProductWithSupplier) => {
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
    doc.text('Relatório de Produtos', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableData = products?.map(p => [
      p.name,
      p.barcode || 'N/A',
      `${p.qty} un`,
      `R$ ${Number(p.cost_price).toFixed(2)}`,
      `R$ ${Number(p.price).toFixed(2)}`,
      p.suppliers?.name || 'N/A',
      `${p.warranty_months || 'N/A'} meses`
    ]) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Produto', 'Código', 'Qtd', 'Custo', 'Venda', 'Fornecedor', 'Garantia']],
      body: tableData,
    });

    doc.save('produtos.pdf');
    toast({ title: "PDF exportado!", description: "Relatório de produtos salvo." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Estoque de Produtos
            <Button onClick={exportToPDF} size="sm" variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead><TableHead>Código</TableHead><TableHead>Quantidade</TableHead>
                <TableHead>Preço Custo</TableHead><TableHead>Preço Venda</TableHead>
                <TableHead>Fornecedor</TableHead><TableHead>Garantia</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingProducts ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              )) : products?.map((product) => (
                <TableRow key={product.id} className={product.qty <= (product.min_stock || 0) ? "bg-orange-50 dark:bg-orange-950" : ""}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{product.barcode}</TableCell>
                  <TableCell><span className={product.qty <= (product.min_stock || 0) ? "text-orange-600 font-semibold" : ""}>{product.qty} unidades</span></TableCell>
                  <TableCell>R$ {Number(product.cost_price).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">R$ {Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>{product.suppliers?.name || "N/A"}</TableCell>
                  <TableCell>{product.warranty_months || "N/A"} meses</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditQty(product)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteProduct(product.id)} disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cadastrar Produto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="barcode">Código de Barras (Opcional)</Label>
            <div className="flex items-center gap-2">
              <Input id="barcode" value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} placeholder="Digite ou escaneie o código (opcional)" />
              <BarcodeScanner onBarcodeDetected={setScannedBarcode} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name-barcode">Nome do Produto</Label>
              <Input id="product-name-barcode" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Nome do produto"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost-price">Preço de Custo (R$)</Label>
              <Input id="cost-price" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00"/>
            </div>
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
              <Label htmlFor="product-price">Preço de Venda (R$)</Label>
              <Input 
                id="product-price" 
                type="number" 
                step="0.01" 
                value={productPrice} 
                onChange={(e) => setProductPrice(e.target.value)} 
                placeholder="0.00"
                className="font-semibold"
              />
              {profitInReais !== "0.00" && (
                <p className="text-xs text-muted-foreground">
                  Lucro: R$ {profitInReais}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-quantity-barcode">Quantidade</Label>
              <Input id="add-quantity-barcode" type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} min="1"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-select">Fornecedor (Opcional)</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled={isLoadingSuppliers}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {suppliers?.map((supplier) => (<SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty">Garantia (meses)</Label>
              <Input id="warranty" type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(Number(e.target.value))} min="0"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-stock">Estoque Mínimo</Label>
              <Input id="min-stock" type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(Number(e.target.value))} min="0"/>
            </div>
          </div>
          
          <Button onClick={handleAddProduct} className="w-full" disabled={addMutation.isPending || !productName || !productPrice || !costPrice}>
            {addMutation.isPending ? "Cadastrando..." : "Cadastrar Produto"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Quantidade - {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-qty">Quantidade em Estoque</Label>
              <Input 
                id="edit-qty" 
                type="number" 
                value={editQty} 
                onChange={(e) => setEditQty(Number(e.target.value))} 
                min="0"
              />
            </div>
            <Button onClick={handleUpdateQty} className="w-full" disabled={updateQtyMutation.isPending}>
              {updateQtyMutation.isPending ? "Atualizando..." : "Atualizar Quantidade"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsTab;
