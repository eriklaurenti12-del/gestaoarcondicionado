import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, Wallet } from "lucide-react";
import ChartsMetrics from './ChartsMetrics';
import FinanceiroReportsTab from './FinanceiroReportsTab';
import FinanceiroTab from './FinanceiroTab';
import TabGuideCards from './TabGuideCards';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("controle");

  const guideCards = [
    {
      icon: Wallet,
      title: 'Controle',
      badge: 'Gestão',
      badgeColor: 'purple',
      description: <>Gerencie <strong>entradas, saques e reservas</strong>. Controle manual do seu caixa.</>,
      onClick: () => setActiveSubTab('controle'),
      isActive: activeSubTab === 'controle',
    },
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
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="controle" className="flex items-center gap-1 px-2 text-xs sm:text-sm">
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Controle</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-1 px-2 text-xs sm:text-sm">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="graficos" className="flex items-center gap-1 px-2 text-xs sm:text-sm">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Gráficos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controle" className="mt-4">
          <FinanceiroTab />
        </TabsContent>

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
