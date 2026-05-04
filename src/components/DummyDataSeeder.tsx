import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Trash2, PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const DummyDataSeeder: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const seedData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // 1. Create Fake Clients
      const fakeClients = [
        { name: "Carlos Oliveira (TESTE)", telefone: "(11) 99999-0001", address: "Av. Paulista, 1000 - SP", user_id: userId },
        { name: "Ana Beatriz (TESTE)", telefone: "(11) 99999-0002", address: "Rua Augusta, 500 - SP", user_id: userId },
        { name: "Roberto Santos (TESTE)", telefone: "(21) 98888-0001", address: "Av. Atlântica, 200 - RJ", user_id: userId },
        { name: "Empresa de Molas ABC (TESTE)", telefone: "(11) 97777-0001", address: "Distrito Industrial - SP", is_company: true, user_id: userId },
      ];

      const { data: createdClients, error: clientErr } = await supabase.from('clients').insert(fakeClients).select();
      if (clientErr) throw clientErr;

      // 2. Create Fake Products/Services
      const fakeProducts = [
        { name: "Ar Split 12000 BTU (TESTE)", type: "produto", price: 2500, cost_price: 1800, stock: 10, user_id: userId, category: "Equipamentos" },
        { name: "Filtro de Ar (TESTE)", type: "produto", price: 45, cost_price: 15, stock: 50, user_id: userId, category: "Peças" },
        { name: "Limpeza Completa (TESTE)", type: "serviço", price: 250, cost_price: 50, user_id: userId, category: "Manutenção", warranty_months: 6 },
        { name: "Instalação Padrão (TESTE)", type: "serviço", price: 650, cost_price: 200, user_id: userId, category: "Instalação", warranty_months: 12 },
        { name: "Carga de Gás R410 (TESTE)", type: "serviço", price: 350, cost_price: 120, user_id: userId, category: "Reparo", warranty_months: 3 },
      ];

      const { data: createdProducts, error: productErr } = await supabase.from('products').insert(fakeProducts).select();
      if (productErr) throw productErr;

      // 3. Create Fake Appointments
      if (createdClients && createdProducts) {
        const services = createdProducts.filter(p => p.type === 'serviço');
        const now = new Date();
        
        const fakeAppts = createdClients.map((c, i) => {
          const apptDate = new Date(now);
          apptDate.setDate(now.getDate() + (i + 1));
          apptDate.setHours(8 + i, 0, 0, 0);
          
          return {
            client_id: c.id,
            service_id: services[i % services.length].id,
            appointment_date: apptDate.toISOString(),
            status: i % 2 === 0 ? 'agendado' : 'confirmado',
            notes: `[DUMMY] Agendamento de teste gerado para ${c.name}. [PRESTADOR:Erik Laurenti]`,
            user_id: userId
          };
        });

        const { error: apptErr } = await supabase.from('appointments').insert(fakeAppts);
        if (apptErr) throw apptErr;
      }

      toast.success("Dados de teste gerados! Verifique Agenda, Clientes e Catálogo.");
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro ao gerar dados: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const clearDummyData = async () => {
    if (!window.confirm("Isso apagará APENAS os dados marcados como (TESTE) ou [DUMMY]. Prosseguir?")) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      await supabase.from('appointments').delete().eq('user_id', userId).like('notes', '%[DUMMY]%');
      await supabase.from('products').delete().eq('user_id', userId).like('name', '%(TESTE)%');
      await supabase.from('clients').delete().eq('user_id', userId).like('name', '%(TESTE)%');

      toast.success("Ambiente de teste limpo!");
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro ao limpar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl mb-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-500 font-bold text-sm">
          <Database className="w-4 h-4" />
          MODO TESTE (EXCLUSIVO)
        </div>
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold">Desenvolvedor</span>
      </div>
      <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
        Você pode gerar dados fictícios para validar o fluxo de caixa, agenda e histórico. 
        Use o botão de limpar para remover todos os registros de teste de uma vez.
      </p>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 gap-2 border-amber-300 bg-white/50 hover:bg-amber-100 text-amber-700 h-9"
          onClick={seedData}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Gerar Fake Data
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1 gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 h-9"
          onClick={clearDummyData}
          disabled={loading}
        >
          <Trash2 className="w-4 h-4" />
          Limpar Tudo
        </Button>
      </div>
    </div>
  );
};

export default DummyDataSeeder;
