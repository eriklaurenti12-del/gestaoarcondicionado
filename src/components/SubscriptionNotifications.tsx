import React, { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

const brazilianNames = [
  "João Silva", "Maria Santos", "Pedro Oliveira", "Ana Costa", "Carlos Souza",
  "Juliana Lima", "Lucas Pereira", "Fernanda Alves", "Rafael Gomes", "Amanda Ribeiro",
  "Thiago Martins", "Camila Ferreira", "Bruno Rodrigues", "Letícia Barbosa", "Gustavo Carvalho",
  "Larissa Nascimento", "Felipe Araújo", "Beatriz Monteiro", "Diego Cardoso", "Isabela Rocha",
  "Eduardo Pinto", "Mariana Correia", "Matheus Vieira", "Gabriela Fernandes", "Rodrigo Mendes",
  "Patricia Nunes", "Leandro Castro", "Renata Dias", "Marcelo Ramos", "Aline Teixeira",
  "André Moreira", "Vanessa Lopes", "Henrique Cruz", "Carolina Melo", "Alexandre Freitas",
  "Priscila Cavalcanti", "Vinícius Azevedo", "Débora Soares", "Fabio Campos", "Tatiana Moura",
  "Ricardo Barros", "Cristiane Reis", "Sérgio Cunha", "Luciana Pires", "Daniel Borges"
];

const cities = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Salvador", "Curitiba",
  "Fortaleza", "Brasília", "Recife", "Porto Alegre", "Manaus",
  "Goiânia", "Belém", "Guarulhos", "Campinas", "São Luís",
  "São Gonçalo", "Maceió", "Duque de Caxias", "Campo Grande", "Natal"
];

const plans = [
  { name: "Plano Mensal", price: "R$ 39,90" },
  { name: "Plano Anual", price: "R$ 370" }
];

type Notification = {
  id: number;
  name: string;
  city: string;
  plan: typeof plans[0];
  visible: boolean;
};

export const SubscriptionNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationId, setNotificationId] = useState(0);

  const createNotification = () => {
    const name = brazilianNames[Math.floor(Math.random() * brazilianNames.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    // 70% chance for annual plan (to encourage it)
    const plan = Math.random() > 0.3 ? plans[1] : plans[0];

    const newNotification: Notification = {
      id: notificationId,
      name,
      city,
      plan,
      visible: true
    };

    setNotificationId(prev => prev + 1);
    setNotifications(prev => [...prev.slice(-1), newNotification]);

    // Remove notification after 8 seconds
    setTimeout(() => {
      setNotifications(prev => 
        prev.map(n => n.id === newNotification.id ? { ...n, visible: false } : n)
      );
    }, 8000);
  };

  useEffect(() => {
    // Initial notification after 4 seconds
    const initialTimeout = setTimeout(createNotification, 4000);

    // Then every 8 seconds
    const interval = setInterval(createNotification, 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const dismissNotification = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, visible: false } : n)
    );
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2 max-w-sm">
      {notifications.filter(n => n.visible).map((notification) => (
        <div
          key={notification.id}
          className="bg-gradient-to-r from-green-900/95 to-emerald-900/95 backdrop-blur-lg border border-green-500/40 rounded-xl p-4 shadow-2xl shadow-green-500/20"
          style={{
            animation: 'slideInLeft 0.8s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-500/20 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {notification.name}
              </p>
              <p className="text-xs text-green-300/90 mt-0.5">
                de {notification.city} acabou de assinar
              </p>
              <p className="text-sm font-bold text-green-400 mt-1.5">
                ✓ {notification.plan.name} - {notification.plan.price}
              </p>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="text-green-400/60 hover:text-green-300 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInLeft {
          0% {
            transform: translateX(-120%);
            opacity: 0;
          }
          60% {
            transform: translateX(5%);
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SubscriptionNotifications;
