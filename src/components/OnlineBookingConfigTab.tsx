import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Link2, Copy, CalendarClock } from 'lucide-react';

const WEEKDAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
] as const;

interface Settings {
  enabled: boolean;
  weekdays: Record<string, boolean>;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  lunch_start: string | null;
  lunch_end: string | null;
  min_advance_hours: number;
  max_advance_days: number;
  auto_confirm: boolean;
}

const DEFAULTS: Settings = {
  enabled: true,
  weekdays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
  start_time: '08:00',
  end_time: '18:00',
  slot_minutes: 30,
  lunch_start: '12:00',
  lunch_end: '13:00',
  min_advance_hours: 2,
  max_advance_days: 30,
  auto_confirm: false,
};

export default function OnlineBookingConfigTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['online-booking-settings'],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return null;
      setUserId(sess.session.user.id);
      const { data, error } = await (supabase as any)
        .from('online_booking_settings')
        .select('*')
        .eq('user_id', sess.session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setSettings({
        enabled: data.enabled,
        weekdays: data.weekdays || DEFAULTS.weekdays,
        start_time: data.start_time,
        end_time: data.end_time,
        slot_minutes: data.slot_minutes,
        lunch_start: data.lunch_start,
        lunch_end: data.lunch_end,
        min_advance_hours: data.min_advance_hours,
        max_advance_days: data.max_advance_days,
        auto_confirm: data.auto_confirm,
      });
    }
  }, [data]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('online_booking_settings')
        .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });
      if (error) throw error;
      toast({ title: '✅ Configuração salva', description: 'Agendamento online atualizado em tempo real.' });
      qc.invalidateQueries({ queryKey: ['online-booking-settings'] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = userId ? `${window.location.origin}/agendar/${userId}` : '';

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: '🔗 Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="w-5 h-5" /> Agendamento Online — Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Habilitar */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
            <div>
              <Label className="text-sm font-medium">Aceitar reservas online</Label>
              <p className="text-xs text-muted-foreground">Quando desligado, o link público mostra "Indisponível".</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
          </div>

          {/* Auto-confirmar */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
            <div>
              <Label className="text-sm font-medium">Confirmação automática</Label>
              <p className="text-xs text-muted-foreground">Reservas viram "confirmado" sem aprovação manual.</p>
            </div>
            <Switch checked={settings.auto_confirm} onCheckedChange={(v) => setSettings({ ...settings, auto_confirm: v })} />
          </div>

          {/* Dias da semana */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Dias de atendimento</Label>
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              {WEEKDAYS.map((d) => (
                <label key={d.key} className="flex items-center gap-2 p-2 rounded-lg border bg-card/50 cursor-pointer hover:bg-accent/40">
                  <Switch
                    checked={!!settings.weekdays[d.key]}
                    onCheckedChange={(v) => setSettings({ ...settings, weekdays: { ...settings.weekdays, [d.key]: v } })}
                  />
                  <span className="text-xs">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Abre às</Label>
              <Input type="time" value={settings.start_time} onChange={(e) => setSettings({ ...settings, start_time: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Fecha às</Label>
              <Input type="time" value={settings.end_time} onChange={(e) => setSettings({ ...settings, end_time: e.target.value })} />
            </div>
          </div>

          {/* Almoço */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Almoço — início</Label>
              <Input type="time" value={settings.lunch_start || ''} onChange={(e) => setSettings({ ...settings, lunch_start: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Almoço — fim</Label>
              <Input type="time" value={settings.lunch_end || ''} onChange={(e) => setSettings({ ...settings, lunch_end: e.target.value || null })} />
            </div>
          </div>

          {/* Outros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Duração do slot (min)</Label>
              <Input type="number" min={15} max={240} step={15} value={settings.slot_minutes} onChange={(e) => setSettings({ ...settings, slot_minutes: Math.max(15, Number(e.target.value) || 30) })} />
            </div>
            <div>
              <Label className="text-xs">Antecedência mínima (h)</Label>
              <Input type="number" min={0} max={48} value={settings.min_advance_hours} onChange={(e) => setSettings({ ...settings, min_advance_hours: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label className="text-xs">Antecedência máxima (dias)</Label>
              <Input type="number" min={1} max={180} value={settings.max_advance_days} onChange={(e) => setSettings({ ...settings, max_advance_days: Math.max(1, Number(e.target.value) || 30) })} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar configuração
          </Button>
        </CardContent>
      </Card>

      {/* Link público */}
      {userId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Link2 className="w-4 h-4" /> Link público</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Compartilhe este link no WhatsApp, Instagram ou no rodapé do seu site.</p>
            <div className="flex gap-2">
              <Input readOnly value={publicUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyLink} className="gap-1.5"><Copy className="w-4 h-4" /> Copiar</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
