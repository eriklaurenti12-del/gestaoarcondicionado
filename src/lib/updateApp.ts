import { toast } from "sonner";

/**
 * Aggressively clears all caches, unregisters service workers, 
 * and reloads the application to ensure the latest version from GitHub/Lovable.
 */
export const forceUpdateApp = async () => {
  toast.loading('🔍 Limpando cache e forçando atualização...', { id: 'app-update' });

  try {
    // 1. Try to fetch version.json to break server cache if possible
    await fetch(`/version.json?refresh=${Date.now()}`, {
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

    // 3. Clear storage (except critical auth/session keys if needed, but here we wipe non-critical)
    try {
      const keysToKeep = ['sb-access-token', 'sb-refresh-token', 'current_user_id', 'pwa-installed', 'theme'];
      Object.keys(localStorage).forEach(key => {
        if (!key.startsWith('sb-') && !keysToKeep.includes(key)) {
           localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      console.log('Storage cleared');
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

    // 5. Hard reload with a cache-busting query param
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('force_refresh', Date.now().toString());
      window.location.replace(url.toString());
    }, 1000);
    
  } catch (err) {
    console.error('forceUpdateApp error:', err);
    toast.error('Erro na limpeza, recarregando...', { id: 'app-update' });
    setTimeout(() => window.location.reload(), 1000);
  }
};
