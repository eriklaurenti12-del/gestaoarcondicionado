import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Plus, Check, Calendar, MessageCircle, RefreshCw, Search, Filter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduledMaintenance {
  id: string;
  client_id: number;
  equipment_id?: string;
  user_id: string;
  maintenance_type: string;
  scheduled_date: string;
  interval_months: number;
  is_completed: boolean;
  completed_date?: string;
  notes?: string;
  clients?: { name: string; telefone?: string };
  client_equipment?: { brand: string; model?: string; btus?: number };
}

const MaintenanceTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    equipment_id: '',
    maintenance_type: 'preventiva',
    scheduled_date: '',
    interval_months: '6',
    notes: ''
  });

  const { data: maintenances, isLoading } = useQuery({
    queryKey: ['scheduled-maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_maintenance')
        .select(`
          *,
          clients(name, telefone),
          client_equipment(brand, model, btus)
        `)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as ScheduledMaintenance[];
    }
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-for-maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: equipment } = useQuery({
    queryKey: ['equipment-for-maintenance', formData.client_id],
    queryFn: async () => {
      if (!formData.client_id) return [];
      const { data, error } = await supabase
        .from('client_equipment')
        .select('id, brand, model, btus')
        .eq('client_id', parseInt(formData.client_id));
      if (error) throw error;
      return data;
    },
    enabled: !!formData.client_id
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('scheduled_maintenance').insert({
        ...data,
        user_id: user.id,
        client_id: parseInt(data.client_id),
        equipment_id: data.equipment_id || null,
        interval_months: parseInt(data.interval_months)
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-maintenance'] });
      toast({ title: "Manutenção agendada!" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const maintenance = maintenances?.find(m => m.id === id);
      if (!maintenance) throw new Error('Manutenção não encontrada');

      // Mark as completed
      const { error: updateError } = await supabase
        .from('scheduled_maintenance')
        .update({ 
          is_completed: true, 
          completed_date: new Date().toISOString().split('T')[0] 
        })
        .eq('id', id);
      if (updateError) throw updateError;

      // Create next maintenance
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const nextDate = addMonths(new Date(), maintenance.interval_months);
      const { error: insertError } = await supabase.from('scheduled_maintenance').insert({
        client_id: maintenance.client_id,
        equipment_id: maintenance.equipment_id,
        user_id: user.id,
        maintenance_type: maintenance.maintenance_type,
        scheduled_date: nextDate.toISOString().split('T')[0],
        interval_months: maintenance.interval_months,
        notes: maintenance.notes
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-maintenance'] });
      toast({ title: "Manutenção concluída!", description: "Próxima manutenção agendada automaticamente." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      equipment_id: '',
      maintenance_type: 'preventiva',
      scheduled_date: '',
      interval_months: '6',
      notes: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  const sendReminder = (maintenance: ScheduledMaintenance) => {
    const phone = maintenance.clients?.telefone?.replace(/\D/g, '');
    if (!phone) {
      toast({ variant: "destructive", title: "Telefone não cadastrado" });
      return;
    }

    const equipInfo = maintenance.client_equipment 
      ? `${maintenance.client_equipment.brand} ${maintenance.client_equipment.model || ''} ${maintenance.client_equipment.btus ? maintenance.client_equipment.btus + ' BTUs' : ''}`.trim()
      : 'seu ar condicionado';

    const message = `Olá ${maintenance.clients?.name}! 🧊 Passando para lembrar da manutenção preventiva de ${equipInfo} agendada para ${format(new Date(maintenance.scheduled_date), "dd/MM/yyyy")}. Podemos confirmar o horário?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getStatusBadge = (maintenance: ScheduledMaintenance) => {
    if (maintenance.is_completed) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Concluída</Badge>;
    }
    const days = differenceInDays(new Date(maintenance.scheduled_date), new Date());
    if (days < 0) {
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Atrasada {Math.abs(days)}d</Badge>;
    }
    if (days === 0) {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Hoje</Badge>;
    }
    if (days <= 7) {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">{days} dias</Badge>;
    }
    return <Badge variant="secondary">{days} dias</Badge>;
  };

  const filteredMaintenances = maintenances?.filter(m => {
    const matchesSearch = m.clients?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'pending' && !m.is_completed) || 
      (filterStatus === 'completed' && m.is_completed);
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              Manutenções Preventivas
            </CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Agendar Manutenção
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Manutenção Preventiva</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => setFormData({ ...formData, client_id: value, equipment_id: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.client_id && equipment && equipment.length > 0 && (
                    <div>
                      <Label>Equipamento</Label>
                      <Select
                        value={formData.equipment_id}
                        onValueChange={(value) => setFormData({ ...formData, equipment_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o equipamento (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipment.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.brand} {eq.model} {eq.btus ? `- ${eq.btus} BTUs` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data Agendada *</Label>
                      <Input
                        type="date"
                        value={formData.scheduled_date}
                        onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Intervalo (meses)</Label>
                      <Select
                        value={formData.interval_months}
                        onValueChange={(value) => setFormData({ ...formData, interval_months: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 meses</SelectItem>
                          <SelectItem value="6">6 meses</SelectItem>
                          <SelectItem value="12">12 meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Tipo</Label>
                    <Select
                      value={formData.maintenance_type}
                      onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="limpeza">Limpeza</SelectItem>
                        <SelectItem value="revisao">Revisão Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Observações adicionais..."
                      rows={2}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                    Agendar Manutenção
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filteredMaintenances.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nenhuma manutenção encontrada.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaintenances.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.clients?.name}</TableCell>
                      <TableCell>
                        {m.client_equipment ? (
                          <span className="text-sm">
                            {m.client_equipment.brand} {m.client_equipment.model}
                            {m.client_equipment.btus && ` ${m.client_equipment.btus} BTUs`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{m.maintenance_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(m.scheduled_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{getStatusBadge(m)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {!m.is_completed && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => sendReminder(m)}
                                title="Enviar lembrete WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => completeMutation.mutate(m.id)}
                                title="Marcar como concluída"
                              >
                                <Check className="w-4 h-4 text-primary" />
                              </Button>
                            </>
                          )}
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
    </div>
  );
};

export default MaintenanceTab;
