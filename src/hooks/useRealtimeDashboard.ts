import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealtimeAppointment {
  id: string;
  client_id: number | null;
  service_id: number | null;
  appointment_date: string;
  status: string;
  // Add other fields as needed
}

/**
 * Hook that subscribes to the `appointments` table via Supabase realtime.
 * It returns the latest list of appointments sorted by date.
 */
export const useRealtimeDashboard = () => {
  const [appointments, setAppointments] = useState<RealtimeAppointment[]>([]);

  useEffect(() => {
    // Initial load
    const fetchInitial = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true });
      if (!error && data) setAppointments(data as RealtimeAppointment[]);
    };
    fetchInitial();

    // Setup realtime subscription
    const channel = supabase
      .channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setAppointments(prev => prev.filter(a => a.id !== payload.old.id));
          return;
        }
        
        const newRecord = payload.new as RealtimeAppointment;
        setAppointments((prev) => {
          const filtered = prev.filter((a) => a.id !== newRecord.id);
          return [...filtered, newRecord].sort(
            (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
          );
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { appointments };
};
