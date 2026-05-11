import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TABLE_TO_TOKENS, keyMatchesTokens } from '@/lib/queryKeys';

/**
 * Global cross-tab realtime sync. Subscribes to every business table and
 * invalidates every queryKey whose first segments contain a matching token,
 * so every tab refreshes automatically without a manual click.
 *
 * Falls back to 30s polling when realtime is disconnected, and refreshes
 * everything when the browser regains focus or comes back online.
 */
export function useRealtimeSync(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidateForTable = (table: string) => {
      const tokens = TABLE_TO_TOKENS[table];
      if (!tokens) return;
      queryClient.invalidateQueries({
        predicate: (q) => keyMatchesTokens(q.queryKey, tokens),
      });
    };

    const invalidateAll = () => {
      const allTokens = Object.values(TABLE_TO_TOKENS).flat();
      queryClient.invalidateQueries({
        predicate: (q) => keyMatchesTokens(q.queryKey, allTokens),
      });
    };

    const tables = Object.keys(TABLE_TO_TOKENS);
    const channel = supabase.channel(`global-sync-${userId}`);

    for (const table of tables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => invalidateForTable(table),
      );
    }

    let pollInterval: ReturnType<typeof setInterval> | undefined;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        if (!pollInterval) pollInterval = setInterval(invalidateAll, 30000);
      } else if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = undefined;
      }
    });

    window.addEventListener('focus', invalidateAll);
    window.addEventListener('online', invalidateAll);

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('focus', invalidateAll);
      window.removeEventListener('online', invalidateAll);
    };
  }, [userId, queryClient]);
}
