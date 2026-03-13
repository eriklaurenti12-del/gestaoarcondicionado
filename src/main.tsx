import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA with auto-update
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-reload when new version is available
    updateSW(true);
  },
  onRegistered(registration) {
    // Check for updates every 60 seconds (especially important when installed as PWA)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
    }
  },
});
