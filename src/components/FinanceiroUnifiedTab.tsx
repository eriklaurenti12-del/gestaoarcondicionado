import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, FileText } from "lucide-react";
import ChartsMetrics from './ChartsMetrics';
import FinanceiroReportsTab from './FinanceiroReportsTab';
import TabGuideCards from './TabGuideCards';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("relatorios");

  const guideCards = [
    {
      icon: BarChart3,
      title: 'Relatórios',
      badge: 'Análise',
      badgeColor: 'blue',
      description: <>Visualize <strong>receitas, despesas e lucro</strong> mensal. Exporte PDF completo ou histórico PDV.</>,
      onClick: () => setActiveSubTab('relatorios'),
      isActive: activeSubTab === 'relatorios',
    },
    {
      icon: TrendingUp,
      title: 'Gráficos',
      badge: 'Visual',
      badgeColor: 'emerald',
      description: <>Acompanhe a <strong>evolução financeira</strong> com gráficos de vendas, serviços e despesas.</>,
      onClick: () => setActiveSubTab('graficos'),
      isActive: activeSubTab === 'graficos',
    },
  ];

  return (
    <div className="space-y-4">
      <TabGuideCards cards={guideCards} />

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-lg">
          <TabsTrigger value="relatorios" className="flex items-center gap-1 px-2">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="graficos" className="flex items-center gap-1 px-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Gráficos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="mt-4">
          <FinanceiroReportsTab />
        </TabsContent>

        <TabsContent value="graficos" className="mt-4">
          <ChartsMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroUnifiedTab;
