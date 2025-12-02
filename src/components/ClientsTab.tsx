
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, PlusCircle, Pencil, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Constants, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import EditClientDialog from './EditClientDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
      // Idealmente, isso deveria ser uma transação (ex: com uma Edge Function)
      const { error: saleError } = await supabase.from('sales').insert(saleData);
      if (saleError) throw saleError;
      
      const { error: productError } = await supabase.from('products').update({ qty: productUpdateData.qty }).eq('id', productUpdateData.id);
      if (productError) {
        // Tenta reverter a venda se a atualização do produto falhar
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Clientes', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableData = clients?.map(c => {
      const total = c.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
      return [c.name, c.telefone || '-', c.aniversario || '-', `${c.sales.length}`, `R$ ${total.toFixed(2)}`];
    }) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'Telefone', 'Aniversário', 'Compras', 'Total Gasto']],
      body: tableData,
    });

    doc.save('clientes.pdf');
    toast({ title: "PDF exportado!", description: "Relatório de clientes salvo." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Gerenciar Clientes
            <Button onClick={exportToPDF} size="sm" variant="outline">
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10"/>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Cliente</TableHead>
                  <TableHead className="min-w-[100px]">Telefone</TableHead>
                  <TableHead className="min-w-[60px]">Compras</TableHead>
                  <TableHead className="min-w-[80px]">Total</TableHead>
                  <TableHead className="min-w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingClients ? Array.from({length: 3}).map((_,i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                : filteredClients.map((client) => {
                  const total = client.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">{client.name}</TableCell>
                      <TableCell className="text-xs sm:text-sm text-muted-foreground">{client.telefone || '-'}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{client.sales.length}</TableCell>
                      <TableCell className="font-semibold text-green-600 text-xs sm:text-sm">R$ {total.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditingClient(client)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onDeleteClient(client.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Registrar Novo Atendimento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="client-name">Cliente</Label>
              <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-select">Serviço/Produto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isLoadingProducts}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
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
            <div className="space-y-2">
              <Label htmlFor="payment-method">Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
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
            <Button onClick={handleAddSale} disabled={addSaleMutation.isPending}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {addSaleMutation.isPending ? "Salvando..." : "Registrar Atendimento"}
            </Button>
          </div>
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
