import { toast } from "sonner";

/**
 * NUCLEAR force update — clears absolutely everything:
 * - All CacheStorage entries (PWA precache, runtime cache, workbox)
 * - All Service Workers (unregister + force skip waiting)
 * - SessionStorage
 * - LocalStorage (except auth tokens)
 * - IndexedDB databases
 * - Then does a hard reload bypassing all caches
 */
export const forceUpdateApp = async () => {
  toast.loading('🔥 Limpando TODO o cache do sistema...', { id: 'nuclear-update' });

  try {
    // 1. DESTROY all CacheStorage (workbox, precache, runtime, etc.)
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        console.log('[NUCLEAR] Deleting caches:', keys);
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) { console.error('[NUCLEAR] Cache clear error:', e); }
    }

    // 2. KILL all Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('[NUCLEAR] Unregistering', registrations.length, 'service workers');
        for (const reg of registrations) {
          // Try to skip waiting on the SW
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await reg.unregister();
        }
      } catch (e) { console.error('[NUCLEAR] SW error:', e); }
    }

    // 3. CLEAR sessionStorage completely
    try { sessionStorage.clear(); } catch (e) { /* noop */ }

    // 4. CLEAR localStorage — keep ONLY the absolute minimum for auth
    try {
      const authKeysToKeep: string[] = [];
      // Find and preserve only Supabase auth keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          authKeysToKeep.push(key);
        }
      }
      const authBackup: Record<string, string> = {};
      authKeysToKeep.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) authBackup[key] = val;
      });

      // Nuke everything
      localStorage.clear();

      // Restore only auth
      Object.entries(authBackup).forEach(([key, val]) => {
        localStorage.setItem(key, val);
      });

      // Mark that we just did a nuclear update
      localStorage.setItem('nuclear_update_at', Date.now().toString());
    } catch (e) { console.error('[NUCLEAR] localStorage error:', e); }

    // 5. DELETE IndexedDB databases (workbox stores, etc.)
    try {
      if ('indexedDB' in window) {
        const dbs = await (indexedDB as any).databases?.();
        if (dbs) {
          for (const db of dbs) {
            if (db.name) {
              console.log('[NUCLEAR] Deleting IndexedDB:', db.name);
              indexedDB.deleteDatabase(db.name);
            }
          }
        }
        // Also try known workbox DB names
        ['workbox-expiration', 'workbox-precache-v2'].forEach(name => {
          try { indexedDB.deleteDatabase(name); } catch { /* noop */ }
        });
      }
    } catch (e) { console.error('[NUCLEAR] IndexedDB error:', e); }

    // 6. Cache-bust fetch to force CDN/edge refresh
    try {
      await fetch(`/index.html?cache_bust=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch { /* noop */ }

    toast.success('✅ Cache TOTALMENTE limpo! Recarregando...', { id: 'nuclear-update' });

    // 7. HARD RELOAD — use location.href with cache buster to bypass everything
    setTimeout(() => {
      // Navigate to clean URL with cache buster
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.href = cleanUrl + '?v=' + Date.now();
    }, 500);

  } catch (err) {
    console.error('[NUCLEAR] Fatal error:', err);
    toast.error('Erro na limpeza, forçando reload...', { id: 'nuclear-update' });
    // Even on error, force a hard reload
    setTimeout(() => {
      window.location.href = window.location.origin + '?v=' + Date.now();
    }, 300);
  }
};
