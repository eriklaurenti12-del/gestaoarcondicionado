import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Tables, TablesInsert } from '@/integrations/supabase/types';

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

  const [scannedBarcode, setScannedBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>();
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [minStockAlert, setMinStockAlert] = useState(5);

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

  const handleAddProduct = () => {
    if (!scannedBarcode || !productName || !productPrice || !costPrice) {
        toast({ variant: "destructive", title: "Campos obrigatórios", description: "Código de barras, nome, preço e custo são obrigatórios."});
        return;
    }
    
    addMutation.mutate({
      name: productName,
      qty,
      price: parseFloat(productPrice),
      cost_price: parseFloat(costPrice),
      barcode: scannedBarcode,
      supplier_id: selectedSupplier ? Number(selectedSupplier) : null,
      warranty_months: warrantyMonths,
      min_stock: minStockAlert,
      date_added: new Date().toISOString().split('T')[0],
    });
  };

  const handleDeleteProduct = (productId: number) => {
    if (window.confirm("Tem certeza que deseja remover este produto?")) {
      deleteMutation.mutate(productId);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Estoque de Produtos</CardTitle></CardHeader>
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
                    <Button size="sm" variant="outline" onClick={() => handleDeleteProduct(product.id)} disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
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
            <Label htmlFor="barcode">Código de Barras</Label>
            <div className="flex items-center gap-2">
              <Input id="barcode" value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} placeholder="Digite ou escaneie o código" />
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
              <Label htmlFor="product-price">Preço de Venda (R$)</Label>
              <Input id="product-price" type="number" step="0.01" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="0.00"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-quantity-barcode">Quantidade</Label>
              <Input id="add-quantity-barcode" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} min="1"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-select">Fornecedor</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled={isLoadingSuppliers}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                <SelectContent>
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
          
          <Button onClick={handleAddProduct} className="w-full" disabled={addMutation.isPending || !scannedBarcode || !productName || !productPrice || !costPrice}>
            {addMutation.isPending ? "Cadastrando..." : "Cadastrar Produto"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsTab;
