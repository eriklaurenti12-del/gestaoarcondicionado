import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShoppingCart, Trash2, Plus, Minus, Receipt, CreditCard, Banknote, Smartphone, Search, Wind, Package, User, Check, AlertCircle, FileText, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Product = Tables<'products'>;
type Client = Tables<'clients'>;
type PaymentMethod = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';

interface CartItem {
  product: Product;
  quantity: number;
}

const PDVTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [installments, setInstallments] = useState(1);
  const [paymentFee, setPaymentFee] = useState(0);
  const [searchProduct, setSearchProduct] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data as Product[];
    }
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      return data as Client[];
    }
  });

  const { data: companyData } = useQuery({
    queryKey: ['company-data'],
    queryFn: async () => {
      const { data, error } = await supabase.from('company_data').select('*').limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const filteredClients = useMemo(() => {
    if (!clients || !searchClient.trim()) return [];
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
      c.telefone?.includes(searchClient)
    ).slice(0, 8);
  }, [clients, searchClient]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.barcode?.includes(searchProduct)
    );
  }, [products, searchProduct]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.product.price) * item.quantity), 0);
  }, [cart]);

  const totalWithFee = useMemo(() => {
    return cartTotal + (cartTotal * paymentFee / 100);
  }, [cartTotal, paymentFee]);

  const profit = useMemo(() => {
    return cart.reduce((sum, item) => {
      const profitPerItem = Number(item.product.price) - Number(item.product.cost_price);
      return sum + (profitPerItem * item.quantity);
    }, 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    if (product.type !== 'service' && product.qty <= 0) {
      toast({ variant: "destructive", title: "Sem estoque", description: "Este produto não possui estoque disponível." });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (product.type !== 'service' && existing.quantity >= product.qty) {
          toast({ variant: "destructive", title: "Estoque insuficiente", description: `Apenas ${product.qty} unidades disponíveis.` });
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item;
          if (item.product.type !== 'service' && newQty > item.product.qty) {
            toast({ variant: "destructive", title: "Estoque insuficiente", description: `Apenas ${item.product.qty} unidades disponíveis.` });
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setPaymentMethod('PIX');
    setInstallments(1);
    setPaymentFee(0);
  };

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Selecione um cliente");
      if (cart.length === 0) throw new Error("Carrinho vazio");

      const salePromises = cart.map(async (item) => {
        const saleData: TablesInsert<'sales'> = {
          product_id: item.product.id,
          client_id: selectedClient.id,
          qty: item.quantity,
          sale_price: Number(item.product.price),
          total_profit: (Number(item.product.price) - Number(item.product.cost_price)) * item.quantity,
          payment_method: paymentMethod,
          payment_fee_percentage: paymentFee,
          user_id: userId,
        };

        const { data: saleResult, error: saleError } = await supabase.from('sales').insert(saleData).select().single();
        if (saleError) throw saleError;

        // Update stock for pieces
        if (item.product.type !== 'service') {
          const { error: updateError } = await supabase
            .from('products')
            .update({ qty: item.product.qty - item.quantity })
            .eq('id', item.product.id);
          if (updateError) throw updateError;
        }

        // Create installments if credit
        if (paymentMethod === 'Crédito' && installments > 1) {
          const installmentAmount = totalWithFee / installments;
          const today = new Date();
          
          for (let i = 1; i <= installments; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            await supabase.from('installments').insert({
              user_id: userId,
              sale_id: saleResult.id,
              installment_number: i,
              total_installments: installments,
              amount: installmentAmount,
              due_date: dueDate.toISOString().split('T')[0],
              is_paid: false,
              payment_method: 'Crédito',
            });
          }
        }

        return saleResult;
      });

      const results = await Promise.all(salePromises);
      return results[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      setLastSaleId(data.id);
      setShowConfirmDialog(false);
      setShowSuccessDialog(true);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro na venda", description: error.message });
    }
  });

  const handleFinalizeSale = () => {
    if (!selectedClient) {
      toast({ variant: "destructive", title: "Cliente obrigatório", description: "Selecione um cliente para continuar." });
      return;
    }
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrinho vazio", description: "Adicione itens ao carrinho." });
      return;
    }
    setShowConfirmDialog(true);
  };

  const generateReceipt = () => {
    if (!selectedClient) return;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text(companyData?.company_name || 'AC Service Pro', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    if (companyData?.cnpj_cpf) {
      doc.text(`CNPJ/CPF: ${companyData.cnpj_cpf}`, 105, 28, { align: 'center' });
    }
    if (companyData?.whatsapp) {
      doc.text(`WhatsApp: ${companyData.whatsapp}`, 105, 34, { align: 'center' });
    }
    
    doc.setFontSize(14);
    doc.text('COMPROVANTE DE VENDA', 105, 48, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 60);
    doc.text(`Cliente: ${selectedClient.name}`, 14, 68);
    doc.text(`Telefone: ${selectedClient.telefone || '-'}`, 14, 74);
    
    // Items table
    const tableData = cart.map(item => [
      item.product.name,
      item.quantity.toString(),
      `R$ ${Number(item.product.price).toFixed(2)}`,
      `R$ ${(Number(item.product.price) * item.quantity).toFixed(2)}`
    ]);
    
    autoTable(doc, {
      startY: 82,
      head: [['Item', 'Qtd', 'Preço Un.', 'Total']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    
    doc.setFontSize(10);
    doc.text(`Subtotal: R$ ${cartTotal.toFixed(2)}`, 14, finalY + 10);
    if (paymentFee > 0) {
      doc.text(`Taxa (${paymentFee}%): R$ ${(cartTotal * paymentFee / 100).toFixed(2)}`, 14, finalY + 16);
    }
    doc.setFontSize(12);
    doc.setFont(undefined as any, 'bold');
    doc.text(`TOTAL: R$ ${totalWithFee.toFixed(2)}`, 14, finalY + 26);
    doc.setFont(undefined as any, 'normal');
    doc.setFontSize(10);
    doc.text(`Forma de Pagamento: ${paymentMethod}${installments > 1 ? ` (${installments}x)` : ''}`, 14, finalY + 34);
    
    doc.setFontSize(8);
    doc.text('Obrigado pela preferência!', 105, finalY + 50, { align: 'center' });
    
    doc.save(`comprovante-venda-${Date.now()}.pdf`);
    toast({ title: "Comprovante gerado!", description: "PDF salvo com sucesso." });
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'Dinheiro': return <Banknote className="w-4 h-4" />;
      case 'PIX': return <Smartphone className="w-4 h-4" />;
      case 'Débito': return <CreditCard className="w-4 h-4" />;
      case 'Crédito': return <CreditCard className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products List */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-cyan-500" />
              Serviços & Peças
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              {isLoadingProducts ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-auto p-3 justify-start text-left hover:bg-muted/50 transition-all"
                      onClick={() => addToCart(product)}
                      disabled={product.type !== 'service' && product.qty <= 0}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="p-2 rounded-lg bg-cyan-500/10">
                          {product.type === 'service' ? (
                            <Wind className="w-4 h-4 text-cyan-500" />
                          ) : (
                            <Package className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-primary">R$ {Number(product.price).toFixed(2)}</span>
                            {product.type !== 'service' && (
                              <span className={product.qty <= (product.min_stock || 0) ? "text-orange-500" : ""}>
                                Est: {product.qty}
                              </span>
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="w-5 h-5 text-green-500" />
              Carrinho
              {cart.length > 0 && (
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} itens
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </Label>
              {selectedClient ? (
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{selectedClient.name}</p>
                      {selectedClient.telefone && (
                        <p className="text-xs text-muted-foreground">{selectedClient.telefone}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)} className="h-8 w-8 p-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchClient}
                    onChange={(e) => {
                      setSearchClient(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="pl-10"
                  />
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg mt-1 py-1 max-h-[200px] overflow-y-auto">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
                          onClick={() => {
                            setSelectedClient(client);
                            setSearchClient('');
                            setShowClientDropdown(false);
                          }}
                        >
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{client.name}</p>
                            {client.telefone && (
                              <p className="text-xs text-muted-foreground">{client.telefone}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Carrinho vazio</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(item.product.price).toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.product.id, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateQuantity(item.product.id, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">
                    <div className="flex items-center gap-2"><Banknote className="w-4 h-4" /> Dinheiro</div>
                  </SelectItem>
                  <SelectItem value="PIX">
                    <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> PIX</div>
                  </SelectItem>
                  <SelectItem value="Débito">
                    <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Débito</div>
                  </SelectItem>
                  <SelectItem value="Crédito">
                    <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Crédito</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'Crédito' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Parcelas</Label>
                  <Select value={installments.toString()} onValueChange={(v) => setInstallments(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Taxa %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={paymentFee}
                    onChange={(e) => setPaymentFee(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </div>
              {paymentFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa ({paymentFee}%):</span>
                  <span>R$ {(cartTotal * paymentFee / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">R$ {totalWithFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lucro estimado:</span>
                <span className="text-primary">R$ {profit.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
                Limpar
              </Button>
              <Button 
                onClick={handleFinalizeSale} 
                disabled={cart.length === 0 || !selectedClient || saleMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Finalizar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirmar Venda
            </DialogTitle>
            <DialogDescription>
              Revise os dados antes de finalizar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm"><strong>Cliente:</strong> {selectedClient?.name}</p>
              <p className="text-sm"><strong>Itens:</strong> {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
              <p className="text-sm"><strong>Pagamento:</strong> {paymentMethod}{installments > 1 ? ` (${installments}x)` : ''}</p>
              <p className="text-lg font-bold mt-2">Total: R$ {totalWithFee.toFixed(2)}</p>
            </div>
            
            <div className="max-h-[150px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.product.id}>
                      <TableCell className="text-sm">{item.product.name}</TableCell>
                      <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right text-sm">R$ {(Number(item.product.price) * item.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => saleMutation.mutate()} 
              disabled={saleMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {saleMutation.isPending ? "Processando..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={(open) => {
        setShowSuccessDialog(open);
        if (!open) clearCart();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Venda Realizada!
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-medium">Venda #{lastSaleId} registrada com sucesso!</p>
            <p className="text-muted-foreground">Total: R$ {totalWithFee.toFixed(2)}</p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setShowSuccessDialog(false);
              clearCart();
            }}>
              Nova Venda
            </Button>
            <Button onClick={() => {
              generateReceipt();
              setShowSuccessDialog(false);
              clearCart();
            }}>
              <FileText className="w-4 h-4 mr-2" />
              Gerar Comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDVTab;
