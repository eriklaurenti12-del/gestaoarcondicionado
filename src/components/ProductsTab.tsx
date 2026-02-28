import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, FileDown, Pencil, Wrench, Plus, X, Wind, Thermometer, ImagePlus, Loader2 } from "lucide-react";
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
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
      setProductImage(null);
      setProductImagePreview(null);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "A imagem deve ter no máximo 5MB." });
        return;
      }
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProductImage = async (): Promise<string | null> => {
    if (!productImage || !userId) return null;
    
    setUploadingImage(true);
    try {
      const fileExt = productImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, productImage);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({ variant: "destructive", title: "Erro ao enviar imagem", description: error.message });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productName || !productPrice || totalCost <= 0) {
        toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome, preço e custo são obrigatórios."});
        return;
    }
    
    if (serviceType === 'peca' && qty < 1) {
        toast({ variant: "destructive", title: "Quantidade inválida", description: "A quantidade mínima é 1."});
        return;
    }

    let imageUrl: string | null = null;
    if (productImage) {
      imageUrl = await uploadProductImage();
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
      image_url: imageUrl,
    };

    addMutation.mutate(productData as any);
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

  // Calculate profit margin percentage
  const calculateProfitMargin = (costPrice: number, salePrice: number) => {
    if (costPrice <= 0) return 0;
    return ((salePrice - costPrice) / costPrice) * 100;
  };

  const exportToPDF = (includeInternalInfo: boolean = true) => {
    const doc = new jsPDF();
    
    if (includeInternalInfo) {
      // Internal PDF with all info (cost, margin)
      doc.setFontSize(18);
      doc.text('Catálogo Interno - Serviços e Peças', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('DOCUMENTO INTERNO - NÃO COMPARTILHAR', 14, 28);
      doc.setTextColor(0);
      doc.setFontSize(11);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 35);

      const tableData = products?.map(p => {
        const margin = calculateProfitMargin(Number(p.cost_price), Number(p.price));
        const profit = Number(p.price) - Number(p.cost_price);
        return [
          p.name,
          p.barcode || '-',
          p.qty < 999 ? `${p.qty} un` : 'Serviço',
          `R$ ${Number(p.cost_price).toFixed(2)}`,
          `R$ ${Number(p.price).toFixed(2)}`,
          `${margin.toFixed(1)}%`,
          `R$ ${profit.toFixed(2)}`
        ];
      }) || [];

      autoTable(doc, {
        startY: 40,
        head: [['Serviço/Peça', 'Código', 'Estoque', 'Custo', 'Preço', 'Margem', 'Lucro']],
        body: tableData,
        headStyles: { fillColor: [0, 128, 192] },
        columnStyles: {
          5: { halign: 'center' },
          6: { halign: 'right' }
        }
      });

      // Summary
      const totalCost = products?.reduce((sum, p) => sum + Number(p.cost_price), 0) || 0;
      const totalPrice = products?.reduce((sum, p) => sum + Number(p.price), 0) || 0;
      const avgMargin = totalCost > 0 ? ((totalPrice - totalCost) / totalCost) * 100 : 0;
      
      const finalY = (doc as any).lastAutoTable?.finalY || 40;
      doc.setFontSize(10);
      doc.text(`Total de itens: ${products?.length || 0}`, 14, finalY + 10);
      doc.text(`Margem média: ${avgMargin.toFixed(1)}%`, 14, finalY + 16);

      doc.save('catalogo-interno-servicos-pecas.pdf');
      toast({ title: "PDF Interno exportado!", description: "Catálogo com custos e margens salvo." });
    } else {
      // Client PDF - without cost info
      doc.setFontSize(18);
      doc.text('Catálogo de Serviços e Peças', 14, 22);
      doc.setFontSize(11);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

      const tableData = products?.map(p => [
        p.name,
        p.barcode || '-',
        p.qty < 999 ? 'Disponível' : 'Serviço',
        `R$ ${Number(p.price).toFixed(2)}`
      ]) || [];

      autoTable(doc, {
        startY: 35,
        head: [['Serviço/Peça', 'Código', 'Disponibilidade', 'Preço']],
        body: tableData,
        headStyles: { fillColor: [0, 128, 192] },
      });

      doc.save('catalogo-cliente-servicos-pecas.pdf');
      toast({ title: "PDF Cliente exportado!", description: "Catálogo para cliente salvo (sem custos)." });
    }
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
            <div className="flex gap-2">
              <Button onClick={() => exportToPDF(true)} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-2" />
                PDF Interno
              </Button>
              <Button onClick={() => exportToPDF(false)} size="sm" variant="secondary">
                <FileDown className="w-4 h-4 mr-2" />
                PDF Cliente
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {products?.map((product) => {
                const margin = calculateProfitMargin(Number(product.cost_price), Number(product.price));
                const profit = Number(product.price) - Number(product.cost_price);
                const isLowStock = product.qty <= (product.min_stock || 0) && product.qty < 999;
                return (
                  <div key={product.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${isLowStock ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20' : 'border-border'}`}>
                    {(product as any).image_url ? (
                      <img src={(product as any).image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {getServiceIcon(product.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {product.qty >= 999 ? (
                          <span className="text-cyan-600 font-medium">Serviço</span>
                        ) : (
                          <span className={isLowStock ? "text-orange-600 font-semibold" : ""}>Estoque: {product.qty}</span>
                        )}
                        <span>Custo: R$ {Number(product.cost_price).toFixed(2)}</span>
                        <span className={`font-medium ${margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                          {margin.toFixed(0)}% (R$ {profit.toFixed(2)})
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm">R$ {Number(product.price).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {product.qty < 999 && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditQty(product)}><Pencil className="w-3.5 h-3.5" /></Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteProduct(product.id)} disabled={deleteMutation.isPending}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Imagem (Opcional)</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-muted-foreground/50 rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Selecionar imagem</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
              {productImagePreview && (
                <div className="relative">
                  <img src={productImagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full"
                    onClick={() => { setProductImage(null); setProductImagePreview(null); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
                  <div>
                    <span className="text-muted-foreground">Margem Real:</span>
                    <p className={`font-semibold ${calculateProfitMargin(totalCost, parseFloat(productPrice) || 0) >= 30 ? 'text-green-600' : calculateProfitMargin(totalCost, parseFloat(productPrice) || 0) >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                      {calculateProfitMargin(totalCost, parseFloat(productPrice) || 0).toFixed(1)}%
                    </p>
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
            disabled={addMutation.isPending || uploadingImage}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            {(addMutation.isPending || uploadingImage) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {uploadingImage ? 'Enviando imagem...' : addMutation.isPending ? 'Adicionando...' : 'Adicionar Serviço/Peça'}
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
