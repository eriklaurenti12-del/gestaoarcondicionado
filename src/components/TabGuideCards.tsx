import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

export interface GuideCard {
  icon: LucideIcon;
  title: string;
  badge: string;
  badgeColor: string; // e.g. "blue", "emerald", "amber", "cyan", "purple", "rose"
  description: React.ReactNode;
  value?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface TabGuideCardsProps {
  cards: GuideCard[];
  columns?: 2 | 3 | 4;
}

const colorMap: Record<string, { border: string; bg: string; text: string; badgeBorder: string; badgeText: string; activeBorder: string; activeBg: string }> = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-500', badgeBorder: 'border-blue-500/30', badgeText: 'text-blue-600', activeBorder: 'border-blue-500', activeBg: 'bg-blue-500/5' },
  emerald: { border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', badgeBorder: 'border-emerald-500/30', badgeText: 'text-emerald-600', activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-500/5' },
  amber: { border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-500', badgeBorder: 'border-amber-500/30', badgeText: 'text-amber-600', activeBorder: 'border-amber-500', activeBg: 'bg-amber-500/5' },
  cyan: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-500', badgeBorder: 'border-cyan-500/30', badgeText: 'text-cyan-600', activeBorder: 'border-cyan-500', activeBg: 'bg-cyan-500/5' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-500', badgeBorder: 'border-purple-500/30', badgeText: 'text-purple-600', activeBorder: 'border-purple-500', activeBg: 'bg-purple-500/5' },
  rose: { border: 'border-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-500', badgeBorder: 'border-rose-500/30', badgeText: 'text-rose-600', activeBorder: 'border-rose-500', activeBg: 'bg-rose-500/5' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500', badgeBorder: 'border-orange-500/30', badgeText: 'text-orange-600', activeBorder: 'border-orange-500', activeBg: 'bg-orange-500/5' },
  green: { border: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-500', badgeBorder: 'border-green-500/30', badgeText: 'text-green-600', activeBorder: 'border-green-500', activeBg: 'bg-green-500/5' },
};

const TabGuideCards: React.FC<TabGuideCardsProps> = ({ cards, columns = 2 }) => {
  const gridClass = columns === 3 ? 'md:grid-cols-3' : columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-2';

  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-3`}>
      {cards.map((card, idx) => {
        const colors = colorMap[card.badgeColor] || colorMap.blue;
        const Icon = card.icon;
        const isClickable = !!card.onClick;

        return (
          <Card
            key={idx}
            className={`border-2 transition-all ${isClickable ? 'cursor-pointer' : ''} ${
              card.isActive
                ? `${colors.activeBorder} ${colors.activeBg} shadow-lg`
                : `border-border ${isClickable ? `hover:${colors.border.replace('border-', 'border-').replace('500', '300')}` : ''}`
            }`}
            onClick={card.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{card.title}</h3>
                    <Badge variant="outline" className={`text-[10px] ${colors.badgeBorder} ${colors.badgeText}`}>
                      {card.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TabGuideCards;
