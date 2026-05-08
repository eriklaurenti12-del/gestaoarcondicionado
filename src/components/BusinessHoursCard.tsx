import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Save, Plane, Plus, Trash2, Info } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_BUSINESS_HOURS, useBusinessHours, type Vacation, type WeekdayKey } from "@/hooks/useBusinessHours";

const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

export const BusinessHoursCard: React.FC = () => {
  const { toast } = useToast();
  const { settings: initial, refresh } = useBusinessHours();

  const [enabled, setEnabled] = useState(true);
  const [weekdays, setWeekdays] = useState(DEFAULT_BUSINESS_HOURS.weekdays);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [lunchStart, setLunchStart] = useState('12:00');
  const [lunchEnd, setLunchEnd] = useState('13:00');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [minAdvanceHours, setMinAdvanceHours] = useState(2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [saving, setSaving] = useState(false);

  // New vacation draft
  const [vStart, setVStart] = useState('');
  const [vEnd, setVEnd] = useState('');
  const [vReason, setVReason] = useState('');

  useEffect(() => {
    if (!initial) return;
    setEnabled(initial.enabled);
    setWeekdays(initial.weekdays);
    setStartTime(initial.start_time);
    setEndTime(initial.end_time);
    setLunchStart(initial.lunch_start || '');
    setLunchEnd(initial.lunch_end || '');
    setSlotMinutes(initial.slot_minutes);
    setMinAdvanceHours(initial.min_advance_hours);
    setMaxAdvanceDays(initial.max_advance_days);
    setAutoConfirm(initial.auto_confirm);
    setVacations(initial.vacations || []);
  }, [initial]);

  const toggleDay = (k: WeekdayKey) => setWeekdays(w => ({ ...w, [k]: !w[k] }));

  const addVacation = () => {
    if (!vStart || !vEnd) {
      toast({ title: 'Datas obrigatórias', variant: 'destructive' });
      return;
    }
    if (vEnd < vStart) {
      toast({ title: 'Data final antes da inicial', variant: 'destructive' });
      return;
    }
    setVacations(v => [...v, { start_date: vStart, end_date: vEnd, reason: vReason || undefined }]);
    setVStart(''); setVEnd(''); setVReason('');
  };

  const removeVacation = (idx: number) => setVacations(v => v.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Não autenticado');

      const payload: any = {
        user_id: userId,
        enabled,
        weekdays,
        start_time: startTime,
        end_time: endTime,
        slot_minutes: slotMinutes,
        lunch_start: lunchStart || null,
        lunch_end: lunchEnd || null,
        min_advance_hours: minAdvanceHours,
        max_advance_days: maxAdvanceDays,
        auto_confirm: autoConfirm,
        vacations,
      };

      const { data: existing } = await supabase
        .from('online_booking_settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('online_booking_settings')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('online_booking_settings').insert(payload);
        if (error) throw error;
      }

      refresh();
      toast({ title: 'Horários salvos', description: 'Aplicado em toda a agenda do sistema.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Horário de Funcionamento
        </CardTitle>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          Fonte única usada pela <b>agenda manual</b>, <b>agenda online</b> e validação em tempo real.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enabled */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Agenda online ativa</Label>
            <p className="text-xs text-muted-foreground">Quando desligado, link público fica indisponível.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Weekdays */}
        <div className="space-y-2">
          <Label className="text-xs">Dias de Trabalho</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`min-w-[44px] h-11 px-3 rounded-md border text-sm font-medium transition ${
                  weekdays[d.key] ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hours */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Abertura</Label>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fechamento</Label>
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Almoço início</Label>
            <Input type="time" value={lunchStart} onChange={e => setLunchStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Almoço fim</Label>
            <Input type="time" value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} />
          </div>
        </div>

        {/* Advanced */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Slot (min)</Label>
            <Input type="number" min={5} step={5} value={slotMinutes} onChange={e => setSlotMinutes(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Antec. mín. (h)</Label>
            <Input type="number" min={0} value={minAdvanceHours} onChange={e => setMinAdvanceHours(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Antec. máx. (dias)</Label>
            <Input type="number" min={1} value={maxAdvanceDays} onChange={e => setMaxAdvanceDays(Number(e.target.value))} />
          </div>
        </div>

        {/* Auto-confirm */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Confirmar automaticamente</Label>
            <p className="text-xs text-muted-foreground">Online: aprova sem sua confirmação manual.</p>
          </div>
          <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
        </div>

        {/* Vacations */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">Férias / Folgas</Label>
          </div>
          <p className="text-xs text-muted-foreground">Períodos bloqueados para agenda manual e online.</p>
          {vacations.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {vacations.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{v.start_date} → {v.end_date}</div>
                    {v.reason && <div className="text-muted-foreground truncate">{v.reason}</div>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeVacation(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input type="date" value={vStart} onChange={e => setVStart(e.target.value)} placeholder="Início" />
            <Input type="date" value={vEnd} onChange={e => setVEnd(e.target.value)} placeholder="Fim" />
          </div>
          <Input value={vReason} onChange={e => setVReason(e.target.value)} placeholder="Motivo (opcional)" />
          <Button type="button" size="sm" variant="outline" onClick={addVacation} className="w-full">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar período
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Horários'}
        </Button>

        <Badge variant="secondary" className="w-full justify-center text-xs">
          ✅ Aplicado em todo o sistema instantaneamente
        </Badge>
      </CardContent>
    </Card>
  );
};
