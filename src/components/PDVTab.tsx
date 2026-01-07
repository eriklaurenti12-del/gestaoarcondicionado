import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Trash2, Plus, Minus, Receipt, CreditCard, Banknote, Smartphone, Search, Wind, Package, User, Check, AlertCircle, FileText, X, History, MessageCircle, UserPlus, PlusCircle, Calculator, DollarSign, Calendar, Filter, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Product = Tables<'products'>;
type Client = Tables<'clients'>;
type Sale = Tables<'sales'> & { 
  clients?: { name: string; telefone?: string | null } | null;
  products?: { name: string } | null;
};
type PaymentMethod = 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito';

interface CartItem {
  product: Product;
  quantity: number;
  isCustom?: boolean;
}

interface CustomProduct {
  name: string;
  price: number;
  cost_price: number;
}

const PDVTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState("venda");
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [installments, setInstallments] = useState(1);
  const [paymentFee, setPaymentFee] = useState(0);
  const [searchProduct, setSearchProduct] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
  // Cash payment
  const [amountReceived, setAmountReceived] = useState<string>("");
  
  // Dialogs
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showSaleDetailDialog, setShowSaleDetailDialog] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  
  // Last sale data for receipt
  const [lastSaleData, setLastSaleData] = useState<{
    id: number;
    total: number;
    client: Client | null;
    items: CartItem[];
    paymentMethod: PaymentMethod;
    change?: number;
  } | null>(null);
  
  // New client form
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  
  // Custom product form
  const [customProductName, setCustomProductName] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductCost, setCustomProductCost] = useState("");
  const [saveCustomProduct, setSaveCustomProduct] = useState(false);
  
  // Sales history filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<string>("all");

  const clientDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const { data: salesHistory, isLoading: isLoadingSales } = useQuery({
    queryKey: ['sales-history', historyMonth],
    queryFn: async () => {
      const startDate = startOfMonth(parseISO(historyMonth + '-01'));
      const endDate = endOfMonth(startDate);
      
      const { data, error } = await supabase
        .from('sales')
        .select('*, clients(name, telefone), products(name)')
        .gte('sale_date', startDate.toISOString())
        .lte('sale_date', endDate.toISOString())
        .order('sale_date', { ascending: false });
      
      if (error) throw error;
      return data as Sale[];
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

  const filteredSalesHistory = useMemo(() => {
    if (!salesHistory) return [];
    return salesHistory.filter(sale => {
      const matchesSearch = !historySearch || 
        sale.clients?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
        sale.products?.name?.toLowerCase().includes(historySearch.toLowerCase());
      const matchesPayment = historyPaymentFilter === 'all' || sale.payment_method === historyPaymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [salesHistory, historySearch, historyPaymentFilter]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.product.price) * item.quantity), 0);
  }, [cart]);

  const totalWithFee = useMemo(() => {
    return cartTotal + (cartTotal * paymentFee / 100);
  }, [cartTotal, paymentFee]);

  const change = useMemo(() => {
    if (paymentMethod !== 'Dinheiro') return 0;
    const received = parseFloat(amountReceived) || 0;
    return Math.max(0, received - totalWithFee);
  }, [paymentMethod, amountReceived, totalWithFee]);

  const profit = useMemo(() => {
    return cart.reduce((sum, item) => {
      const profitPerItem = Number(item.product.price) - Number(item.product.cost_price);
      return sum + (profitPerItem * item.quantity);
    }, 0);
  }, [cart]);

  const salesStats = useMemo(() => {
    if (!filteredSalesHistory) return { total: 0, count: 0, profit: 0 };
    return {
      total: filteredSalesHistory.reduce((sum, s) => sum + Number(s.sale_price) * s.qty, 0),
      count: filteredSalesHistory.length,
      profit: filteredSalesHistory.reduce((sum, s) => sum + Number(s.total_profit), 0)
    };
  }, [filteredSalesHistory]);

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

  const addCustomProductToCart = () => {
    const price = parseFloat(customProductPrice);
    const cost = parseFloat(customProductCost) || 0;
    
    if (!customProductName.trim() || isNaN(price) || price <= 0) {
      toast({ variant: "destructive", title: "Dados inválidos", description: "Preencha nome e preço do produto." });
      return;
    }

    const customProduct: Product = {
      id: Date.now() * -1, // Negative ID for custom products
      name: customProductName.trim(),
      price: price,
      cost_price: cost,
      qty: 999,
      type: 'piece',
      user_id: userId,
      created_at: new Date().toISOString(),
      barcode: null,
      image_url: null,
      min_stock: null,
      date_added: null,
      service_duration: null,
      supplier_id: null,
      warranty_months: null
    };

    setCart(prev => [...prev, { product: customProduct, quantity: 1, isCustom: true }]);
    
    // Optionally save to database
    if (saveCustomProduct && userId) {
      supabase.from('products').insert({
        name: customProductName.trim(),
        price: price,
        cost_price: cost,
        qty: 0,
        type: 'piece',
        user_id: userId
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        toast({ title: "Produto salvo!", description: "Produto cadastrado no sistema." });
      });
    }
    
    setShowAddProductDialog(false);
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductCost("");
    setSaveCustomProduct(false);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item;
          if (!item.isCustom && item.product.type !== 'service' && newQty > item.product.qty) {
            toast({ variant: "destructive", title: "Estoque insuficiente" });
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
    setAmountReceived("");
  };

  // Add new client
  const addClientMutation = useMutation({
    mutationFn: async () => {
      if (!newClientName.trim()) throw new Error("Nome é obrigatório");
      
      const { data, error } = await supabase.from('clients').insert({
        name: newClientName.trim(),
        telefone: newClientPhone.trim() || null,
        preferences: newClientAddress.trim() || null,
        user_id: userId
      }).select().single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setSelectedClient(data);
      setShowAddClientDialog(false);
      setNewClientName("");
      setNewClientPhone("");
      setNewClientAddress("");
      toast({ title: "Cliente cadastrado!", description: "Cliente adicionado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Carrinho vazio");

      // For avulsa sales, we'll use a default client or require one
      const clientId = selectedClient?.id;
      if (!clientId) throw new Error("Selecione um cliente");

      const salePromises = cart.map(async (item) => {
        // Skip custom products that aren't saved
        const productId = item.isCustom ? null : item.product.id;
        
        if (!productId && item.isCustom) {
          // For custom products, we need to create them first
          const { data: newProduct, error: productError } = await supabase.from('products').insert({
            name: item.product.name,
            price: item.product.price,
            cost_price: item.product.cost_price,
            qty: 0,
            type: 'piece',
            user_id: userId
          }).select().single();
          
          if (productError) throw productError;
          
          const saleData: TablesInsert<'sales'> = {
            product_id: newProduct.id,
            client_id: clientId,
            qty: item.quantity,
            sale_price: Number(item.product.price),
            total_profit: (Number(item.product.price) - Number(item.product.cost_price)) * item.quantity,
            payment_method: paymentMethod,
            payment_fee_percentage: paymentFee,
            user_id: userId,
          };

          const { data: saleResult, error: saleError } = await supabase.from('sales').insert(saleData).select().single();
          if (saleError) throw saleError;
          return saleResult;
        }

        const saleData: TablesInsert<'sales'> = {
          product_id: item.product.id,
          client_id: clientId,
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
        if (item.product.type !== 'service' && !item.isCustom) {
          await supabase
            .from('products')
            .update({ qty: item.product.qty - item.quantity })
            .eq('id', item.product.id);
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
      queryClient.invalidateQueries({ queryKey: ['sales-history'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      
      setLastSaleData({
        id: data.id,
        total: totalWithFee,
        client: selectedClient,
        items: [...cart],
        paymentMethod,
        change: paymentMethod === 'Dinheiro' ? change : undefined
      });
      
      setShowConfirmDialog(false);
      setShowSuccessDialog(true);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro na venda", description: error.message });
    }
  });

  const handleFinalizeSale = () => {
    if (!selectedClient) {
      toast({ variant: "destructive", title: "Cliente obrigatório", description: "Selecione ou cadastre um cliente." });
      return;
    }
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrinho vazio", description: "Adicione itens ao carrinho." });
      return;
    }
    if (paymentMethod === 'Dinheiro' && parseFloat(amountReceived) < totalWithFee) {
      toast({ variant: "destructive", title: "Valor insuficiente", description: "O valor recebido é menor que o total." });
      return;
    }
    setShowConfirmDialog(true);
  };

  const generateReceipt = () => {
    if (!lastSaleData) return;
    
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
    doc.text(`Venda #${lastSaleData.id}`, 14, 60);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 66);
    doc.text(`Cliente: ${lastSaleData.client?.name || 'Não informado'}`, 14, 72);
    if (lastSaleData.client?.telefone) {
      doc.text(`Telefone: ${lastSaleData.client.telefone}`, 14, 78);
    }
    
    // Items table
    const tableData = lastSaleData.items.map(item => [
      item.product.name,
      item.quantity.toString(),
      `R$ ${Number(item.product.price).toFixed(2)}`,
      `R$ ${(Number(item.product.price) * item.quantity).toFixed(2)}`
    ]);
    
    autoTable(doc, {
      startY: 85,
      head: [['Item', 'Qtd', 'Preço Un.', 'Total']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });
    
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    
    doc.setFontSize(10);
    if (paymentFee > 0) {
      doc.text(`Taxa (${paymentFee}%): R$ ${(cartTotal * paymentFee / 100).toFixed(2)}`, 14, finalY + 10);
    }
    doc.setFontSize(12);
    doc.setFont(undefined as any, 'bold');
    doc.text(`TOTAL: R$ ${lastSaleData.total.toFixed(2)}`, 14, finalY + 20);
    doc.setFont(undefined as any, 'normal');
    doc.setFontSize(10);
    doc.text(`Forma de Pagamento: ${lastSaleData.paymentMethod}${installments > 1 ? ` (${installments}x)` : ''}`, 14, finalY + 28);
    
    if (lastSaleData.change && lastSaleData.change > 0) {
      doc.text(`Valor Recebido: R$ ${amountReceived}`, 14, finalY + 36);
      doc.text(`Troco: R$ ${lastSaleData.change.toFixed(2)}`, 14, finalY + 42);
    }
    
    doc.setFontSize(8);
    doc.text('Obrigado pela preferência!', 105, finalY + 56, { align: 'center' });
    
    doc.save(`comprovante-venda-${lastSaleData.id}.pdf`);
    toast({ title: "Comprovante gerado!", description: "PDF salvo com sucesso." });
  };

  const sendReceiptWhatsApp = () => {
    if (!lastSaleData?.client?.telefone) {
      toast({ variant: "destructive", title: "Sem telefone", description: "Cliente não possui telefone cadastrado." });
      return;
    }
    
    const phone = lastSaleData.client.telefone.replace(/\D/g, '');
    const itemsList = lastSaleData.items.map(i => 
      `• ${i.product.name} (${i.quantity}x) - R$ ${(Number(i.product.price) * i.quantity).toFixed(2)}`
    ).join('\n');
    
    let message = `🧾 *COMPROVANTE DE VENDA*\n\n`;
    message += `*${companyData?.company_name || 'AC Service Pro'}*\n`;
    message += `Venda #${lastSaleData.id}\n`;
    message += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    message += `*Itens:*\n${itemsList}\n\n`;
    message += `*Total: R$ ${lastSaleData.total.toFixed(2)}*\n`;
    message += `Pagamento: ${lastSaleData.paymentMethod}`;
    if (lastSaleData.change && lastSaleData.change > 0) {
      message += `\nTroco: R$ ${lastSaleData.change.toFixed(2)}`;
    }
    message += `\n\nObrigado pela preferência! 🙏`;
    
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    toast({ title: "WhatsApp aberto!", description: "Comprovante enviado." });
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'Dinheiro': return <Banknote className="w-4 h-4 text-green-500" />;
      case 'PIX': return <Smartphone className="w-4 h-4 text-purple-500" />;
      case 'Débito': return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'Crédito': return <CreditCard className="w-4 h-4 text-orange-500" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  const getPaymentBadge = (method: string) => {
    const colors: Record<string, string> = {
      'Dinheiro': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'PIX': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'Débito': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Crédito': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return colors[method] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="venda" className="flex items-center gap-1 px-2">
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">PDV</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1 px-2">
            <History className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Histórico</span>
          </TabsTrigger>
        </TabsList>

        {/* PDV Tab */}
        <TabsContent value="venda" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Products List */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-cyan-500" />
                    Produtos & Serviços
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowAddProductDialog(true)}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Produto Avulso
                  </Button>
                </div>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="w-5 h-5 text-green-500" />
                  Carrinho
                  {cart.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)} itens
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Cliente
                    </Label>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddClientDialog(true)}>
                      <UserPlus className="w-3 h-3 mr-1" />
                      Novo
                    </Button>
                  </div>
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
                    <div ref={clientDropdownRef} className="relative">
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
                <div className="max-h-[180px] overflow-y-auto space-y-2">
                  {cart.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Carrinho vazio</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.product.name}
                            {item.isCustom && <Badge variant="outline" className="ml-1 text-[10px]">Avulso</Badge>}
                          </p>
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
                        <div className="flex items-center gap-2"><Banknote className="w-4 h-4 text-green-500" /> Dinheiro</div>
                      </SelectItem>
                      <SelectItem value="PIX">
                        <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-purple-500" /> PIX</div>
                      </SelectItem>
                      <SelectItem value="Débito">
                        <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Débito</div>
                      </SelectItem>
                      <SelectItem value="Crédito">
                        <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-orange-500" /> Crédito</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cash - Amount received and change */}
                {paymentMethod === 'Dinheiro' && (
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor Recebido</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="0.00"
                        className="bg-background"
                      />
                    </div>
                    {parseFloat(amountReceived) > 0 && (
                      <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-background">
                        <span className="text-sm flex items-center gap-2">
                          <Calculator className="w-4 h-4" />
                          Troco:
                        </span>
                        <span className={`font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {change.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Credit options */}
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
        </TabsContent>

        {/* Sales History Tab */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Histórico de Vendas
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                      {salesStats.count} vendas
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20">
                      R$ {salesStats.total.toFixed(2)}
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20">
                      Lucro: R$ {salesStats.profit.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente ou produto..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Input
                  type="month"
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                />
                <Select value={historyPaymentFilter} onValueChange={setHistoryPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Débito">Débito</SelectItem>
                    <SelectItem value="Crédito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto/Serviço</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
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
                    ) : filteredSalesHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSalesHistory.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="text-sm">
                            {format(new Date(sale.sale_date), 'dd/MM/yy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">{sale.clients?.name || '-'}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{sale.products?.name || '-'}</TableCell>
                          <TableCell className="text-center">{sale.qty}</TableCell>
                          <TableCell>
                            <Badge className={`${getPaymentBadge(sale.payment_method)} flex items-center gap-1 w-fit`}>
                              {getPaymentIcon(sale.payment_method)}
                              {sale.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {(Number(sale.sale_price) * sale.qty).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            R$ {Number(sale.total_profit).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {sale.clients?.telefone && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-500"
                                  onClick={() => {
                                    const phone = sale.clients?.telefone?.replace(/\D/g, '');
                                    const msg = `Olá ${sale.clients?.name}! 🧊 Referente à venda de ${sale.products?.name} - R$ ${(Number(sale.sale_price) * sale.qty).toFixed(2)}`;
                                    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                  }}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedSaleDetail(sale);
                                  setShowSaleDetailDialog(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Sale Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirmar Venda
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm"><strong>Cliente:</strong> {selectedClient?.name}</p>
              <p className="text-sm"><strong>Itens:</strong> {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
              <p className="text-sm"><strong>Pagamento:</strong> {paymentMethod}{installments > 1 ? ` (${installments}x)` : ''}</p>
              {paymentMethod === 'Dinheiro' && parseFloat(amountReceived) > 0 && (
                <>
                  <p className="text-sm"><strong>Recebido:</strong> R$ {amountReceived}</p>
                  <p className="text-sm"><strong>Troco:</strong> R$ {change.toFixed(2)}</p>
                </>
              )}
              <p className="text-lg font-bold mt-2 text-green-600">Total: R$ {totalWithFee.toFixed(2)}</p>
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
            <p className="text-lg font-medium">Venda #{lastSaleData?.id} registrada!</p>
            <p className="text-2xl font-bold text-green-600 my-2">R$ {lastSaleData?.total.toFixed(2)}</p>
            {lastSaleData?.change && lastSaleData.change > 0 && (
              <p className="text-muted-foreground">Troco: R$ {lastSaleData.change.toFixed(2)}</p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowSuccessDialog(false);
              clearCart();
            }} className="flex-1">
              Nova Venda
            </Button>
            <Button variant="outline" onClick={generateReceipt} className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button 
              onClick={sendReceiptWhatsApp} 
              disabled={!lastSaleData?.client?.telefone}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Cadastrar Cliente Rápido
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone/WhatsApp</Label>
              <Input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                placeholder="Endereço do cliente"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddClientDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addClientMutation.mutate()} 
              disabled={addClientMutation.isPending || !newClientName.trim()}
            >
              {addClientMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Product Dialog */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Produto Avulso
            </DialogTitle>
            <DialogDescription>
              Adicione um produto que não está cadastrado no sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
                placeholder="Ex: Peça avulsa, Serviço extra..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço de Venda *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={customProductPrice}
                  onChange={(e) => setCustomProductPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Custo (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={customProductCost}
                  onChange={(e) => setCustomProductCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveProduct"
                checked={saveCustomProduct}
                onChange={(e) => setSaveCustomProduct(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="saveProduct" className="text-sm cursor-pointer">
                Salvar produto no cadastro para uso futuro
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProductDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={addCustomProductToCart} 
              disabled={!customProductName.trim() || !customProductPrice}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar ao Carrinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale Detail Dialog */}
      <Dialog open={showSaleDetailDialog} onOpenChange={setShowSaleDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda #{selectedSaleDetail?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedSaleDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">{format(new Date(selectedSaleDetail.sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">{selectedSaleDetail.clients?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Produto:</span>
                  <p className="font-medium">{selectedSaleDetail.products?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantidade:</span>
                  <p className="font-medium">{selectedSaleDetail.qty}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pagamento:</span>
                  <Badge className={getPaymentBadge(selectedSaleDetail.payment_method)}>
                    {selectedSaleDetail.payment_method}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxa:</span>
                  <p className="font-medium">{selectedSaleDetail.payment_fee_percentage || 0}%</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span>Total:</span>
                  <span className="font-bold text-green-600">
                    R$ {(Number(selectedSaleDetail.sale_price) * selectedSaleDetail.qty).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Lucro:</span>
                  <span className="text-primary">R$ {Number(selectedSaleDetail.total_profit).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaleDetailDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDVTab;
