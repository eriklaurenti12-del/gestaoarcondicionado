import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, ShoppingCart, CreditCard } from "lucide-react";
import PDVTab from './PDVTab';
import SalesTab from './SalesTab';
import InstallmentsTab from './InstallmentsTab';

const PDVUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("pdv");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="pdv" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">PDV</span>
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Parcelas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdv" className="mt-4">
          <PDVTab />
        </TabsContent>

        <TabsContent value="vendas" className="mt-4">
          <SalesTab />
        </TabsContent>

        <TabsContent value="parcelas" className="mt-4">
          <InstallmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PDVUnifiedTab;
