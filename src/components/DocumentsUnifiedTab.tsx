import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Briefcase } from "lucide-react";
import QuotesTab from './QuotesTab';
import ServiceOrdersTab from './ServiceOrdersTab';

const DocumentsUnifiedTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState("quotes");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Orçamentos</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span className="hidden sm:inline">Ordens de Serviço</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <QuotesTab />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <ServiceOrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentsUnifiedTab;
