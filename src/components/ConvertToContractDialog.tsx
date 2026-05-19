import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Repeat, Info } from 'lucide-react';
import { format, addYears } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface SourceAppointment {
  id: string;
  user_id: string;
  client_id: number | null;
  appointment_date: string;
  notes?: string | null;
  clients?: { name?: string; telefone?: string; address?: string } | null;
  products?: { name?: string; price?: number } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointment: SourceAppointment | null;
}

/**
 * Aditivo: transforma um cliente avulso (de um agendamento existente) em
 * contrato recorrente. NÃO altera o agendamento original — preserva todo
 * o histórico. Cria apenas um maintenance_contracts novo.
 */
export default function ConvertToContractDialog({ open, onOpenChange, appointment }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    intervalMonths: '6',
    monthlyValue: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    paymentMethod: 'mensal',
    contractType: 'residencial',
    chargeFirst: true,
    notes: '',
  });

  useEffect(() => {
    if (!open || !appointment) return;
    const priceMatch = appointment.notes?.match(/\[VALOR:([\d.]+)\]/);
    const priceFromNotes = priceMatch ? priceMatch[1] : '';
    const productPrice = appointment.products?.price ? String(appointment.products.price) : '';
    setForm((f) => ({
      ...f,
      title: appointment.products?.name
        ? `Manutenção recorrente - ${appointment.products.name}`
        : `Contrato recorrente - ${appointment.clients?.name || 'Cliente'}`,
      monthlyValue: priceFromNotes || productPrice || '',
      notes: `Originado do agendamento #${appointment.id} em ${format(new Date(appointment.appointment_date), 'dd/MM/yyyy')}.`,
    }));
  }, [open, appointment]);

  const handleSubmit = async () => {
    if (!appointment || !appointment.client_id) {
      toast.error('Agendamento sem cliente vinculado.');
      return;
    }
    if (!form.title.trim()) {
      toast.error('Informe um título para o contrato.');
      return;
    }
    setSaving(true);
    try {
      const extra = {
        paymentMethod: form.paymentMethod,
        contractType: form.contractType,
        serviceType: 'preventiva',
        equipmentCount: '1',
        sourceAppointmentId: appointment.id,
      };
      const enrichedNotes = JSON.stringify({ userNotes: form.notes || '', ...extra });
      const { error } = await supabase.from('maintenance_contracts').insert({
        user_id: appointment.user_id,
        client_id: appointment.client_id,
        title: form.title.trim(),
        description: `Convertido de avulso (agendamento ${appointment.id})`,
        start_date: form.startDate,
        end_date: form.endDate || null,
        cleaning_interval_months: parseInt(form.intervalMonths) || 6,
        monthly_value: parseFloat(form.monthlyValue) || 0,
        notes: enrichedNotes,
      });
      if (error) throw error;

      if (form.chargeFirst && parseFloat(form.monthlyValue) > 0) {
        try {
          await recordFinancialEntry({
            userId: appointment.user_id,
            type: 'entrada',
            amount: parseFloat(form.monthlyValue),
            description: `Primeira parcela - ${form.title.trim()}`,
            paymentMethod: (form.paymentMethod === 'mensal' ? 'Dinheiro' : form.paymentMethod) as any,
            category: 'Serviço',
            recordDate: new Date().toISOString(),
          });
        } catch (e: any) {
          // Dedup pode bloquear — não falhar a conversão por causa disso.
          console.warn('recordFinancialEntry skipped:', e?.message);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['maintenance-contracts'] });

      // 🔄 Sincroniza imediatamente o lançamento mensal do contrato no Financeiro,
      // sem o usuário precisar clicar em "Sincronizar Contratos".
      try {
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { ensureMonthlyRecurringExpenses } = await import('@/utils/recurringSync');
        await ensureMonthlyRecurringExpenses(appointment.user_id, ym);
        queryClient.invalidateQueries({ queryKey: ['financial_records'] });
        queryClient.invalidateQueries({ queryKey: ['financial-records'] });
      } catch (e) {
        console.warn('auto contract sync failed', e);
      }

      toast.success('Cliente convertido em contrato recorrente! Histórico preservado.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao criar contrato');
    } finally {
      setSaving(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            Tornar Contrato Recorrente
          </DialogTitle>
          <DialogDescription>
            Cria um novo contrato para <b>{appointment.clients?.name || 'este cliente'}</b> mantendo
            o agendamento original e todo o histórico intactos.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-muted/40 border-muted">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            O fluxo normal continua igual. Use esta opção apenas se a cliente decidir migrar
            este atendimento para um contrato recorrente.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Título do contrato</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Periodicidade (meses)</Label>
              <Select value={form.intervalMonths} onValueChange={(v) => setForm({ ...form, intervalMonths: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mensal</SelectItem>
                  <SelectItem value="2">Bimestral</SelectItem>
                  <SelectItem value="3">Trimestral</SelectItem>
                  <SelectItem value="6">Semestral</SelectItem>
                  <SelectItem value="12">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor por ciclo (R$)</Label>
              <Input type="number" step="0.01" value={form.monthlyValue}
                onChange={(e) => setForm({ ...form, monthlyValue: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal (Dinheiro)</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.contractType} onValueChange={(v) => setForm({ ...form, contractType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.chargeFirst}
              onChange={(e) => setForm({ ...form, chargeFirst: e.target.checked })}
            />
            Lançar primeira parcela como entrada agora
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Repeat className="w-4 h-4 mr-2" />}
            {saving ? 'Convertendo...' : 'Criar Contrato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
