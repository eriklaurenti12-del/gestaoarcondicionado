import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 1. Initial debug log
console.log('[MAIN] Application entry point reached');

// 2. Immediate auto-cleanup for stale cache
try {
  const currentBuild = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
  const storedBuild = localStorage.getItem('app_build_id');

  if (currentBuild && storedBuild && currentBuild !== storedBuild) {
    console.log('[MAIN] Version change detected. Clearing session data...');
    sessionStorage.clear();
    // We keep localStorage for user settings, the ForceUpdateListener handles granular clearing
  }
  localStorage.setItem('app_build_id', currentBuild);
} catch (e) {
  console.warn('[MAIN] Cleanup check skipped:', e);
}

// 3. Mount the app with safety
const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log('[MAIN] Render successful');
  } catch (err) {
    console.error('[MAIN] Render crash:', err);
    rootElement.innerHTML = `
      <div style="min-h-screen; background:#0a1628; color:white; font-family:sans-serif; display:flex; align-items:center; justify-content:center; padding:20px; text-align:center;">
        <div style="max-width:400px; background:#0d1f3c; padding:30px; border-radius:20px; border:1px solid #1e3a8a; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          <div style="font-size:50px; margin-bottom:20px;">❄️</div>
          <h1 style="font-size:24px; margin-bottom:10px;">Erro de Inicialização</h1>
          <p style="color:#94a3b8; font-size:14px; margin-bottom:25px;">Ocorreu um erro ao carregar o sistema. Isso geralmente acontece devido a arquivos antigos no navegador.</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload();" 
            style="background:#2563eb; color:white; border:none; padding:12px 24px; border-radius:10px; font-weight:bold; cursor:pointer; width:100%; transition:all 0.2s;">
            LIMPAR E REPARAR SISTEMA
          </button>
          <p style="margin-top:15px; font-size:10px; color:#475569; font-family:monospace;">${err}</p>
        </div>
      </div>
    `;
  }
} else {
  console.error('[MAIN] Root element not found');
}

// 4. Safe PWA Registration (Doesn't block the UI)
if ('serviceWorker' in navigator && !window.location.hostname.includes('lovableproject.com')) {
  window.addEventListener('load', async () => {
    try {
      // Use dynamic import for virtual module to avoid blocking the main bundle parsing
      // @ts-ignore
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA] New version available');
        }
      });
    } catch (e) {
      console.log('[PWA] Registration skipped (Normal for dev):', e);
    }
  });
}
