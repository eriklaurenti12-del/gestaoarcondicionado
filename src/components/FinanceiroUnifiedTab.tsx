import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, CreditCard, TrendingUp } from "lucide-react";
import FinanceiroTab from './FinanceiroTab';
import FixedExpensesTab from './FixedExpensesTab';
import InstallmentsTab from './InstallmentsTab';
import ChartsMetrics from './ChartsMetrics';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("financeiro");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Receitas</span>
          </TabsTrigger>
          <TabsTrigger value="gastos" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Despesas</span>
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Parcelas</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4">
          <FinanceiroTab />
        </TabsContent>

        <TabsContent value="gastos" className="mt-4">
          <FixedExpensesTab />
        </TabsContent>

        <TabsContent value="parcelas" className="mt-4">
          <InstallmentsTab />
        </TabsContent>

        <TabsContent value="relatorios" className="mt-4">
          <ChartsMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroUnifiedTab;
