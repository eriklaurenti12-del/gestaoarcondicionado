import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, TrendingUp, BarChart3 } from "lucide-react";
import InstallmentsTab from './InstallmentsTab';
import ChartsMetrics from './ChartsMetrics';
import FinanceiroReportsTab from './FinanceiroReportsTab';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("parcelas");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="parcelas" className="flex items-center gap-1 px-2">
            <CreditCard className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Parcelas</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-1 px-2">
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="graficos" className="flex items-center gap-1 px-2">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Gráficos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parcelas" className="mt-4">
          <InstallmentsTab />
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
