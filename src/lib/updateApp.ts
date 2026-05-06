import { toast } from "sonner";

/**
 * Aggressively clears all caches, unregisters service workers, 
 * and reloads the application to ensure the latest version from GitHub/Lovable.
 */
export const forceUpdateApp = async () => {
  toast.loading('🔍 Limpando cache e forçando atualização...', { id: 'app-update' });

  try {
    // 1. Try to fetch version.json with aggressive cache busting
    await fetch(`/?v=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    }).catch(() => null);

    await fetch(`/version.json?v=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    }).catch(() => null);

    // 2. Clear all browser Caches (CacheStorage)
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.log('Caches cleared');
      } catch (e) { console.error('Cache clear error:', e); }
    }

    // 3. Clear storage selectively (prevent loops and preserve critical user state)
    try {
      const keysToKeep = [
        'sb-access-token', 
        'sb-refresh-token', 
        'current_user_id', 
        'pwa-installed', 
        'theme',
        'last_global_force_update',
        'last_user_force_update',
        'app_version'
      ];
      
      const prefixesToKeep = [
        'sb-', 
        'ac_onboarding_completed_',
        'push_notif_'
      ];

      Object.keys(localStorage).forEach(key => {
        const shouldKeep = keysToKeep.includes(key) || 
                          prefixesToKeep.some(prefix => key.startsWith(prefix));
        
        if (!shouldKeep) {
           localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      console.log('Storage cleared selectively');
    } catch (e) { console.error('Storage clear error:', e); }

    // 4. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update().catch(() => undefined);
          await reg.unregister();
        }
        console.log('Service Workers unregistered');
      } catch (e) { console.error('SW unregister error:', e); }
    }

    toast.success('✅ Sistema pronto! Recarregando...', { id: 'app-update' });

    // 5. Hard reload with multiple cache-busting query params
    setTimeout(() => {
      const url = new URL(window.location.origin);
      url.searchParams.set('v', Date.now().toString());
      url.searchParams.set('force', '1');
      url.searchParams.set('t', Date.now().toString());
      window.location.replace(url.toString());
    }, 1000);
    
  } catch (err) {
    console.error('forceUpdateApp error:', err);
    toast.error('Erro na limpeza, recarregando...', { id: 'app-update' });
    setTimeout(() => window.location.reload(), 1000);
  }
};
