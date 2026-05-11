import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TABLE_TO_KEYS } from '@/lib/queryKeys';

/**
 * Subscribes once to Supabase Realtime for every table that drives the UI.
 * On any INSERT/UPDATE/DELETE we invalidate every queryKey that depends on
 * that table — so all tabs of the app refresh themselves without the user
 * having to click "Atualizar". Works across multiple devices and browser tabs.
 *
 * Falls back to a lightweight 30s polling refresh in case the realtime
 * websocket gets disconnected (mobile background, captive portals, etc.).
 */
export function useRealtimeSync(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const tables = Object.keys(TABLE_TO_KEYS);
    const channel = supabase.channel(`global-sync-${userId}`);

    for (const table of tables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        (_payload: any) => {
          const keys = TABLE_TO_KEYS[table] || [];
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
          }
        }
      );
    }

    let pollInterval: ReturnType<typeof setInterval> | undefined;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        // Fallback polling — invalidate everything periodically
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            for (const keys of Object.values(TABLE_TO_KEYS)) {
              for (const key of keys) {
                queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
              }
            }
          }, 30000);
        }
      } else if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = undefined;
      }
    });

    // Also refresh everything when the window regains focus or comes back online
    const refreshAll = () => {
      for (const keys of Object.values(TABLE_TO_KEYS)) {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key as unknown as string[] });
        }
      }
    };
    window.addEventListener('focus', refreshAll);
    window.addEventListener('online', refreshAll);

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('focus', refreshAll);
      window.removeEventListener('online', refreshAll);
    };
  }, [userId, queryClient]);
}
