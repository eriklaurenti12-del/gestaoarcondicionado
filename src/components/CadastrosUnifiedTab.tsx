import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Snowflake, Building2, Package, PlusCircle } from "lucide-react";
import ClientsTab from './ClientsTab';
import ProductsTab from './ProductsTab';
import SuppliersTab from './SuppliersTab';
import EstoqueTab from './EstoqueTab';
import RegisterProductTab from './RegisterProductTab';
import TabGuideCards from './TabGuideCards';

const CadastrosUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("clients");

  const guideCards = [
    {
      icon: Users,
      title: 'Clientes',
      badge: 'Essencial',
      badgeColor: 'blue',
      description: <>Cadastre seus clientes com <strong>nome, telefone e endereço</strong>. Necessário para agendar serviços e emitir orçamentos.</>,
      onClick: () => setActiveSubTab('clients'),
      isActive: activeSubTab === 'clients',
    },
    {
      icon: Snowflake,
      title: 'Catálogo',
      badge: 'Catálogo',
      badgeColor: 'cyan',
      description: <>Veja todos os <strong>serviços e produtos</strong> cadastrados. Edite preços, margens e informações.</>,
      onClick: () => setActiveSubTab('products'),
      isActive: activeSubTab === 'products',
    },
    {
      icon: PlusCircle,
      title: 'Cadastrar',
      badge: 'Novo',
      badgeColor: 'green',
      description: <>Cadastre novos <strong>serviços ou produtos</strong>. Serviços não vão para estoque, produtos sim.</>,
      onClick: () => setActiveSubTab('register'),
      isActive: activeSubTab === 'register',
    },
    {
      icon: Package,
      title: 'Estoque',
      badge: 'Controle',
      badgeColor: 'amber',
      description: <>Gerencie <strong>peças e materiais</strong> com estoque mínimo, localização e código de barras.</>,
      onClick: () => setActiveSubTab('estoque'),
      isActive: activeSubTab === 'estoque',
    },
  ];

  return (
    <div className="space-y-4">
      <TabGuideCards cards={guideCards} columns={4} />

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="clients" className="flex items-center gap-1 px-2">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-1 px-2">
            <Snowflake className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Catálogo</span>
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center gap-1 px-2">
            <PlusCircle className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline truncate">Cadastrar</span>
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

        <TabsContent value="register" className="mt-4">
          <RegisterProductTab />
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
