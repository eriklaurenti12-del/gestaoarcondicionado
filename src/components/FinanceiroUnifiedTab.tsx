import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, Wallet, Fuel, Activity } from "lucide-react";
import ChartsMetrics from './ChartsMetrics';
import FinanceiroReportsTab from './FinanceiroReportsTab';
import FinanceiroTab from './FinanceiroTab';
import FixedExpensesTab from './FixedExpensesTab';
import FinanceiroReconciliationTab from './FinanceiroReconciliationTab';
import TabGuideCards from './TabGuideCards';
import { useFinanceLegendHidden } from '@/hooks/useFinanceLegendHidden';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("controle");
  const [hideLegend] = useFinanceLegendHidden();

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
    {
      icon: Fuel,
      title: 'Gastos de Rota',
      badge: 'Despesas',
      badgeColor: 'amber',
      description: <>Controle <strong>combustível, alimentação e ajudantes</strong> por prestador e por mês.</>,
      onClick: () => setActiveSubTab('gastos-rota'),
      isActive: activeSubTab === 'gastos-rota',
    },
    {
      icon: Activity,
      title: 'Conciliação',
      badge: 'Auditoria',
      badgeColor: 'red',
      description: <>Detecta <strong>duplicatas, vendas órfãs e divergências</strong> entre PDV e financeiro.</>,
      onClick: () => setActiveSubTab('conciliacao'),
      isActive: activeSubTab === 'conciliacao',
    },
  ];

  return (
    <div className="space-y-4">
      {!hideLegend && <TabGuideCards cards={guideCards} columns={4} />}

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
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
          <TabsTrigger value="gastos-rota" className="flex items-center gap-1 px-2 text-xs sm:text-sm">
            <Fuel className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Gastos</span>
          </TabsTrigger>
          <TabsTrigger value="conciliacao" className="flex items-center gap-1 px-2 text-xs sm:text-sm">
            <Activity className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Conciliar</span>
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

        <TabsContent value="gastos-rota" className="mt-4">
          <FixedExpensesTab />
        </TabsContent>

        <TabsContent value="conciliacao" className="mt-4">
          <FinanceiroReconciliationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroUnifiedTab;
