import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById("root")!).render(<App />);

// Skip SW in iframe / preview hosts to avoid breaking the editor preview
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
