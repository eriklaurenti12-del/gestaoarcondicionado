import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

declare const __APP_BUILD_ID__: string;

// ============================================================
// AUTO-CLEANUP: On every load, check if the build has changed.
// If it has, nuke all caches and service workers BEFORE React mounts
// so the user always sees the latest version.
// ============================================================
(function autoClearStaleCache() {
  try {
    const currentBuild = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : null;
    const storedBuild = localStorage.getItem('app_build_id');

    if (currentBuild && storedBuild && currentBuild !== storedBuild) {
      console.log('[AUTO-CLEAR] Build changed:', storedBuild, '->', currentBuild);

      // Clear CacheStorage
      if ('caches' in window) {
        caches.keys().then(keys => {
          keys.forEach(k => caches.delete(k));
          console.log('[AUTO-CLEAR] Deleted', keys.length, 'cache entries');
        });
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
          console.log('[AUTO-CLEAR] Unregistered', regs.length, 'service workers');
        });
      }

      // Clear sessionStorage
      sessionStorage.clear();
    }

    // Always store current build
    if (currentBuild) {
      localStorage.setItem('app_build_id', currentBuild);
    }
  } catch (e) {
    console.warn('[AUTO-CLEAR] Error:', e);
  }
})();

// ============================================================
// Mount React
// ============================================================
createRoot(document.getElementById("root")!).render(<App />);

// ============================================================
// PWA Registration — skip in iframe/preview hosts
// ============================================================
const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');

if (!isInIframe && !isPreviewHost) {
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = '/manifest.json';
  document.head.appendChild(manifestLink);

  // Register SW in PROMPT mode: shows banner so user can apply update
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('pwa:need-refresh', { detail: { updateSW } }));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
    },
  });

  // Poll registered SW every 60s for updates (works when installed as PWA)
  if ('serviceWorker' in navigator) {
    setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch { /* noop */ }
    }, 60 * 1000);
  }

  // Allow any UI button to force a fresh update check
  window.addEventListener('pwa:check-update', async () => {
    try { await updateSW(false); } catch { /* noop */ }
  });
} else {
  // Unregister any leftover SW inside iframe/preview to avoid stale shells
  navigator.serviceWorker?.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
}
