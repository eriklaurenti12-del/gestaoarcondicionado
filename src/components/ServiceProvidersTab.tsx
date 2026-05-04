import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Users, Phone, Wrench, DollarSign, Search, FileDown, MapPin, Send, Car } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabGuideCards from './TabGuideCards';
import ProviderScheduleDialog from './ProviderScheduleDialog';
import ProviderDailyRouteDialog from './ProviderDailyRouteDialog';
import RouteAllocationTab from './RouteAllocationTab';

export interface ServiceProvider {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  cost_per_hour: number;
  color: string;
  active: boolean;
  food_allowance?: number;
  fuel_allowance?: number;
  technical_notes?: string;
  created_at: string;
}

const COLORS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#f97316', label: 'Laranja' },
];

const SPECIALTIES = [
  'Instalação', 'Manutenção Preventiva', 'Manutenção Corretiva',
  'Limpeza', 'Higienização', 'Carga de Gás', 'Elétrica', 'Geral'
];

const fetchProviders = async (): Promise<ServiceProvider[]> => {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'service_providers')
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  if (data?.value) {
    try { return JSON.parse(data.value); } catch { return []; }
  }
  return [];
};

const saveProviders = async (providers: ServiceProvider[]) => {
  const { data: existing } = await supabase
    .from('admin_settings')
    .select('id')
    .eq('key', 'service_providers')
    .maybeSingle();
  
  if (existing) {
    const { error } = await supabase
      .from('admin_settings')
      .update({ value: JSON.stringify(providers), updated_at: new Date().toISOString() })
      .eq('key', 'service_providers');
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('admin_settings')
      .insert({ key: 'service_providers', value: JSON.stringify(providers), description: 'Lista de prestadores de serviço' });
    if (error) throw error;
  }
};

export default function ServiceProvidersTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
  const [search, setSearch] = useState('');
  const [historyProvider, setHistoryProvider] = useState<ServiceProvider | null>(null);
  const [scheduleProvider, setScheduleProvider] = useState<ServiceProvider | null>(null);
  const [routeProvider, setRouteProvider] = useState<ServiceProvider | null>(null);

  const [formData, setFormData] = useState({
    name: '', phone: '', specialty: 'Geral', cost_per_hour: '', color: '#3b82f6',
    food_allowance: '', fuel_allowance: '', technical_notes: ''
  });

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['service-providers'],
    queryFn: fetchProviders,
  });

  const { data: appointments } = useQuery({
    queryKey: ['appointments-for-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address)')
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses-for-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newProviders: ServiceProvider[]) => {
      await saveProviders(newProviders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', phone: '', specialty: 'Geral', cost_per_hour: '', color: '#3b82f6', food_allowance: '', fuel_allowance: '' });
    setEditingProvider(null);
  };

  const handleSave = () => {
    if (!formData.name.trim()) { toast.error('Nome é obrigatório'); return; }
    
    const newProvider: ServiceProvider = {
      id: editingProvider?.id || crypto.randomUUID(),
      name: formData.name.trim(),
      phone: formData.phone,
      specialty: formData.specialty,
      cost_per_hour: parseFloat(formData.cost_per_hour) || 0,
      food_allowance: parseFloat(formData.food_allowance) || 0,
      fuel_allowance: parseFloat(formData.fuel_allowance) || 0,
      color: formData.color,
      active: true,
      created_at: editingProvider?.created_at || new Date().toISOString(),
    };

    let updated: ServiceProvider[];
    if (editingProvider) {
      updated = providers.map(p => p.id === editingProvider.id ? newProvider : p);
      toast.success('Prestador atualizado!');
    } else {
      updated = [...providers, newProvider];
      toast.success('Prestador cadastrado!');
    }
    
    saveMutation.mutate(updated);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este prestador?')) return;
    const updated = providers.filter(p => p.id !== id);
    saveMutation.mutate(updated);
    toast.success('Prestador removido!');
  };

  const handleEdit = (provider: ServiceProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      phone: provider.phone,
      specialty: provider.specialty,
      cost_per_hour: String(provider.cost_per_hour),
      food_allowance: String(provider.food_allowance || ''),
      fuel_allowance: String(provider.fuel_allowance || ''),
      color: provider.color,
    });
    setDialogOpen(true);
  };

  const getProviderAppointments = (providerName: string) => {
    return (appointments || []).filter((a: any) =>
      a.notes?.includes(`[PRESTADOR:${providerName}]`)
    );
  };

  const getProviderExpenses = (providerName: string) => {
    return (expenses || []).filter((e: any) =>
      e.helper_name === providerName || e.description?.includes(providerName)
    );
  };

  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.specialty.toLowerCase().includes(search.toLowerCase())
  );

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Equipe de Prestadores', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 32);

    const tableData = providers.map(p => [
      p.name, p.phone || '-', p.specialty,
      `R$ ${p.cost_per_hour.toFixed(2)}/h`,
      p.active ? 'Ativo' : 'Inativo'
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['Nome', 'Telefone', 'Especialidade', 'Custo/Hora', 'Status']],
      body: tableData,
      headStyles: { fillColor: [24, 24, 27] },
      styles: { fontSize: 10 },
    });

    doc.save('prestadores.pdf');
    toast.success('PDF exportado!');
  };

  const totalCostMonth = providers.reduce((sum, p) => {
    const pExpenses = getProviderExpenses(p.name);
    return sum + pExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  }, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <TabGuideCards cards={[
        {
          icon: Users,
          title: 'Equipe de Prestadores',
          badge: 'Cadastro',
          badgeColor: 'blue',
          description: <>Cadastre seus <strong>prestadores/funcionários</strong>. Associe cada um a serviços agendados e controle custos.</>,
        },
        {
          icon: MapPin,
          title: 'Rotas & Custos',
          badge: 'Gestão',
          badgeColor: 'emerald',
          description: <>Visualize o <strong>histórico de serviços por prestador</strong> e os gastos com combustível e alimentação.</>,
        },
      ]} />

      <Tabs defaultValue="cadastro" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="cadastro" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            Cadastro de Prestadores
          </TabsTrigger>
          <TabsTrigger value="separar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MapPin className="w-4 h-4 mr-2" />
            Separar Rota
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="space-y-4 m-0">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Prestadores</span>
            </div>
            <p className="text-xl font-bold text-blue-500">{providers.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Ativos</span>
            </div>
            <p className="text-xl font-bold text-green-500">{providers.filter(p => p.active).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Custo Médio/h</span>
            </div>
            <p className="text-xl font-bold text-amber-500">
              R$ {providers.length > 0 ? (providers.reduce((s, p) => s + p.cost_per_hour, 0) / providers.length).toFixed(2) : '0.00'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-muted-foreground">Gastos Equipe</span>
            </div>
            <p className="text-xl font-bold text-red-500">R$ {totalCostMonth.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Prestadores de Serviço
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-[180px]" />
              </div>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileDown className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Novo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhum prestador cadastrado</p>
              <p className="text-sm mt-1">Cadastre seus prestadores para associá-los aos serviços</p>
              <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar Primeiro Prestador
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(provider => {
                const provAppts = getProviderAppointments(provider.name);
                const provExpenses = getProviderExpenses(provider.name);
                const totalExpenses = provExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
                return (
                  <div key={provider.id}
                    className="p-4 rounded-xl border hover:shadow-md transition-all hover:border-primary/30"
                    style={{ borderLeftColor: provider.color, borderLeftWidth: '4px' }}>
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{provider.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Wrench className="w-3 h-3" /> {provider.specialty}
                        </p>
                        {provider.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {provider.phone}
                          </p>
                        )}
                      </div>
                      <Badge style={{ backgroundColor: `${provider.color}20`, color: provider.color, borderColor: `${provider.color}40` }}>
                        R$ {provider.cost_per_hour.toFixed(2)}/h
                      </Badge>
                    </div>
                    {(provider.food_allowance || provider.fuel_allowance) ? (
                      <div className="flex gap-2 mt-2">
                        {provider.food_allowance ? <Badge variant="outline" className="text-[10px] bg-amber-50">🍔 R$ {provider.food_allowance.toFixed(2)}</Badge> : null}
                        {provider.fuel_allowance ? <Badge variant="outline" className="text-[10px] bg-gray-50">⛽ R$ {provider.fuel_allowance.toFixed(2)}</Badge> : null}
                      </div>
                    ) : null}
                    <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                      <span>{provAppts.length} serviço(s)</span>
                      <span className="text-red-500">R$ {totalExpenses.toFixed(2)} gastos</span>
                    </div>
                    <div className="space-y-2 mt-4">
                      {/* Row 1: Operational */}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-9 text-xs flex-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" onClick={() => setScheduleProvider(provider)}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Agendar
                        </Button>
                        <Button size="sm" className="h-9 text-xs flex-1 bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100" onClick={() => setRouteProvider(provider)}>
                          <Car className="w-3.5 h-3.5 mr-1" /> Rota Hoje
                        </Button>
                      </div>

                      {/* Row 2: Admin/Comm */}
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-8 text-[10px] flex-1" onClick={() => setHistoryProvider(provider)}>
                          Histórico
                        </Button>
                        {provider.phone && (
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => {
                              const phone = provider.phone.replace(/\D/g, '');
                              window.open(`https://wa.me/55${phone}`, '_blank');
                            }}>
                            <Send className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleEdit(provider)}>
                          <Edit2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/5" onClick={() => handleDelete(provider.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Editar Prestador' : 'Novo Prestador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo" className="min-h-[44px]" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000" className="min-h-[44px]" />
            </div>
            <div>
              <Label>Especialidade</Label>
              <Select value={formData.specialty} onValueChange={v => setFormData({ ...formData, specialty: v })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações Técnicas</Label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Ex: Possui ferramental completo, carro próprio, etc."
                value={formData.technical_notes}
                onChange={e => setFormData({ ...formData, technical_notes: e.target.value })}
              />
            </div>
            <div>
              <Label>Custo por Hora (R$)</Label>
              <Input type="number" step="0.01" value={formData.cost_per_hour}
                onChange={e => setFormData({ ...formData, cost_per_hour: e.target.value })}
                placeholder="0.00" className="min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Alimentação Fixa (R$)</Label>
                <Input type="number" step="0.01" value={formData.food_allowance}
                  onChange={e => setFormData({ ...formData, food_allowance: e.target.value })}
                  placeholder="0.00" className="min-h-[44px]" />
              </div>
              <div>
                <Label>Combustível Fixo (R$)</Label>
                <Input type="number" step="0.01" value={formData.fuel_allowance}
                  onChange={e => setFormData({ ...formData, fuel_allowance: e.target.value })}
                  placeholder="0.00" className="min-h-[44px]" />
              </div>
            </div>
            <div>
              <Label>Cor de Identificação</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map(c => (
                  <button key={c.value} onClick={() => setFormData({ ...formData, color: c.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === c.value ? 'scale-110 border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }} title={c.label} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave}>{editingProvider ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyProvider} onOpenChange={() => setHistoryProvider(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: historyProvider?.color }} />
              Histórico — {historyProvider?.name}
            </DialogTitle>
          </DialogHeader>
          {historyProvider && (() => {
            const appts = getProviderAppointments(historyProvider.name);
            const exps = getProviderExpenses(historyProvider.name);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-blue-500/5 border-blue-500/20">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Serviços</p>
                      <p className="text-lg font-bold text-blue-500">{appts.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-500/5 border-red-500/20">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Gastos</p>
                      <p className="text-lg font-bold text-red-500">
                        R$ {exps.reduce((s: number, e: any) => s + Number(e.amount), 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Serviços Realizados</h4>
                  {appts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum serviço associado</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {appts.slice(0, 20).map((a: any) => (
                        <div key={a.id} className="p-2 bg-muted/50 rounded-lg text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{a.clients?.name || 'Cliente'}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(a.appointment_date), 'dd/MM/yy HH:mm')}
                            </span>
                          </div>
                          <span className={`text-xs ${a.status === 'concluido' ? 'text-green-500' : 'text-amber-500'}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Gastos Associados</h4>
                  {exps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum gasto registrado</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {exps.slice(0, 20).map((e: any) => (
                        <div key={e.id} className="flex justify-between p-2 bg-muted/50 rounded-lg text-sm">
                          <div>
                            <span className="font-medium">{e.description || e.category}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(e.expense_date + 'T12:00:00'), 'dd/MM/yy')}
                            </span>
                          </div>
                          <span className="font-medium text-red-500">R$ {Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <ProviderScheduleDialog
          isOpen={!!scheduleProvider}
          onOpenChange={(open) => !open && setScheduleProvider(null)}
          providerName={scheduleProvider?.name || ''}
        />

        <ProviderDailyRouteDialog
          isOpen={!!routeProvider}
          onOpenChange={(open) => !open && setRouteProvider(null)}
          provider={routeProvider}
          allAppointments={appointments || []}
        />
      </TabsContent>

      <TabsContent value="separar" className="m-0">
        <RouteAllocationTab providers={providers} />
      </TabsContent>
    </Tabs>
    </div>
  );
}
