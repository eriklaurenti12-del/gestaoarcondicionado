import React, { useState, useEffect } from 'react';
import { Clock, Flame, Zap } from 'lucide-react';

interface PromoCountdownProps {
  endDate?: string;
}

export const PromoCountdown: React.FC<PromoCountdownProps> = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endDate) {
      // If no end date, use a fake countdown (24 hours from now but resets)
      const fakeEnd = new Date();
      fakeEnd.setHours(fakeEnd.getHours() + 24);
      calculateTimeLeft(fakeEnd.toISOString());
    } else {
      calculateTimeLeft(endDate);
    }

    const interval = setInterval(() => {
      if (!endDate) {
        const fakeEnd = new Date();
        fakeEnd.setHours(fakeEnd.getHours() + 24);
        calculateTimeLeft(fakeEnd.toISOString());
      } else {
        calculateTimeLeft(endDate);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  const calculateTimeLeft = (targetDate: string) => {
    const difference = new Date(targetDate).getTime() - new Date().getTime();

    if (difference <= 0) {
      setIsExpired(true);
      return;
    }

    setTimeLeft({
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    });
  };

  if (isExpired && endDate) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 text-white py-2 px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${i * 25}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: 0.2
            }}
          >
            <Flame className="w-6 h-6" />
          </div>
        ))}
      </div>

      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 relative z-10">
        <div className="flex items-center gap-2 animate-pulse">
          <Zap className="w-5 h-5" />
          <span className="font-bold text-sm sm:text-base">
            🔥 PROMOÇÃO POR TEMPO LIMITADO!
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <div className="flex gap-1 text-sm sm:text-base font-mono">
            <TimeUnit value={timeLeft.days} label="d" />
            <span className="text-white/70">:</span>
            <TimeUnit value={timeLeft.hours} label="h" />
            <span className="text-white/70">:</span>
            <TimeUnit value={timeLeft.minutes} label="m" />
            <span className="text-white/70">:</span>
            <TimeUnit value={timeLeft.seconds} label="s" />
          </div>
        </div>

        <span className="text-xs sm:text-sm font-medium bg-white/20 px-2 py-1 rounded-full">
          22% OFF Plano Anual
        </span>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

const TimeUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <span className="bg-black/30 px-2 py-0.5 rounded font-bold">
    {value.toString().padStart(2, '0')}{label}
  </span>
);

export default PromoCountdown;
