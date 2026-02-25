import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, X, TrendingUp, RefreshCw, Star } from 'lucide-react';

const brazilianNames = [
  "João Silva", "Maria Santos", "Pedro Oliveira", "Ana Costa", "Carlos Souza",
  "Juliana Lima", "Lucas Pereira", "Fernanda Alves", "Rafael Gomes", "Amanda Ribeiro",
  "Thiago Martins", "Camila Ferreira", "Bruno Rodrigues", "Letícia Barbosa", "Gustavo Carvalho",
  "Larissa Nascimento", "Felipe Araújo", "Beatriz Monteiro", "Diego Cardoso", "Isabela Rocha",
  "Eduardo Pinto", "Mariana Correia", "Matheus Vieira", "Gabriela Fernandes", "Rodrigo Mendes",
  "Patricia Nunes", "Leandro Castro", "Renata Dias", "Marcelo Ramos", "Aline Teixeira",
  "André Moreira", "Vanessa Lopes", "Henrique Cruz", "Carolina Melo", "Alexandre Freitas",
  "Priscila Cavalcanti", "Vinícius Azevedo", "Débora Soares", "Fabio Campos", "Tatiana Moura",
  "Ricardo Barros", "Cristiane Reis", "Sérgio Cunha", "Luciana Pires", "Daniel Borges",
  "José Pereira", "Antônio Gomes", "Francisco Costa", "Paulo Santos", "Marcos Oliveira",
  "Luiz Ferreira", "Adriana Silva", "Sandra Lima", "Claudia Mendes", "Simone Rocha",
  "Márcio Teixeira", "Wagner Almeida", "Rogério Dias", "Eliane Souza", "Vera Campos"
];

const cities = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Salvador", "Curitiba",
  "Fortaleza", "Brasília", "Recife", "Porto Alegre", "Manaus",
  "Goiânia", "Belém", "Guarulhos", "Campinas", "São Luís",
  "São Gonçalo", "Maceió", "Duque de Caxias", "Campo Grande", "Natal",
  "Teresina", "João Pessoa", "Aracaju", "Cuiabá", "Florianópolis",
  "Joinville", "Londrina", "Niterói", "Santos", "Uberlândia",
  "Ribeirão Preto", "Sorocaba", "Feira de Santana", "Vitória", "Serra",
  "Juiz de Fora", "Contagem", "Osasco", "Piracicaba", "Bauru",
  "Carapicuíba", "Jundiaí", "São José dos Campos", "Santo André", "Diadema",
  "Montes Claros", "Petrolina", "Franca", "Araraquara", "Marília"
];

const plans = [
  { name: "Plano Mensal", price: "R$ 39,90", isAnnual: false },
  { name: "Plano Anual", price: "R$ 370", isAnnual: true }
];

const actionTypes = [
  { action: "acabou de assinar", icon: CheckCircle, color: "text-green-400" },
  { action: "acabou de renovar", icon: RefreshCw, color: "text-blue-400" },
  { action: "fez upgrade para anual", icon: TrendingUp, color: "text-amber-400" },
  { action: "ativou sua conta", icon: Star, color: "text-purple-400" }
];

type Notification = {
  id: number;
  name: string;
  city: string;
  plan: typeof plans[0];
  actionType: typeof actionTypes[0];
  visible: boolean;
};

// Simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Silently fail if audio not supported
  }
};

export const SubscriptionNotifications: React.FC<{ interval?: number; soundEnabled?: boolean }> = ({ interval = 10000, soundEnabled = true }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);
  const hasInteracted = useRef(false);

  // Track user interaction for audio
  useEffect(() => {
    const handleInteraction = () => {
      hasInteracted.current = true;
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const createNotification = () => {
    const name = brazilianNames[Math.floor(Math.random() * brazilianNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    // Random action type with weighted distribution
    const random = Math.random();
    let actionType: typeof actionTypes[0];
    let plan: typeof plans[0];
    
    if (random < 0.4) {
      // 40% - new subscription
      actionType = actionTypes[0];
      plan = Math.random() > 0.3 ? plans[1] : plans[0];
    } else if (random < 0.65) {
      // 25% - renewal
      actionType = actionTypes[1];
      plan = Math.random() > 0.4 ? plans[1] : plans[0];
    } else if (random < 0.85) {
      // 20% - upgrade to annual
      actionType = actionTypes[2];
      plan = plans[1]; // Always annual for upgrade
    } else {
      // 15% - activated account
      actionType = actionTypes[3];
      plan = Math.random() > 0.3 ? plans[1] : plans[0];
    }

    const newNotification: Notification = {
      id: notificationId,
      name,
      city,
      plan,
      actionType,
      visible: true
    };

    setNotificationId(prev => prev + 1);
    setNotifications(prev => [...prev.slice(-1), newNotification]);

    // Play sound if user has interacted and sound is enabled
    if (hasInteracted.current && soundEnabled) {
      playNotificationSound();
    }

    // Remove notification after 10 seconds
    setTimeout(() => {
      setNotifications(prev => 
        prev.map(n => n.id === newNotification.id ? { ...n, visible: false } : n)
      );
    }, 10000);
  };

  useEffect(() => {
    // Initial notification after 5 seconds
    const initialTimeout = setTimeout(createNotification, 5000);

    // Then at configured interval
    const timer = setInterval(createNotification, interval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(timer);
    };
  }, [interval]);

  const dismissNotification = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, visible: false } : n)
    );
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-3 max-w-sm">
      {notifications.filter(n => n.visible).map((notification) => {
        const IconComponent = notification.actionType.icon;
        
        return (
          <div
            key={notification.id}
            className="bg-gradient-to-r from-slate-900/98 to-slate-800/98 backdrop-blur-xl border border-green-500/40 rounded-2xl p-4 shadow-2xl shadow-black/50"
            style={{
              animation: 'slideInLeft 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2.5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl ${notification.actionType.color}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">
                  {notification.name}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  de <span className="text-gray-300">{notification.city}</span>
                </p>
                <p className={`text-sm font-semibold mt-2 ${notification.actionType.color}`}>
                  {notification.actionType.action}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                    {notification.plan.name}
                  </span>
                  <span className="text-xs text-green-300 font-bold">
                    {notification.plan.price}
                  </span>
                </div>
              </div>
              <button
                onClick={() => dismissNotification(notification.id)}
                className="text-gray-500 hover:text-gray-300 transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slideInLeft {
          0% {
            transform: translateX(-150%) scale(0.8);
            opacity: 0;
          }
          50% {
            transform: translateX(8%) scale(1.02);
          }
          70% {
            transform: translateX(-3%) scale(1);
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SubscriptionNotifications;
