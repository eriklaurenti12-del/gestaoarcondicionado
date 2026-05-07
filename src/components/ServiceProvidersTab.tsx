import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Users, Phone, Wrench, DollarSign, Search, FileDown, MapPin, Send, Car, Loader2, RefreshCw, Zap, ShieldCheck, Activity, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from "@/components/ui/switch";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProviderDailyRouteDialog from './ProviderDailyRouteDialog';
import RouteAllocationTab from './RouteAllocationTab';
import { ScrollArea } from "@/components/ui/scroll-area";

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
  daily_rate?: number;
  driver_cost?: number;
  technical_notes?: string;
  is_field_technician?: boolean;
  is_recurring_expenses?: boolean;
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
  'Limpeza', 'Higienização', 'Carga de Gás', 'Elétrica', 'Geral',
  'Técnico de Ar', 'Auxiliar Técnico'
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
  const [routeProvider, setRouteProvider] = useState<ServiceProvider | null>(null);

  const [formData, setFormData] = useState({
    name: '', phone: '', specialty: 'Geral', cost_per_hour: '', color: '#3b82f6',
    food_allowance: '', fuel_allowance: '', daily_rate: '', driver_cost: '', technical_notes: '', 
    is_field_technician: true, is_recurring_expenses: true
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
    setFormData({ 
      name: '', phone: '', specialty: 'Geral', cost_per_hour: '', color: '#3b82f6', 
      food_allowance: '', fuel_allowance: '', technical_notes: '', daily_rate: '',
      driver_cost: '', is_field_technician: true, is_recurring_expenses: true 
    });
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
      daily_rate: parseFloat(formData.daily_rate) || 0,
      driver_cost: parseFloat(formData.driver_cost) || 0,
      technical_notes: formData.technical_notes,
      is_field_technician: formData.is_field_technician,
      is_recurring_expenses: formData.is_recurring_expenses,
      color: formData.color,
      active: true,
      created_at: editingProvider?.created_at || new Date().toISOString(),
    };

    let updated: ServiceProvider[];
    if (editingProvider) {
      updated = providers.map(p => p.id === editingProvider.id ? newProvider : p);
      toast.success('Profissional atualizado!');
    } else {
      updated = [...providers, newProvider];
      toast.success('Novo profissional cadastrado!');
    }
    
    saveMutation.mutate(updated);
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este prestador? Isso removerá o vínculo histórico operacional.')) return;
    const updated = providers.filter(p => p.id !== id);
    saveMutation.mutate(updated);
    toast.success('Removido com sucesso!');
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
      daily_rate: String(provider.daily_rate || ''),
      driver_cost: String(provider.driver_cost || ''),
      color: provider.color,
      technical_notes: provider.technical_notes || '',
      is_field_technician: provider.is_field_technician !== false,
      is_recurring_expenses: provider.is_recurring_expenses !== false,
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
    doc.setFillColor(11, 17, 32);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RELAÇÃO DE EQUIPE TÉCNICA', 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ${providers.length} Profissionais — Ativos: ${providers.filter(p=>p.active).length}`, 14, 30);

    autoTable(doc, {
      startY: 48,
      head: [['Nome', 'Telefone', 'Especialidade', 'Custo/H', 'Gasto Mensal']],
      body: providers.map(p => [
        p.name, p.phone || '-', p.specialty,
        `R$ ${p.cost_per_hour.toFixed(2)}`,
        `R$ ${getProviderExpenses(p.name).reduce((s: number, e: any) => s + Number(e.amount), 0).toFixed(2)}`
      ]),
      headStyles: { fillColor: [11, 17, 32] },
      styles: { fontSize: 9 },
    });

    doc.save(`equipe-tecnica-${format(new Date(), 'dd-MM-yy')}.pdf`);
    toast.success('Relatório gerado!');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <Tabs defaultValue="cadastro" className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <TabsList className="bg-black/40 border border-white/5 p-1 rounded-2xl h-12">
            <TabsTrigger value="cadastro" className="px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest gap-2">
              <Users className="w-4 h-4" /> CADASTRO
            </TabsTrigger>
            <TabsTrigger value="separar" className="px-6 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest gap-2">
              <MapPin className="w-4 h-4" /> SEPARAR ROTA
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input 
                placeholder="Buscar por nome ou especialidade..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="op-input pl-9 h-11 text-xs font-bold"
              />
            </div>
            <Button variant="outline" onClick={exportPDF} className="h-11 border-white/10 bg-white/5 hover:bg-white/10 text-slate-400">
              <FileDown className="w-4 h-4" />
            </Button>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="op-btn-primary h-11 px-6 font-black uppercase text-[10px] tracking-widest gap-2">
              <UserPlus className="w-4 h-4" /> NOVO TÉCNICO
            </Button>
          </div>
        </div>

        <TabsContent value="cadastro" className="m-0 focus-visible:ring-0">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-64 op-card animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center op-card border-dashed">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-700 opacity-20" />
              <p className="text-lg font-black text-slate-400 uppercase tracking-widest">Nenhum profissional na base</p>
              <p className="text-xs text-slate-600 font-bold uppercase mt-1">Inicie o cadastro da sua equipe externa</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(provider => {
                const provAppts = getProviderAppointments(provider.name);
                const provExpenses = getProviderExpenses(provider.name);
                const totalExpenses = provExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
                const completed = provAppts.filter((a:any) => a.status === 'concluido').length;

                return (
                  <div key={provider.id} className="op-card group relative overflow-hidden transition-all hover:border-primary/50">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 bg-white/5 hover:bg-white/10 text-white rounded-lg" onClick={() => handleEdit(provider)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors" onClick={() => handleDelete(provider.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg ring-4 ring-white/5" style={{ backgroundColor: provider.color }}>
                        {provider.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-black text-lg uppercase truncate pr-16">{provider.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[9px] font-black uppercase">{provider.specialty}</Badge>
                          {provider.active && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Custo Base</p>
                        <p className="text-white font-black text-sm">R$ {provider.cost_per_hour.toFixed(2)}/h</p>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Diária Fixa</p>
                        <p className="text-white font-black text-sm">R$ {provider.daily_rate?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6 border-t border-white/5 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-blue-500" /> Rendimento
                        </span>
                        <span className="text-xs font-black text-white">{completed}/{provAppts.length} Concluídos</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(completed / (provAppts.length || 1)) * 100}%` }} />
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {provider.food_allowance ? <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-500 text-[9px] font-black">🍔 R$ {provider.food_allowance.toFixed(2)}</Badge> : null}
                        {provider.fuel_allowance ? <Badge variant="outline" className="bg-slate-500/10 border-white/10 text-slate-400 text-[9px] font-black">⛽ R$ {provider.fuel_allowance.toFixed(2)}</Badge> : null}
                        {provider.is_recurring_expenses && <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-500 text-[9px] font-black uppercase">RECORRENTE</Badge>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="op-btn-primary flex-1 h-11 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => setRouteProvider(provider)}>
                        <Car className="w-4 h-4" /> MONTAR ROTA
                      </Button>
                      {provider.phone && (
                        <Button variant="outline" className="h-11 w-12 border-white/10 bg-white/5 hover:bg-green-500/10 text-green-500" onClick={() => window.open(`https://wa.me/55${provider.phone.replace(/\D/g, '')}`, '_blank')}>
                          <Phone className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="separar" className="m-0 focus-visible:ring-0">
          <RouteAllocationTab providers={providers} />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl bg-[#0B1120] border-white/10 text-white p-0 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-white/5 bg-white/5">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <UserPlus className="w-8 h-8 text-primary" />
              {editingProvider ? 'Atualizar Profissional' : 'Novo Integrante da Equipe'}
            </DialogTitle>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Configurações operacionais e custos fixos</p>
          </div>

          <ScrollArea className="max-h-[70vh] p-8">
            <div className="space-y-8">
              {/* Seção 1: Identidade */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identificação Básica</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nome Completo</Label>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: João da Silva" className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">WhatsApp Operacional</Label>
                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(00) 00000-0000" className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Especialidade Principal</Label>
                    <Select value={formData.specialty} onValueChange={v => setFormData({ ...formData, specialty: v })}>
                      <SelectTrigger className="op-input h-12 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111827] border-white/10">
                        {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Automação de Custos</Label>
                    <div className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-black/20 h-12">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lançar custos fixos em rotas?</span>
                      <Switch checked={formData.is_recurring_expenses} onCheckedChange={c => setFormData({ ...formData, is_recurring_expenses: c })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Financeiro */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Matriz de Custos</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Custo/Hora (R$)</Label>
                    <Input type="number" step="0.01" value={formData.cost_per_hour} onChange={e => setFormData({ ...formData, cost_per_hour: e.target.value })} className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Diária Fixa (R$)</Label>
                    <Input type="number" step="0.01" value={formData.daily_rate} onChange={e => setFormData({ ...formData, daily_rate: e.target.value })} className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Aux. Alimentação (R$)</Label>
                    <Input type="number" step="0.01" value={formData.food_allowance} onChange={e => setFormData({ ...formData, food_allowance: e.target.value })} className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Aux. Combustível (R$)</Label>
                    <Input type="number" step="0.01" value={formData.fuel_allowance} onChange={e => setFormData({ ...formData, fuel_allowance: e.target.value })} className="op-input h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-500 uppercase ml-1">Aux. Motorista (R$)</Label>
                    <Input type="number" step="0.01" value={formData.driver_cost} onChange={e => setFormData({ ...formData, driver_cost: e.target.value })} className="op-input h-12 font-bold" />
                  </div>
                </div>
              </div>

              {/* Seção 3: Visual */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identidade no Mapa/Agenda</h4>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 p-4 bg-black/20 rounded-2xl border border-white/5">
                  {COLORS.map(c => (
                    <button 
                      key={c.value} type="button"
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${formData.color === c.value ? 'scale-110 border-white shadow-xl ring-4 ring-white/10' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      style={{ backgroundColor: c.value }}
                    >
                      {formData.color === c.value && <div className="w-2 h-2 bg-white rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-8 border-t border-white/5 bg-white/5 gap-3">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="h-12 px-6 text-slate-400 font-black uppercase text-xs">Descartar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="op-btn-primary h-12 px-10 font-black uppercase text-xs tracking-widest">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : editingProvider ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProviderDailyRouteDialog
        isOpen={!!routeProvider}
        onOpenChange={(open) => !open && setRouteProvider(null)}
        provider={routeProvider}
        allAppointments={appointments || []}
      />
    </div>
  );
}
