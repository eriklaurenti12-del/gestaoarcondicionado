import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Car, Utensils, CheckCircle, Clock } from 'lucide-react';
import { ServiceProvider } from './ServiceProvidersTab';

interface ProviderDailyRouteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ServiceProvider | null;
  allAppointments: any[];
}

export default function ProviderDailyRouteDialog({ isOpen, onOpenChange, provider, allAppointments }: ProviderDailyRouteDialogProps) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');

  // Get today's appointments for this provider
  const todaysAppointments = (allAppointments || []).filter(a => {
    if (!provider) return false;
    const isProv = a.notes?.includes(`[PRESTADOR:${provider.name}]`);
    const date = a.appointment_date ? new Date(a.appointment_date) : null;
    return isProv && date && isToday(date);
  });

  // Pre-fill default allowances when dialog opens
  useEffect(() => {
    if (isOpen && provider) {
      setCombustivel(provider.fuel_allowance ? String(provider.fuel_allowance) : '');
      setAlimentacao(provider.food_allowance ? String(provider.food_allowance) : '');
      // Automatically select all pending/agendado appointments by default
      const defaultSelected = todaysAppointments
        .filter(a => a.status !== 'cancelado')
        .map(a => a.id);
      setSelectedAppointments(defaultSelected);
    }
  }, [isOpen, provider]);

  const toggleAppointment = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const registerDailyExpensesMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      if (!provider) throw new Error('Prestador não encontrado');

      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];
      const servicesInfo = selectedAppointments.length > 0 
        ? ` (${selectedAppointments.length} serviço(s) no dia)`
        : '';

      if (combustivel && parseFloat(combustivel) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Combustível',
          amount: parseFloat(combustivel),
          expense_date: today,
          description: `Rota Diária - ${provider.name}${servicesInfo}`,
          helper_name: provider.name,
        });
      }

      if (alimentacao && parseFloat(alimentacao) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Alimentação',
          amount: parseFloat(alimentacao),
          expense_date: today,
          description: `Alimentação Diária - ${provider.name}${servicesInfo}`,
          helper_name: provider.name,
        });
      }

      if (expensesToInsert.length === 0) return;

      const { error } = await supabase.from('fixed_expenses').insert(expensesToInsert);
      if (error) throw error;

      // Optional: Update status of selected appointments to 'concluido'
      if (selectedAppointments.length > 0) {
        const { error: aptError } = await supabase
          .from('appointments')
          .update({ status: 'concluido' })
          .in('id', selectedAppointments)
          .eq('status', 'agendado'); // only update if still 'agendado' or 'confirmado'
        
        if (aptError) console.error("Erro ao concluir agendamentos", aptError);
      }
    },
    onSuccess: () => {
      toast.success('Gastos da rota diária registrados!');
      if (selectedAppointments.length > 0) {
        toast.success(`${selectedAppointments.length} serviço(s) marcados como concluídos.`);
      }
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-for-providers'] });
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`)
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            Serviços do Dia & Gastos
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {provider?.name} — {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          {/* Serviços do Dia */}
          <div className="space-y-3">
            <Label className="text-base">Serviços da Rota ({todaysAppointments.length})</Label>
            {todaysAppointments.length === 0 ? (
              <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/20">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Nenhum serviço agendado para hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysAppointments.map(apt => (
                  <label key={apt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAppointments.includes(apt.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                    <Checkbox 
                      checked={selectedAppointments.includes(apt.id)}
                      onCheckedChange={() => toggleAppointment(apt.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{apt.clients?.name || 'Cliente'}</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {format(new Date(apt.appointment_date), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {apt.clients?.address || 'Sem endereço'}
                      </p>
                      <Badge variant="outline" className={`mt-2 text-[10px] ${apt.status === 'concluido' ? 'border-green-500 text-green-600' : 'border-amber-500 text-amber-600'}`}>
                        {apt.status.toUpperCase()}
                      </Badge>
                    </div>
                  </label>
                ))}
                <p className="text-[11px] text-muted-foreground mt-2">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Serviços selecionados serão marcados como <strong>Concluídos</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Gastos */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base">Lançar Gastos do Dia</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Car className="w-3 h-3" /> Combustível (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={combustivel} 
                  onChange={e => setCombustivel(e.target.value)} 
                  min="0" step="0.01" 
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Utensils className="w-3 h-3" /> Alimentação (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={alimentacao} 
                  onChange={e => setAlimentacao(e.target.value)} 
                  min="0" step="0.01" 
                />
              </div>
            </div>
            {(provider?.fuel_allowance || provider?.food_allowance) && (
              <p className="text-[11px] text-muted-foreground">
                * Os valores foram preenchidos com os valores fixos do prestador.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button variant="outline" onClick={generateRoutePDF} disabled={selectedAppointments.length === 0} className="w-full sm:w-auto text-blue-600 border-blue-200 hover:bg-blue-50">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={sendWhatsAppRoute} disabled={selectedAppointments.length === 0} className="w-full sm:w-auto text-green-600 border-green-200 hover:bg-green-50">
              <Send className="w-4 h-4 mr-2" /> WhatsApp
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => registerDailyExpensesMutation.mutate()}
              disabled={registerDailyExpensesMutation.isPending || (!combustivel && !alimentacao && selectedAppointments.length === 0)}
              className="bg-primary text-primary-foreground"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {registerDailyExpensesMutation.isPending ? 'Salvando...' : 'Confirmar Rota & Gastos'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
