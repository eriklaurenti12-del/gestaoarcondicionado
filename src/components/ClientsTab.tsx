import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Search, Pencil, FileDown, MessageCircle, PlusCircle, History, MapPin, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import EditClientDialog from './EditClientDialog';
import AddClientDialog from './AddClientDialog';
import ClientHistoryDialog from './ClientHistoryDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isValid } from 'date-fns';

type ClientWithSales = Tables<'clients'> & { sales: Pick<Tables<'sales'>, 'sale_price' | 'qty'>[], preferences?: string | null };

const fetchClients = async (): Promise<ClientWithSales[]> => {
  const { data, error } = await supabase.from('clients').select(`*, sales(sale_price, qty)`).order('name');
  if (error) throw new Error(error.message);
  return data as ClientWithSales[];
};

const ClientsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingClient, setEditingClient] = useState<ClientWithSales | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [historyClient, setHistoryClient] = useState<ClientWithSales | null>(null);

  const { data: clients, isLoading: isLoadingClients } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });
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
  
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone?.includes(search) ||
      c.preferences?.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);
  
  const onDeleteClient = async (clientId: number) => {
    if (!window.confirm("Tem certeza? Todas as ordens de serviço deste cliente também serão removidas.")) return;
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if(error) {
       toast({ variant: "destructive", title: "Erro ao remover cliente.", description: error.message });
    } else {
       toast({ title: "Sucesso!", description: "Cliente removido." });
       queryClient.invalidateQueries({ queryKey: ['clients'] });
    }
  }

  const sendWhatsAppMessage = (client: ClientWithSales) => {
    const phone = client.telefone?.replace(/\D/g, '');
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado", description: "Cadastre o telefone do cliente para enviar mensagem." });
      return;
    }
    const message = `Olá ${client.name}! 🧊 Aqui é da AC Service Pro. Como posso ajudá-lo hoje com seu ar condicionado?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Clientes - AC Service Pro', 14, 22);
    doc.setFontSize(11);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    const tableData = clients?.map(c => {
      const total = c.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
      return [c.name, c.telefone || '-', c.preferences || '-', `${c.sales.length}`, `R$ ${total.toFixed(2)}`];
    }) || [];

    autoTable(doc, {
      startY: 35,
      head: [['Cliente', 'WhatsApp', 'Endereço', 'Serviços', 'Total']],
      body: tableData,
      headStyles: { fillColor: [0, 128, 192] },
    });

    doc.save('clientes-ac-service.pdf');
    toast({ title: "PDF exportado!", description: "Relatório de clientes salvo." });
  };

  return (
    <div className="space-y-6 overflow-visible animate-fade-in">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>Gerenciar Clientes</span>
            <div className="flex gap-2">
              <Button onClick={() => setShowAddClient(true)} size="sm" className="transition-all duration-200 hover:scale-[1.02] bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
                <PlusCircle className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
              <Button onClick={exportToPDF} size="sm" variant="outline" className="transition-all duration-200 hover:scale-[1.02]">
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente, telefone ou endereço..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 transition-all duration-200"/>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingClients ? Array.from({length: 3}).map((_,i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                  : filteredClients.map((client) => {
                    const total = client.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
                    
                    return (
                      <TableRow key={client.id} className="transition-all duration-200 hover:bg-muted/50">
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          {client.telefone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {client.telefone}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {client.preferences ? (
                            <div className="flex items-center gap-1 max-w-[200px] truncate" title={client.preferences}>
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{client.preferences}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{client.sales.length}</TableCell>
                        <TableCell className="font-semibold text-green-600">R$ {total.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-primary hover:text-primary/80 transition-all duration-200 hover:scale-110" onClick={() => setHistoryClient(client)} title="Ver histórico">
                              <History className="w-3 h-3" />
                            </Button>
                            {client.telefone && (
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-500 hover:text-green-600 transition-all duration-200 hover:scale-110" onClick={() => sendWhatsAppMessage(client)} title="Enviar WhatsApp">
                                <MessageCircle className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110" onClick={() => setEditingClient(client)}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110" onClick={() => onDeleteClient(client.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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

      <AddClientDialog
        isOpen={showAddClient}
        onOpenChange={setShowAddClient}
      />

      <ClientHistoryDialog
        client={historyClient}
        isOpen={!!historyClient}
        onOpenChange={(open) => !open && setHistoryClient(null)}
      />
    </div>
  );
};

export default ClientsTab;
