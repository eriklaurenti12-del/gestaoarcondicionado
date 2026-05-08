import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { forceUpdateApp } from "@/lib/updateApp";
import { toast } from "sonner";

/**
 * Component that listens for force update signals from the database.
 * This ensures that when a Super Admin triggers an update, all active users 
 * get their cache cleared and app reloaded automatically.
 */
export const ForceUpdateListener = () => {
  useEffect(() => {
    let mounted = true;

    const handleUpdateSignal = (timestamp: string, isGlobal: boolean) => {
      const storageKey = isGlobal ? 'last_global_force_update' : 'last_user_force_update';
      const lastUpdate = localStorage.getItem(storageKey);

      if (!lastUpdate || new Date(timestamp) > new Date(lastUpdate)) {
        localStorage.setItem(storageKey, timestamp);
        console.log(`[ForceUpdate] Received ${isGlobal ? 'global' : 'individual'} update signal: ${timestamp}`);
        
        toast.info(
          isGlobal 
            ? "🚀 Uma nova versão do sistema foi publicada! Atualizando..." 
            : "🔄 O administrador solicitou uma sincronização do seu sistema.",
          { duration: 5000 }
        );

        // Wait a bit for the toast to be seen, then force update
        setTimeout(() => {
          if (mounted) forceUpdateApp();
        }, 2000);
      }
    };

    // 1. Initial check on mount
    const checkInitialSignals = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      // Check global signal
      const { data: globalData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'force_update_all_at')
        .maybeSingle();

      const globalLast = localStorage.getItem('last_global_force_update');
      if (globalData?.value) {
        if (!globalLast) {
          // First time we see this signal — record it WITHOUT triggering an update.
          localStorage.setItem('last_global_force_update', globalData.value);
        } else {
          handleUpdateSignal(globalData.value, true);
        }
      }

      // Check individual signal
      const { data: userData } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', `force_update_user:${user.id}`)
        .maybeSingle();

      const userLast = localStorage.getItem('last_user_force_update');
      if (userData?.value) {
        if (!userLast) {
          localStorage.setItem('last_user_force_update', userData.value);
        } else {
          handleUpdateSignal(userData.value, false);
        }
      }
    };

    checkInitialSignals();

    // 2. Realtime subscription
    const channel = supabase
      .channel('system_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings',
        },
        async (payload: any) => {
          const { new: newRecord } = payload;
          if (!newRecord || !newRecord.key || !newRecord.value) return;

          if (newRecord.key === 'force_update_all_at') {
            handleUpdateSignal(newRecord.value, true);
          } else {
            const { data } = await supabase.auth.getUser();
            const user = data?.user;
            if (user && newRecord.key === `force_update_user:${user.id}`) {
              handleUpdateSignal(newRecord.value, false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return null; // This component doesn't render anything
};
