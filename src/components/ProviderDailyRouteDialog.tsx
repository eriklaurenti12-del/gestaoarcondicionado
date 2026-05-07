import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Car, Utensils, CheckCircle, Clock, FileDown, Send, CheckCircle2, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { ServiceProvider } from './ServiceProvidersTab';

interface ProviderDailyRouteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ServiceProvider | null;
  allAppointments: any[];
}

export default function ProviderDailyRouteDialog({ isOpen, onOpenChange, provider, allAppointments }: ProviderDailyRouteDialogProps) {
  const queryClient = useQueryClient();
  const [selectedAppointments, setSelectedAppointments] = useState<Record<string, string>>({}); // id -> status
  const [combustivel, setCombustivel] = useState('');
  const [alimentacao, setAlimentacao] = useState('');
  const [diaria, setDiaria] = useState('');
  const [motorista, setMotorista] = useState('');

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
      setDiaria(provider.daily_rate ? String(provider.daily_rate) : '');
      setMotorista(provider.driver_cost ? String(provider.driver_cost) : '');
      
      // Initialize with 'concluido' for all pending/agendado appointments
      const initialStatus: Record<string, string> = {};
      todaysAppointments
        .filter(a => a.status !== 'cancelado' && a.status !== 'concluido')
        .forEach(a => {
          initialStatus[a.id] = 'concluido';
        });
      setSelectedAppointments(initialStatus);
    }
  }, [isOpen, provider]);

  const toggleAppointment = (id: string) => {
    setSelectedAppointments(prev => 
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  const generateRoutePDF = () => {
    if (!provider) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(24, 24, 27);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Roteiro de Trabalho', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Prestador: ${provider.name} | Data: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, 14, 32);

    const completedIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'concluido');
    const selectedAppts = todaysAppointments.filter(a => completedIds.includes(a.id));
    
    const tableData = selectedAppts.map((a, i) => [
      i + 1,
      format(new Date(a.appointment_date), 'HH:mm'),
      a.clients?.name || 'Cliente',
      a.clients?.address || 'Não informado',
      a.clients?.telefone || '-',
      a.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['#', 'Hora', 'Cliente', 'Endereço', 'Telefone', 'Status']],
      body: tableData,
      headStyles: { fillColor: [24, 24, 27] },
      styles: { fontSize: 8 },
    });

    doc.save(`rota_${provider.name.replace(/\s/g, '_')}_${format(new Date(), 'dd_MM')}.pdf`);
    toast.success('PDF da rota gerado!');
  };

  const sendWhatsAppRoute = () => {
    if (!provider?.phone) {
      toast.error('Prestador sem telefone cadastrado');
      return;
    }

    const completedIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'concluido');
    const selectedAppts = todaysAppointments.filter(a => completedIds.includes(a.id));
    if (selectedAppts.length === 0) return;

    let message = `*ROTEIRO DE HOJE - ${format(new Date(), 'dd/MM/yyyy')}*\n`;
    message += `*Prestador:* ${provider.name}\n\n`;
    
    selectedAppts.forEach((a, i) => {
      const address = a.clients?.address || 'Não informado';
      const encodedAddress = encodeURIComponent(address);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      const wazeUrl = `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
      
      message += `*${i + 1}. ${format(new Date(a.appointment_date), 'HH:mm')} - ${a.clients?.name}*\n`;
      message += `📍 Endereço: ${address}\n`;
      if (a.clients?.telefone) message += `📞 Contato: ${a.clients.telefone}\n`;
      message += `🧭 *NAVEGAR:* \n`;
      message += `➤ Google Maps: ${googleMapsUrl}\n`;
      message += `➤ Waze: ${wazeUrl}\n`;
      message += `\n`;
    });

    message += `_Tenha um ótimo trabalho!_`;

    const phone = provider.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const registerDailyExpensesMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      if (!provider) throw new Error('Prestador não encontrado');

      const completedIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'concluido');
      const canceledIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'cancelado');
      const pendingIds = Object.keys(selectedAppointments).filter(id => selectedAppointments[id] === 'pendente');

      const completedAppts = todaysAppointments.filter(a => completedIds.includes(a.id));
      
      const servicesInfo = completedAppts.length > 0 
        ? ` (${completedAppts.length} serviços concluídos)` 
        : '';

      const expensesToInsert = [];
      const today = new Date().toISOString().split('T')[0];

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

      if (diaria && parseFloat(diaria) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Diária',
          amount: parseFloat(diaria),
          expense_date: today,
          description: `Diária Diária - ${provider.name}${servicesInfo}`,
          helper_name: provider.name,
        });
      }

      if (motorista && parseFloat(motorista) > 0) {
        expensesToInsert.push({
          user_id: session.user.id,
          category: 'Motorista',
          amount: parseFloat(motorista),
          expense_date: today,
          description: `Motorista Diário - ${provider.name}${servicesInfo}`,
          helper_name: provider.name,
        });
      }

      if (expensesToInsert.length > 0) {
        const { error } = await supabase.from('fixed_expenses').insert(expensesToInsert);
        if (error) throw error;

        for (const exp of expensesToInsert) {
          await recordFinancialEntry({
            userId: session.user.id,
            type: 'saque',
            amount: exp.amount,
            description: exp.description,
            paymentMethod: 'Dinheiro',
            category: exp.category,
            providerName: provider.name,
          });
        }
      }

      let totalRevenue = 0;
      if (completedIds.length > 0) {
        for (const apt of completedAppts) {
          let price = 0;
          if (apt.notes) {
            const match = apt.notes.match(/\[VALOR:([\d.]+)\]/);
            if (match) price = Number(match[1]);
          }
          if (price === 0) price = Number(apt.products?.price) || 0;
          totalRevenue += price;
        }

        await supabase.from('appointments').update({ status: 'concluido' }).in('id', completedIds);
      }

      if (canceledIds.length > 0) {
        await supabase.from('appointments').update({ status: 'cancelado' }).in('id', canceledIds);
      }

      if (pendingIds.length > 0) {
        await supabase.from('appointments').update({ status: 'agendado' }).in('id', pendingIds);
      }

      if (totalRevenue > 0) {
        await recordFinancialEntry({
          userId: session.user.id,
          type: 'entrada',
          amount: totalRevenue,
          category: 'Serviços',
          description: `Receita de Rota: ${completedAppts.length} serviços`,
          paymentMethod: 'Dinheiro',
          providerName: provider.name,
        });
      }
    },
    onSuccess: () => {
      toast.success('Operação concluída com sucesso!');
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
          <div className="space-y-3">
            <Label className="text-base">Serviços da Rota ({todaysAppointments.length})</Label>
            {todaysAppointments.length === 0 ? (
              <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/20">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Nenhum serviço agendado para hoje.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysAppointments.map((apt) => (
                  <div key={apt.id} className="flex flex-col p-3 rounded-lg border bg-card/50 gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-bold truncate">{apt.clients?.name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {format(parseISO(apt.appointment_date), 'HH:mm')} • {apt.products?.name}
                        </p>
                      </div>
                      <Badge variant={selectedAppointments[apt.id] === 'concluido' ? 'default' : 'outline'} className="text-[9px]">
                        {selectedAppointments[apt.id] || apt.status}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedAppointments[apt.id] === 'concluido' ? 'default' : 'outline'}
                        className={`flex-1 h-8 text-[10px] gap-1 ${selectedAppointments[apt.id] === 'concluido' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => setSelectedAppointments(prev => ({ ...prev, [apt.id]: 'concluido' }))}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Concluído
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedAppointments[apt.id] === 'cancelado' ? 'destructive' : 'outline'}
                        className="flex-1 h-8 text-[10px] gap-1"
                        onClick={() => setSelectedAppointments(prev => ({ ...prev, [apt.id]: 'cancelado' }))}
                      >
                        <XCircle className="w-3 h-3" /> Cancelado
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedAppointments[apt.id] === 'pendente' ? 'secondary' : 'outline'}
                        className="flex-1 h-8 text-[10px] gap-1"
                        onClick={() => setSelectedAppointments(prev => ({ ...prev, [apt.id]: 'pendente' }))}
                      >
                        <Clock className="w-3 h-3" /> Adiado
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground mt-2 text-center bg-muted/30 p-2 rounded">
                  <CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />
                  Ao confirmar, os serviços marcados serão dados como <strong>concluídos</strong>.
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
              <div className="space-y-2">
                <Label className="flex items-center gap-1">📅 Diária (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={diaria} 
                  onChange={e => setDiaria(e.target.value)} 
                  min="0" step="0.01" 
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">🚗 Motorista (R$)</Label>
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={motorista} 
                  onChange={e => setMotorista(e.target.value)} 
                  min="0" step="0.01" 
                />
              </div>
            </div>
            {(provider?.fuel_allowance || provider?.food_allowance || provider?.daily_rate || provider?.driver_cost) && (
              <p className="text-[11px] text-muted-foreground italic">
                * Preenchido automaticamente com os valores fixos do prestador.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex-col sm:flex-row gap-3 border-t pt-4">
          <div className="flex gap-2 flex-1 w-full">
            <Button variant="outline" onClick={generateRoutePDF} disabled={selectedAppointments.length === 0} className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50">
              <FileDown className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" onClick={sendWhatsAppRoute} disabled={selectedAppointments.length === 0} className="flex-1 text-green-600 border-green-200 hover:bg-green-50">
              <Send className="w-4 h-4 mr-2" /> WhatsApp
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button 
              onClick={() => registerDailyExpensesMutation.mutate()}
              disabled={registerDailyExpensesMutation.isPending || (!combustivel && !alimentacao && selectedAppointments.length === 0)}
              className="bg-primary text-primary-foreground shadow-lg hover:shadow-primary/20"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {registerDailyExpensesMutation.isPending ? 'Salvando...' : 'Confirmar Tudo'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
