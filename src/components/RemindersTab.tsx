import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bell, Send, MessageSquare, Clock, AlertTriangle, 
  Users, Palmtree, Calendar, RefreshCw, Search, CheckSquare, Square, Mail
} from 'lucide-react';

interface ServiceReminder {
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  serviceName: string;
  lastServiceDate: string;
  warrantyMonths: number;
  monthsSince: number;
  daysOverdue: number;
  status: 'due' | 'overdue' | 'upcoming';
}

const fetchServiceReminders = async (): Promise<ServiceReminder[]> => {
  const { data: appointments, error: aptError } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      clients(id, name, telefone, email),
      products(id, name, warranty_months)
    `)
    .eq('status', 'concluido')
    .order('appointment_date', { ascending: false });

  if (aptError) throw aptError;

  const clientServiceMap: { [key: string]: any } = {};
  
  (appointments || []).forEach((apt: any) => {
    if (!apt.clients || !apt.products) return;
    const key = `${apt.clients.id}-${apt.products.id}`;
    if (!clientServiceMap[key] || new Date(apt.appointment_date) > new Date(clientServiceMap[key].appointment_date)) {
      clientServiceMap[key] = apt;
    }
  });

  const today = new Date();
  const reminders: ServiceReminder[] = [];

  Object.values(clientServiceMap).forEach((apt: any) => {
    const warrantyMonths = apt.products.warranty_months || 6;
    const lastDate = new Date(apt.appointment_date);
    const monthsSince = differenceInMonths(today, lastDate);
    const nextDueDate = addMonths(lastDate, warrantyMonths);
    const daysOverdue = differenceInDays(today, nextDueDate);

    let status: 'due' | 'overdue' | 'upcoming' = 'upcoming';
    if (daysOverdue > 0) {
      status = 'overdue';
    } else if (daysOverdue >= -30) {
      status = 'due';
    }

    if (monthsSince >= warrantyMonths - 2) {
      reminders.push({
        clientId: apt.clients.id,
        clientName: apt.clients.name,
        clientPhone: apt.clients.telefone,
        clientEmail: apt.clients.email,
        serviceName: apt.products.name,
        lastServiceDate: apt.appointment_date,
        warrantyMonths,
        monthsSince,
        daysOverdue,
        status
      });
    }
  });

  return reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);
};

const fetchAllClients = async () => {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, telefone, email')
    .order('name');
  if (error) throw error;
  return data || [];
};

const RemindersTab: React.FC = () => {
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkType, setBulkType] = useState<'vacation' | 'holiday' | 'custom'>('vacation');
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [sendMethod, setSendMethod] = useState<'whatsapp' | 'email'>('whatsapp');

  const { data: reminders, isLoading: loadingReminders } = useQuery({
    queryKey: ['service-reminders'],
    queryFn: fetchServiceReminders
  });

  const { data: allClients, isLoading: loadingClients } = useQuery({
    queryKey: ['all-clients-reminders'],
    queryFn: fetchAllClients
  });

  const clientsWithContact = useMemo(() => {
    if (sendMethod === 'whatsapp') {
      return allClients?.filter(c => c.telefone) || [];
    }
    return allClients?.filter(c => (c as any).email) || [];
  }, [allClients, sendMethod]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clientsWithContact;
    return clientsWithContact.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clientsWithContact, clientSearch]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'overdue':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Vencido</Badge>;
      case 'due':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Vence em breve</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Próximo</Badge>;
    }
  };

  const sendReminderWhatsApp = (reminder: ServiceReminder) => {
    if (!reminder.clientPhone) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }

    const phone = reminder.clientPhone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${reminder.clientName}!\n\n` +
      `🔧 Passaram-se ${reminder.monthsSince} meses desde sua última manutenção de ${reminder.serviceName}.\n\n` +
      `✅ Recomendamos agendar uma nova manutenção para manter seu equipamento funcionando perfeitamente!\n\n` +
      `📞 Entre em contato para agendar.`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
    toast.success(`Mensagem enviada para ${reminder.clientName}`);
  };

  const sendReminderEmail = (reminder: ServiceReminder) => {
    if (!reminder.clientEmail) {
      toast.error('Cliente não possui email cadastrado');
      return;
    }

    const subject = encodeURIComponent(`Lembrete de Manutenção - ${reminder.serviceName}`);
    const body = encodeURIComponent(
      `Olá ${reminder.clientName}!\n\n` +
      `Passaram-se ${reminder.monthsSince} meses desde sua última manutenção de ${reminder.serviceName}.\n\n` +
      `Recomendamos agendar uma nova manutenção para manter seu equipamento funcionando perfeitamente!\n\n` +
      `Entre em contato para agendar.\n\nAtenciosamente.`
    );
    window.open(`mailto:${reminder.clientEmail}?subject=${subject}&body=${body}`, '_blank');
    toast.success(`Email preparado para ${reminder.clientName}`);
  };

  const toggleClientSelection = (clientId: number) => {
    setSelectAll(false);
    setSelectedClientIds(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedClientIds([]);
    } else {
      setSelectAll(true);
      setSelectedClientIds([]);
    }
  };

  const getSelectedClients = () => {
    if (selectAll) {
      return clientsWithContact;
    }
    return clientsWithContact.filter(c => selectedClientIds.includes(c.id));
  };

  const sendBulkMessage = () => {
    const targetClients = getSelectedClients();
    
    if (targetClients.length === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    let message = bulkMessage;
    if (!message) {
      if (bulkType === 'vacation') {
        message = `Olá! 🏖️\n\nInformamos que estaremos em período de férias e retornaremos em breve.\n\nAgradecemos a compreensão!`;
      } else if (bulkType === 'holiday') {
        message = `Olá! 🎉\n\nInformamos que não haverá expediente hoje devido ao feriado.\n\nRetornaremos normalmente no próximo dia útil!\n\nBoas festas!`;
      }
    }

    if (sendMethod === 'whatsapp') {
      let successCount = 0;
      targetClients.forEach((client, index) => {
        setTimeout(() => {
          const phone = client.telefone!.replace(/\D/g, '');
          const personalizedMessage = encodeURIComponent(message.replace('{nome}', client.name));
          window.open(`https://wa.me/55${phone}?text=${personalizedMessage}`, '_blank');
          successCount++;
          if (successCount === targetClients.length) {
            toast.success(`${successCount} mensagens preparadas para envio!`);
          }
        }, index * 500);
      });
    } else {
      // Email
      const emails = targetClients.map(c => (c as any).email).join(',');
      const subject = encodeURIComponent(
        bulkType === 'vacation' ? 'Aviso de Férias' : 
        bulkType === 'holiday' ? 'Aviso de Feriado' : 'Comunicado'
      );
      const body = encodeURIComponent(message.replace('{nome}', 'Cliente'));
      window.open(`mailto:${emails}?subject=${subject}&body=${body}`, '_blank');
      toast.success(`Email preparado para ${targetClients.length} cliente(s)!`);
    }
  };

  const overdueCount = reminders?.filter(r => r.status === 'overdue').length || 0;
  const dueCount = reminders?.filter(r => r.status === 'due').length || 0;
  const selectedCount = selectAll ? clientsWithContact.length : selectedClientIds.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Manutenções Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{dueCount}</p>
                <p className="text-xs text-muted-foreground">Vencem em Breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{allClients?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reminders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Lembretes de Manutenção
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Mensagens em Massa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reminders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Clientes para Retorno de Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReminders ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : reminders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum lembrete de manutenção pendente</p>
                  <p className="text-sm mt-1">Configure warranty_months nos serviços</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Última</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reminders?.map((reminder, i) => (
                        <TableRow key={i} className={reminder.status === 'overdue' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                          <TableCell className="font-medium">{reminder.clientName}</TableCell>
                          <TableCell>{reminder.serviceName}</TableCell>
                          <TableCell>
                            {format(new Date(reminder.lastServiceDate), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>{reminder.warrantyMonths}m</TableCell>
                          <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => sendReminderWhatsApp(reminder)}
                                disabled={!reminder.clientPhone}
                                className="bg-green-600 hover:bg-green-700"
                                title="WhatsApp"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendReminderEmail(reminder)}
                                disabled={!reminder.clientEmail}
                                title="Email"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="mt-6 space-y-6">
          {/* Send Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Método de Envio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${sendMethod === 'whatsapp' ? 'ring-2 ring-green-500' : ''}`}
                  onClick={() => { setSendMethod('whatsapp'); setSelectAll(true); setSelectedClientIds([]); }}
                >
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-semibold">WhatsApp</h3>
                    <p className="text-xs text-muted-foreground">{allClients?.filter(c => c.telefone).length || 0} clientes</p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${sendMethod === 'email' ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => { setSendMethod('email'); setSelectAll(true); setSelectedClientIds([]); }}
                >
                  <CardContent className="p-4 text-center">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-xs text-muted-foreground">{allClients?.filter(c => (c as any).email).length || 0} clientes</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Message Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'vacation' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('vacation')}
                >
                  <CardContent className="p-4 text-center">
                    <Palmtree className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <h3 className="font-semibold">Férias</h3>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'holiday' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('holiday')}
                >
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-red-500" />
                    <h3 className="font-semibold">Feriado</h3>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'custom' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('custom')}
                >
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h3 className="font-semibold">Personalizada</h3>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Use {nome} para incluir o nome do cliente"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Selecionar Clientes
                </span>
                <Badge variant="outline">{selectedCount} selecionado(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={() => toggleSelectAll()}
                  />
                  <Label htmlFor="select-all" className="cursor-pointer">
                    Selecionar Todos
                  </Label>
                </div>
                <span className="text-sm text-muted-foreground">
                  {clientsWithContact.length} clientes com {sendMethod === 'whatsapp' ? 'telefone' : 'email'}
                </span>
              </div>

              {!selectAll && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <ScrollArea className="h-48 border rounded-lg p-2">
                    <div className="space-y-1">
                      {filteredClients.map(client => (
                        <div 
                          key={client.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedClientIds.includes(client.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleClientSelection(client.id)}
                        >
                          <Checkbox checked={selectedClientIds.includes(client.id)} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{client.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sendMethod === 'whatsapp' ? client.telefone : (client as any).email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedClientIds(clientsWithContact.map(c => c.id))}>
                      <CheckSquare className="w-4 h-4 mr-1" />
                      Marcar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedClientIds([])}>
                      <Square className="w-4 h-4 mr-1" />
                      Desmarcar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Button */}
          <Card className={`bg-gradient-to-r ${sendMethod === 'whatsapp' ? 'from-green-500/10 to-emerald-500/10 border-green-200 dark:border-green-800' : 'from-blue-500/10 to-indigo-500/10 border-blue-200 dark:border-blue-800'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Pronto para enviar?</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCount} cliente(s) via {sendMethod === 'whatsapp' ? 'WhatsApp' : 'Email'}
                  </p>
                </div>
                <Button 
                  onClick={sendBulkMessage}
                  size="lg"
                  className={sendMethod === 'whatsapp' 
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  }
                  disabled={loadingClients || selectedCount === 0}
                >
                  {sendMethod === 'whatsapp' ? <MessageSquare className="w-5 h-5 mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RemindersTab;