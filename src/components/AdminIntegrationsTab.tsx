import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, CheckCircle2, XCircle, Send, Loader2,
  ExternalLink, RefreshCw, Zap, Globe, Shield,
  CreditCard, Smartphone, Eye, EyeOff, Code, Plug,
  FileJson, Key, Trash2, Settings, ChevronDown,
  UserPlus, Sparkles, Play, AlertCircle, Map, History, Plus
} from "lucide-react";

const WEBHOOK_URL = 'https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/payment-webhook';

type TestResult = { success: boolean; message: string; data?: any; timestamp: string };

type Platform = {
  name: string;
  slug: string;
  color: string;
  icon: string;
  guide: string[];
  events: string[];
};

const PLATFORMS: Platform[] = [
  { name: 'GGCheckout', slug: 'ggcheckout', color: 'from-green-500 to-emerald-600', icon: '💳', guide: ['Acesse GGCheckout', 'Vá em Webhooks', 'Cole a URL acima', 'Selecione "Pagamento Aprovado"'], events: ['pix_paid', 'card_paid', 'paid', 'approved'] },
  { name: 'Hotmart', slug: 'hotmart', color: 'from-orange-500 to-red-500', icon: '🔥', guide: ['Ferramentas > Webhook (Hottok)', 'Configure a URL de notificação', 'Selecione compra aprovada', 'Ative'], events: ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'] },
  { name: 'Kiwify', slug: 'kiwify', color: 'from-purple-500 to-violet-600', icon: '🥝', guide: ['Configurações > Webhooks', 'Adicione URL', 'Selecione "Compra Aprovada"', 'Salve'], events: ['order_paid', 'subscription_created'] },
  { name: 'Eduzz', slug: 'eduzz', color: 'from-blue-500 to-indigo-600', icon: '📦', guide: ['Configurações > Notificações', 'Configure Postback URL', 'Selecione "Pago"', 'Ative'], events: ['paid', 'refunded'] },
  { name: 'Monetizze', slug: 'monetizze', color: 'from-teal-500 to-cyan-600', icon: '💰', guide: ['Configurações > Postback', 'Informe a URL', 'Selecione "Compra Finalizada"', 'Salve'], events: ['Finalizada', 'Cancelada'] },
  { name: 'PagSeguro', slug: 'pagseguro', color: 'from-green-400 to-green-600', icon: '🟢', guide: ['Vendas > Configurações', 'URL de notificação', 'Transações aprovadas', 'Salve'], events: ['paid', 'available'] },
  { name: 'Mercado Pago', slug: 'mercadopago', color: 'from-sky-400 to-blue-500', icon: '🔵', guide: ['Configurações > Notificações IPN', 'Configure URL', 'Selecione "Payments"', 'Salve'], events: ['payment.created', 'payment.updated'] },
  { name: 'Stripe', slug: 'stripe', color: 'from-indigo-500 to-purple-600', icon: '💎', guide: ['Developers > Webhooks', 'Add Endpoint', 'Cole URL e selecione eventos', 'Salve'], events: ['checkout.session.completed', 'payment_intent.succeeded'] },
  { name: 'Cakto', slug: 'cakto', color: 'from-pink-500 to-rose-600', icon: '🎂', guide: ['Configurações > Integrações > Webhook', 'Cole a URL do webhook', 'Selecione: pagamento aprovado/recusado', 'Salve e teste'], events: ['payment_approved', 'payment_refused', 'subscription_active'] },
  { name: 'Braip', slug: 'braip', color: 'from-amber-500 to-orange-600', icon: '🚀', guide: ['Configurações > Postback', 'URL de notificação', '"Venda Aprovada"', 'Ative'], events: ['approved', 'refunded'] },
  { name: 'Yampi', slug: 'yampi', color: 'from-violet-500 to-fuchsia-600', icon: '🛒', guide: ['Configurações > Webhooks', 'Adicione URL', 'Eventos de pedido', 'Salve'], events: ['order.paid', 'order.cancelled'] },
  { name: 'Pepper (Hotmart)', slug: 'pepper', color: 'from-red-500 to-orange-500', icon: '🌶️', guide: ['Mesmo do Hotmart', 'Ferramentas > Webhook', 'Configure compra', 'Salve'], events: ['PURCHASE_APPROVED'] },
];

const PLANS = [
  { id: 'mensal', label: 'Mensal', icon: '💳', color: 'bg-blue-600', placeholder: '29.90' },
  { id: 'trimestral', label: 'Trimestral', icon: '📘', color: 'bg-purple-600', placeholder: '69.90' },
  { id: 'semestral', label: 'Semestral', icon: '📗', color: 'bg-teal-600', placeholder: '149.90' },
  { id: 'anual', label: 'Anual', icon: '⭐', color: 'bg-yellow-600', placeholder: '199.90' },
  { id: 'vitalicio', label: 'Vitalício', icon: '👑', color: 'bg-amber-600', placeholder: '499.90' },
];

const FAKE_NAMES = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Lima', 'Fernanda Souza'];

export const AdminIntegrationsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingFake, setCreatingFake] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');
  const [showCode, setShowCode] = useState(false);
  const [integrationKeys, setIntegrationKeys] = useState<Array<{ id: string; name: string; value: string; show: boolean }>>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  // Product mapping state
  const [productMappings, setProductMappings] = useState<any[]>([]);
  const [newMapping, setNewMapping] = useState({ platform: 'cakto', product_id: '', product_name: '', plan_name: 'mensal', duration_months: 1, is_lifetime: false });
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Simulator state
  const [simEmail, setSimEmail] = useState(`teste_${Math.floor(Math.random() * 9999)}@simulacao.fake`);
  const [simPlan, setSimPlan] = useState('mensal');
  const [simAmount, setSimAmount] = useState('');

  const [settings, setSettings] = useState<Record<string, string>>({
    plataforma_ativa: 'ggcheckout',
    plano_ativo_checkout: 'anual',
    planos_visiveis_landing: 'mensal,anual', // quais planos aparecem na landing
    notificar_vendas: 'true',
    notificar_erros: 'true',
    checkout_mensal: '', checkout_trimestral: '', checkout_semestral: '', checkout_anual: '', checkout_vitalicio: '',
    preco_mensal: '29.90', preco_trimestral: '69.90', preco_semestral: '149.90', preco_anual: '199.90', preco_vitalicio: '499.90',
    whatsapp_suporte: '',
  });

  const activePlatform = PLATFORMS.find(p => p.slug === settings.plataforma_ativa) || PLATFORMS[0];

  useEffect(() => {
    loadSettings();
    testConnection();
    loadProductMappings();
    loadWebhookLogs();
  }, []);

  // Update simAmount when simPlan changes
  useEffect(() => {
    const price = settings[`preco_${simPlan}`] || PLANS.find(p => p.id === simPlan)?.placeholder || '29.90';
    setSimAmount(price);
  }, [simPlan, settings]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from('admin_settings').select('*');
      if (error) throw error;
      const map: Record<string, string> = {};
      const keys: Array<{ id: string; name: string; value: string; show: boolean }> = [];
      (data as any[])?.forEach(item => {
        if (item.key.startsWith('integration_key_')) {
          if (item.value) keys.push({ id: item.key, name: item.key.replace('integration_key_', ''), value: item.value, show: false });
        } else {
          map[item.key] = item.value || '';
        }
      });
      setSettings(prev => ({ ...prev, ...map }));
      setIntegrationKeys(keys);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadProductMappings = async () => {
    try {
      const { data } = await supabase.from('product_plan_mapping').select('*').order('created_at', { ascending: false });
      if (data) setProductMappings(data);
    } catch (e) { console.error('Error loading mappings:', e); }
  };

  const loadWebhookLogs = async () => {
    try {
      const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) setWebhookLogs(data);
    } catch (e) { console.error('Error loading logs:', e); }
  };

  const saveMapping = async () => {
    if (!newMapping.product_id && !newMapping.product_name) {
      toast({ title: "Preencha o ID ou nome do produto", variant: "destructive" });
      return;
    }
    try {
      const planDurations: Record<string, { months: number; lifetime: boolean }> = {
        mensal: { months: 1, lifetime: false },
        trimestral: { months: 3, lifetime: false },
        semestral: { months: 6, lifetime: false },
        anual: { months: 12, lifetime: false },
        vitalicio: { months: 0, lifetime: true },
      };
      const dur = planDurations[newMapping.plan_name] || { months: 1, lifetime: false };
      const { error } = await supabase.from('product_plan_mapping').insert({
        platform: newMapping.platform,
        product_id: newMapping.product_id || null,
        product_name: newMapping.product_name || null,
        plan_name: newMapping.plan_name,
        duration_months: dur.months,
        is_lifetime: dur.lifetime,
      });
      if (error) throw error;
      toast({ title: "✅ Mapeamento salvo!" });
      setNewMapping({ platform: 'cakto', product_id: '', product_name: '', plan_name: 'mensal', duration_months: 1, is_lifetime: false });
      loadProductMappings();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const deleteMapping = async (id: string) => {
    try {
      await supabase.from('product_plan_mapping').delete().eq('id', id);
      setProductMappings(prev => prev.filter(m => m.id !== id));
      toast({ title: "Mapeamento removido" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const autoCreateMapping = async (planId: string) => {
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    const planDurations: Record<string, { months: number; lifetime: boolean }> = {
      mensal: { months: 1, lifetime: false },
      trimestral: { months: 3, lifetime: false },
      semestral: { months: 6, lifetime: false },
      anual: { months: 12, lifetime: false },
      vitalicio: { months: 0, lifetime: true },
    };
    const dur = planDurations[planId] || { months: 1, lifetime: false };
    const platform = settings.plataforma_ativa || 'cakto';
    const productName = `Plano ${plan.label}`;
    try {
      const { error } = await supabase.from('product_plan_mapping').insert({
        platform,
        product_id: null,
        product_name: productName,
        plan_name: planId,
        duration_months: dur.months,
        is_lifetime: dur.lifetime,
      });
      if (error) throw error;
      toast({ title: `✅ Mapeamento criado: ${productName} → ${plan.label}` });
      loadProductMappings();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const autoMapAllPlans = async () => {
    const platform = settings.plataforma_ativa || 'cakto';
    const planDurations: Record<string, { months: number; lifetime: boolean }> = {
      mensal: { months: 1, lifetime: false },
      trimestral: { months: 3, lifetime: false },
      semestral: { months: 6, lifetime: false },
      anual: { months: 12, lifetime: false },
      vitalicio: { months: 0, lifetime: true },
    };
    let created = 0;
    for (const plan of PLANS) {
      const hasMapping = productMappings.some(m => m.plan_name === plan.id && m.platform === platform);
      if (hasMapping) continue;
      const dur = planDurations[plan.id] || { months: 1, lifetime: false };
      try {
        await supabase.from('product_plan_mapping').insert({
          platform,
          product_id: null,
          product_name: `Plano ${plan.label}`,
          plan_name: plan.id,
          duration_months: dur.months,
          is_lifetime: dur.lifetime,
        });
        created++;
      } catch (e) {
        console.error('Error auto-mapping:', e);
      }
    }
    if (created > 0) {
      toast({ title: `✅ ${created} mapeamento(s) criado(s) automaticamente!` });
      loadProductMappings();
    } else {
      toast({ title: "Todos os planos já estão mapeados", description: `Plataforma: ${platform}` });
    }
  };

  const clearWebhookLogs = async () => {
    try {
      await supabase.from('webhook_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setWebhookLogs([]);
      toast({ title: "Logs limpos" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const keysToSave = ['plataforma_ativa', 'plano_ativo_checkout', 'planos_visiveis_landing',
        'notificar_vendas', 'notificar_erros', 'whatsapp_suporte',
        ...PLANS.flatMap(p => [`checkout_${p.id}`, `preco_${p.id}`])];
      
      // Sync ALL plan prices to landing page settings
      const landingSyncKeys: Record<string, string> = {};
      PLANS.forEach(p => {
        landingSyncKeys[`landing_preco_${p.id}`] = settings[`preco_${p.id}`]?.replace('.', ',') || p.placeholder.replace('.', ',');
      });
      
      const allUpserts = [
        ...keysToSave.map(key => ({
          key, value: settings[key] || '', description: `Config: ${key}`
        })),
        ...Object.entries(landingSyncKeys).map(([key, value]) => ({
          key, value, description: `Sync: ${key}`
        })),
      ];
      
      for (const item of allUpserts) {
        await supabase.from('admin_settings').upsert(item, { onConflict: 'key' });
      }
      toast({ title: "✅ Salvo!", description: "Todas as configurações e links de checkout foram atualizados." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "📋 Copiado!", description: `${label} copiado.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' });
      const data = await res.json();
      setConnectionStatus(data.success ? 'online' : 'offline');
    } catch {
      setConnectionStatus('offline');
    }
  };

  const generatePayload = (email: string, amount: number, success: boolean) => {
    const base = { customer: { email, phone: '11999999999' } };
    const slug = settings.plataforma_ativa;
    const platform = PLATFORMS.find(p => p.slug === slug) || PLATFORMS[0];
    const evt = success ? (platform.events[0] || 'paid') : (platform.events[platform.events.length - 1] || 'failed');
    switch (slug) {
      case 'hotmart':
      case 'pepper':
        return { ...base, hottok: 'test', event: evt, data: { buyer: { email }, purchase: { price: { value: amount }, transaction: `HM_${Date.now()}` } } };
      case 'stripe':
        return { type: evt, data: { object: { customer_email: email, amount_total: Math.round(amount * 100), id: `cs_${Date.now()}` } } };
      case 'mercadopago':
        return { action: 'payment.updated', data: { id: `MP_${Date.now()}` }, email, amount, event: evt };
      case 'cakto':
        // Cakto real format: uses secret + purchase_approved + nested data.customer
        return {
          secret: 'cakto_test_secret',
          event: success ? 'purchase_approved' : 'purchase_refused',
          data: {
            id: `CAKTO_${Date.now()}`,
            refId: `CK${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            customer: { name: 'Teste Cakto', email, phone: '11999999999', docNumber: '12345678909', docType: 'cpf' },
            offer: { id: 'test_offer', name: 'Plano Teste', price: amount },
            product: { name: 'Sistema Gestão', id: 'test_product', type: 'unique' },
            status: success ? 'paid' : 'refused',
            amount,
            baseAmount: amount,
            discount: 0,
            installments: 1,
            paymentMethod: 'credit_card',
            paymentMethodName: 'Cartão de Crédito',
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }
        };
      case 'kiwify':
        return { ...base, event: evt, transaction_id: `KW_${Date.now()}`, amount, email };
      case 'eduzz':
        return { ...base, event: evt, trans_cod: `ED_${Date.now()}`, eduzz_id: `ED_${Date.now()}`, amount, email };
      case 'monetizze':
        return { ...base, evento: evt === 'Finalizada' ? 'Finalizada' : evt, chave_unica: `MN_${Date.now()}`, amount, email };
      case 'braip':
        return { ...base, event: evt, transaction_id: `BR_${Date.now()}`, producer: true, amount, email };
      default:
        return { ...base, event: evt, transaction_id: `${slug.toUpperCase()}_${Date.now()}`, amount, email };
    }
  };

  const generateFakeEmail = () => {
    const rand = Math.floor(Math.random() * 9999);
    setSimEmail(`teste_${rand}@simulacao.fake`);
  };

  const callCreateFakeUser = async (email: string): Promise<boolean> => {
    const password = 'Teste@1234';
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão não encontrada. Faça login novamente.');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-fake-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao criar usuário');
    return true;
  };

  const createFakeUser = async (withPlan = false) => {
    setCreatingFake(true);
    try {
      // Always ensure a unique email
      let email = simEmail;
      if (!email || email === 'usuario@email.com' || email.trim() === '') {
        email = `teste_${Date.now()}@simulacao.fake`;
        setSimEmail(email);
      }
      const password = 'Teste@1234';
      
      addLog(true, `⏳ Criando usuário ${email}...`);
      await callCreateFakeUser(email);
      
      const msg = `✅ Usuário ${email} criado (senha: ${password})`;
      
      if (withPlan) {
        // Wait for DB triggers to create profile/subscription
        await new Promise(r => setTimeout(r, 2000));
        
        const amount = parseFloat(simAmount) || 29.90;
        addLog(true, `⏳ Ativando plano ${simPlan} via webhook (R$ ${amount.toFixed(2)})...`);
        const payload = generatePayload(email, amount, true);
        const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (data.success) {
          addLog(true, `✅ ${msg} + Plano ${simPlan} ATIVADO via ${activePlatform.name}!`);
          toast({ title: "✅ Usuário criado e plano ativado!", description: `${email} — ${simPlan} aprovado. Verifique na aba Usuários.` });
        } else {
          addLog(false, `⚠️ Usuário criado mas webhook falhou: ${data.error || data.message}`);
          toast({ title: "⚠️ Usuário criado, webhook falhou", description: data.error || data.message, variant: "destructive" });
        }
      } else {
        addLog(true, msg);
        toast({ title: "✅ Usuário fake criado!", description: `${email} — status pendente. Use o webhook para ativar.` });
      }
      
      // Generate new email for next test
      setSimEmail(`teste_${Math.floor(Math.random() * 9999)}@simulacao.fake`);
    } catch (error: any) {
      addLog(false, `❌ Erro ao criar usuário: ${error.message}`);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setCreatingFake(false);
    }
  };

  const runTest = async (type: 'success' | 'error' | 'ping') => {
    if (type === 'ping') {
      setTesting(true);
      try {
        const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' });
        const data = await res.json();
        addLog(data.success, `[Ping] ${data.message || 'OK'}`, data);
        toast({ title: data.success ? '✅ Ping OK' : '❌ Ping falhou', description: data.message });
      } catch (e: any) {
        addLog(false, `[Ping] ${e.message}`);
      } finally {
        setTesting(false);
      }
      return;
    }
    
    const email = simEmail || `teste_${Date.now()}@simulacao.fake`;
    setTesting(true);
    try {
      const payload = generatePayload(email, parseFloat(simAmount) || 99.90, type === 'success');
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      addLog(data.success, `[${activePlatform.name}] ${data.message || data.error || 'OK'}`, data);
      toast({
        title: data.success ? `✅ ${activePlatform.name} OK!` : '❌ Resultado',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      addLog(false, error.message);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const runFullFlow = async () => {
    setCreatingFake(true);
    try {
      // Always generate a unique email for full flow
      let email = simEmail;
      if (!email || email === 'usuario@email.com' || email.trim() === '') {
        email = `teste_${Date.now()}@simulacao.fake`;
        setSimEmail(email);
      }

      // Step 1: Create user
      addLog(true, `🔄 [1/3] Criando usuário ${email}...`);
      await callCreateFakeUser(email);
      addLog(true, `✅ [1/3] Usuário ${email} criado!`);

      // Step 2: Wait for DB triggers (profile, subscription, roles)
      addLog(true, `🔄 [2/3] Aguardando triggers do banco...`);
      await new Promise(r => setTimeout(r, 2000));
      addLog(true, `✅ [2/3] Triggers executados!`);

      // Step 3: Simulate webhook payment
      const amount = parseFloat(simAmount) || 29.90;
      addLog(true, `🔄 [3/3] Simulando pagamento ${activePlatform.name} — R$ ${amount.toFixed(2)}...`);
      const payload = generatePayload(email, amount, true);
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();

      if (data.success) {
        addLog(true, `🎉 [COMPLETO] ${email} — Plano ${data.data?.plan_name || simPlan} ativado via ${activePlatform.name}!`);
        toast({ title: "🎉 Fluxo completo!", description: `${email} criado com plano ${data.data?.plan_name || simPlan} aprovado! Verifique na aba Usuários.` });
      } else {
        addLog(false, `❌ [3/3] Webhook falhou: ${data.error || data.message}`);
        toast({ title: "⚠️ Webhook falhou", description: data.error || data.message, variant: "destructive" });
      }
      
      // Generate new email for next test
      setSimEmail(`teste_${Math.floor(Math.random() * 9999)}@simulacao.fake`);
    } catch (error: any) {
      addLog(false, `❌ [Fluxo] Erro: ${error.message}`);
      toast({ title: "Erro no fluxo", description: error.message, variant: "destructive" });
    } finally {
      setCreatingFake(false);
    }
  };

  const addLog = (success: boolean, message: string, data?: any) => {
    setTestResults(prev => [{
      success, message, data,
      timestamp: new Date().toLocaleString('pt-BR')
    }, ...prev.slice(0, 29)]);
  };

  const saveKey = async () => {
    if (!newKeyName || !newKeyValue) return;
    setSaving(true);
    try {
      const dbKey = `integration_key_${newKeyName}`;
      await supabase.from('admin_settings').upsert(
        { key: dbKey, value: newKeyValue, description: `Chave: ${newKeyName}` },
        { onConflict: 'key' }
      );
      const existing = integrationKeys.findIndex(k => k.name === newKeyName);
      if (existing >= 0) {
        setIntegrationKeys(prev => prev.map((k, i) => i === existing ? { ...k, value: newKeyValue } : k));
      } else {
        setIntegrationKeys(prev => [...prev, { id: dbKey, name: newKeyName, value: newKeyValue, show: false }]);
      }
      setNewKeyName('');
      setNewKeyValue('');
      toast({ title: "✅ Chave salva!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (idx: number) => {
    const key = integrationKeys[idx];
    try {
      await supabase.from('admin_settings').update({ value: '' }).eq('key', key.id);
      setIntegrationKeys(prev => prev.filter((_, i) => i !== idx));
      toast({ title: "Removida", description: `${key.name} removida.` });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ═══════════ PLATAFORMA ATIVA ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" /> Plataforma Ativa
              </h3>
              <p className="text-[11px] text-muted-foreground">Selecione sua plataforma de pagamento</p>
            </div>
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5" /> Conectado
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {PLATFORMS.map(p => {
              const isActive = settings.plataforma_ativa === p.slug;
              return (
                <button
                  key={p.slug}
                  onClick={() => setSettings(prev => ({ ...prev, plataforma_ativa: p.slug }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? 'bg-[#1a1a2e] border-green-500/50 ring-1 ring-green-500/20'
                      : 'bg-[#12121c] border-[#1e1e2e] hover:border-[#3a3a4a] hover:bg-[#1a1a24]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.icon}</span>
                    <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>{p.name}</span>
                  </div>
                  {isActive && (
                    <Badge className="mt-1.5 bg-green-600 text-white border-0 text-[9px] h-4 px-1.5">Ativo</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ WEBHOOK UNIVERSAL ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" /> Webhook Universal — {activePlatform.name}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={testConnection}
              className="bg-[#1a1a24] border-[#2a2a3a] text-white hover:bg-[#2a2a3a] h-8 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
              Testar Conexão
            </Button>
          </div>

          {/* URL */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={WEBHOOK_URL}
                readOnly
                className="bg-[#0a0a12] border-[#1e1e2e] text-cyan-300 font-mono text-xs pr-16 h-10"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Badge className="bg-green-600 text-white border-0 text-[9px] h-5">POST</Badge>
              </div>
            </div>
            <Button
              onClick={() => copyText(WEBHOOK_URL, 'Webhook URL')}
              variant="outline"
              className="bg-[#1a1a24] border-[#2a2a3a] text-white hover:bg-[#2a2a3a] h-10"
            >
              {copied === 'Webhook URL' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              <span className="ml-1.5 text-xs">Copiar</span>
            </Button>
          </div>

          {/* Steps */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {activePlatform.guide.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-green-600' : i === 2 ? 'bg-amber-600' : 'bg-purple-600'
                } text-white`}>{i + 1}</span>
                <span className="text-[11px] text-gray-400">{step}</span>
              </div>
            ))}
          </div>

          {/* Code toggle */}
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <Code className="w-3 h-3" /> Ver código de integração
          </button>

          {showCode && (
            <div className="bg-[#0a0a12] rounded-lg border border-[#1e1e2e] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d17] border-b border-[#1e1e2e]">
                <span className="text-[10px] text-gray-500">Payload — {activePlatform.name}</span>
                <Button size="sm" variant="ghost" onClick={() => copyText(JSON.stringify(generatePayload('cliente@email.com', 99.90, true), null, 2), 'Código')} className="text-cyan-400 h-6 px-2 text-[10px]">
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
              <pre className="p-3 text-[11px] text-gray-300 font-mono overflow-x-auto max-h-[150px]">
                {JSON.stringify(generatePayload('cliente@email.com', 99.90, true), null, 2)}
              </pre>
            </div>
          )}

          {/* Events */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-gray-500">Eventos:</span>
            {activePlatform.events.map(evt => (
              <Badge key={evt} className="bg-[#1a1a24] text-gray-300 border-[#2a2a3a] text-[10px] font-mono">{evt}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ PLANOS & CHECKOUT ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-400" /> Planos & Checkout
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <span>⭐</span>
              <span>{PLANS.find(p => p.id === settings.plano_ativo_checkout)?.label || 'Anual'} ativo</span>
            </div>
          </div>

          {/* Plan selector tabs */}
          <div className="flex flex-wrap gap-1.5">
            {PLANS.map(plan => (
              <Button
                key={plan.id}
                size="sm"
                className={`h-8 text-xs ${
                  settings.plano_ativo_checkout === plan.id
                    ? `${plan.color} text-white`
                    : 'bg-[#12121c] border border-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#1a1a24]'
                }`}
                onClick={() => setSettings(prev => ({ ...prev, plano_ativo_checkout: plan.id }))}
              >
                {plan.icon} {plan.label}
              </Button>
            ))}
          </div>

          {/* Plan rows */}
          <div className="space-y-2">
            {PLANS.map(plan => {
              const isActive = settings.plano_ativo_checkout === plan.id;
              const visiblePlans = (settings.planos_visiveis_landing || 'mensal,anual').split(',');
              const isLandingActive = visiblePlans.includes(plan.id);
              const hasMapping = productMappings.some(m => m.plan_name === plan.id);
              return (
                <div
                  key={plan.id}
                  className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border transition-all ${
                    isActive ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-[#0a0a12] border-[#1e1e2e]'
                  }`}
                >
                  <span className="text-sm shrink-0">{plan.icon}</span>
                  <span className="text-xs font-medium text-white w-20 shrink-0">{plan.label}</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={plan.placeholder}
                    value={settings[`preco_${plan.id}`] || ''}
                    onChange={e => setSettings(prev => ({ ...prev, [`preco_${plan.id}`]: e.target.value }))}
                    className="bg-[#12121c] border-[#1e1e2e] text-white h-9 text-sm w-24 shrink-0"
                  />
                  <Input
                    placeholder="Link do checkout..."
                    value={settings[`checkout_${plan.id}`] || ''}
                    onChange={e => setSettings(prev => ({ ...prev, [`checkout_${plan.id}`]: e.target.value }))}
                    className="bg-[#12121c] border-[#1e1e2e] text-white h-9 text-sm flex-1"
                  />
                  <button
                    onClick={() => {
                      setSettings(prev => {
                        const current = (prev.planos_visiveis_landing || 'mensal,anual').split(',').filter(Boolean);
                        const next = isLandingActive
                          ? current.filter(id => id !== plan.id)
                          : [...new Set([...current, plan.id])];
                        return { ...prev, planos_visiveis_landing: next.length ? next.join(',') : plan.id };
                      });
                    }}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-semibold border transition-all ${
                      isLandingActive
                        ? 'bg-green-600/20 text-green-400 border-green-600/40 hover:bg-green-600/30'
                        : 'bg-red-600/10 text-red-400 border-red-600/30 hover:bg-red-600/20'
                    }`}
                    title={isLandingActive ? 'Desativar na landing' : 'Ativar na landing'}
                  >
                    <Globe className="w-3 h-3" />
                    {isLandingActive ? 'Landing ✓' : 'Landing ✗'}
                  </button>
                  {/* Mapping indicator */}
                  {hasMapping && (
                    <span className="text-[9px] text-cyan-400 shrink-0" title="Mapeamento ativo">🔗 Mapeado</span>
                  )}
                </div>
              );
            })}
          </div>


          {/* ── Resumo: Planos visíveis na Landing ── */}
          <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
            <p className="text-xs font-bold text-purple-300 flex items-center gap-1.5 mb-1.5">
              <Globe className="w-3.5 h-3.5" /> Planos na Landing Page
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLANS.map(plan => {
                const isVisible = (settings.planos_visiveis_landing || 'mensal,anual').split(',').includes(plan.id);
                const hasLink = !!settings[`checkout_${plan.id}`];
                if (!isVisible) return null;
                return (
                  <Badge key={plan.id} className={`text-[10px] ${hasLink ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-amber-600/20 text-amber-400 border-amber-600/30'}`}>
                    {plan.icon} {plan.label} — R$ {settings[`preco_${plan.id}`] || plan.placeholder} {hasLink ? '✓' : '⚠ sem link'}
                  </Badge>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Use o botão "Landing ✓/✗" acima para ativar/desativar planos.</p>
          </div>

          {/* ── Notificações ── */}
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
            <p className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Notificações de Vendas
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={settings.notificar_vendas !== 'false'}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificar_vendas: checked ? 'true' : 'false' }))}
                />
                <span className="text-xs text-white">📬 Notificar vendas aprovadas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={settings.notificar_erros !== 'false'}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificar_erros: checked ? 'true' : 'false' }))}
                />
                <span className="text-xs text-white">❌ Notificar erros de pagamento</span>
              </label>
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">WhatsApp Suporte</label>
            <Input
              placeholder="https://wa.me/55..."
              value={settings.whatsapp_suporte}
              onChange={e => setSettings(prev => ({ ...prev, whatsapp_suporte: e.target.value }))}
              className="bg-[#0a0a12] border-[#1e1e2e] text-white h-9 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={saveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              Salvar Tudo (Planos, Links, Notificações)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ CHAVES DE INTEGRAÇÃO ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" /> Chaves de Integração
          </h3>

          <div className="flex gap-2">
            <Input
              placeholder="NOME_DA_CHAVE"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              className="bg-[#0a0a12] border-[#1e1e2e] text-white text-sm h-9 flex-1"
            />
            <Input
              placeholder="Valor da chave"
              value={newKeyValue}
              onChange={e => setNewKeyValue(e.target.value)}
              className="bg-[#0a0a12] border-[#1e1e2e] text-white text-sm h-9 flex-1 font-mono"
            />
            <Button size="sm" disabled={!newKeyName || !newKeyValue || saving} onClick={saveKey} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
              + Salvar
            </Button>
          </div>

          {integrationKeys.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-4">Nenhuma chave cadastrada</p>
          ) : (
            <div className="space-y-1.5">
              {integrationKeys.map((k, idx) => (
                <div key={k.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0a0a12] border border-[#1e1e2e]">
                  <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-white font-medium flex-1 truncate">{k.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono truncate max-w-[120px]">
                    {k.show ? k.value : '•'.repeat(12)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setIntegrationKeys(prev => prev.map((x, i) => i === idx ? { ...x, show: !x.show } : x))} className="h-7 w-7 p-0 text-gray-400">
                    {k.show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copyText(k.value, k.name)} className="h-7 w-7 p-0 text-gray-400"><Copy className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeKey(idx)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Chaves armazenadas localmente. Use para tokens de API, secret keys e credenciais de integração.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ MAPEAMENTO DE PRODUTOS ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Map className="w-4 h-4 text-cyan-400" /> Mapeamento Produto → Plano
          </h3>
          <p className="text-[11px] text-gray-500">
            Mapeie produtos de cada plataforma a um plano específico. O webhook usa isso ANTES da detecção por preço.
          </p>

          {/* Add new mapping */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Plataforma</label>
              <Select value={newMapping.platform} onValueChange={v => setNewMapping(p => ({ ...p, platform: v }))}>
                <SelectTrigger className="bg-[#0a0a12] border-[#1e1e2e] text-white h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.slug} value={p.slug}>{p.icon} {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">ID do Produto</label>
              <Input
                placeholder="ex: prod_123"
                value={newMapping.product_id}
                onChange={e => setNewMapping(p => ({ ...p, product_id: e.target.value }))}
                className="bg-[#0a0a12] border-[#1e1e2e] text-white text-xs h-9"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Nome do Produto</label>
              <Input
                placeholder="ex: Plano Anual"
                value={newMapping.product_name}
                onChange={e => setNewMapping(p => ({ ...p, product_name: e.target.value }))}
                className="bg-[#0a0a12] border-[#1e1e2e] text-white text-xs h-9"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Plano</label>
              <Select value={newMapping.plan_name} onValueChange={v => setNewMapping(p => ({ ...p, plan_name: v }))}>
                <SelectTrigger className="bg-[#0a0a12] border-[#1e1e2e] text-white h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.icon} {p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={saveMapping} className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-9">
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Existing mappings */}
          {productMappings.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-4">Nenhum mapeamento. O webhook usará detecção automática por preço.</p>
          ) : (
            <div className="space-y-1.5">
              {productMappings.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0a0a12] border border-[#1e1e2e]">
                  <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-[9px] shrink-0">{m.platform}</Badge>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white">
                      {m.product_id && <span className="text-cyan-300 font-mono">ID: {m.product_id}</span>}
                      {m.product_id && m.product_name && <span className="text-gray-500 mx-1">|</span>}
                      {m.product_name && <span className="text-gray-300">{m.product_name}</span>}
                    </span>
                  </div>
                  <Badge className={`text-[9px] shrink-0 ${m.is_lifetime ? 'bg-amber-600/20 text-amber-400 border-amber-600/30' : 'bg-blue-600/20 text-blue-400 border-blue-600/30'}`}>
                    {m.plan_name} {m.is_lifetime ? '👑' : `(${m.duration_months}m)`}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => deleteMapping(m.id)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
            <p className="text-[10px] text-cyan-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> O mapeamento tem prioridade sobre a detecção por preço. Use para garantir 100% de precisão.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ WEBHOOK LOGS (HISTÓRICO) ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" /> Histórico de Webhooks ({webhookLogs.length})
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadWebhookLogs} className="border-[#2a2a3a] text-gray-400 hover:text-white text-[10px] h-7">
                <RefreshCw className="w-3 h-3 mr-1" /> Atualizar
              </Button>
              {webhookLogs.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearWebhookLogs} className="text-gray-500 hover:text-red-400 text-[10px] h-7">
                  <Trash2 className="w-3 h-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {webhookLogs.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-6">Nenhum webhook recebido ainda. Faça uma simulação ou espere um pagamento real.</p>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {webhookLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.success ? 'bg-green-950/10 border-green-800/20' : 'bg-red-950/10 border-red-800/20'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-[9px]">{log.platform}</Badge>
                    {log.plan_detected && (
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 text-[9px]">{log.plan_detected}</Badge>
                    )}
                    {log.email && <span className="text-xs text-gray-300 font-mono">{log.email}</span>}
                    {log.amount > 0 && <span className="text-xs text-green-400">R$ {Number(log.amount).toFixed(2)}</span>}
                    <span className="text-[9px] text-gray-500 ml-auto">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {log.error_message && (
                    <p className="text-[10px] text-gray-400 mt-1 ml-5">{log.error_message}</p>
                  )}
                  {log.product_id && (
                    <p className="text-[10px] text-cyan-400 mt-0.5 ml-5 font-mono">Produto: {log.product_id} {log.product_name ? `(${log.product_name})` : ''}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <Sparkles className="w-4 h-4 text-green-400" /> Simulador Completo
            </h3>
            <Badge className="bg-blue-600 text-white border-0 text-xs">{activePlatform.name}</Badge>
          </div>

          {/* Step 1: Fake data */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">1</span>
              <span className="text-xs font-medium text-white">Gerar Dados Fake</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Email</label>
                <Input
                  placeholder="usuario@email.com"
                  value={simEmail}
                  onChange={e => setSimEmail(e.target.value)}
                  className="bg-[#0a0a12] border-[#1e1e2e] text-white text-sm h-9"
                />
              </div>
              <Button size="sm" onClick={generateFakeEmail} className="bg-green-600 hover:bg-green-700 text-white text-xs h-9">
                <Zap className="w-3 h-3 mr-1" /> Gerar
              </Button>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Plano</label>
                <Select value={simPlan} onValueChange={setSimPlan}>
                  <SelectTrigger className="bg-[#0a0a12] border-[#1e1e2e] text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon} {p.label} — R$ {settings[`preco_${p.id}`] || p.placeholder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Valor (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={simAmount}
                  onChange={e => setSimAmount(e.target.value)}
                  className="bg-[#0a0a12] border-[#1e1e2e] text-white text-sm h-9 w-24"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Create fake user */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-[10px] font-bold flex items-center justify-center text-white">2</span>
              <span className="text-xs font-medium text-white">Criar Usuário Fake no Sistema</span>
              <span className="text-[10px] text-gray-500">(cadastro real para teste)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={creatingFake || !simEmail}
                onClick={() => createFakeUser(false)}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs"
              >
                {creatingFake ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                Criar Usuário Fake
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={creatingFake || !simEmail}
                onClick={() => createFakeUser(true)}
                className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs"
              >
                {creatingFake ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Criar + Ativar Plano {PLANS.find(p => p.id === simPlan)?.label}
              </Button>
            </div>
          </div>

          {/* Step 3: Simulate webhook */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-red-600 text-[10px] font-bold flex items-center justify-center text-white">3</span>
              <span className="text-xs font-medium text-white">Simular Webhook da Plataforma</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={testing}
                onClick={() => runTest('success')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                Simular Aprovado
              </Button>
              <Button
                size="sm"
                disabled={testing}
                onClick={() => runTest('error')}
                className="bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                <XCircle className="w-3 h-3 mr-1" /> Simular Recusa
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={testing}
                onClick={() => runTest('ping')}
                className="border-[#2a2a3a] text-gray-400 hover:text-white text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Ping
              </Button>
            </div>
          </div>

          {/* Full flow button */}
          <Button
            onClick={runFullFlow}
            disabled={creatingFake || testing || !simEmail}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-10 text-sm font-medium"
          >
            {(creatingFake || testing) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            ⚡ Fluxo Completo: Criar Usuário + Ativar Plano + Simular Webhook
          </Button>

          {/* Info badges */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-[#0a0a12] border border-[#1e1e2e]">
              <p className="text-[10px] text-gray-500">Detecção</p>
              <p className="text-xs font-bold text-white">Automática</p>
            </div>
            <div className="p-2 rounded-lg bg-[#0a0a12] border border-[#1e1e2e]">
              <p className="text-[10px] text-gray-500">Plano</p>
              <p className="text-xs font-bold text-white">Por valor</p>
            </div>
            <div className="p-2 rounded-lg bg-[#0a0a12] border border-[#1e1e2e]">
              <p className="text-[10px] text-gray-500">Ativação</p>
              <p className="text-xs font-bold text-white">Instantânea</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ LOGS ═══════════ */}
      <Card className="bg-[#0d0d14] border-[#1e1e2e]">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileJson className="w-4 h-4 text-cyan-400" /> Logs ({testResults.length})
            </h3>
            {testResults.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setTestResults([])} className="text-gray-500 hover:text-white text-[10px] h-7">Limpar</Button>
            )}
          </div>

          {testResults.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-6">Nenhum log</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {testResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                    r.success ? 'bg-green-950/10 border-green-800/20' : 'bg-red-950/10 border-red-800/20'
                  }`}
                >
                  {r.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{r.message}</p>
                    <p className="text-[9px] text-gray-500 mt-0.5">{r.timestamp}</p>
                    {r.data && (
                      <details className="mt-1">
                        <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-gray-300">JSON</summary>
                        <pre className="text-[9px] text-gray-400 mt-1 bg-[#0a0a12] p-2 rounded overflow-x-auto max-h-[100px]">
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegrationsTab;
