import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, PlusCircle, Pencil, FileDown, Gift, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Constants, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import EditClientDialog from './EditClientDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

type ClientWithSales = Tables<'clients'> & { sales: Pick<Tables<'sales'>, 'sale_price' | 'qty'>[] };

const fetchClients = async (): Promise<ClientWithSales[]> => {
  const { data, error } = await supabase.from('clients').select(`*, sales(sale_price, qty)`).order('name');
  if (error) throw new Error(error.message);
  return data as ClientWithSales[];
};

const fetchProducts = async () => {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
};

// Check if birthday is coming in X days
const getBirthdayStatus = (aniversario: string | null): { isBirthdaySoon: boolean; daysUntil: number; message: string } | null => {
  if (!aniversario) return null;
  
  try {
    const birthDate = parseISO(aniversario);
    if (!isValid(birthDate)) return null;
    
    const today = new Date();
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    // If birthday already passed this year, check next year
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    const daysUntil = differenceInDays(thisYearBirthday, today);
    
    if (daysUntil <= 7 && daysUntil >= 0) {
      let message = '';
      if (daysUntil === 0) {
        message = '🎂 Hoje é aniversário! Envie parabéns e ofereça um desconto especial!';
      } else if (daysUntil === 1) {
        message = '🎁 Aniversário amanhã! Aproveite para enviar uma mensagem especial.';
      } else {
        message = `🎁 Aniversário em ${daysUntil} dias! Envie uma mensagem com desconto.`;
      }
      return { isBirthdaySoon: true, daysUntil, message };
    }
  } catch (e) {
    return null;
  }
  
  return null;
};

const ClientsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<Tables<'sales'>['payment_method']>('Dinheiro');
  const [paymentFee, setPaymentFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [editingClient, setEditingClient] = useState<ClientWithSales | null>(null);
  const [userId, setUserId] = useState<string>("");

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

  const { data: clients, isLoading: isLoadingClients } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });
  const { data: products, isLoading: isLoadingProducts } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });

  const addSaleMutation = useMutation({
    mutationFn: async ({ saleData, productUpdateData }: { saleData: TablesInsert<'sales'>, productUpdateData: { id: number, qty: number } }) => {
      const { error: saleError } = await supabase.from('sales').insert(saleData);
      if (saleError) throw saleError;
      
      const { error: productError } = await supabase.from('products').update({ qty: productUpdateData.qty }).eq('id', productUpdateData.id);
      if (productError) {
        await supabase.from('sales').delete().match({ client_id: saleData.client_id, product_id: saleData.product_id });
        throw productError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: "Sucesso!", description: "Venda registrada." });
      setClientName("");
      setSelectedProductId("");
      setQty(1);
      setPaymentMethod('Dinheiro');
      setPaymentFee("0");
      setDiscount("0");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro ao registrar venda.", description: error.message });
    }
  });

  const updateClientMutation = useMutation({
    mutationFn: async (clientData: TablesUpdate<'clients'> & { id: number }) => {
        const { id, ...updateData } = clientData;
        const { error } = await supabase.from('clients').update(updateData).eq('id', id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        toast({ title: "Sucesso!", description: "Cliente atualizado." });
        setEditingClient(null);
    },
    onError: (error: any) => {
        toast({ variant: "destructive", title: "Erro ao atualizar cliente.", description: error.message });
    }
  });

  const handleAddSale = async () => {
    if (!clientName || !selectedProductId || qty <= 0) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Cliente, produto e quantidade são obrigatórios."});
      return;
    }

    const product = products?.find(p => p.id === Number(selectedProductId));
    if (!product) {
      toast({ variant: "destructive", title: "Produto não encontrado." });
      return;
    }

    if (product.qty < qty) {
      toast({ variant: "destructive", title: "Estoque insuficiente.", description: `Apenas ${product.qty} unidades disponíveis.` });
      return;
    }
    
    try {
      let { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientName.trim())
        .maybeSingle();
      
      if (clientError) {
        toast({ variant: "destructive", title: "Erro ao buscar cliente.", description: clientError.message });
        return;
      }

      if (!client) {
        const { data: newClient, error: newClientError } = await supabase
          .from('clients')
          .insert({ name: clientName.trim(), user_id: userId })
          .select('id')
          .single();
        
        if (newClientError) {
          toast({ variant: "destructive", title: "Erro ao criar cliente.", description: newClientError.message });
          return;
        }
        client = newClient;
      }
      
      const discountValue = parseFloat(discount) || 0;
      const finalPrice = Number(product.price) - discountValue;
      
      const saleData = {
        client_id: client.id,
        product_id: product.id,
        qty,
        sale_price: finalPrice,
        total_profit: (finalPrice - Number(product.cost_price)) * qty,
        payment_method: paymentMethod,
        payment_fee_percentage: ['Débito', 'Crédito'].includes(paymentMethod) ? parseFloat(paymentFee) : null,
        user_id: userId,
      } as TablesInsert<'sales'>;
      
      const productUpdateData = {
        id: product.id,
        qty: product.qty - qty
      };

      addSaleMutation.mutate({ saleData, productUpdateData });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao registrar venda.", description: error.message });
    }
  };
  
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [clients, search]);
  
  const onDeleteClient = async (clientId: number) => {
    if (!window.confirm("Tem certeza? Todas as vendas deste cliente também serão removidas.")) return;
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if(error) {
       toast({ variant: "destructive", title: "Erro ao remover cliente.", description: error.message });
    } else {
       toast({ title: "Sucesso!", description: "Cliente removido." });
       queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  }

  const sendBirthdayMessage = (client: ClientWithSales) => {
    const phone = client.telefone?.replace(/\D/g, '');
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado", description: "Cadastre o telefone do cliente para enviar mensagem." });
      return;
    }
    const message = `Olá ${client.name}! 🎂 Feliz aniversário! Como presente especial, preparamos um desconto exclusivo para você. Agende seu horário e aproveite! 💝`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Clientes', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableData = clients?.map(c => {
      const total = c.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
      return [c.name, c.telefone || '-', c.aniversario ? format(parseISO(c.aniversario), 'dd/MM') : '-', `${c.sales.length}`, `R$ ${total.toFixed(2)}`];
    }) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'WhatsApp', 'Aniversário', 'Compras', 'Total Gasto']],
      body: tableData,
    });

    doc.save('clientes.pdf');
    toast({ title: "PDF exportado!", description: "Relatório de clientes salvo." });
  };

  return (
    <div className="space-y-6 overflow-visible">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>Gerenciar Clientes</span>
            <Button onClick={exportToPDF} size="sm" variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10"/>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Aniversário</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingClients ? Array.from({length: 3}).map((_,i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                  : filteredClients.map((client) => {
                    const total = client.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
                    const birthdayStatus = getBirthdayStatus(client.aniversario);
                    
                    return (
                      <React.Fragment key={client.id}>
                        <TableRow className={birthdayStatus?.isBirthdaySoon ? 'bg-pink-50 dark:bg-pink-950/30' : ''}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell className="text-muted-foreground">{client.telefone || '-'}</TableCell>
                          <TableCell>
                            {client.aniversario ? (
                              <span className="flex items-center gap-1">
                                {birthdayStatus?.isBirthdaySoon && <Gift className="w-4 h-4 text-pink-500" />}
                                {format(parseISO(client.aniversario), 'dd/MM')}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{client.sales.length}</TableCell>
                          <TableCell className="font-semibold text-green-600">R$ {total.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {birthdayStatus?.isBirthdaySoon && client.telefone && (
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-pink-500 hover:text-pink-600" onClick={() => sendBirthdayMessage(client)} title="Enviar mensagem de aniversário">
                                  <MessageCircle className="w-3 h-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditingClient(client)}><Pencil className="w-3 h-3" /></Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onDeleteClient(client.id)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {birthdayStatus?.isBirthdaySoon && (
                          <TableRow className="bg-pink-50 dark:bg-pink-950/30 border-0">
                            <TableCell colSpan={6} className="py-2 text-sm text-pink-600 dark:text-pink-400">
                              {birthdayStatus.message}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader><CardTitle>Registrar Novo Atendimento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="client-name">Cliente</Label>
              <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente"/>
            </div>
            <div className="space-y-2 overflow-visible">
              <Label htmlFor="product-select">Serviço/Produto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isLoadingProducts}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-[9999]" position="popper" sideOffset={4}>
                  {products?.filter(p => p.qty > 0).map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>{product.name} - R$ {Number(product.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input id="quantity" type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} min="1"/>
            </div>
            <div className="space-y-2 overflow-visible">
              <Label htmlFor="payment-method">Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-popover border-border z-[9999]" position="popper" sideOffset={4}>
                  {Constants.public.Enums.payment_method_enum.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Desconto (R$)</Label>
              <Input id="discount" type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" placeholder="0.00"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-fee">Taxa da Máquina (%)</Label>
              <Input id="payment-fee" type="number" value={paymentFee} onChange={(e) => setPaymentFee(e.target.value)} min="0" disabled={!['Débito', 'Crédito'].includes(paymentMethod)}/>
            </div>
          </div>
          <Button onClick={handleAddSale} disabled={addSaleMutation.isPending} className="mt-4 w-full md:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            {addSaleMutation.isPending ? "Salvando..." : "Registrar Atendimento"}
          </Button>
        </CardContent>
      </Card>

      {editingClient && (
        <EditClientDialog
            client={editingClient}
            isOpen={!!editingClient}
            onOpenChange={(isOpen) => !isOpen && setEditingClient(null)}
            onSave={(data) => updateClientMutation.mutate({ id: editingClient.id, ...data })}
        />
      )}
    </div>
  );
};

export default ClientsTab;
