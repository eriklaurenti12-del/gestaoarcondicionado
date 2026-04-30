import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MapPin, Car, Utensils, Send, CheckCircle2 } from 'lucide-react';
import { ServiceProvider } from './ServiceProvidersTab';

export default function RouteAllocationTab({ providers }: { providers: ServiceProvider[] }) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');
  const [filterDate, setFilterDate] = useState<string>(''); // empty means 'all'

  // Get all unassigned appointments
  const { data: unassignedAppointmentsRaw, isLoading } = useQuery({
    queryKey: ['unassigned-appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address), products(name)')
        .eq('status', 'agendado')
        .order('appointment_date', { ascending: true });
        
      if (error) throw error;
      
      // Filter out those that already have a provider
      return (data || []).filter(a => !a.notes?.includes('[PRESTADOR:'));
    }
  });

  const unassignedAppointments = unassignedAppointmentsRaw?.filter(apt => {
    if (!filterDate) return true;
    return apt.appointment_date.startsWith(filterDate);
  });

  const toggleAppointment = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const allocateRouteMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      
      const provider = providers.find(p => p.id === selectedProviderId);
      if (!provider) throw new Error('Prestador não encontrado');

      // 1. Update Appointments to assign provider
      const appointmentsToUpdate = unassignedAppointments?.filter(a => selectedAppointments.includes(a.id)) || [];
      
      for (const apt of appointmentsToUpdate) {
        const newNotes = apt.notes 
          ? `${apt.notes}\n[PRESTADOR:${provider.name}]` 
          : `[PRESTADOR:${provider.name}]`;
          
        const { error } = await supabase
          .from('appointments')
          .update({ notes: newNotes })
          .eq('id', apt.id);
          
        if (error) throw error;
      }

      // 2. Launch Expenses if provided
      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];

      if (combustivel && parseFloat(combustivel) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Combustível',
          amount: parseFloat(combustivel),
          expense_date: today,
          description: `Rota: ${appointmentsToUpdate.length} serviços - ${provider.name}`,
          helper_name: provider.name,
        });
      }

      if (alimentacao && parseFloat(alimentacao) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Alimentação',
          amount: parseFloat(alimentacao),
          expense_date: today,
          description: `Alimentação Rota - ${provider.name}`,
          helper_name: provider.name,
        });
      }

      if (expensesToInsert.length > 0) {
        const { error } = await supabase.from('fixed_expenses').insert(expensesToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Rota separada e gastos lançados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments-for-providers'] });
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      
      // Reset form
      setSelectedAppointments([]);
      setSelectedProviderId('');
      setCombustivel('');
      setAlimentacao('');
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`)
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Coluna 1: Lista de Serviços */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                Serviços Aguardando Rota
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione os serviços pendentes para separar a rota da equipe.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Filtrar Data:</Label>
              <Input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-auto h-9"
              />
              {filterDate && (
                <Button variant="ghost" size="sm" onClick={() => setFilterDate('')} className="h-9 px-2 text-muted-foreground hover:text-foreground">
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando serviços...</div>
          ) : unassignedAppointments?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20 text-green-500" />
              <p className="text-lg font-medium">Nenhum serviço pendente</p>
              <p className="text-sm">Todos os agendamentos já estão atribuídos a um prestador.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unassignedAppointments?.map(apt => (
                <label key={apt.id} className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${selectedAppointments.includes(apt.id) ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/30'}`}>
                  <Checkbox 
                    checked={selectedAppointments.includes(apt.id)}
                    onCheckedChange={() => toggleAppointment(apt.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between gap-1 sm:items-center mb-1">
                      <span className="font-semibold text-base">{apt.clients?.name || 'Cliente Sem Nome'}</span>
                      <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {format(new Date(apt.appointment_date), 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      <strong>Endereço:</strong> {apt.clients?.address || 'Sem endereço cadastrado'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      <strong>Serviço:</strong> {apt.products?.name || 'Não especificado'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coluna 2: Atribuição e Gastos */}
      <div className="space-y-6">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle>Configurar Rota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border text-center">
              <span className="text-2xl font-bold text-primary">{selectedAppointments.length}</span>
              <p className="text-sm text-muted-foreground font-medium">Serviços Selecionados</p>
            </div>

            <div className="space-y-2">
              <Label>Atribuir ao Prestador *</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione o prestador" />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-sm text-muted-foreground font-medium">Lançar Gastos da Rota (Opcional)</Label>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Car className="w-4 h-4 text-orange-500" /> Combustível (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={combustivel} 
                  onChange={e => setCombustivel(e.target.value)} 
                  className="h-12 text-lg"
                  min="0" step="0.01" 
                />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Utensils className="w-4 h-4 text-amber-500" /> Alimentação (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={alimentacao} 
                  onChange={e => setAlimentacao(e.target.value)} 
                  className="h-12 text-lg"
                  min="0" step="0.01" 
                />
              </div>
            </div>

            <Button 
              className="w-full h-12 text-base font-semibold mt-4" 
              onClick={() => allocateRouteMutation.mutate()}
              disabled={selectedAppointments.length === 0 || !selectedProviderId || allocateRouteMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {allocateRouteMutation.isPending ? 'Separando...' : 'Confirmar e Separar Rota'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
