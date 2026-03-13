import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA with auto-update
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

// Periodically check for SW updates (important when installed as PWA)
if ('serviceWorker' in navigator) {
  setInterval(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
    }
  }, 60 * 1000);
}
