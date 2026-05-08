import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export type Vacation = { start_date: string; end_date: string; reason?: string };
export type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type BusinessHoursSettings = {
  enabled: boolean;
  weekdays: Record<WeekdayKey, boolean>;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  lunch_start: string | null;
  lunch_end: string | null;
  min_advance_hours: number;
  max_advance_days: number;
  auto_confirm: boolean;
  vacations: Vacation[];
};

export const DEFAULT_BUSINESS_HOURS: BusinessHoursSettings = {
  enabled: true,
  weekdays: { sun: false, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true },
  start_time: '08:00',
  end_time: '18:00',
  slot_minutes: 30,
  lunch_start: '12:00',
  lunch_end: '13:00',
  min_advance_hours: 2,
  max_advance_days: 30,
  auto_confirm: false,
  vacations: [],
};

const WK_KEYS: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function useBusinessHours() {
  const qc = useQueryClient();
  const [now, setNow] = useState<Date>(new Date());

  // Re-tick every minute so all validations stay real-time
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['business-hours'],
    queryFn: async (): Promise<BusinessHoursSettings> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return DEFAULT_BUSINESS_HOURS;

      const { data } = await supabase
        .from('online_booking_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) return DEFAULT_BUSINESS_HOURS;

      return {
        ...DEFAULT_BUSINESS_HOURS,
        ...(data as any),
        weekdays: { ...DEFAULT_BUSINESS_HOURS.weekdays, ...((data as any).weekdays || {}) },
        vacations: Array.isArray((data as any).vacations) ? (data as any).vacations : [],
      };
    },
    staleTime: 30_000,
  });

  const settings = data || DEFAULT_BUSINESS_HOURS;

  const isOnVacation = (date: Date): Vacation | null => {
    const d = ymd(date);
    return settings.vacations.find(v => d >= v.start_date && d <= v.end_date) || null;
  };

  const isWeekdayAllowed = (date: Date) => {
    const wk = WK_KEYS[date.getDay()];
    return settings.weekdays[wk] !== false;
  };

  const isWithinHours = (date: Date) => {
    const mins = date.getHours() * 60 + date.getMinutes();
    const startM = toMin(settings.start_time);
    const endM = toMin(settings.end_time);
    if (mins < startM || mins >= endM) return false;
    if (settings.lunch_start && settings.lunch_end) {
      const lS = toMin(settings.lunch_start);
      const lE = toMin(settings.lunch_end);
      if (mins >= lS && mins < lE) return false;
    }
    return true;
  };

  /**
   * Validates a date+time for scheduling. Returns null if valid, error message otherwise.
   * Used by manual agenda AND online booking client-side.
   */
  const validateSlot = (
    dateTime: Date,
    opts?: { skipMinAdvance?: boolean; durationMinutes?: number }
  ): string | null => {
    if (!settings.enabled) {
      // enabled=false only blocks ONLINE; manual still allowed unless explicit
    }
    if (dateTime <= now) {
      return 'Data/horário no passado. Selecione um horário futuro.';
    }
    const vac = isOnVacation(dateTime);
    if (vac) {
      return `Em férias/folga (${vac.start_date} → ${vac.end_date})${vac.reason ? ': ' + vac.reason : ''}.`;
    }
    if (!isWeekdayAllowed(dateTime)) {
      return 'Dia da semana fora do expediente cadastrado.';
    }
    if (!isWithinHours(dateTime)) {
      return `Horário fora do expediente (${settings.start_time}–${settings.end_time}${settings.lunch_start ? `, almoço ${settings.lunch_start}–${settings.lunch_end}` : ''}).`;
    }
    // Validate end-of-service still inside hours (exact duration)
    const dur = opts?.durationMinutes ?? 0;
    if (dur > 0) {
      const endDt = new Date(dateTime.getTime() + dur * 60000);
      const endM = endDt.getHours() * 60 + endDt.getMinutes();
      const closeM = toMin(settings.end_time);
      const sameDay = endDt.toDateString() === dateTime.toDateString();
      if (!sameDay || endM > closeM) {
        return `Serviço de ${dur}min termina após o fechamento (${settings.end_time}).`;
      }
      // overlap with lunch
      if (settings.lunch_start && settings.lunch_end) {
        const lS = toMin(settings.lunch_start);
        const lE = toMin(settings.lunch_end);
        const startM = dateTime.getHours() * 60 + dateTime.getMinutes();
        if (startM < lE && endM > lS) {
          return `Serviço cruza o horário de almoço (${settings.lunch_start}–${settings.lunch_end}).`;
        }
      }
    }
    if (!opts?.skipMinAdvance && settings.min_advance_hours > 0) {
      const diffH = (dateTime.getTime() - now.getTime()) / 3600000;
      if (diffH < settings.min_advance_hours) {
        return `Antecedência mínima de ${settings.min_advance_hours}h não respeitada.`;
      }
    }
    return null;
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['business-hours'] });

  return { settings, isLoading, now, isOnVacation, isWeekdayAllowed, isWithinHours, validateSlot, refresh };
}
