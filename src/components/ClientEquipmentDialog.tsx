import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Wind, Calendar, Shield, MapPin, Edit2, Save, X, Wrench, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Equipment {
  id: string;
  client_id: number;
  user_id: string;
  brand: string;
  model?: string;
  btus?: number;
  serial_number?: string;
  installation_date?: string;
  warranty_end_date?: string;
  location?: string;
  notes?: string;
  created_at: string;
}

interface ScheduledMaintenance {
  id: string;
  equipment_id: string | null;
  scheduled_date: string;
  interval_months: number;
  is_completed: boolean;
  completed_date: string | null;
  maintenance_type: string;
  notes?: string;
}

interface ClientEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
}

const ClientEquipmentDialog: React.FC<ClientEquipmentDialogProps> = ({
  open,
  onOpenChange,
  clientId,
  clientName
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    btus: '',
    serial_number: '',
    installation_date: '',
    warranty_end_date: '',
    location: '',
    notes: ''
  });

  const [schedulingEquipmentId, setSchedulingEquipmentId] = useState<string | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    scheduled_date: '',
    interval_months: '6',
    maintenance_type: 'limpeza',
    notes: ''
  });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ['client-equipment', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_equipment')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Equipment[];
    },
    enabled: open && !!clientId
  });

  const { data: maintenances } = useQuery({
    queryKey: ['equipment-maintenances', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_maintenance')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as ScheduledMaintenance[];
    },
    enabled: open && !!clientId
  });

  const addMutation = useMutation({
    mutationFn: async (data: Omit<Equipment, 'id' | 'created_at' | 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('client_equipment').insert({
        ...data,
        user_id: user.id,
        btus: data.btus || null,
        installation_date: data.installation_date || null,
        warranty_end_date: data.warranty_end_date || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-equipment', clientId] });
      toast({ title: "Equipamento cadastrado!" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Equipment> & { id: string }) => {
      const { error } = await supabase
        .from('client_equipment')
        .update({
          ...data,
          btus: data.btus || null,
          installation_date: data.installation_date || null,
          warranty_end_date: data.warranty_end_date || null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-equipment', clientId] });
      toast({ title: "Equipamento atualizado!" });
      setEditingId(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_equipment').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-equipment', clientId] });
      toast({ title: "Equipamento removido!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: { equipment_id: string; scheduled_date: string; interval_months: number; maintenance_type: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('scheduled_maintenance').insert({
        client_id: clientId,
        equipment_id: data.equipment_id,
        user_id: user.id,
        scheduled_date: data.scheduled_date,
        interval_months: data.interval_months,
        maintenance_type: data.maintenance_type,
        notes: data.notes || null,
        is_completed: false
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenances', clientId] });
      toast({ title: "Manutenção agendada!" });
      setSchedulingEquipmentId(null);
      setMaintenanceForm({ scheduled_date: '', interval_months: '6', maintenance_type: 'limpeza', notes: '' });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    }
  });

  const completeMaintenanceMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const { error } = await supabase
        .from('scheduled_maintenance')
        .update({ is_completed: true, completed_date: new Date().toISOString().split('T')[0] })
        .eq('id', maintenanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-maintenances', clientId] });
      toast({ title: "Manutenção concluída!" });
    }
  });

  const resetForm = () => {
    setFormData({
      brand: '',
      model: '',
      btus: '',
      serial_number: '',
      installation_date: '',
      warranty_end_date: '',
      location: '',
      notes: ''
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (eq: Equipment) => {
    setEditingId(eq.id);
    setFormData({
      brand: eq.brand,
      model: eq.model || '',
      btus: eq.btus?.toString() || '',
      serial_number: eq.serial_number || '',
      installation_date: eq.installation_date || '',
      warranty_end_date: eq.warranty_end_date || '',
      location: eq.location || '',
      notes: eq.notes || ''
    });
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      client_id: clientId,
      brand: formData.brand,
      model: formData.model || undefined,
      btus: formData.btus ? parseInt(formData.btus) : undefined,
      serial_number: formData.serial_number || undefined,
      installation_date: formData.installation_date || undefined,
      warranty_end_date: formData.warranty_end_date || undefined,
      location: formData.location || undefined,
      notes: formData.notes || undefined
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      addMutation.mutate(data as any);
    }
  };

  const getWarrantyStatus = (endDate?: string) => {
    if (!endDate) return null;
    const days = differenceInDays(new Date(endDate), new Date());
    if (days < 0) return { label: 'Vencida', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
    if (days <= 30) return { label: `${days}d restantes`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' };
    if (days <= 90) return { label: `${Math.floor(days / 30)}m restantes`, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' };
    return { label: 'Ativa', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
  };

  const getMaintenanceStatus = (equipmentId: string) => {
    const equipmentMaintenances = maintenances?.filter(m => m.equipment_id === equipmentId && !m.is_completed) || [];
    if (equipmentMaintenances.length === 0) return null;
    
    const nextMaintenance = equipmentMaintenances.sort((a, b) => 
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    )[0];
    
    const days = differenceInDays(new Date(nextMaintenance.scheduled_date), new Date());
    
    if (days < 0) {
      return { 
        label: `${Math.abs(days)}d atrasada`, 
        color: 'bg-red-500 text-white',
        borderColor: 'border-l-red-500',
        icon: AlertTriangle,
        maintenance: nextMaintenance
      };
    }
    if (days <= 7) {
      return { 
        label: `${days}d restantes`, 
        color: 'bg-amber-500 text-white',
        borderColor: 'border-l-amber-500',
        icon: Clock,
        maintenance: nextMaintenance
      };
    }
    if (days <= 30) {
      return { 
        label: `${days}d restantes`, 
        color: 'bg-yellow-500 text-black',
        borderColor: 'border-l-yellow-500',
        icon: Clock,
        maintenance: nextMaintenance
      };
    }
    return { 
      label: format(new Date(nextMaintenance.scheduled_date), 'dd/MM/yyyy'), 
      color: 'bg-green-500 text-white',
      borderColor: 'border-l-green-500',
      icon: CheckCircle,
      maintenance: nextMaintenance
    };
  };

  const handleScheduleMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingEquipmentId || !maintenanceForm.scheduled_date) return;
    
    scheduleMutation.mutate({
      equipment_id: schedulingEquipmentId,
      scheduled_date: maintenanceForm.scheduled_date,
      interval_months: parseInt(maintenanceForm.interval_months),
      maintenance_type: maintenanceForm.maintenance_type,
      notes: maintenanceForm.notes
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-cyan-500" />
            Equipamentos de {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Novo Equipamento
            </Button>
          )}

          {showAddForm && (
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Marca *</Label>
                      <Input
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="Ex: LG, Samsung, Carrier..."
                        required
                      />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Input
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="Ex: Dual Inverter"
                      />
                    </div>
                    <div>
                      <Label>BTUs</Label>
                      <Input
                        type="number"
                        value={formData.btus}
                        onChange={(e) => setFormData({ ...formData, btus: e.target.value })}
                        placeholder="Ex: 12000, 18000..."
                      />
                    </div>
                    <div>
                      <Label>Número de Série</Label>
                      <Input
                        value={formData.serial_number}
                        onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                        placeholder="S/N do equipamento"
                      />
                    </div>
                    <div>
                      <Label>Data de Instalação</Label>
                      <Input
                        type="date"
                        value={formData.installation_date}
                        onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Garantia até</Label>
                      <Input
                        type="date"
                        value={formData.warranty_end_date}
                        onChange={(e) => setFormData({ ...formData, warranty_end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Localização</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Ex: Sala, Quarto, Escritório..."
                    />
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Observações sobre o equipamento..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                      <Save className="w-4 h-4 mr-2" />
                      {editingId ? 'Atualizar' : 'Salvar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : equipment?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum equipamento cadastrado para este cliente.
                </p>
              ) : (
                equipment?.map((eq) => {
                  const warranty = getWarrantyStatus(eq.warranty_end_date);
                  const maintenanceStatus = getMaintenanceStatus(eq.id);
                  const StatusIcon = maintenanceStatus?.icon || Wrench;
                  
                  return (
                    <Card key={eq.id} className={`border-l-4 ${maintenanceStatus?.borderColor || 'border-l-cyan-500'}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Wind className="w-4 h-4 text-cyan-500" />
                              <span className="font-semibold">{eq.brand}</span>
                              {eq.model && <span className="text-muted-foreground">- {eq.model}</span>}
                              {eq.btus && <Badge variant="secondary">{eq.btus} BTUs</Badge>}
                            </div>
                            {eq.location && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {eq.location}
                              </div>
                            )}
                            {eq.serial_number && (
                              <p className="text-xs text-muted-foreground">S/N: {eq.serial_number}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs flex-wrap">
                              {eq.installation_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Instalado: {format(new Date(eq.installation_date), 'dd/MM/yyyy')}
                                </span>
                              )}
                              {warranty && (
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  <Badge className={`text-[10px] ${warranty.color}`}>
                                    Garantia: {warranty.label}
                                  </Badge>
                                </span>
                              )}
                            </div>
                            
                            {/* Próxima Manutenção */}
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Wrench className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Próxima Manutenção:</span>
                                </div>
                                {maintenanceStatus ? (
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${maintenanceStatus.color} flex items-center gap-1`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {maintenanceStatus.label}
                                    </Badge>
                                    {maintenanceStatus.maintenance && !maintenanceStatus.maintenance.is_completed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-xs"
                                        onClick={() => completeMaintenanceMutation.mutate(maintenanceStatus.maintenance!.id)}
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Concluir
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Não agendada</span>
                                )}
                              </div>
                              
                              {maintenanceStatus?.maintenance && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <span className="capitalize">{maintenanceStatus.maintenance.maintenance_type}</span>
                                  {' · '}
                                  {format(new Date(maintenanceStatus.maintenance.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  {maintenanceStatus.maintenance.notes && (
                                    <span className="block mt-0.5 italic">{maintenanceStatus.maintenance.notes}</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Botão agendar ou formulário */}
                              {schedulingEquipmentId === eq.id ? (
                                <form onSubmit={handleScheduleMaintenance} className="mt-3 space-y-2 p-3 bg-muted/50 rounded-md">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Data Agendada *</Label>
                                      <Input
                                        type="date"
                                        value={maintenanceForm.scheduled_date}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduled_date: e.target.value })}
                                        className="h-8 text-sm"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Intervalo</Label>
                                      <Select 
                                        value={maintenanceForm.interval_months}
                                        onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, interval_months: v })}
                                      >
                                        <SelectTrigger className="h-8 text-sm">
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
                                    <Label className="text-xs">Tipo</Label>
                                    <Select 
                                      value={maintenanceForm.maintenance_type}
                                      onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: v })}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="limpeza">Limpeza</SelectItem>
                                        <SelectItem value="preventiva">Preventiva</SelectItem>
                                        <SelectItem value="corretiva">Corretiva</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Observações</Label>
                                    <Input
                                      value={maintenanceForm.notes}
                                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                                      placeholder="Observações..."
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button type="submit" size="sm" disabled={scheduleMutation.isPending}>
                                      <Save className="w-3 h-3 mr-1" />
                                      Salvar
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setSchedulingEquipmentId(null)}>
                                      <X className="w-3 h-3 mr-1" />
                                      Cancelar
                                    </Button>
                                  </div>
                                </form>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 h-7 text-xs"
                                  onClick={() => {
                                    setSchedulingEquipmentId(eq.id);
                                    // Sugerir data baseada no intervalo padrão
                                    const suggestedDate = addMonths(new Date(), 6).toISOString().split('T')[0];
                                    setMaintenanceForm({ ...maintenanceForm, scheduled_date: suggestedDate });
                                  }}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Agendar Manutenção
                                </Button>
                              )}
                            </div>
                            
                            {eq.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{eq.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(eq)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Remover este equipamento?')) {
                                  deleteMutation.mutate(eq.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientEquipmentDialog;
