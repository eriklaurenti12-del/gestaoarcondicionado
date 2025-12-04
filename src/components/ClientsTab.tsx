import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Search, Pencil, FileDown, Gift, MessageCircle, PlusCircle, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import { Tables, TablesUpdate } from '@/integrations/supabase/types';
import EditClientDialog from './EditClientDialog';
import AddClientDialog from './AddClientDialog';
import ClientHistoryDialog from './ClientHistoryDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';

type ClientWithSales = Tables<'clients'> & { sales: Pick<Tables<'sales'>, 'sale_price' | 'qty'>[], preferences?: string | null };

const fetchClients = async (): Promise<ClientWithSales[]> => {
  const { data, error } = await supabase.from('clients').select(`*, sales(sale_price, qty)`).order('name');
  if (error) throw new Error(error.message);
  return data as ClientWithSales[];
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
    <div className="space-y-6 overflow-visible animate-fade-in">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>Gerenciar Clientes</span>
            <div className="flex gap-2">
              <Button onClick={() => setShowAddClient(true)} size="sm" className="transition-all duration-200 hover:scale-[1.02]">
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
            <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 transition-all duration-200"/>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Aniversário</TableHead>
                    <TableHead>Atendimentos</TableHead>
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
                        <TableRow className={`transition-all duration-200 hover:bg-muted/50 ${birthdayStatus?.isBirthdaySoon ? 'bg-pink-50 dark:bg-pink-950/30' : ''}`}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell className="text-muted-foreground">{client.telefone || '-'}</TableCell>
                          <TableCell>
                            {client.aniversario ? (
                              <span className="flex items-center gap-1">
                                {birthdayStatus?.isBirthdaySoon && <Gift className="w-4 h-4 text-pink-500 animate-pulse" />}
                                {format(parseISO(client.aniversario), 'dd/MM')}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{client.sales.length}</TableCell>
                          <TableCell className="font-semibold text-green-600">R$ {total.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-primary hover:text-primary/80 transition-all duration-200 hover:scale-110" onClick={() => setHistoryClient(client)} title="Ver histórico">
                                <History className="w-3 h-3" />
                              </Button>
                              {birthdayStatus?.isBirthdaySoon && client.telefone && (
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-pink-500 hover:text-pink-600 transition-all duration-200 hover:scale-110" onClick={() => sendBirthdayMessage(client)} title="Enviar mensagem de aniversário">
                                  <MessageCircle className="w-3 h-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110" onClick={() => setEditingClient(client)}><Pencil className="w-3 h-3" /></Button>
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0 transition-all duration-200 hover:scale-110" onClick={() => onDeleteClient(client.id)}><Trash2 className="w-3 h-3" /></Button>
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
