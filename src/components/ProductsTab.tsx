import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileDown, Pencil, Wrench, Plus, X, Wind, Thermometer, ImagePlus, Loader2, Package, ChevronDown, ChevronUp } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/components/ui/use-toast";
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  { value: 'combo', label: '🎁 Combo (Mesclar Serviços)', type: 'service' },
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
  const [qty, setQty] = useState(1);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [serviceType, setServiceType] = useState('instalacao');
  const [serviceDuration, setServiceDuration] = useState(60);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Combo
  const [comboSelectedServices, setComboSelectedServices] = useState<number[]>([]);
  const [comboDiscount, setComboDiscount] = useState("");

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

  // Auto-calculate margin from cost and price
  const autoMargin = React.useMemo(() => {
    const price = parseFloat(productPrice) || 0;
    if (totalCost <= 0 || price <= 0) return 0;
    return ((price - totalCost) / totalCost) * 100;
  }, [totalCost, productPrice]);

  const profitInReais = React.useMemo(() => {
    const price = parseFloat(productPrice) || 0;
    return (price - totalCost).toFixed(2);
  }, [totalCost, productPrice]);

  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  // Combo calculations
  const comboOriginalTotal = React.useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p ? Number(p.price) : 0);
    }, 0);
  }, [comboSelectedServices, products]);

  const comboCostTotal = React.useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p ? Number(p.cost_price) : 0);
    }, 0);
  }, [comboSelectedServices, products]);

  const comboDurationTotal = React.useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p?.service_duration || 60);
    }, 0);
  }, [comboSelectedServices, products]);

  React.useEffect(() => {
    if (serviceType === 'combo' && comboSelectedServices.length > 0) {
      const disc = parseFloat(comboDiscount) || 0;
      const finalPrice = comboOriginalTotal * (1 - disc / 100);
      setProductPrice(finalPrice.toFixed(2));
      setBaseCostPrice(comboCostTotal.toFixed(2));
      setServiceDuration(comboDurationTotal);
    }
  }, [serviceType, comboSelectedServices, comboDiscount, comboOriginalTotal, comboCostTotal, comboDurationTotal]);

  const addMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Serviço/Peça adicionado." });
      setScannedBarcode(""); setProductName(""); setProductPrice(""); setBaseCostPrice("");
      setQty(1); setExpenses([]); setNewExpenseName(""); setNewExpenseValue("");
      setProductImage(null); setProductImagePreview(null); setShowExpenses(false);
      setComboSelectedServices([]); setComboDiscount(""); setShowForm(false);
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
      toast({ variant: "destructive", title: "Gasto inválido", description: "Informe nome e valor." });
      return;
    }
    setExpenses([...expenses, { name, value }]);
    setNewExpenseName(""); setNewExpenseValue("");
  };

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "Máximo 5MB." });
        return;
      }
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProductImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadProductImage = async (): Promise<string | null> => {
    if (!productImage || !userId) return null;
    setUploadingImage(true);
    try {
      const fileExt = productImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, productImage);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao enviar imagem", description: error.message });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddProduct = async () => {
    if (!productName || !productPrice) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Nome e preço são obrigatórios." });
      return;
    }

    let imageUrl: string | null = null;
    if (productImage) imageUrl = await uploadProductImage();

    const isService = serviceTypes.find(t => t.value === serviceType)?.type === 'service';
    const comboNames = serviceType === 'combo' && products
      ? comboSelectedServices.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(' + ')
      : null;
    
    const productData = {
      name: serviceType === 'combo' ? (productName || `Combo: ${comboNames}`) : productName.trim(),
      qty: isService ? 999 : Math.max(1, qty),
      price: parseFloat(productPrice),
      cost_price: totalCost || 0,
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

  const calculateProfitMargin = (costPrice: number, salePrice: number) => {
    if (costPrice <= 0) return 0;
    return ((salePrice - costPrice) / costPrice) * 100;
  };

  const exportToPDF = (includeInternalInfo: boolean = true) => {
    const doc = new jsPDF();
    if (includeInternalInfo) {
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
        return [p.name, p.barcode || '-', p.qty < 999 ? `${p.qty} un` : 'Serviço',
          `R$ ${Number(p.cost_price).toFixed(2)}`, `R$ ${Number(p.price).toFixed(2)}`,
          `${margin.toFixed(1)}%`, `R$ ${profit.toFixed(2)}`];
      }) || [];

      autoTable(doc, {
        startY: 40,
        head: [['Serviço/Peça', 'Código', 'Estoque', 'Custo', 'Preço', 'Margem', 'Lucro']],
        body: tableData,
        headStyles: { fillColor: [0, 128, 192] },
      });
      doc.save('catalogo-interno-servicos-pecas.pdf');
      toast({ title: "PDF Interno exportado!" });
    } else {
      doc.setFontSize(18);
      doc.text('Catálogo de Serviços e Peças', 14, 22);
      doc.setFontSize(11);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
      const tableData = products?.map(p => [p.name, p.barcode || '-',
        p.qty < 999 ? 'Disponível' : 'Serviço', `R$ ${Number(p.price).toFixed(2)}`]) || [];
      autoTable(doc, {
        startY: 35,
        head: [['Serviço/Peça', 'Código', 'Disponibilidade', 'Preço']],
        body: tableData,
        headStyles: { fillColor: [0, 128, 192] },
      });
      doc.save('catalogo-cliente-servicos-pecas.pdf');
      toast({ title: "PDF Cliente exportado!" });
    }
  };

  const getServiceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('combo')) return <Package className="w-4 h-4 text-purple-500" />;
    if (lowerName.includes('instalação') || lowerName.includes('instalacao')) return <Wind className="w-4 h-4 text-cyan-500" />;
    if (lowerName.includes('manutenção') || lowerName.includes('manutencao')) return <Wrench className="w-4 h-4 text-amber-500" />;
    if (lowerName.includes('limpeza') || lowerName.includes('higienização')) return <Thermometer className="w-4 h-4 text-green-500" />;
    return <Wrench className="w-4 h-4 text-muted-foreground" />;
  };

  const existingServices = products?.filter(p => p.type === 'service') || [];

  return (
    <div className="space-y-6 overflow-visible">
      {/* Items List */}
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-500" />
              Serviços & Peças
              <Badge variant="secondary" className="text-xs">{products?.length || 0}</Badge>
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowForm(!showForm)} size="sm">
                <Plus className="w-4 h-4 mr-1" /> Novo
              </Button>
              <Button onClick={() => exportToPDF(true)} size="sm" variant="outline">
                <FileDown className="w-4 h-4 mr-1" /> Interno
              </Button>
              <Button onClick={() => exportToPDF(false)} size="sm" variant="secondary">
                <FileDown className="w-4 h-4 mr-1" /> Cliente
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
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">Serviço</Badge>
                        ) : (
                          <span className={isLowStock ? "text-orange-600 font-semibold" : ""}>Est: {product.qty}</span>
                        )}
                        <span className={`font-medium ${margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                          {margin.toFixed(0)}% (R$ {profit.toFixed(2)})
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm">R$ {Number(product.price).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">custo: R$ {Number(product.cost_price).toFixed(2)}</p>
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

      {/* Registration Form - Collapsible */}
      {showForm && (
        <Card className="overflow-visible border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastrar Serviço ou Peça</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={serviceType} onValueChange={(v) => { setServiceType(v); setComboSelectedServices([]); setComboDiscount(""); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código (Opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input value={scannedBarcode} onChange={(e) => setScannedBarcode(e.target.value)} placeholder="Código" className="h-9" />
                  <BarcodeScanner onBarcodeDetected={setScannedBarcode} />
                </div>
              </div>
            </div>

            {/* Combo Selection */}
            {serviceType === 'combo' && (
              <Card className="border-purple-500/30 bg-purple-500/5">
                <CardContent className="pt-4 space-y-3">
                  <Label className="text-xs font-semibold text-purple-400">Selecione os serviços para o combo:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {existingServices.map(svc => (
                      <label key={svc.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm
                        ${comboSelectedServices.includes(svc.id) ? 'border-purple-500/50 bg-purple-500/10' : 'border-border hover:border-muted-foreground/30'}`}>
                        <Checkbox
                          checked={comboSelectedServices.includes(svc.id)}
                          onCheckedChange={(checked) => {
                            setComboSelectedServices(prev => 
                              checked ? [...prev, svc.id] : prev.filter(id => id !== svc.id)
                            );
                          }}
                        />
                        <span className="flex-1 truncate">{svc.name}</span>
                        <span className="text-xs text-muted-foreground">R$ {Number(svc.price).toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                  {comboSelectedServices.length > 0 && (
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Soma original: <span className="font-semibold">R$ {comboOriginalTotal.toFixed(2)}</span></p>
                        <p className="text-xs text-muted-foreground">Duração total: {comboDurationTotal} min</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Desconto combo (%)</Label>
                        <Input type="number" min="0" max="50" step="1" value={comboDiscount}
                          onChange={(e) => setComboDiscount(e.target.value)}
                          className="h-8 w-24" placeholder="10" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Name + Image row */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {serviceType === 'combo' ? 'Nome do Combo' : 'Nome do Serviço/Peça'}
              </Label>
              <div className="flex gap-3">
                <Input value={productName} onChange={(e) => setProductName(e.target.value)}
                  placeholder={serviceType === 'combo' 
                    ? "Ex: Combo Instalação + Limpeza" 
                    : "Ex: Instalação Split 12000 BTUs"}
                  className="h-9 flex-1" />
                <label className="flex items-center gap-1.5 px-3 border border-dashed border-muted-foreground/40 rounded-lg cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors shrink-0">
                  {productImagePreview ? (
                    <div className="relative">
                      <img src={productImagePreview} alt="" className="w-7 h-7 rounded object-cover" />
                      <button type="button" className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]"
                        onClick={(e) => { e.preventDefault(); setProductImage(null); setProductImagePreview(null); }}>×</button>
                    </div>
                  ) : (
                    <><ImagePlus className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground hidden sm:inline">Foto</span></>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              </div>
            </div>

            {/* Pricing: Cost → Price (simplified) */}
            {serviceType !== 'combo' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Custo (R$)</Label>
                  <Input type="number" step="0.01" value={baseCostPrice}
                    onChange={(e) => setBaseCostPrice(e.target.value)} placeholder="0.00" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço Final (R$)</Label>
                  <Input type="number" step="0.01" value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)} placeholder="0.00" className="h-9 font-semibold" />
                </div>
              </div>
            )}

            {serviceType === 'combo' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Preço Final do Combo (R$)</Label>
                <Input type="number" step="0.01" value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)} placeholder="0.00" className="h-9 font-semibold text-lg" />
              </div>
            )}

            {/* Auto margin display */}
            {totalCost > 0 && parseFloat(productPrice) > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/60 text-sm">
                <span className="text-muted-foreground">Custo total:</span>
                <span className="font-medium">R$ {totalCost.toFixed(2)}</span>
                <span className="text-muted-foreground">→</span>
                <span className={`font-bold ${autoMargin >= 30 ? 'text-green-600' : autoMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                  Margem: {autoMargin.toFixed(1)}% (R$ {profitInReais})
                </span>
              </div>
            )}

            {/* Expenses - collapsible */}
            {serviceType !== 'combo' && (
              <div>
                <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 h-7 px-2 text-muted-foreground"
                  onClick={() => setShowExpenses(!showExpenses)}>
                  {showExpenses ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Gastos Adicionais {expenses.length > 0 && `(${expenses.length})`}
                </Button>
                {showExpenses && (
                  <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/40 border">
                    <div className="flex gap-2">
                      <Input placeholder="Ex: Tubo de cobre" value={newExpenseName}
                        onChange={(e) => setNewExpenseName(e.target.value)} className="h-8 text-sm flex-1" />
                      <Input type="number" step="0.01" placeholder="R$" value={newExpenseValue}
                        onChange={(e) => setNewExpenseValue(e.target.value)} className="h-8 text-sm w-24" />
                      <Button type="button" onClick={addExpense} size="sm" variant="secondary" className="h-8 px-2">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    {expenses.map((exp, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-background px-2 py-1.5 rounded">
                        <span>{exp.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">R$ {exp.value.toFixed(2)}</span>
                          <button type="button" onClick={() => removeExpense(i)} className="text-destructive hover:text-destructive/80">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {expenses.length > 0 && (
                      <div className="flex justify-between text-xs font-semibold pt-1 border-t">
                        <span>Total Gastos:</span>
                        <span className="text-orange-600">R$ {totalExpenses.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Service duration */}
            {serviceTypes.find(t => t.value === serviceType)?.type === 'service' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tempo de Serviço (min)</Label>
                <Input type="number" value={serviceDuration}
                  onChange={(e) => setServiceDuration(Math.max(15, Number(e.target.value)))}
                  min="15" step="15" className="h-9" />
              </div>
            )}

            {/* Piece qty */}
            {serviceTypes.find(t => t.value === serviceType)?.type === 'piece' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} min="1" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estoque Mínimo</Label>
                  <Input type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(Number(e.target.value))} min="0" className="h-9" />
                </div>
              </div>
            )}

            <Button onClick={handleAddProduct} disabled={addMutation.isPending || uploadingImage}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
              {(addMutation.isPending || uploadingImage) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {uploadingImage ? 'Enviando imagem...' : addMutation.isPending ? 'Adicionando...' : serviceType === 'combo' ? 'Criar Combo' : 'Adicionar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Qty Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Quantidade - {editingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade em Estoque</Label>
              <Input type="number" min="0" value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} />
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
