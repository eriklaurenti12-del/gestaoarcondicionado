import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Fuel } from "lucide-react";
import FinanceiroTab from './FinanceiroTab';
import FixedExpensesTab from './FixedExpensesTab';

const FinanceiroUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("financeiro");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="gastos" className="flex items-center gap-2">
            <Fuel className="w-4 h-4" />
            <span className="hidden sm:inline">Gastos Fixos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4">
          <FinanceiroTab />
        </TabsContent>

        <TabsContent value="gastos" className="mt-4">
          <FixedExpensesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceiroUnifiedTab;
