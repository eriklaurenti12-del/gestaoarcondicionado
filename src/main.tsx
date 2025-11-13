import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Solicitar permissão de notificação e mostrar mensagem de boas-vindas
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              new Notification('Bem-vindo ao Sistema!', {
                body: 'Gestão de Negócios instalado com sucesso! 🎉',
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png'
              });
            }
          });
        } else if (Notification.permission === 'granted') {
          new Notification('Bem-vindo de volta!', {
            body: 'Sistema de Gestão de Negócios pronto para uso.',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png'
          });
        }
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
