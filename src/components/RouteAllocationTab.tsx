import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MapPin, Car, Utensils, Send, CheckCircle2, Calendar } from 'lucide-react';
import { ServiceProvider } from './ServiceProvidersTab';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { Badge } from "@/components/ui/badge";
import ProviderDailyRouteDialog from './ProviderDailyRouteDialog';
import { FileDown, RefreshCw, Trash2 } from 'lucide-react';

export default function RouteAllocationTab({ providers }: { providers: ServiceProvider[] }) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');
  const [diaria, setDiaria] = useState('');
  const [motorista, setMotorista] = useState('');
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), 'yyyy-MM-dd')); // default to today
  const [showAssigned, setShowAssigned] = useState(false);
  const [moveToToday, setMoveToToday] = useState(true);
  const [routeProvider, setRouteProvider] = useState<ServiceProvider | null>(null);

  // Get all unassigned appointments
  const { data: allAppointmentsRaw, isLoading } = useQuery({
    queryKey: ['route-appointments', filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address), products(name)')
        .in('status', ['agendado', 'confirmado', 'futura', 'pendente'])
        .order('appointment_date', { ascending: true });
        
      if (error) throw error;
      return data || [];
    }
  });

  const unassignedAppointments = useMemo(() => {
    if (!allAppointmentsRaw) return [];
    return allAppointmentsRaw.filter(a => {
      const hasProvider = a.notes?.includes('[PRESTADOR:');
      const matchesDate = !filterDate || a.appointment_date.startsWith(filterDate);
      if (showAssigned) return matchesDate;
      return !hasProvider && matchesDate;
    });
  }, [allAppointmentsRaw, filterDate, showAssigned]);

  // Get ALL assigned appointments for monitoring
  const { data: assignedAppointments } = useQuery({
    queryKey: ['assigned-appointments', filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, clients(name, telefone, address), products(name)')
        .in('status', ['agendado', 'confirmado', 'concluido'])
        .order('appointment_date', { ascending: true });
      if (error) throw error;
      
      // Filter for those that HAVE a provider and match the date
      return (data || []).filter(a => {
        const hasProvider = a.notes?.includes('[PRESTADOR:');
        if (!hasProvider) return false;
        if (!filterDate) return true;
        return a.appointment_date.startsWith(filterDate);
      });
    }
  });

  const routesByProvider = useMemo(() => {
    if (!assignedAppointments) return {};
    const grouped: Record<string, any[]> = {};
    assignedAppointments.forEach(a => {
      const match = a.notes?.match(/\[PRESTADOR:(.+?)\]/);
      const provName = match?.[1] || 'Outros';
      if (!grouped[provName]) grouped[provName] = [];
      grouped[provName].push(a);
    });
    return grouped;
  }, [assignedAppointments]);

  const groupedAppointments = useMemo(() => {
    if (!unassignedAppointments) return {};
    return unassignedAppointments.reduce((acc: any, apt) => {
      const date = apt.appointment_date.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(apt);
      return acc;
    }, {});
  }, [unassignedAppointments]);

  const toggleAppointment = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  // Pre-fill defaults when provider is selected
  React.useEffect(() => {
    if (selectedProviderId) {
      const provider = providers.find(p => p.id === selectedProviderId);
      if (provider && provider.is_recurring_expenses !== false) {
        setCombustivel(provider.fuel_allowance ? String(provider.fuel_allowance) : '');
        setAlimentacao(provider.food_allowance ? String(provider.food_allowance) : '');
        setDiaria(provider.daily_rate ? String(provider.daily_rate) : '');
        setMotorista(provider.driver_cost ? String(provider.driver_cost) : '');
      } else {
        setCombustivel('');
        setAlimentacao('');
        setDiaria('');
        setMotorista('');
      }
    } else {
      setCombustivel('');
      setAlimentacao('');
      setDiaria('');
      setMotorista('');
    }
  }, [selectedProviderId, providers]);

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
          
        const today = new Date();
        const aptDate = new Date(apt.appointment_date);
        
        let updateData: any = { notes: newNotes };
        
        if (moveToToday) {
          // Keep the original time, but change the date to today
          const todayDate = new Date();
          todayDate.setHours(aptDate.getHours(), aptDate.getMinutes(), 0, 0);
          updateData.appointment_date = todayDate.toISOString();
        }

        const { error } = await supabase
          .from('appointments')
          .update(updateData)
          .eq('id', apt.id);
          
        if (error) throw error;
      }

      // 2. Launch Expenses if provided
      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];

      if (combustivel && parseFloat(combustivel) > 0) {
        if (!provider?.name) throw new Error("Prestador é obrigatório para lançar combustível.");
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

      if (diaria && parseFloat(diaria) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Diária',
          amount: parseFloat(diaria),
          expense_date: today,
          description: `Diária Prestador - ${provider.name}`,
          helper_name: provider.name,
        });
      }

      if (motorista && parseFloat(motorista) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Motorista',
          amount: parseFloat(motorista),
          expense_date: today,
          description: `Custo Motorista Rota - ${provider.name}`,
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
      setDiaria('');
      setMotorista('');
    },
    onError: (error: any) => toast.error(`Erro: ${error.message}`)
  });

  const exportRoutePDF = (provName: string, appts: any[]) => {
    const doc = new jsPDF();
    const provider = providers.find(p => p.name === provName);
    const dateStr = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

    appts.forEach((apt, index) => {
      if (index > 0) doc.addPage();

      // Header Box
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('ROTA DE SERVIÇO', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`AC SERVICE PRO - ${dateStr}`, 105, 25, { align: 'center' });
      doc.text(`PRESTADOR: ${provName.toUpperCase()}`, 105, 33, { align: 'center' });

      // Client Info Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMAÇÕES DO CLIENTE', 20, 55);
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 58, 190, 58);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`NOME: ${apt.clients?.name || 'N/A'}`, 20, 68);
      doc.text(`TELEFONE: ${apt.clients?.telefone || 'N/A'}`, 20, 76);
      
      doc.setFont('helvetica', 'bold');
      doc.text('ENDEREÇO:', 20, 84);
      doc.setFont('helvetica', 'normal');
      const addressLines = doc.splitTextToSize(apt.clients?.address || 'N/A', 160);
      doc.text(addressLines, 20, 90);

      // Service Details Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('DETALHES DO SERVIÇO', 20, 115);
      doc.line(20, 118, 190, 118);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Use a background for the service summary
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 122, 170, 25, 'F');
      
      doc.text(`SERVIÇO: ${apt.products?.name || 'Personalizado'}`, 25, 130);
      doc.text(`HORÁRIO PREVISTO: ${format(parseISO(apt.appointment_date), 'HH:mm')}`, 25, 138);
      
      const price = apt.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1] || apt.products?.price || '0.00';
      doc.setFont('helvetica', 'bold');
      doc.text(`VALOR A COBRAR: R$ ${Number(price).toFixed(2)}`, 110, 138);

      if (apt.notes) {
        doc.setFont('helvetica', 'bold');
        doc.text('OBSERVAÇÕES E NOTAS:', 20, 160);
        doc.setFont('helvetica', 'normal');
        const notesLines = doc.splitTextToSize(apt.notes.replace(/\[.*?\]/g, '').trim(), 160);
        doc.text(notesLines, 20, 166);
      }

      // Checkbox list for tech (Verification list)
      doc.setDrawColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text('CHECKLIST DE EXECUÇÃO', 20, 195);
      doc.line(20, 197, 75, 197);
      
      doc.setFont('helvetica', 'normal');
      doc.rect(20, 205, 5, 5); doc.text('Serviço Concluído / Testado', 28, 209);
      doc.rect(20, 215, 5, 5); doc.text('Área Limpa / Organizada', 28, 219);
      doc.rect(20, 225, 5, 5); doc.text('Pagamento Recebido', 28, 229);
      doc.rect(110, 205, 5, 5); doc.text('Nota Fiscal / Recibo', 118, 209);
      doc.rect(110, 215, 5, 5); doc.text('Material Adicional Usado', 118, 219);

      // Signature Section with better layout
      doc.setFontSize(10);
      doc.line(20, 265, 100, 265);
      doc.text('Assinatura do Técnico', 60, 270, { align: 'center' });

      doc.line(110, 265, 190, 265);
      doc.text('Visto do Cliente (Ok Final)', 150, 270, { align: 'center' });
      
      // Footer with Branding
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('AC SERVICE PRO - Inteligência em Climatização', 105, 285, { align: 'center' });
      doc.text(`Página ${index + 1} de ${appts.length}`, 190, 285, { align: 'right' });
    });

    doc.save(`rota_${provName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('PDF da Rota gerado com sucesso!');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
      {/* Coluna 1: Lista de Serviços */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="w-5 h-5 text-primary" />
                1. Selecione os Serviços
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                <Checkbox 
                  id="show-assigned" 
                  checked={showAssigned}
                  onCheckedChange={(checked) => setShowAssigned(!!checked)}
                />
                <Label htmlFor="show-assigned" className="text-sm font-bold cursor-pointer text-primary">Mostrar Atribuídos</Label>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                <Checkbox 
                  id="select-all" 
                  checked={unassignedAppointments && unassignedAppointments.length > 0 && selectedAppointments.length === unassignedAppointments.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedAppointments(unassignedAppointments?.map(a => a.id) || []);
                    } else {
                      setSelectedAppointments([]);
                    }
                  }}
                />
                <Label htmlFor="select-all" className="text-sm font-bold cursor-pointer text-primary">Selecionar Todos</Label>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-auto h-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-1"
                onClick={() => {
                  if (unassignedAppointments) {
                    setSelectedAppointments(unassignedAppointments.map(a => a.id));
                    toast.success('Todos os serviços selecionados');
                  }
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Puxar Todos
              </Button>
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
            <div className="space-y-6">
              {Object.keys(groupedAppointments).sort().map(date => (
                <div key={date} className="space-y-3">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
                    <Calendar className="w-4 h-4 text-primary" />
                    {format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <div className="space-y-2">
                    {groupedAppointments[date].map((apt: any) => (
                      <div key={apt.id} 
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${selectedAppointments.includes(apt.id) ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/30 hover:border-muted-foreground/20'}`}>
                        <Checkbox 
                          checked={selectedAppointments.includes(apt.id)}
                          onCheckedChange={() => toggleAppointment(apt.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row justify-between gap-1 sm:items-center mb-2">
                            <span className="font-semibold text-base">{apt.clients?.name || 'Cliente Sem Nome'}</span>
                            <div className="flex items-center gap-2">
                              {apt.status === 'futura' && <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">Instalação Futura</Badge>}
                              <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                {format(new Date(apt.appointment_date), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                                <span className="line-clamp-2">{apt.clients?.address || 'Sem endereço cadastrado'}</span>
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                <strong className="text-foreground/80">Serviço:</strong> {apt.products?.name || 'Não especificado'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {apt.clients?.telefone && (
                                <Button variant="outline" size="sm" className="h-8 text-[10px] shrink-0 border-green-200 text-green-600 hover:bg-green-50" onClick={() => window.open(`https://wa.me/55${apt.clients.telefone.replace(/\D/g, '')}`, '_blank')}>
                                  <Send className="w-3 h-3 mr-1" /> WhatsApp
                                </Button>
                              )}
                              {apt.clients?.address && (
                                <Button variant="outline" size="sm" className="h-8 text-[10px] shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(apt.clients.address)}`, '_blank')}>
                                  <MapPin className="w-3 h-3 mr-1" /> Ver Mapa
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coluna 2: Atribuição e Gastos */}
      <div className="space-y-6">
        <Card className="sticky top-4 border-primary shadow-lg ring-1 ring-primary/10">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="text-primary flex items-center gap-2">
              <Car className="w-5 h-5" />
              2. Configurar Rota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border text-center">
              <span className="text-2xl font-bold text-primary">{selectedAppointments.length}</span>
              <p className="text-sm text-muted-foreground font-medium">Serviços Selecionados</p>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Atribuir ao Prestador *</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger className="h-12 border-primary/30 focus:ring-primary">
                  <SelectValue placeholder="Escolha o Executor..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.filter(p => p.active && p.is_field_technician !== false).map(p => (
                    <SelectItem key={p.id} value={p.id}>🚐 {p.name}{p.specialty ? ` — ${p.specialty}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProviderId && providers.find(p => p.id === selectedProviderId) && (
                <div className="mt-2 text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                  {providers.find(p => p.id === selectedProviderId)?.daily_rate ? <span>Diária Padrão: R$ {providers.find(p => p.id === selectedProviderId)?.daily_rate?.toFixed(2)}</span> : null}
                  {providers.find(p => p.id === selectedProviderId)?.driver_cost ? <span>Motorista Padrão: R$ {providers.find(p => p.id === selectedProviderId)?.driver_cost?.toFixed(2)}</span> : null}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Checkbox 
                id="move_to_today" 
                checked={moveToToday} 
                onCheckedChange={(checked) => setMoveToToday(!!checked)}
              />
              <Label htmlFor="move_to_today" className="text-sm font-medium cursor-pointer">
                Adiantar para hoje (Mudar data para {format(new Date(), 'dd/MM')})
              </Label>
            </div>

            <div className="space-y-4 pt-2 border-t">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> Diária (R$)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={diaria} 
                    onChange={e => setDiaria(e.target.value)} 
                    className="h-11"
                    min="0" step="0.01" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Car className="w-4 h-4 text-purple-500" /> Motorista (R$)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={motorista} 
                    onChange={e => setMotorista(e.target.value)} 
                    className="h-11"
                    min="0" step="0.01" 
                  />
                </div>
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

      {/* Visualização de Rotas Atuais */}
      <div className="lg:col-span-3 mt-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Monitoramento de Equipes {filterDate ? `- ${format(parseISO(filterDate), 'dd/MM')}` : '(Hoje/Geral)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(routesByProvider).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                Nenhuma rota atribuída para este período.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(routesByProvider).map(([provName, appts]) => (
                  <Card key={provName} className="border-l-4 overflow-hidden" style={{ borderLeftColor: providers.find(p => p.name === provName)?.color || '#ccc' }}>
                    <CardHeader className="p-3 bg-muted/30">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{provName}</span>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="bg-background">{appts.length} serviços</Badge>
                          <span className="text-[10px] font-bold text-green-600 text-right">
                            {(() => {
                              const totalRevenue = appts.reduce((sum, a) => {
                                const price = a.notes?.match(/\[VALOR:([\d.]+)\]/)?.[1] || a.products?.price || 0;
                                return sum + Number(price);
                              }, 0);
                              
                              const provider = providers.find(p => p.name === provName);
                              const estExpenses = (provider?.daily_rate || 0) + (provider?.driver_cost || 0) + (provider?.fuel_allowance || 0) + (provider?.food_allowance || 0);
                              const profit = totalRevenue - estExpenses;
                              
                              return (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold text-blue-600">Receita: R$ {totalRevenue.toFixed(2)}</span>
                                  <span className="text-[10px] font-bold text-green-600">Lucro Est: R$ {profit.toFixed(2)}</span>
                                </div>
                              );
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] gap-1 border-slate-300 hover:bg-slate-100"
                          onClick={() => exportRoutePDF(provName, appts)}
                        >
                          <FileDown className="w-3 h-3" /> Gerar PDF
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 text-[10px] gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          onClick={() => setRouteProvider(providers.find(p => p.name === provName) || null)}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Confirmar Retorno
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-7 text-[10px] gap-1"
                          onClick={() => {
                            const addresses = appts.map(a => a.clients?.address).filter(Boolean);
                            if (addresses.length === 0) return;
                            const url = `https://www.google.com/maps/dir/${addresses.map(addr => encodeURIComponent(addr)).join('/')}`;
                            window.open(url, '_blank');
                          }}
                        >
                          <MapPin className="w-3 h-3" /> Ver Mapa
                        </Button>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="w-full mt-1 h-6 text-[9px] gap-1 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          if (!confirm(`Remover todos os serviços da rota de ${provName}?`)) return;
                          for (const apt of appts) {
                            const cleanNotes = apt.notes?.replace(new RegExp(`\\[PRESTADOR:${provName}\\]`, 'g'), '').trim();
                            await supabase.from('appointments').update({ notes: cleanNotes }).eq('id', apt.id);
                          }
                          toast.success('Rota removida');
                          queryClient.invalidateQueries({ queryKey: ['assigned-appointments'] });
                          queryClient.invalidateQueries({ queryKey: ['unassigned-appointments'] });
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5" /> Limpar Rota
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {appts.map(a => (
                        <div key={a.id} className="text-xs p-2 rounded bg-muted/50 border flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span className="font-medium truncate">{a.clients?.name}</span>
                            <span className="text-primary font-mono">{format(parseISO(a.appointment_date), 'HH:mm')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground truncate">{a.products?.name}</span>
                            <Badge variant={a.status === 'concluido' ? 'default' : 'outline'} className="text-[9px] h-4">
                              {a.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProviderDailyRouteDialog
        isOpen={!!routeProvider}
        onOpenChange={(open) => !open && setRouteProvider(null)}
        provider={routeProvider}
        allAppointments={assignedAppointments || []}
      />
    </div>
  );
}
