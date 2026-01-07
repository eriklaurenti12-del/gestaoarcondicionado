import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Snowflake, Building2 } from "lucide-react";
import ClientsTab from './ClientsTab';
import ProductsTab from './ProductsTab';
import SuppliersTab from './SuppliersTab';

const CadastrosUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("clients");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Snowflake className="w-4 h-4" />
            <span className="hidden sm:inline">Serviços AC</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Fornecedores</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <ProductsTab />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CadastrosUnifiedTab;
