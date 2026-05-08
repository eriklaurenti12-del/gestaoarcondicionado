import { useEffect } from "react";
import { supabase, getSafeUser } from "@/integrations/supabase/client";
import { forceUpdateApp } from "@/lib/updateApp";
import { toast } from "sonner";

/**
 * Component that listens for force update signals from the database.
 * CRITICAL: All operations wrapped in try-catch to NEVER crash the app.
 */
export const ForceUpdateListener = () => {
  useEffect(() => {
    let mounted = true;

    const handleUpdateSignal = (timestamp: string, isGlobal: boolean) => {
      try {
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

          setTimeout(() => {
            if (mounted) forceUpdateApp();
          }, 2000);
        }
      } catch (e) {
        console.warn('[ForceUpdate] Error handling signal:', e);
      }
    };

    // 1. Initial check on mount - ALL wrapped in try-catch
    const checkInitialSignals = async () => {
      try {
        const { user, error } = await getSafeUser();
        if (error || !user) return;

        // Check global signal
        const { data: globalData } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'force_update_all_at')
          .maybeSingle();

        const globalLast = localStorage.getItem('last_global_force_update');
        if (globalData?.value) {
          if (!globalLast) {
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
      } catch (e) {
        // NEVER crash the app - just log the error silently
        console.warn('[ForceUpdate] Initial check failed (safe):', e);
      }
    };

    checkInitialSignals();

    // 2. Realtime subscription - also wrapped in try-catch
    let channel: any = null;
    try {
      channel = supabase
        .channel('system_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'admin_settings',
          },
          async (payload: any) => {
            try {
              const { new: newRecord } = payload;
              if (!newRecord || !newRecord.key || !newRecord.value) return;

              if (newRecord.key === 'force_update_all_at') {
                handleUpdateSignal(newRecord.value, true);
              } else {
                const { user, error } = await getSafeUser();
                if (error || !user) return;
                if (newRecord.key === `force_update_user:${user.id}`) {
                  handleUpdateSignal(newRecord.value, false);
                }
              }
            } catch (e) {
              console.warn('[ForceUpdate] Realtime handler error (safe):', e);
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[ForceUpdate] Channel subscription failed (safe):', e);
    }

    return () => {
      mounted = false;
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, []);

  return null;
};
