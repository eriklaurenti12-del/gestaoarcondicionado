import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bell, Send, MessageSquare, Clock, AlertTriangle, Check, 
  Users, Palmtree, Calendar, RefreshCw
} from 'lucide-react';

interface ServiceReminder {
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  lastServiceDate: string;
  warrantyMonths: number;
  monthsSince: number;
  daysOverdue: number;
  status: 'due' | 'overdue' | 'upcoming';
}

const fetchServiceReminders = async (): Promise<ServiceReminder[]> => {
  // Get completed appointments with service info
  const { data: appointments, error: aptError } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      clients(id, name, telefone),
      products(id, name, warranty_months)
    `)
    .eq('status', 'concluido')
    .order('appointment_date', { ascending: false });

  if (aptError) throw aptError;

  // Group by client and service, get latest
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

    // Only include if due or overdue or upcoming within 2 months
    if (monthsSince >= warrantyMonths - 2) {
      reminders.push({
        clientId: apt.clients.id,
        clientName: apt.clients.name,
        clientPhone: apt.clients.telefone,
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
    .select('id, name, telefone')
    .order('name');
  if (error) throw error;
  return data || [];
};

const RemindersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkType, setBulkType] = useState<'vacation' | 'holiday' | 'custom'>('vacation');

  const { data: reminders, isLoading: loadingReminders } = useQuery({
    queryKey: ['service-reminders'],
    queryFn: fetchServiceReminders
  });

  const { data: allClients, isLoading: loadingClients } = useQuery({
    queryKey: ['all-clients-reminders'],
    queryFn: fetchAllClients
  });

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

  const sendBulkMessage = () => {
    if (!allClients || allClients.length === 0) {
      toast.error('Nenhum cliente cadastrado');
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

    const clientsWithPhone = allClients.filter(c => c.telefone);
    
    if (clientsWithPhone.length === 0) {
      toast.error('Nenhum cliente com telefone cadastrado');
      return;
    }

    // Open WhatsApp for each client (will open multiple tabs)
    // Note: For production, consider using WhatsApp Business API
    let successCount = 0;
    clientsWithPhone.forEach((client, index) => {
      setTimeout(() => {
        const phone = client.telefone!.replace(/\D/g, '');
        const personalizedMessage = encodeURIComponent(message.replace('{nome}', client.name));
        window.open(`https://wa.me/55${phone}?text=${personalizedMessage}`, '_blank');
        successCount++;
        if (successCount === clientsWithPhone.length) {
          toast.success(`${successCount} mensagens preparadas para envio!`);
        }
      }, index * 500); // Delay to prevent browser blocking
    });

    setShowBulkDialog(false);
  };

  const overdueCount = reminders?.filter(r => r.status === 'overdue').length || 0;
  const dueCount = reminders?.filter(r => r.status === 'due').length || 0;

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
                  <p className="text-sm mt-1">Os lembretes aparecerão quando serviços atingirem o prazo de garantia</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Última Manutenção</TableHead>
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
                            {format(new Date(reminder.lastServiceDate), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {reminder.warrantyMonths} meses
                          </TableCell>
                          <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => sendReminderWhatsApp(reminder)}
                              disabled={!reminder.clientPhone}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              WhatsApp
                            </Button>
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

        <TabsContent value="bulk" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Enviar Mensagem para Todos os Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'vacation' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('vacation')}
                >
                  <CardContent className="p-4 text-center">
                    <Palmtree className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <h3 className="font-semibold">Aviso de Férias</h3>
                    <p className="text-xs text-muted-foreground">Informar período de férias</p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'holiday' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('holiday')}
                >
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-red-500" />
                    <h3 className="font-semibold">Aviso de Feriado</h3>
                    <p className="text-xs text-muted-foreground">Informar feriado/folga</p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:scale-105 ${bulkType === 'custom' ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setBulkType('custom')}
                >
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <h3 className="font-semibold">Mensagem Personalizada</h3>
                    <p className="text-xs text-muted-foreground">Escrever própria mensagem</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <Label>Mensagem {bulkType !== 'custom' && '(opcional - usar padrão se vazio)'}</Label>
                <Textarea
                  placeholder={
                    bulkType === 'vacation' 
                      ? "Ex: Estaremos em férias de 20/12 a 05/01. Retornaremos normalmente após este período!" 
                      : bulkType === 'holiday'
                      ? "Ex: Não haverá expediente amanhã devido ao feriado. Retornamos na segunda-feira!"
                      : "Digite sua mensagem personalizada aqui... Use {nome} para incluir o nome do cliente."
                  }
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para incluir o nome do cliente na mensagem
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="font-medium">
                    {allClients?.filter(c => c.telefone).length || 0} clientes receberão a mensagem
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ({allClients?.filter(c => !c.telefone).length || 0} clientes sem telefone cadastrado)
                  </p>
                </div>
                <Button 
                  onClick={sendBulkMessage}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={loadingClients || (allClients?.filter(c => c.telefone).length || 0) === 0}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar para Todos
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                <strong>⚠️ Importante:</strong> O envio será feito abrindo o WhatsApp para cada cliente. 
                Certifique-se de permitir pop-ups no seu navegador.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RemindersTab;
