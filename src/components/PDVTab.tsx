import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Send, X, Search, User, Package } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CartItem {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  quantity: number;
}

interface PaymentSplit {
  method: string;
  amount: number;
}

const paymentMethods = [
  { value: 'Dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'PIX', label: 'PIX', icon: QrCode },
  { value: 'Débito', label: 'Débito', icon: CreditCard },
  { value: 'Crédito', label: 'Crédito', icon: CreditCard },
];

export default function PDVTab() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [selectedClientPhone, setSelectedClientPhone] = useState('');
  
  // Payment state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([{ method: 'Dinheiro', amount: 0 }]);
  const [cashReceived, setCashReceived] = useState<number>(0);
  
  // Quick product add
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');
  const [quickProductCost, setQuickProductCost] = useState('');

  React.useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    };
    getUserId();
  }, []);

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, telefone').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(productSearch))
    );
  }, [products, productSearch]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!clients || !clientSearch) return [];
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.telefone && c.telefone.includes(clientSearch))
    ).slice(0, 5);
  }, [clients, clientSearch]);

  // Cart calculations
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartProfit = useMemo(() => cart.reduce((sum, item) => sum + (item.price - item.cost_price) * item.quantity, 0), [cart]);
  
  // Payment calculations
  const totalPaid = useMemo(() => paymentSplits.reduce((sum, p) => sum + p.amount, 0), [paymentSplits]);
  const remaining = cartTotal - totalPaid;
  const change = cashReceived > cartTotal ? cashReceived - cartTotal : 0;

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        cost_price: Number(product.cost_price),
        quantity: 1
      }]);
    }
    setProductSearch('');
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const selectClient = (client: any) => {
    setSelectedClientId(client.id);
    setSelectedClientName(client.name);
    setSelectedClientPhone(client.telefone || '');
    setClientSearch('');
  };

  const clearClient = () => {
    setSelectedClientId(null);
    setSelectedClientName('');
    setSelectedClientPhone('');
  };

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, { method: 'Dinheiro', amount: 0 }]);
  };

  const updatePaymentSplit = (index: number, field: keyof PaymentSplit, value: any) => {
    const updated = [...paymentSplits];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentSplits(updated);
  };

  const removePaymentSplit = (index: number) => {
    if (paymentSplits.length > 1) {
      setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
    }
  };

  const autoFillRemaining = (index: number) => {
    const updated = [...paymentSplits];
    const otherTotal = paymentSplits.filter((_, i) => i !== index).reduce((sum, p) => sum + p.amount, 0);
    updated[index] = { ...updated[index], amount: Math.max(0, cartTotal - otherTotal) };
    setPaymentSplits(updated);
  };

  // Sale mutation
  const saleMutation = useMutation({
    mutationFn: async () => {
      for (const item of cart) {
        // Map payment method to valid enum
        const primaryMethod = paymentSplits[0]?.method || 'Dinheiro';
        const validMethod = ['Dinheiro', 'PIX', 'Débito', 'Crédito'].includes(primaryMethod) 
          ? primaryMethod as 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito'
          : 'Dinheiro';
        
        const saleData = {
          user_id: userId,
          client_id: selectedClientId || 1,
          product_id: item.id,
          qty: item.quantity,
          sale_price: item.price * item.quantity,
          total_profit: (item.price - item.cost_price) * item.quantity,
          payment_method: validMethod
        };
        
        const { error } = await supabase.from('sales').insert([saleData]);
        if (error) throw error;

        // Update product stock if it's a physical product
        const product = products?.find(p => p.id === item.id);
        if (product && product.qty < 999) {
          await supabase
            .from('products')
            .update({ qty: product.qty - item.quantity })
            .eq('id', item.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      // Send WhatsApp receipt if client has phone
      if (selectedClientPhone) {
        sendReceipt();
      }
      
      toast.success('Venda finalizada com sucesso!');
      resetSale();
    },
    onError: (error: any) => {
      toast.error('Erro ao finalizar venda: ' + error.message);
    }
  });

  // Quick product add mutation
  const addProductMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('products').insert({
        user_id: userId,
        name: quickProductName,
        price: parseFloat(quickProductPrice),
        cost_price: parseFloat(quickProductCost) || 0,
        qty: 1,
        min_stock: 0,
        date_added: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto adicionado!');
      setShowQuickProduct(false);
      setQuickProductName('');
      setQuickProductPrice('');
      setQuickProductCost('');
    }
  });

  const resetSale = () => {
    setCart([]);
    setShowPaymentDialog(false);
    setPaymentSplits([{ method: 'Dinheiro', amount: 0 }]);
    setCashReceived(0);
    clearClient();
  };

  const sendReceipt = () => {
    const phone = selectedClientPhone.replace(/\D/g, '');
    if (!phone) return;

    const itemsList = cart.map(item => 
      `• ${item.name} x${item.quantity} = R$ ${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const message = `✅ *COMPROVANTE DE VENDA*\n\n` +
      `📋 *AC Service Pro*\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Cliente:* ${selectedClientName || 'Balcão'}\n` +
      `📅 *Data:* ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}\n\n` +
      `🛒 *Itens:*\n${itemsList}\n\n` +
      `💰 *TOTAL:* R$ ${cartTotal.toFixed(2)}\n` +
      (change > 0 ? `💵 *Troco:* R$ ${change.toFixed(2)}\n` : '') +
      `\n━━━━━━━━━━━━━━━━\n` +
      `Agradecemos a preferência! 🙏`;

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const finalizeSale = () => {
    if (Math.abs(remaining) > 0.01 && remaining > 0) {
      toast.error('Valor pago insuficiente!');
      return;
    }
    saleMutation.mutate();
  };

  const openPayment = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio!');
      return;
    }
    setPaymentSplits([{ method: 'Dinheiro', amount: cartTotal }]);
    setCashReceived(0);
    setShowPaymentDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5" />
                PDV - Ponto de Venda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou código..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                  />
                </div>
                <Button onClick={() => setShowQuickProduct(true)} variant="outline" className="min-h-[44px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Rápido
                </Button>
              </div>

              {/* Product List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
                {filteredProducts.slice(0, 20).map((product) => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto p-3 flex flex-col items-start text-left hover:bg-primary/10"
                    onClick={() => addToCart(product)}
                  >
                    <span className="text-sm font-medium truncate w-full">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {product.qty < 999 ? `Est: ${product.qty}` : 'Serviço'}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      R$ {Number(product.price).toFixed(2)}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart Panel */}
        <div className="space-y-4">
          {/* Client Selection */}
          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                Cliente (opcional)
              </Label>
              {selectedClientId ? (
                <div className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <p className="font-medium">{selectedClientName}</p>
                    {selectedClientPhone && <p className="text-xs text-muted-foreground">{selectedClientPhone}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearClient}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="min-h-[44px]"
                  />
                  {filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg mt-1">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          className="w-full p-2 text-left hover:bg-muted transition-colors"
                          onClick={() => selectClient(client)}
                        >
                          <p className="font-medium">{client.name}</p>
                          {client.telefone && <p className="text-xs text-muted-foreground">{client.telefone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5" />
                Carrinho ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Carrinho vazio</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {item.price.toFixed(2)} x {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.id, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.id, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeFromCart(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Lucro:</span>
                      <span>R$ {cartProfit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-primary">
                      <span>TOTAL:</span>
                      <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 min-h-[44px]" onClick={resetSale}>
                      Limpar
                    </Button>
                    <Button className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700" onClick={openPayment}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pagar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagamento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total a pagar</p>
              <p className="text-3xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</p>
            </div>

            {/* Payment Splits */}
            <div className="space-y-3">
              <Label className="font-medium">Formas de Pagamento</Label>
              {paymentSplits.map((split, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Select value={split.method} onValueChange={(v) => updatePaymentSplit(index, 'method', v)}>
                    <SelectTrigger className="w-[120px] min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Valor"
                    value={split.amount || ''}
                    onChange={(e) => updatePaymentSplit(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="flex-1 min-h-[44px]"
                  />
                  <Button variant="ghost" size="sm" className="px-2" onClick={() => autoFillRemaining(index)}>
                    Auto
                  </Button>
                  {paymentSplits.length > 1 && (
                    <Button variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => removePaymentSplit(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPaymentSplit} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Dividir Pagamento
              </Button>
            </div>

            {/* Cash handling */}
            {paymentSplits.some(p => p.method === 'Dinheiro') && (
              <div className="space-y-2">
                <Label>Valor recebido em dinheiro</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                  className="min-h-[44px]"
                />
                {cashReceived > 0 && cashReceived >= cartTotal && (
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-md text-center">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="text-xl font-bold text-green-600">R$ {change.toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Total pago:</span>
                <span className={totalPaid >= cartTotal ? 'text-green-600' : 'text-orange-600'}>
                  R$ {totalPaid.toFixed(2)}
                </span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Falta:</span>
                  <span>R$ {remaining.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button 
              onClick={finalizeSale} 
              disabled={remaining > 0.01 || saleMutation.isPending}
              className="min-h-[44px] bg-green-600 hover:bg-green-700"
            >
              {saleMutation.isPending ? 'Processando...' : 'Finalizar Venda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Product Dialog */}
      <Dialog open={showQuickProduct} onOpenChange={setShowQuickProduct}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro Rápido de Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Produto</Label>
              <Input 
                value={quickProductName} 
                onChange={(e) => setQuickProductName(e.target.value)}
                placeholder="Ex: Gás R22 500g"
                className="min-h-[44px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Custo (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={quickProductCost} 
                  onChange={(e) => setQuickProductCost(e.target.value)}
                  placeholder="0.00"
                  className="min-h-[44px]"
                />
              </div>
              <div>
                <Label>Preço Venda (R$)</Label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={quickProductPrice} 
                  onChange={(e) => setQuickProductPrice(e.target.value)}
                  placeholder="0.00"
                  className="min-h-[44px]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickProduct(false)}>Cancelar</Button>
            <Button onClick={() => addProductMutation.mutate()} disabled={!quickProductName || !quickProductPrice}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
