import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Aggressively clears all caches, unregisters service workers,
 * and reloads the application to ensure the latest version.
 *
 * IMPORTANT: stamps the DB-backed update markers so ForceUpdateListener
 * does NOT re-trigger an infinite update loop after the reload.
 */
export const forceUpdateApp = async () => {
  // Guard: if we already ran a force update in the last 30 seconds, skip.
  const lastRunStr = localStorage.getItem('app_last_force_update_at');
  if (lastRunStr) {
    const elapsed = Date.now() - parseInt(lastRunStr, 10);
    if (elapsed < 30_000) {
      console.warn('[forceUpdateApp] Skipped — already ran ' + elapsed + 'ms ago');
      toast.info('Sistema já foi sincronizado recentemente.');
      return;
    }
  }
  localStorage.setItem('app_last_force_update_at', Date.now().toString());

  toast.loading('🔍 Limpando cache e forçando atualização...', { id: 'app-update' });

  try {
    // 0. Stamp update markers BEFORE reload so realtime listener won't re-trigger.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: globalRow }, { data: userRow }] = await Promise.all([
        supabase.from('admin_settings').select('value').eq('key', 'force_update_all_at').maybeSingle(),
        user
          ? supabase.from('admin_settings').select('value').eq('key', `force_update_user:${user.id}`).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      const nowIso = new Date().toISOString();
      localStorage.setItem('last_global_force_update', globalRow?.value || nowIso);
      localStorage.setItem('last_user_force_update', userRow?.value || nowIso);
    } catch (e) {
      const nowIso = new Date().toISOString();
      localStorage.setItem('last_global_force_update', nowIso);
      localStorage.setItem('last_user_force_update', nowIso);
    }

    // 1. Cache-bust ping
    await fetch(`/version.json?v=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    }).catch(() => null);

    // 2. Clear CacheStorage
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) { console.error('Cache clear error:', e); }
    }

    // 3. Clear storage selectively
    try {
      const keysToKeep = [
        'sb-access-token',
        'sb-refresh-token',
        'current_user_id',
        'pwa-installed',
        'theme',
        'last_global_force_update',
        'last_user_force_update',
        'app_last_force_update_at',
        'app_version',
      ];
      const prefixesToKeep = ['sb-', 'ac_onboarding_completed_', 'push_notif_'];

      Object.keys(localStorage).forEach(key => {
        const shouldKeep = keysToKeep.includes(key) || prefixesToKeep.some(p => key.startsWith(p));
        if (!shouldKeep) localStorage.removeItem(key);
      });
      sessionStorage.clear();
    } catch (e) { console.error('Storage clear error:', e); }

    // 4. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update().catch(() => undefined);
          await reg.unregister();
        }
      } catch (e) { console.error('SW unregister error:', e); }
    }

    toast.success('✅ Sistema pronto! Recarregando...', { id: 'app-update' });

    // 5. Reload preserving current path
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.replace(url.toString());
    }, 800);
  } catch (err) {
    console.error('forceUpdateApp error:', err);
    toast.error('Erro na limpeza, recarregando...', { id: 'app-update' });
    setTimeout(() => window.location.reload(), 1000);
  }
};
