import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Search, Pencil, FileDown, MessageCircle, PlusCircle, History, MapPin, Phone, Wind, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import EditClientDialog from './EditClientDialog';
import AddClientDialog from './AddClientDialog';
import ClientHistoryDialog from './ClientHistoryDialog';
import ClientEquipmentDialog from './ClientEquipmentDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';

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
  const [equipmentClient, setEquipmentClient] = useState<ClientWithSales | null>(null);

  const { data: clients, isLoading: isLoadingClients } = useQuery({ queryKey: ['clients'], queryFn: fetchClients });

  const { data: allMaintenances } = useQuery({
    queryKey: ['all-maintenances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_maintenance')
        .select('*')
        .eq('is_completed', false)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const getClientMaintenanceStatus = (clientId: number) => {
    const clientMaintenances = allMaintenances?.filter(m => m.client_id === clientId) || [];
    if (clientMaintenances.length === 0) return null;
    
    const overdue = clientMaintenances.filter(m => differenceInDays(new Date(m.scheduled_date), new Date()) < 0);
    const upcoming = clientMaintenances.filter(m => {
      const days = differenceInDays(new Date(m.scheduled_date), new Date());
      return days >= 0 && days <= 7;
    });
    
    if (overdue.length > 0) {
      return { status: 'overdue', count: overdue.length, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
    }
    if (upcoming.length > 0) {
      return { status: 'upcoming', count: upcoming.length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' };
    }
    return { status: 'ok', count: clientMaintenances.length, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
  };
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
      c.address?.toLowerCase().includes(search.toLowerCase()) ||
      c.preferences?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    ).map(c => ({
      ...c,
      sales: c.sales || []
    }));
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
      const sales = c.sales || [];
      const total = sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
      return [c.name, c.telefone || '-', c.preferences || '-', `${sales.length}`, `R$ ${total.toFixed(2)}`];
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
                    <TableHead>Obs.</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingClients ? Array.from({length: 3}).map((_,i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                  : filteredClients.map((client) => {
                    const total = client.sales.reduce((sum, p) => sum + Number(p.sale_price) * p.qty, 0);
                    const maintenanceStatus = getClientMaintenanceStatus(client.id);
                    const MaintenanceIcon = maintenanceStatus?.icon || CheckCircle;
                    
                    return (
                      <TableRow key={client.id} className="transition-all duration-200 hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{client.name}</span>
                            {maintenanceStatus && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`p-1 rounded-full ${maintenanceStatus.bg}`}>
                                      <MaintenanceIcon className={`w-3 h-3 ${maintenanceStatus.color}`} />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {maintenanceStatus.status === 'overdue' && `${maintenanceStatus.count} manutenção(ões) atrasada(s)`}
                                    {maintenanceStatus.status === 'upcoming' && `${maintenanceStatus.count} manutenção(ões) próxima(s)`}
                                    {maintenanceStatus.status === 'ok' && `${maintenanceStatus.count} manutenção(ões) agendada(s)`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.telefone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {client.telefone}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {client.address ? (
                            <div className="flex items-center gap-1 max-w-[200px] truncate" title={client.address}>
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{client.address}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {client.preferences ? (
                            <div className="max-w-[160px] truncate text-xs text-muted-foreground" title={client.preferences}>
                              {client.preferences}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{client.sales.length}</TableCell>
                        <TableCell className="font-semibold text-green-600">R$ {total.toFixed(2)}</TableCell>
                        <TableCell>
                          <TooltipProvider delayDuration={150}>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-cyan-500 hover:text-cyan-600 transition-all duration-200 hover:scale-110" onClick={() => setEquipmentClient(client)}>
                                    <Wind className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Equipamentos e manutenções</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-primary hover:text-primary/80 transition-all duration-200 hover:scale-110" onClick={() => setHistoryClient(client)}>
                                    <History className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Histórico de serviços e vendas</TooltipContent>
                              </Tooltip>
                              {client.telefone && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-500 hover:text-green-600 transition-all duration-200 hover:scale-110" onClick={() => sendWhatsAppMessage(client)}>
                                      <MessageCircle className="w-3 h-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Enviar mensagem no WhatsApp</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110" onClick={() => setEditingClient(client)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Editar cadastro do cliente</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive transition-all duration-200 hover:scale-110" onClick={() => onDeleteClient(client.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir cliente</TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
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

      {equipmentClient && (
        <ClientEquipmentDialog
          open={!!equipmentClient}
          onOpenChange={(open) => !open && setEquipmentClient(null)}
          clientId={equipmentClient.id}
          clientName={equipmentClient.name}
        />
      )}
    </div>
  );
};

export default ClientsTab;
