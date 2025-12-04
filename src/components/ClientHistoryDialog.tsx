import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Scissors, Save, Sparkles, AlertCircle } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

interface ClientHistoryDialogProps {
  client: {
    id: number;
    name: string;
    telefone?: string | null;
    aniversario?: string | null;
    preferences?: string | null;
  } | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const fetchClientHistory = async (clientId: number) => {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*, products(name, price)')
    .eq('client_id', clientId)
    .order('appointment_date', { ascending: false });

  if (error) throw error;

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*, products(name)')
    .eq('client_id', clientId)
    .order('sale_date', { ascending: false });

  if (salesError) throw salesError;

  return { appointments: appointments || [], sales: sales || [] };
};

const ClientHistoryDialog: React.FC<ClientHistoryDialogProps> = ({ client, isOpen, onOpenChange }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState(client?.preferences || '');

  React.useEffect(() => {
    if (client) {
      setPreferences(client.preferences || '');
    }
  }, [client]);

  const { data: history, isLoading } = useQuery({
    queryKey: ['client-history', client?.id],
    queryFn: () => fetchClientHistory(client!.id),
    enabled: !!client?.id && isOpen,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ preferences: newPreferences })
        .eq('id', client!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: "Sucesso!", description: "Preferências salvas." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      agendado: { variant: "secondary", label: "Agendado" },
      confirmado: { variant: "default", label: "Confirmado" },
      concluido: { variant: "outline", label: "Concluído" },
      cancelado: { variant: "destructive", label: "Cancelado" }
    };
    const config = variants[status] || variants.agendado;
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  if (!client) return null;

  const totalSpent = history?.sales?.reduce((sum, s) => sum + Number(s.sale_price) * s.qty, 0) || 0;
  const totalAppointments = history?.appointments?.length || 0;
  const completedAppointments = history?.appointments?.filter(a => a.status === 'concluido').length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Histórico de {client.name}
          </DialogTitle>
          <DialogDescription>
            Visualize o histórico completo e gerencie as preferências do cliente
          </DialogDescription>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-primary">{totalAppointments}</div>
              <div className="text-xs text-muted-foreground">Atendimentos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-green-600">{completedAppointments}</div>
              <div className="text-xs text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-3 text-center">
              <div className="text-xl font-bold text-blue-600">R$ {totalSpent.toFixed(0)}</div>
              <div className="text-xs text-muted-foreground">Total Gasto</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="preferences">Preferências</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : history?.appointments?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
                  <p>Nenhum atendimento registrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.appointments?.map((apt: any) => (
                    <Card key={apt.id} className="transition-all hover:shadow-md">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Scissors className="w-4 h-4 text-primary" />
                              <span className="font-medium">{apt.products?.name || 'Serviço não especificado'}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(apt.appointment_date), "HH:mm")}
                              </span>
                            </div>
                            {apt.notes && (
                              <p className="text-xs text-muted-foreground italic">"{apt.notes}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(apt.status)}
                            {apt.products?.price && (
                              <span className="text-sm font-semibold text-green-600">
                                R$ {Number(apt.products.price).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="preferences" className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Notas e Preferências
                </Label>
                <Textarea
                  id="preferences"
                  placeholder="Ex: Prefere corte mais curto nas laterais, alergia a amônia, cor favorita: loiro mel..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Registre preferências, alergias, cores favoritas, tipo de corte preferido, etc.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button 
            onClick={() => updatePreferencesMutation.mutate(preferences)}
            disabled={updatePreferencesMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Preferências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientHistoryDialog;
