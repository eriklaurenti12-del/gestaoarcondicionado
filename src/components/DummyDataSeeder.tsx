import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Database, Trash2, PlusCircle, AlertTriangle, Loader2, Eye,
  Users, Package, Wrench, CalendarDays, DollarSign, UserCog, Truck, MapPin, FileText
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { recordFinancialEntry } from "@/utils/financialHelpers";
import { reconcileFinancialMonth } from "@/utils/recurringSync";

// ---- Categories the user can select ----
type Cat =
  | 'clientes' | 'produtos' | 'servicos' | 'agendas'
  | 'financeiro' | 'funcionarios' | 'prestadores' | 'rotas' | 'impostos'
  | 'fornecedores' | 'equipamentos' | 'contratos' | 'os';

const CATEGORIES: Array<{ key: Cat; label: string; desc: string; icon: React.ComponentType<any> }> = [
  { key: 'clientes',     label: 'Clientes',     desc: '8 clientes (PF + PJ)', icon: Users },
  { key: 'produtos',     label: 'Produtos',     desc: '3 itens em estoque',          icon: Package },
  { key: 'servicos',     label: 'Serviços',     desc: '3 serviços com imagens', icon: Wrench },
  { key: 'agendas',      label: 'Agenda',       desc: '2 hoje + 1 passado concluído',      icon: CalendarDays },
  { key: 'financeiro',   label: 'Financeiro',   desc: 'Venda + entrada do concluído', icon: DollarSign },
  { key: 'funcionarios', label: 'Funcionários', desc: '3 funcionários (salário/vale)',     icon: UserCog },
  { key: 'prestadores',  label: 'Prestadores',  desc: '3 prestadores + gastos diários',     icon: Truck },
  { key: 'rotas',        label: 'Rotas',        desc: 'Marca prestador nos agendamentos',   icon: MapPin },
  { key: 'impostos',     label: 'Impostos',     desc: 'Registro do mês + folha + provedores', icon: FileText },
  { key: 'fornecedores', label: 'Fornecedores', desc: '3 fornecedores cadastrados',         icon: Truck },
  { key: 'equipamentos', label: 'Equipamentos', desc: 'Equipamentos vinculados ao cliente', icon: Wrench },
  { key: 'contratos',    label: 'Contratos',    desc: '2 contratos de manutenção ativos',   icon: FileText },
  { key: 'os',           label: 'O.S. / Orçam.',desc: '1 orçamento + 1 ordem de serviço',   icon: FileText },
];

const ALL_ON: Record<Cat, boolean> = CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: true }), {} as any);

const DummyDataSeeder: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [picker, setPicker] = useState<Record<Cat, boolean>>(ALL_ON);
  const queryClient = useQueryClient();

  const toggle = (k: Cat) => setPicker((p) => ({ ...p, [k]: !p[k] }));
  const setAll = (v: boolean) => setPicker(CATEGORIES.reduce((a, c) => ({ ...a, [c.key]: v }), {} as Record<Cat, boolean>));

  const preview = useMemo(() => {
    const lines: Array<{ label: string; count: number; detail: string }> = [];
    if (picker.clientes)     lines.push({ label: 'Clientes',     count: 4, detail: 'Carlos, Ana, Roberto, Empresa ABC' });
    if (picker.produtos)     lines.push({ label: 'Produtos',     count: 1, detail: 'Ar Split 12000 BTU (R$ 2.500)' });
    if (picker.servicos)     lines.push({ label: 'Serviços',     count: 2, detail: 'Limpeza R$ 250 · Instalação R$ 650' });
    if (picker.agendas)      lines.push({ label: 'Agendamentos', count: 3, detail: '2 pendentes hoje + 1 concluído (-2 dias)' });
    if (picker.financeiro)   lines.push({ label: 'Financeiro',   count: 2, detail: '1 venda + 1 entrada do concluído' });
    if (picker.funcionarios) lines.push({ label: 'Funcionários', count: 1, detail: 'Salário R$ 1.800 + Vale R$ 200' });
    if (picker.prestadores)  lines.push({ label: 'Prestadores',  count: 3, detail: 'Custo mensal recorrente' });
    if (picker.rotas)        lines.push({ label: 'Rotas',        count: 2, detail: 'Marca [PRESTADOR:nome] nos agendamentos' });
    if (picker.impostos)     lines.push({ label: 'Impostos',     count: 1, detail: 'Registro do mês corrente com folha' });
    return lines;
  }, [picker]);

  const hasAny = preview.length > 0;

  const seed = async () => {
    if (!hasAny) {
      toast.error('Selecione pelo menos 1 categoria.');
      return;
    }
    setLoading(true);
    setPreviewOpen(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      const userId = session.user.id;

      const now = new Date();
      const monthYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${monthYYYYMM}-01`;

      // Helpers aleatórios
      const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
      const fakePhone = () => {
        const ddd = rand(['11','21','16','19','27','31','41','47','51','61','71','81','85']);
        const p1 = String(90000 + Math.floor(Math.random()*9999)).padStart(5,'0');
        const p2 = String(Math.floor(Math.random()*9999)).padStart(4,'0');
        return `${ddd}9${p1.slice(0,4)}${p2}`.slice(0,11);
      };
      const FAKE_NAMES = [
        'Carlos Oliveira','Ana Beatriz','Roberto Santos','Juliana Costa','Pedro Almeida',
        'Mariana Souza','Felipe Rocha','Camila Ribeiro','Lucas Ferreira','Patrícia Lima',
        'Bruno Carvalho','Fernanda Martins','Rafael Mendes','Gabriela Pinto','Thiago Araújo'
      ];

      // --- Prestadores (admin_settings JSON) ---
      const providers = [
        { id: crypto.randomUUID(), name: "Erik Laurenti (TESTE)", phone: "16992600631", specialty: "Geral",       cost_per_hour: 50, monthly_cost: 1200, is_recurring_expenses: true, color: "#3b82f6", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Marcio Técnico (TESTE)", phone: "11988887777", specialty: "Instalação", cost_per_hour: 45, monthly_cost: 800,  is_recurring_expenses: true, color: "#10b981", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Equipe Alpha (TESTE)",  phone: "11977776666", specialty: "Limpeza",    cost_per_hour: 40, monthly_cost: 600,  is_recurring_expenses: true, color: "#f59e0b", active: true, created_at: new Date().toISOString() },
      ];
      if (picker.prestadores) {
        await supabase.from('admin_settings').upsert({ key: 'service_providers', value: JSON.stringify(providers), description: 'Simulação' }, { onConflict: 'key' });

        // Gastos diários de combustível + alimentação por prestador (últimos 5 dias)
        const dailyExpenses: any[] = [];
        for (let d = 0; d < 5; d++) {
          const day = new Date(now); day.setDate(now.getDate() - d);
          const dateStr = day.toISOString().slice(0,10);
          for (const p of providers) {
            dailyExpenses.push({
              user_id: userId,
              category: 'Combustível',
              description: `Combustível ${p.name}`,
              amount: 30 + Math.floor(Math.random()*40),
              expense_date: dateStr,
              helper_name: p.name,
              is_recurring: false,
            });
            dailyExpenses.push({
              user_id: userId,
              category: 'Alimentação',
              description: `Alimentação ${p.name}`,
              amount: 18 + Math.floor(Math.random()*22),
              expense_date: dateStr,
              helper_name: p.name,
              is_recurring: false,
            });
          }
        }
        if (dailyExpenses.length) {
          await supabase.from('fixed_expenses').insert(dailyExpenses);
        }
      }

      // --- Funcionários (3 com nomes/telefones aleatórios) ---
      if (picker.funcionarios) {
        const funcs = Array.from({ length: 3 }).map((_, i) => ({
          user_id: userId,
          name: `${rand(FAKE_NAMES)} (TESTE)`,
          phone: fakePhone(),
          role: i === 0 ? 'gerente' : 'sistema',
          monthly_salary: 1500 + Math.floor(Math.random()*1500),
          vale_amount: 100 + Math.floor(Math.random()*200),
          expense_category: 'Salário',
          is_active: true,
        }));
        await supabase.from('team_members').insert(funcs);
      }

      // --- Clientes (8 aleatórios) ---
      let createdClients: any[] = [];
      if (picker.clientes) {
        const used = new Set<string>();
        const fakeClients = Array.from({ length: 8 }).map((_, i) => {
          let n = rand(FAKE_NAMES); while (used.has(n)) n = rand(FAKE_NAMES); used.add(n);
          return {
            name: `${n} (TESTE)`,
            telefone: fakePhone(),
            address: rand(['Av. Paulista, 1000 - SP','Rua Augusta, 500 - SP','Av. Atlântica, 200 - RJ','Rua das Flores, 88 - SP','Av. Brasil, 1500 - RJ','Rua XV, 320 - PR']),
            user_id: userId,
            is_company: i === 7,
          };
        });
        const { data, error } = await supabase.from('clients').insert(fakeClients).select();
        if (error) throw error;
        createdClients = data || [];
      }

      // --- Produtos / Serviços (com imagens) ---
      let createdProducts: any[] = [];
      const wantProducts = picker.produtos || picker.servicos;
      if (wantProducts) {
        const rows: any[] = [];
        if (picker.produtos) {
          rows.push({ name: "Ar Split 12000 BTU (TESTE)", type: "piece", price: 2500, cost_price: 1800, qty: 10, user_id: userId, storage_location: "Câmara 1", min_stock: 2, image_url: 'https://images.unsplash.com/photo-1631545806609-cda3ecde29bc?w=400' });
          rows.push({ name: "Ar Split 9000 BTU (TESTE)",  type: "piece", price: 1900, cost_price: 1300, qty: 6,  user_id: userId, storage_location: "Câmara 1", min_stock: 2, image_url: 'https://images.unsplash.com/photo-1605374551406-b8c5d7c5e2c1?w=400' });
          rows.push({ name: "Suporte Inox (TESTE)",       type: "piece", price: 90,   cost_price: 35,   qty: 25, user_id: userId, storage_location: "Câmara 2", min_stock: 5, image_url: 'https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=400' });
        }
        if (picker.servicos) {
          rows.push({ name: "Limpeza Completa (TESTE)",   type: "service", price: 250, cost_price: 50,  user_id: userId, service_duration: 90,  warranty_months: 6,  qty: 0, image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400' });
          rows.push({ name: "Instalação Padrão (TESTE)", type: "service", price: 650, cost_price: 200, user_id: userId, service_duration: 120, warranty_months: 12, qty: 0, image_url: 'https://images.unsplash.com/photo-1597149961419-cc6e095faf95?w=400' });
          rows.push({ name: "Manutenção Preventiva (TESTE)", type: "service", price: 320, cost_price: 80, user_id: userId, service_duration: 60, warranty_months: 3, qty: 0, image_url: 'https://images.unsplash.com/photo-1607400201515-c2c41c07d307?w=400' });
        }
        const { data, error } = await supabase.from('products').insert(rows).select();
        if (error) throw error;
        createdProducts = data || [];
      }

      // --- Configuração da Agenda Online (puxa horário da empresa) ---
      if (picker.agendas) {
        await supabase.from('online_booking_settings').upsert({
          user_id: userId,
          enabled: true,
          weekdays: { sun: false, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true },
          start_time: '08:00',
          end_time: '18:00',
          slot_minutes: 30,
          lunch_start: '12:00',
          lunch_end: '13:00',
          min_advance_hours: 2,
          max_advance_days: 30,
          auto_confirm: false,
        } as any, { onConflict: 'user_id' });

        // Agendamentos online pendentes (vindos do PublicBooking)
        const onlineRows = Array.from({ length: 3 }).map(() => {
          const day = new Date(now); day.setDate(now.getDate() + 1 + Math.floor(Math.random()*5));
          const hour = 9 + Math.floor(Math.random()*8);
          return {
            user_id: userId,
            client_name: `${rand(FAKE_NAMES)} (ONLINE)`,
            client_phone: fakePhone(),
            client_email: null,
            service_name: rand(['Limpeza Completa','Instalação Padrão','Manutenção Preventiva']),
            preferred_date: day.toISOString().slice(0,10),
            preferred_time: `${String(hour).padStart(2,'0')}:00`,
            payment_method: rand(['pix','dinheiro','cartao_credito']),
            notes: '[DUMMY] Solicitação online de teste',
            status: 'pendente',
          };
        });
        await supabase.from('online_bookings').insert(onlineRows);
      }


      // --- Agendamentos (precisa de clientes + serviços) ---
      let createdAppts: any[] = [];
      if (picker.agendas && createdClients.length > 0) {
        const services = createdProducts.filter((p) => p.type === 'service');
        if (services.length === 0) {
          // Garante pelo menos um serviço para o agendamento concluído
          const { data: extra } = await supabase.from('products').insert([{
            name: "Serviço TESTE", type: "service", price: 300, cost_price: 80,
            user_id: userId, service_duration: 60, qty: 0,
          }]).select();
          if (extra) services.push(...extra);
        }
        const fakeAppts = createdClients.slice(0, 3).map((c, i) => {
          const apptDate = new Date(now);
          if (i === 0) apptDate.setHours(9, 0, 0, 0);
          else if (i === 1) apptDate.setHours(14, 30, 0, 0);
          else apptDate.setDate(now.getDate() - 2);
          const provider = picker.rotas ? providers[i % providers.length] : null;
          return {
            client_id: c.id,
            service_id: services[i % services.length]?.id,
            appointment_date: apptDate.toISOString(),
            status: i < 2 ? 'pendente' : 'concluido',
            notes: provider
              ? `[DUMMY] Rota TESTE. [PRESTADOR:${provider.name}]`
              : `[DUMMY] Agendamento TESTE`,
            user_id: userId,
          };
        });
        const { data, error } = await supabase.from('appointments').insert(fakeAppts).select();
        if (error) throw error;
        createdAppts = data || [];
      }

      // --- Financeiro: venda + entrada IDEMPOTENTES (appointment_id) ---
      if (picker.financeiro) {
        const concluded = createdAppts.find((a) => a.status === 'concluido');
        if (concluded) {
          const service = createdProducts.find((p) => p.id === concluded.service_id);
          const price = Number(service?.price || 300);
          const cost  = Number(service?.cost_price || 80);

          // Venda (dedup feita manualmente: só insere se não existir)
          const { data: existingSale } = await supabase
            .from('sales').select('id').eq('appointment_id', concluded.id).maybeSingle();
          if (!existingSale) {
            await (supabase.from('sales') as any).insert({
              user_id: userId,
              appointment_id: concluded.id,
              client_id: concluded.client_id,
              product_id: concluded.service_id,
              qty: 1,
              sale_price: price,
              total_profit: price - cost,
              payment_method: 'Crédito',
              sale_date: concluded.appointment_date,
            });
          }

          // Entrada (recordFinancialEntry já é idempotente em appointment_id+type)
          await recordFinancialEntry({
            userId,
            appointmentId: concluded.id,
            type: 'entrada',
            amount: price,
            description: `Recebimento: ${service?.name || 'Serviço'}`,
            category: 'Serviço',
            paymentMethod: 'PIX',
            recordDate: concluded.appointment_date,
          });
        }
      }

      // --- Reconciliação do mês: garante recorrentes + remove duplicatas ---
      // Roda sempre que o usuário pediu funcionarios/prestadores/financeiro/agendas/impostos.
      if (picker.financeiro || picker.funcionarios || picker.prestadores || picker.agendas || picker.impostos) {
        await reconcileFinancialMonth(userId, monthYYYYMM, 'manual');
      }

      // --- Impostos do mês corrente ---
      if (picker.impostos) {
        const { data: existingTax } = await supabase
          .from('tax_records').select('id')
          .eq('user_id', userId).eq('month_year', monthYYYYMM).maybeSingle();

        const payroll = picker.funcionarios ? [{
          name: 'Funcionário TESTE', salary: 1800, vale: 200,
          inss: 1800 * 0.08, fgts: 1800 * 0.08, total: 1800 + 200,
        }] : [];
        const providerCosts = picker.prestadores ? providers.map((p) => ({
          id: p.id, name: p.name, monthly_cost: p.monthly_cost,
        })) : [];

        if (!existingTax) {
          await supabase.from('tax_records').insert({
            user_id: userId,
            month_year: monthYYYYMM,
            record_date: monthStart,
            total_revenue: picker.financeiro ? 300 : 0,
            revenue_from_services: picker.financeiro ? 300 : 0,
            revenue_from_products: 0,
            material_expenses: 0,
            total_expenses: payroll.reduce((s, p) => s + p.total, 0)
              + providerCosts.reduce((s, p) => s + Number(p.monthly_cost || 0), 0),
            payroll_data: payroll as any,
            provider_costs: providerCosts as any,
            xml_imports: [] as any,
            employee_fgts: payroll.reduce((s, p) => s + p.fgts, 0),
            employee_inss: payroll.reduce((s, p) => s + p.inss, 0),
            notes: 'Gerado pela simulação',
          });
        }
      }

      // --- Fornecedores ---
      if (picker.fornecedores) {
        const sups = ['Distribuidora Frio Norte','AC Parts Brasil','Refricenter SP'].map((n) => ({
          user_id: userId,
          name: `${n} (TESTE)`,
          contact: rand(FAKE_NAMES),
          email: `contato${Math.floor(Math.random()*999)}@${n.toLowerCase().replace(/\s+/g,'')}.com.br`,
          contact_person: rand(FAKE_NAMES),
          payment_terms: rand(['30 dias','15 dias','À vista']),
        }));
        await supabase.from('suppliers').insert(sups);
      }

      // --- Equipamentos do cliente ---
      if (picker.equipamentos && createdClients.length > 0) {
        const eqs = createdClients.slice(0, 4).map((c) => ({
          user_id: userId,
          client_id: c.id,
          brand: rand(['Samsung','LG','Electrolux','Midea','Springer']),
          model: `Inverter ${rand(['9','12','18','24'])}.000`,
          btus: rand([9000, 12000, 18000, 24000]),
          serial_number: `SN${Math.floor(Math.random()*999999)}`,
          location: rand(['Sala','Quarto','Escritório','Recepção']),
          installation_date: new Date(now.getFullYear()-1, now.getMonth(), 1).toISOString().slice(0,10),
        }));
        await supabase.from('client_equipment').insert(eqs);
      }

      // --- Contratos de manutenção ---
      if (picker.contratos && createdClients.length > 0) {
        const contracts = createdClients.slice(0, 2).map((c, i) => ({
          user_id: userId,
          client_id: c.id,
          title: `Contrato Manutenção ${c.name}`,
          description: 'Limpeza preventiva semestral (TESTE)',
          start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10),
          monthly_value: 150 + i * 50,
          cleaning_interval_months: 6,
          status: 'ativo',
        }));
        await supabase.from('maintenance_contracts').insert(contracts);
      }

      // --- O.S. / Orçamentos ---
      if (picker.os && createdClients.length > 0) {
        const c = createdClients[0];
        const items = [
          { name: 'Limpeza Completa', qty: 1, unit_price: 250, total: 250 },
          { name: 'Filtro novo', qty: 2, unit_price: 45, total: 90 },
        ];
        await supabase.from('quotes').insert({
          user_id: userId,
          client_id: c.id,
          title: 'Orçamento limpeza + filtros (TESTE)',
          subtotal: 340, total: 340,
          items: items as any,
          validity_days: 15,
          status: 'pendente',
        } as any);
        await supabase.from('service_orders').insert({
          user_id: userId,
          client_id: c.id,
          title: 'O.S. Manutenção corretiva (TESTE)',
          services: [{ name: 'Reparo placa', value: 320 }] as any,
          parts: [{ name: 'Capacitor', qty: 1, value: 80 }] as any,
          services_total: 320, parts_total: 80, total: 400,
          status: 'pendente',
        } as any);
      }

      toast.success(`✅ Simulação aplicada (${preview.length} categoria(s)).`);
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro na simulação: " + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const hardReset = async () => {
    if (!window.confirm("⚠️ Apaga TUDO da sua conta (clientes, agenda, financeiro, prestadores, agenda online, configurações). Continuar?")) return;
    if (!window.confirm("Confirmação final: ação irreversível.")) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      const userId = session.user.id;

      // Ordem importa: filhos antes dos pais
      await supabase.from('installments').delete().eq('user_id', userId);
      await supabase.from('sales').delete().eq('user_id', userId);
      await supabase.from('financial_records').delete().eq('user_id', userId);
      await supabase.from('financial_audit_log').delete().eq('user_id', userId);
      await supabase.from('financial_reconciliation_log').delete().eq('user_id', userId);
      await supabase.from('fixed_expenses').delete().eq('user_id', userId);
      await supabase.from('scheduled_maintenance').delete().eq('user_id', userId);
      await supabase.from('service_orders').delete().eq('user_id', userId);
      await supabase.from('appointments').delete().eq('user_id', userId);
      await supabase.from('online_bookings').delete().eq('user_id', userId);
      await supabase.from('online_booking_settings').delete().eq('user_id', userId);
      await supabase.from('quotes').delete().eq('user_id', userId);
      await supabase.from('client_equipment').delete().eq('user_id', userId);
      await supabase.from('maintenance_contracts').delete().eq('user_id', userId);
      await supabase.from('products').delete().eq('user_id', userId);
      await supabase.from('clients').delete().eq('user_id', userId);
      await supabase.from('suppliers').delete().eq('user_id', userId);
      await supabase.from('tax_records').delete().eq('user_id', userId);
      await supabase.from('team_members').delete().eq('user_id', userId);

      // Prestadores ficam em admin_settings (JSON global). Limpa apenas a chave.
      await supabase.from('admin_settings').delete().eq('key', 'service_providers');

      toast.success("✅ Sistema limpo do zero (incluindo prestadores e agenda online).");
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro ao resetar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5 bg-zinc-950/50 dark:bg-zinc-950/80 border border-primary/20 rounded-2xl mb-6 shadow-2xl backdrop-blur-xl">
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
        Marque o que deseja gerar. Use <strong>Visualizar pré-simulação</strong> para conferir antes de aplicar.
      </p>

      {/* Picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CATEGORIES.map(({ key, label, desc, icon: Icon }) => (
          <label
            key={key}
            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
              picker[key] ? 'border-primary/60 bg-primary/5' : 'border-border bg-card/50 hover:border-primary/30'
            }`}
          >
            <Checkbox checked={picker[key]} onCheckedChange={() => toggle(key)} className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-semibold">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">{desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setAll(true)}>Marcar tudo</Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setAll(false)}>Limpar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
        <Button
          variant="outline"
          className="h-11 gap-2 font-bold border-primary/30"
          onClick={() => setPreviewOpen(true)}
          disabled={loading || !hasAny}
        >
          <Eye className="w-4 h-4" />
          Pré-simulação
        </Button>
        <Button
          variant="default"
          className="h-11 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20 font-bold"
          onClick={seed}
          disabled={loading || !hasAny}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Gerar Simulação
        </Button>
        <Button
          variant="destructive"
          className="h-11 gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 font-bold"
          onClick={hardReset}
          disabled={loading}
        >
          <AlertTriangle className="w-4 h-4" />
          Reset Total
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Pré-simulação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              O sistema vai criar (sem afetar dados existentes além do necessário):
            </p>
            <ul className="space-y-1.5">
              {preview.map((p) => (
                <li key={p.label} className="flex items-start justify-between gap-2 border-b last:border-0 pb-1.5">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.detail}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">+{p.count}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground pt-2">
              Reconciliação do mês corrente roda em seguida — venda e entrada do agendamento concluído usam o mesmo <code>appointment_id</code>, então não duplicam.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={seed} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
              Aplicar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DummyDataSeeder;
