import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Wrench, ShoppingCart, Camera, X, Plus, Loader2, Clock, Package, ChevronDown, ChevronUp, ScanBarcode } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { toast } from 'sonner';
import { TablesInsert } from '@/integrations/supabase/types';

type Expense = { name: string; value: number };

const RegisterProductTab: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string>("");

  // Form state
  const [registerType, setRegisterType] = useState<'service' | 'piece'>('piece');
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [minStock, setMinStock] = useState(5);
  const [serviceDuration, setServiceDuration] = useState(60);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [storageShelf, setStorageShelf] = useState("");
  const [storageSection, setStorageSection] = useState("");

  // Combo
  const [isCombo, setIsCombo] = useState(false);
  const [comboSelectedServices, setComboSelectedServices] = useState<number[]>([]);
  const [comboDiscount, setComboDiscount] = useState("");

  // Expenses
  const [showExpenses, setShowExpenses] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseValue, setNewExpenseValue] = useState("");

  useEffect(() => {
    const getUserId = async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUserId();
  }, []);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  const existingServices = products?.filter(p => p.type === 'service') || [];

  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.value, 0), [expenses]);
  const totalCost = useMemo(() => (parseFloat(costPrice) || 0) + totalExpenses, [costPrice, totalExpenses]);
  const autoMargin = useMemo(() => {
    const p = parseFloat(price) || 0;
    if (totalCost <= 0 || p <= 0) return 0;
    return ((p - totalCost) / totalCost) * 100;
  }, [totalCost, price]);
  const profitInReais = useMemo(() => ((parseFloat(price) || 0) - totalCost).toFixed(2), [totalCost, price]);

  // Combo calculations
  const comboOriginalTotal = useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p ? Number(p.price) : 0);
    }, 0);
  }, [comboSelectedServices, products]);

  const comboCostTotal = useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p ? Number(p.cost_price) : 0);
    }, 0);
  }, [comboSelectedServices, products]);

  const comboDurationTotal = useMemo(() => {
    if (!products) return 0;
    return comboSelectedServices.reduce((sum, id) => {
      const p = products.find(pr => pr.id === id);
      return sum + (p?.service_duration || 60);
    }, 0);
  }, [comboSelectedServices, products]);

  useEffect(() => {
    if (isCombo && comboSelectedServices.length > 0) {
      const disc = parseFloat(comboDiscount) || 0;
      const finalPrice = comboOriginalTotal * (1 - disc / 100);
      setPrice(finalPrice.toFixed(2));
      setCostPrice(comboCostTotal.toFixed(2));
      setServiceDuration(comboDurationTotal);
    }
  }, [isCombo, comboSelectedServices, comboDiscount, comboOriginalTotal, comboCostTotal, comboDurationTotal]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande (máx 5MB)'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !userId) return null;
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, imageFile);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const addExpense = () => {
    const n = newExpenseName.trim();
    const v = parseFloat(newExpenseValue);
    if (!n || isNaN(v) || v <= 0) { toast.error('Informe nome e valor do gasto'); return; }
    setExpenses([...expenses, { name: n, value: v }]);
    setNewExpenseName(""); setNewExpenseValue("");
  };

  const addMutation = useMutation({
    mutationFn: async (product: TablesInsert<'products'>) => {
      const { error } = await supabase.from('products').insert(product);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Item cadastrado com sucesso!');
      resetForm();
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar: ' + error.message);
    }
  });

  const resetForm = () => {
    setName(""); setBarcode(""); setCostPrice(""); setPrice("");
    setQty(1); setMinStock(5); setServiceDuration(60);
    setImageFile(null); setImagePreview(null);
    setSelectedSupplierId(""); setStorageLocation(""); setStorageShelf(""); setStorageSection("");
    setExpenses([]); setShowExpenses(false);
    setIsCombo(false); setComboSelectedServices([]); setComboDiscount("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }

    try {
      if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
        if (session?.user?.id) {
          setUserId(session.user.id);
        } else {
          toast.error('Sessão expirada. Por favor, entre novamente.');
          return;
        }
      }
      setUploading(true);
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadImage();

      const isService = registerType === 'service';
      const comboNames = isCombo && products
        ? comboSelectedServices.map(id => products.find(p => p.id === id)?.name).filter(Boolean).join(' + ')
        : null;

      const productData: TablesInsert<'products'> = {
        name: isCombo ? (name || `Combo: ${comboNames}`) : name.trim(),
        qty: isService ? 999 : Math.max(1, qty),
        price: parseFloat(price),
        cost_price: totalCost || 0,
        barcode: barcode.trim() || null,
        date_added: new Date().toISOString().split('T')[0],
        user_id: userId,
        service_duration: isService ? serviceDuration : null,
        type: isService ? 'service' : 'piece',
        image_url: imageUrl,
        supplier_id: selectedSupplierId && selectedSupplierId !== "none" ? parseInt(selectedSupplierId) : null,
        min_stock: isService ? 0 : minStock,
        warranty_months: 12,
        storage_location: storageLocation.trim() || null,
        storage_shelf: storageShelf.trim() || null,
        storage_section: storageSection.trim() || null,
      };

      addMutation.mutate(productData);
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const isLoading = addMutation.isPending || uploading;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Cadastrar Serviço ou Produto</h2>
            <p className="text-sm text-muted-foreground">Preencha os dados abaixo para adicionar ao catálogo</p>
          </div>

          {/* Type Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de Cadastro</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setRegisterType('piece'); setIsCombo(false); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-medium transition-all
                  ${registerType === 'piece' 
                    ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                    : 'border-border bg-card text-foreground hover:border-muted-foreground/50'}`}
              >
                <ShoppingCart className="w-4 h-4" />
                Produto
              </button>
              <button
                type="button"
                onClick={() => { setRegisterType('service'); setIsCombo(false); }}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-medium transition-all
                  ${registerType === 'service' && !isCombo
                    ? 'border-primary bg-primary text-primary-foreground shadow-md' 
                    : 'border-border bg-card text-foreground hover:border-muted-foreground/50'}`}
              >
                <Wrench className="w-4 h-4" />
                Serviço
              </button>
            </div>
            {registerType === 'service' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-muted-foreground">
                <Checkbox checked={isCombo} onCheckedChange={(c) => { setIsCombo(!!c); setComboSelectedServices([]); setComboDiscount(""); }} />
                🎁 Criar Combo (mesclar serviços existentes)
              </label>
            )}
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto (Opcional)</Label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagePreview ? (
              <div className="relative w-20 h-20">
                <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border" />
                <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                <Camera className="w-5 h-5 mb-1" />
                <span className="text-[10px]">Adicionar</span>
              </button>
            )}
          </div>

          {/* Combo Selection */}
          {isCombo && (
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
                        onChange={(e) => setComboDiscount(e.target.value)} className="h-8 w-24" placeholder="10" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Barcode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Código (Opcional)</Label>
            <div className="flex items-center gap-2">
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Código do serviço/produto (opcional)" className="flex-1" />
              <BarcodeScanner onBarcodeDetected={setBarcode} />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isCombo ? 'Nome do Combo' : registerType === 'piece' ? 'Nome do Produto' : 'Nome do Serviço'}
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={isCombo ? "Ex: Combo Instalação + Limpeza" : registerType === 'piece' ? "Ex: Gás R410a" : "Ex: Instalação Split 12000 BTUs"} />
          </div>

          {/* Pricing */}
          {!isCombo && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custo Base (R$)</Label>
                <Input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preço Final (R$)</Label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="font-semibold" />
              </div>
            </div>
          )}

          {isCombo && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Preço Final do Combo (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="font-semibold text-lg" />
            </div>
          )}

          {/* Margin display */}
          {totalCost > 0 && parseFloat(price) > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/60 text-sm">
              <span className="text-muted-foreground">Custo total:</span>
              <span className="font-medium">R$ {totalCost.toFixed(2)}</span>
              <span className="text-muted-foreground">→</span>
              <span className={`font-bold ${autoMargin >= 30 ? 'text-green-600' : autoMargin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                Margem: {autoMargin.toFixed(1)}% (R$ {profitInReais})
              </span>
            </div>
          )}

          {/* Expenses */}
          {!isCombo && (
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
                        <button type="button" onClick={() => setExpenses(expenses.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80">
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


          {/* Stock (product only) */}
          {registerType === 'piece' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Quantidade em Estoque</Label>
                <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} min="1" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estoque Mínimo (Alerta)</Label>
                <Input type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} min="0" />
              </div>
            </div>
          )}

          {/* Supplier */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fornecedor</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger><SelectValue placeholder="Selecione um fornecedor..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {suppliers?.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Storage (product only) */}
          {registerType === 'piece' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Local de Armazenamento</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="Local" className="text-sm" />
                <Input value={storageShelf} onChange={(e) => setStorageShelf(e.target.value)} placeholder="Prateleira" className="text-sm" />
                <Input value={storageSection} onChange={(e) => setStorageSection(e.target.value)} placeholder="Seção" className="text-sm" />
              </div>
            </div>
          )}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full" size="lg">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cadastrando...</>
            ) : (
              <><Plus className="w-4 h-4 mr-2" /> {isCombo ? 'Criar Combo' : `Cadastrar ${registerType === 'service' ? 'Serviço' : 'Produto'}`}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterProductTab;
