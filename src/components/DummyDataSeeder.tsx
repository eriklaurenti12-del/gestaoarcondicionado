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

      // 1. Create Providers (Prestadores)
      const providers = [
        { id: crypto.randomUUID(), name: "Erik Laurenti", phone: "16992600631", specialty: "Geral", cost_per_hour: 50, color: "#3b82f6", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Marcio Técnico", phone: "11988887777", specialty: "Instalação", cost_per_hour: 45, color: "#10b981", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Equipe Alpha", phone: "11977776666", specialty: "Limpeza", cost_per_hour: 40, color: "#f59e0b", active: true, created_at: new Date().toISOString() },
      ];
      await supabase.from('admin_settings').upsert({ key: 'service_providers', value: JSON.stringify(providers), description: 'Simulação' });

      // 2. Create Clients
      const fakeClients = [
        { name: "Carlos Oliveira (TESTE)", telefone: "11999990001", address: "Av. Paulista, 1000 - SP", user_id: userId },
        { name: "Ana Beatriz (TESTE)", telefone: "11999990002", address: "Rua Augusta, 500 - SP", user_id: userId },
        { name: "Roberto Santos (TESTE)", telefone: "21988880001", address: "Av. Atlântica, 200 - RJ", user_id: userId },
        { name: "Empresa de Molas ABC (TESTE)", telefone: "11977770001", address: "Distrito Industrial - SP", is_company: true, user_id: userId },
      ];
      const { data: createdClients, error: clientErr } = await supabase.from('clients').insert(fakeClients).select();
      if (clientErr) throw clientErr;

      // 3. Create Products/Services
      const fakeProducts = [
        { name: "Ar Split 12000 BTU (TESTE)", type: "piece", price: 2500, cost_price: 1800, qty: 10, user_id: userId, storage_location: "Câmara 1", min_stock: 2 },
        { name: "Limpeza Completa (TESTE)", type: "service", price: 250, cost_price: 50, user_id: userId, service_duration: 90, warranty_months: 6 },
        { name: "Instalação Padrão (TESTE)", type: "service", price: 650, cost_price: 200, user_id: userId, service_duration: 120, warranty_months: 12 },
      ];
      const { data: createdProducts, error: productErr } = await supabase.from('products').insert(fakeProducts).select();
      if (productErr) throw productErr;

      // 4. Create Appointments (Today and Past)
      if (createdClients && createdProducts) {
        const services = createdProducts.filter(p => p.type === 'service');
        const now = new Date();
        
        const fakeAppts = createdClients.map((c, i) => {
          const apptDate = new Date(now);
          if (i === 0) apptDate.setHours(9, 0, 0, 0); // Today 9am
          else if (i === 1) apptDate.setHours(14, 30, 0, 0); // Today 2:30pm
          else apptDate.setDate(now.getDate() - 30); // Past (for history/overdue)

          return {
            client_id: c.id,
            service_id: services[i % services.length].id,
            appointment_date: apptDate.toISOString(),
            status: i < 2 ? 'agendado' : 'concluido',
            notes: i < 2 ? `[DUMMY] Rota de teste. [PRESTADOR:${providers[i % 2].name}]` : `[DUMMY] Serviço passado.`,
            user_id: userId
          };
        });
        const { data: createdAppts, error: apptErr } = await supabase.from('appointments').insert(fakeAppts).select();
        if (apptErr) throw apptErr;

        // 5. Create Sales & Finances for the past appt
        const pastAppt = createdAppts.find(a => a.status === 'concluido');
        if (pastAppt) {
          const service = services.find(s => s.id === pastAppt.service_id);
          await supabase.from('sales').insert({
            user_id: userId,
            client_id: pastAppt.client_id,
            product_id: pastAppt.service_id,
            qty: 1,
            sale_price: service?.price || 0,
            total_profit: (service?.price || 0) - (service?.cost_price || 0),
            payment_method: 'Cartão',
            sale_date: pastAppt.appointment_date
          });
          await supabase.from('financial_records').insert({
            user_id: userId,
            type: 'entrada',
            amount: service?.price || 0,
            category: 'Serviço',
            description: `Recebimento: ${service?.name} - ${pastAppt.client_id}`,
            date: pastAppt.appointment_date,
            payment_method: 'Cartão'
          });
        }
      }

      toast.success("Simulação completa gerada! Verifique Dashboard, Agenda e Financeiro.");
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro na simulação: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hardReset = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Isso apagará ABSOLUTAMENTE TUDO da sua conta (clientes, serviços, vendas, gastos). Deseja limpar do zero?")) return;
    if (!window.confirm("CONFIRMAÇÃO FINAL: Esta ação não pode ser desfeita. Deseja mesmo o RESET TOTAL?")) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      // Sequence to avoid FK issues
      await supabase.from('installments').delete().eq('user_id', userId);
      await supabase.from('sales').delete().eq('user_id', userId);
      await supabase.from('financial_records').delete().eq('user_id', userId);
      await supabase.from('fixed_expenses').delete().eq('user_id', userId);
      await supabase.from('appointments').delete().eq('user_id', userId);
      await supabase.from('quotes').delete().eq('user_id', userId);
      await supabase.from('service_orders').delete().eq('user_id', userId);
      await supabase.from('products').delete().eq('user_id', userId);
      await supabase.from('clients').delete().eq('user_id', userId);
      await supabase.from('suppliers').delete().eq('user_id', userId);
      await supabase.from('equipment').delete().eq('user_id', userId);
      await supabase.from('maintenance_plans').delete().eq('user_id', userId);
      
      toast.success("Sistema limpo do zero! Conta Erik preservada.");
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro ao resetar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5 bg-zinc-950/50 dark:bg-zinc-950/80 border border-primary/20 rounded-2xl mb-6 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-bold text-base tracking-tight">
          <Database className="w-5 h-5 animate-pulse" />
          CENTRAL DE SIMULAÇÃO & RESET
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase text-[9px] font-black tracking-widest">
          Modo Administrador
        </Badge>
      </div>
      
      <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
        Gere uma simulação real com <strong>prestadores, rotas de hoje, vendas passadas e lucros</strong> para ver o sistema em funcionamento pleno. Ou use o <strong>Reset Total</strong> para limpar sua base.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        <Button 
          variant="default" 
          className="h-11 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20 font-bold"
          onClick={seedData}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Iniciar Simulação Real
        </Button>
        <Button 
          variant="destructive" 
          className="h-11 gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 font-bold"
          onClick={hardReset}
          disabled={loading}
        >
          <AlertTriangle className="w-4 h-4" />
          Reset Total do Sistema
        </Button>
      </div>
    </div>
  );
};

export default DummyDataSeeder;
