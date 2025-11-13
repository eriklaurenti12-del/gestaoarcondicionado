
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
      
      const saleData = {
        client_id: client.id,
        product_id: product.id,
        qty,
        sale_price: product.price,
        total_profit: (Number(product.price) - Number(product.cost_price)) * qty,
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
      return [c.name, `${c.sales.length}`, `R$ ${total.toFixed(2)}`];
    }) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'Compras', 'Total Gasto']],
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead><TableHead>Compras</TableHead><TableHead>Total Gasto</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingClients ? Array.from({length: 3}).map((_,i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
              : filteredClients.map((client) => {
                const total = client.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
                return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.sales.length}</TableCell>
                    <TableCell className="font-semibold text-green-600">R$ {total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="mr-2" onClick={() => setEditingClient(client)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => onDeleteClient(client.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Registrar Nova Venda</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="client-name">Cliente</Label>
              <Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome (novo ou existente)"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-select">Produto</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isLoadingProducts}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {products?.filter(p => p.qty > 0).map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>{product.name} ({product.qty} disp.)</SelectItem>
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
                <SelectTrigger className="bg-background"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-background border-border z-50">
                  {Constants.public.Enums.payment_method_enum.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-fee">Taxa da Máquina (%)</Label>
              <Input id="payment-fee" type="number" value={paymentFee} onChange={(e) => setPaymentFee(e.target.value)} min="0" disabled={!['Débito', 'Crédito'].includes(paymentMethod)}/>
            </div>
            <Button onClick={handleAddSale} disabled={addSaleMutation.isPending}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {addSaleMutation.isPending ? "Salvando..." : "Salvar Venda"}
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
