import React, { useState, useEffect } from 'react';
import { X, Bell, Lightbulb, TrendingUp, Calendar, Shield, Zap, Heart, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
}

const notifications: Notification[] = [
  {
    id: 1,
    icon: <Lightbulb className="w-5 h-5" />,
    title: "Dica do dia",
    message: "Agende manutenções preventivas para fidelizar clientes!",
    color: "from-amber-500 to-orange-500"
  },
  {
    id: 2,
    icon: <TrendingUp className="w-5 h-5" />,
    title: "Performance",
    message: "Suas vendas podem aumentar 30% com orçamentos detalhados.",
    color: "from-emerald-500 to-green-500"
  },
  {
    id: 3,
    icon: <Calendar className="w-5 h-5" />,
    title: "Lembrete",
    message: "Verifique os agendamentos do dia para evitar atrasos.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: 4,
    icon: <Shield className="w-5 h-5" />,
    title: "Segurança",
    message: "Seus dados estão protegidos com criptografia avançada.",
    color: "from-violet-500 to-purple-500"
  },
  {
    id: 5,
    icon: <Zap className="w-5 h-5" />,
    title: "Novidade",
    message: "Use o PDV para registrar vendas rapidamente!",
    color: "from-yellow-500 to-amber-500"
  },
  {
    id: 6,
    icon: <Heart className="w-5 h-5" />,
    title: "Cliente feliz",
    message: "Envie orçamentos por WhatsApp e aumente conversões.",
    color: "from-pink-500 to-rose-500"
  },
  {
    id: 7,
    icon: <Star className="w-5 h-5" />,
    title: "Destaque",
    message: "Exporte relatórios em PDF para seus clientes.",
    color: "from-indigo-500 to-blue-500"
  },
  {
    id: 8,
    icon: <Bell className="w-5 h-5" />,
    title: "Atenção",
    message: "Acompanhe parcelas vencidas na aba Financeiro.",
    color: "from-red-500 to-orange-500"
  }
];

const RotatingNotifications: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Shuffle notifications on mount
    const shuffled = [...notifications].sort(() => Math.random() - 0.5);
    
    const showNext = () => {
      setIsExiting(true);
      
      setTimeout(() => {
        setIsVisible(false);
        
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % shuffled.length);
          setIsExiting(false);
          setIsVisible(true);
        }, 500);
      }, 300);
    };

    const interval = setInterval(showNext, 6000); // Change every 6 seconds

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % notifications.length);
        setIsExiting(false);
        setIsVisible(true);
      }, 500);
    }, 300);
  };

  const currentNotification = notifications[currentIndex];

  if (!isVisible && !isExiting) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm transition-all duration-300 ease-in-out",
        isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0",
        !isVisible && "hidden"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-lg shadow-lg border border-border/50",
          "bg-gradient-to-r",
          currentNotification.color
        )}
      >
        <div className="absolute inset-0 bg-black/20" />
        
        <div className="relative p-4">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3 pr-6">
            <div className="p-2 rounded-full bg-white/20 text-white">
              {currentNotification.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white text-sm">
                {currentNotification.title}
              </h4>
              <p className="text-white/90 text-sm mt-1">
                {currentNotification.message}
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-white/60 animate-progress"
              style={{ animationDuration: '6s' }}
            />
          </div>
        </div>
      </div>
      
      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {notifications.map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              index === currentIndex
                ? "bg-primary w-3"
                : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default RotatingNotifications;
