import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Snowflake, Building2, Package } from "lucide-react";
import ClientsTab from './ClientsTab';
import ProductsTab from './ProductsTab';
import SuppliersTab from './SuppliersTab';
import EstoqueTab from './EstoqueTab';

const CadastrosUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("clients");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="clients" className="flex items-center gap-1 px-2">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-1 px-2">
            <Snowflake className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Serviços AC</span>
          </TabsTrigger>
          <TabsTrigger value="estoque" className="flex items-center gap-1 px-2">
            <Package className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Estoque</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-1 px-2">
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Fornecedores</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="mt-4">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <ProductsTab />
        </TabsContent>

        <TabsContent value="estoque" className="mt-4">
          <EstoqueTab />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CadastrosUnifiedTab;
