import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, CheckCircle2, XCircle, Send, Loader2,
  ExternalLink, RefreshCw, Zap, Globe, Shield,
  CreditCard, Smartphone, Eye, EyeOff, Code, Plug,
  FileJson, Key, Plus, Trash2, Settings, ChevronDown
} from "lucide-react";

const WEBHOOK_URL = 'https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/payment-webhook';

type TestResult = { success: boolean; message: string; data?: any; timestamp: string; };

type Platform = {
  name: string;
  slug: string;
  color: string;
  icon: string;
  guide: string[];
  events: string[];
};

const PLATFORMS: Platform[] = [
  { name: 'Cakto', slug: 'cakto', color: 'from-pink-500 to-rose-600', icon: '🎂', guide: ['Configurações > Integrações > Webhook', 'Cole a URL do webhook', 'Selecione: pagamento aprovado/recusado', 'Salve e teste'], events: ['payment_approved', 'payment_refused', 'subscription_active'] },
  { name: 'GGCheckout', slug: 'ggcheckout', color: 'from-green-500 to-emerald-600', icon: '💳', guide: ['Configurações > Webhooks', 'Adicionar Webhook', 'Cole a URL, selecione "Pagamento Aprovado"', 'Salve'], events: ['pix_paid', 'card_paid', 'failed'] },
  { name: 'Hotmart', slug: 'hotmart', color: 'from-orange-500 to-red-500', icon: '🔥', guide: ['Ferramentas > Webhook (Hottok)', 'Configure a URL de notificação', 'Selecione compra aprovada', 'Ative'], events: ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'] },
  { name: 'Kiwify', slug: 'kiwify', color: 'from-purple-500 to-violet-600', icon: '🥝', guide: ['Configurações > Webhooks', 'Adicione URL', 'Selecione "Compra Aprovada"', 'Salve'], events: ['order_paid', 'subscription_created'] },
  { name: 'Eduzz', slug: 'eduzz', color: 'from-blue-500 to-indigo-600', icon: '📦', guide: ['Configurações > Notificações', 'Configure Postback URL', 'Selecione "Pago"', 'Ative'], events: ['paid', 'refunded'] },
  { name: 'Monetizze', slug: 'monetizze', color: 'from-teal-500 to-cyan-600', icon: '💰', guide: ['Configurações > Postback', 'Informe a URL', 'Selecione "Compra Finalizada"', 'Salve'], events: ['Finalizada', 'Cancelada'] },
  { name: 'Stripe', slug: 'stripe', color: 'from-indigo-500 to-purple-600', icon: '💎', guide: ['Developers > Webhooks', 'Add Endpoint', 'Cole URL e selecione eventos', 'Salve'], events: ['checkout.session.completed', 'payment_intent.succeeded'] },
  { name: 'Mercado Pago', slug: 'mercadopago', color: 'from-sky-400 to-blue-500', icon: '🔵', guide: ['Configurações > Notificações IPN', 'Configure URL', 'Selecione "Payments"', 'Salve'], events: ['payment.created', 'payment.updated'] },
  { name: 'PagSeguro', slug: 'pagseguro', color: 'from-green-400 to-green-600', icon: '🟢', guide: ['Vendas > Configurações', 'URL de notificação', 'Transações aprovadas', 'Salve'], events: ['paid', 'available'] },
  { name: 'Braip', slug: 'braip', color: 'from-amber-500 to-orange-600', icon: '🚀', guide: ['Configurações > Postback', 'URL de notificação', '"Venda Aprovada"', 'Ative'], events: ['approved', 'refunded'] },
  { name: 'Yampi', slug: 'yampi', color: 'from-violet-500 to-fuchsia-600', icon: '🛒', guide: ['Configurações > Webhooks', 'Adicione URL', 'Eventos de pedido', 'Salve'], events: ['order.paid', 'order.cancelled'] },
  { name: 'Pepper', slug: 'pepper', color: 'from-red-500 to-orange-500', icon: '🌶️', guide: ['Mesmo do Hotmart', 'Ferramentas > Webhook', 'Configure compra', 'Salve'], events: ['PURCHASE_APPROVED'] },
];

const PLANS = [
  { id: 'mensal', label: 'Mensal', icon: '💳', placeholder: '29.90' },
  { id: 'trimestral', label: 'Trimestral', icon: '📘', placeholder: '69.90' },
  { id: 'semestral', label: 'Semestral', icon: '📗', placeholder: '149.90' },
  { id: 'anual', label: 'Anual', icon: '⭐', placeholder: '199.90' },
  { id: 'vitalicio', label: 'Vitalício', icon: '👑', placeholder: '499.90' },
];

export const AdminIntegrationsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');
  const [activeTab, setActiveTab] = useState('conexao');
  const [showGuide, setShowGuide] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testAmount, setTestAmount] = useState('99.90');
  const [integrationKeys, setIntegrationKeys] = useState<Array<{ id: string; name: string; value: string; show: boolean }>>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({
    plataforma_ativa: 'cakto',
    plano_ativo_checkout: 'anual',
    checkout_mensal: '', checkout_trimestral: '', checkout_semestral: '', checkout_anual: '', checkout_vitalicio: '',
    preco_mensal: '', preco_trimestral: '', preco_semestral: '', preco_anual: '', preco_vitalicio: '',
    whatsapp_suporte: '',
  });

  const activePlatform = PLATFORMS.find(p => p.slug === settings.plataforma_ativa) || PLATFORMS[0];

  useEffect(() => {
    loadSettings();
    testConnection();
  }, []);

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

  const saveAll = async () => {
    setSaving(true);
    try {
      const keysToSave = ['plataforma_ativa', 'plano_ativo_checkout', 'whatsapp_suporte',
        ...PLANS.flatMap(p => [`checkout_${p.id}`, `preco_${p.id}`])];
      for (const key of keysToSave) {
        await supabase.from('admin_settings').upsert(
          { key, value: settings[key] || '', description: `Config: ${key}` },
          { onConflict: 'key' }
        );
      }
      toast({ title: "✅ Salvo!", description: "Todas as configurações foram atualizadas." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copiado!", description: `${label} copiado.` });
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
    const evt = success ? (activePlatform.events[0] || 'paid') : (activePlatform.events[activePlatform.events.length - 1] || 'failed');
    switch (slug) {
      case 'hotmart':
      case 'pepper':
        return { ...base, hottok: 'test', event: evt, data: { buyer: { email }, purchase: { price: { value: amount }, transaction: `HM_${Date.now()}` } } };
      case 'stripe':
        return { type: evt, data: { object: { customer_email: email, amount_total: Math.round(amount * 100), id: `cs_${Date.now()}` } } };
      case 'mercadopago':
        return { action: 'payment.updated', data: { id: `MP_${Date.now()}` }, email, amount, event: evt };
      default:
        return { ...base, event: evt, transaction_id: `${slug.toUpperCase()}_${Date.now()}`, amount, email };
    }
  };

  const runTest = async (type: 'success' | 'error') => {
    const email = testEmail || `teste_${Date.now()}@simulacao.fake`;
    if (!testEmail) setTestEmail(email);
    setTesting(true);
    try {
      const payload = generatePayload(email, parseFloat(testAmount) || 99.90, type === 'success');
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setTestResults(prev => [{
        success: data.success,
        message: `[${activePlatform.name}] ${data.message || data.error || 'OK'}`,
        data,
        timestamp: new Date().toLocaleString('pt-BR')
      }, ...prev.slice(0, 19)]);
      toast({
        title: data.success ? `✅ ${activePlatform.name} OK!` : 'Resultado',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive'
      });
    } catch (error: any) {
      setTestResults(prev => [{
        success: false,
        message: error.message,
        timestamp: new Date().toLocaleString('pt-BR')
      }, ...prev.slice(0, 19)]);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
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
      toast({ title: "✅ Chave salva!", description: `${newKeyName} pronta para uso.` });
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

  const statusColor = connectionStatus === 'online'
    ? 'bg-green-500'
    : connectionStatus === 'offline'
      ? 'bg-red-500'
      : connectionStatus === 'testing'
        ? 'bg-yellow-500 animate-pulse'
        : 'bg-gray-500';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 relative">
            <Zap className="w-5 h-5 text-purple-400" />
            <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusColor} border-2 border-[#0a0a0f]`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Integrações</h2>
            <p className="text-gray-500 text-xs">Webhook universal • Alteração rápida</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={testConnection}
            className="bg-[#1a1a24] border-[#2a2a3a] text-white hover:bg-[#2a2a3a] h-8 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
            {connectionStatus === 'online' ? 'Online' : 'Verificar'}
          </Button>
          <Button
            size="sm"
            onClick={saveAll}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

      {/* Plataforma Ativa */}
      <Card className="bg-gradient-to-r from-[#1a1a24] to-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plug className="w-4 h-4 text-purple-400" />
              Plataforma Ativa
            </h3>
            <Badge className={`bg-gradient-to-r ${activePlatform.color} text-white border-0 text-xs`}>
              {activePlatform.icon} {activePlatform.name}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map(p => (
              <Button
                key={p.slug}
                size="sm"
                variant={settings.plataforma_ativa === p.slug ? 'default' : 'outline'}
                className={`h-8 text-xs ${
                  settings.plataforma_ativa === p.slug
                    ? `bg-gradient-to-r ${p.color} text-white border-0 shadow-lg`
                    : 'bg-[#0f0f17] border-[#2a2a3a] text-gray-400 hover:text-white hover:bg-[#2a2a3a]'
                }`}
                onClick={() => setSettings(prev => ({ ...prev, plataforma_ativa: p.slug }))}
              >
                <span className="mr-1">{p.icon}</span>{p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Simulador Verde */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-green-600/15 to-emerald-600/10 border border-green-500/30 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Simulador</span>
        </div>
        <Input
          placeholder="email@teste.com"
          value={testEmail}
          onChange={e => setTestEmail(e.target.value)}
          className="bg-[#1a1a24] border-green-500/30 text-white text-xs h-8 w-[150px] placeholder:text-gray-600"
        />
        <Input
          placeholder="R$"
          value={testAmount}
          onChange={e => setTestAmount(e.target.value)}
          className="bg-[#1a1a24] border-green-500/30 text-white text-xs h-8 w-[70px] placeholder:text-gray-600"
        />
        <Button
          size="sm"
          disabled={testing}
          onClick={() => runTest('success')}
          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
        >
          {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Testar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={testing}
          onClick={() => runTest('error')}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs"
        >
          <XCircle className="w-3 h-3 mr-1" /> Erro
        </Button>
        {testResults.length > 0 && (
          <Badge className={`text-[10px] ${testResults[0].success ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-red-600/20 text-red-400 border-red-500/30'}`}>
            {testResults[0].success ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            {testResults[0].success ? 'Recebido ✓' : 'Falhou ✗'}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="conexao" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs">
            <Globe className="w-3.5 h-3.5 mr-1" /> Conexão
          </TabsTrigger>
          <TabsTrigger value="checkout" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs">
            <CreditCard className="w-3.5 h-3.5 mr-1" /> Checkout
          </TabsTrigger>
          <TabsTrigger value="chaves" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs">
            <Key className="w-3.5 h-3.5 mr-1" /> Chaves
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs">
            <FileJson className="w-3.5 h-3.5 mr-1" /> Logs ({testResults.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB: Conexão */}
        <TabsContent value="conexao" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4 space-y-4">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Webhook Universal — {activePlatform.icon} {activePlatform.name}
              </h4>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={WEBHOOK_URL}
                    readOnly
                    className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 font-mono text-xs pr-14"
                  />
                  <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-600/20 text-green-400 border-green-600/30 text-[9px]">
                    POST
                  </Badge>
                </div>
                <Button
                  onClick={() => copyText(WEBHOOK_URL, 'Webhook URL')}
                  variant="outline"
                  size="sm"
                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"
                >
                  {copied === 'Webhook URL' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* Guia */}
              <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a] space-y-3">
                <button onClick={() => setShowGuide(!showGuide)} className="w-full flex items-center justify-between text-left">
                  <span className="text-xs font-medium text-white flex items-center gap-2">
                    <span>{activePlatform.icon}</span>
                    Como configurar no {activePlatform.name}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
                </button>
                {showGuide && (
                  <div className="space-y-3 pt-2 border-t border-[#2a2a3a]">
                    <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
                      {activePlatform.guide.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-gray-500">Eventos:</span>
                      {activePlatform.events.map(evt => (
                        <Badge key={evt} className="bg-green-600/10 text-green-400 border border-green-600/20 text-[9px] font-mono">
                          {evt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payload */}
              <div className="bg-[#0f0f17] rounded-lg border border-[#2a2a3a] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-[#13131d] border-b border-[#2a2a3a]">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Code className="w-3 h-3 text-cyan-400" /> Payload exemplo — {activePlatform.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const code = `// Webhook: ${activePlatform.name}\n// URL: ${WEBHOOK_URL}\n// Método: POST\n// Eventos: ${activePlatform.events.join(', ')}\n\n${JSON.stringify(generatePayload('cliente@email.com', 99.90, true), null, 2)}`;
                      copyText(code, 'Código');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 h-6 px-2 text-[10px]"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                </div>
                <pre className="p-3 text-[11px] text-gray-300 font-mono overflow-x-auto max-h-[150px] leading-relaxed">
                  {JSON.stringify(generatePayload('cliente@email.com', 99.90, true), null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={saveAll}
                  disabled={saving}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Checkout */}
        <TabsContent value="checkout" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4 space-y-4">
              {/* Plano ativo */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  🎯 Plano Ativo no Gate
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {PLANS.map(plan => (
                    <Button
                      key={plan.id}
                      size="sm"
                      className={`h-8 text-xs ${
                        settings.plano_ativo_checkout === plan.id
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-[#0f0f17] border border-[#2a2a3a] text-gray-400 hover:text-white hover:bg-[#2a2a3a]'
                      }`}
                      onClick={() => setSettings(prev => ({ ...prev, plano_ativo_checkout: plan.id }))}
                    >
                      {plan.icon} {plan.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Plans */}
              <div className="space-y-3">
                {PLANS.map(plan => {
                  const isActive = settings.plano_ativo_checkout === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className={`p-3 rounded-lg border transition-all ${
                        isActive ? 'bg-green-500/5 border-green-500/30' : 'bg-[#0f0f17] border-[#2a2a3a]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span>{plan.icon}</span>
                        <span className="text-sm font-medium text-white">{plan.label}</span>
                        {isActive && <Badge className="bg-green-600 text-white text-[9px] h-5">Ativo</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">Preço (R$)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={plan.placeholder}
                            value={settings[`preco_${plan.id}`] || ''}
                            onChange={e => setSettings(prev => ({ ...prev, [`preco_${plan.id}`]: e.target.value }))}
                            className="bg-[#1a1a24] border-[#2a2a3a] text-white h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">Link Checkout</label>
                          <div className="flex gap-1">
                            <Input
                              placeholder="https://checkout..."
                              value={settings[`checkout_${plan.id}`] || ''}
                              onChange={e => setSettings(prev => ({ ...prev, [`checkout_${plan.id}`]: e.target.value }))}
                              className="bg-[#1a1a24] border-[#2a2a3a] text-white h-9 text-sm"
                            />
                            {settings[`checkout_${plan.id}`] && (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => copyText(settings[`checkout_${plan.id}`], plan.label)}
                                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] h-9 w-9 shrink-0"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => window.open(settings[`checkout_${plan.id}`], '_blank')}
                                  className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] h-9 w-9 shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-green-400" /> WhatsApp Suporte
                </label>
                <Input
                  placeholder="https://wa.me/5511999999999"
                  value={settings.whatsapp_suporte}
                  onChange={e => setSettings(prev => ({ ...prev, whatsapp_suporte: e.target.value }))}
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white h-9 text-sm"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={saveAll}
                  disabled={saving}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Chaves */}
        <TabsContent value="chaves" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4 space-y-4">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> Chaves de Integração
              </h4>
              <p className="text-xs text-gray-500">Cole sua chave secreta, salve e o sistema reconhece automaticamente.</p>

              {/* Add key */}
              <div className="p-3 rounded-lg border border-dashed border-green-500/30 bg-green-500/5 space-y-2">
                <Input
                  placeholder="NOME_DA_CHAVE (ex: API_KEY_CAKTO)"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                  className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm h-9"
                />
                <div className="relative">
                  <Input
                    placeholder="Cole sua chave secreta aqui (Ctrl+V)"
                    value={newKeyValue}
                    onChange={e => setNewKeyValue(e.target.value)}
                    className="bg-[#1a1a24] border-[#2a2a3a] text-white text-sm h-9 font-mono pr-16"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const t = await navigator.clipboard.readText();
                        setNewKeyValue(t);
                        toast({ title: "Colado!" });
                      } catch {
                        // silent
                      }
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-green-400 hover:text-green-300 text-[10px]"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Colar
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!newKeyName || !newKeyValue || saving}
                    onClick={saveKey}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Salvar Chave
                  </Button>
                  {newKeyValue && (
                    <span className="text-[10px] text-green-400/70">{newKeyValue.length} caracteres</span>
                  )}
                </div>
              </div>

              {/* Existing keys */}
              {integrationKeys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Key className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Nenhuma chave cadastrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {integrationKeys.map((k, idx) => (
                    <div
                      key={k.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0f0f17] border border-[#2a2a3a] hover:border-amber-500/30 transition-all"
                    >
                      <Key className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{k.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          {k.show ? k.value : `${'•'.repeat(16)} (${k.value.length})`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIntegrationKeys(prev => prev.map((x, i) => i === idx ? { ...x, show: !x.show } : x))}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                      >
                        {k.show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyText(k.value, k.name)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setNewKeyName(k.name); setNewKeyValue(k.value); }}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-amber-400"
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeKey(idx)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                <p className="text-[10px] text-green-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Chaves salvas com segurança. Use o simulador para validar.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Logs */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-cyan-400" /> Histórico de Testes
                </h4>
                {testResults.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTestResults([])}
                    className="text-gray-500 hover:text-white text-[10px] h-7"
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {testResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileJson className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Nenhum teste realizado</p>
                  <p className="text-[10px] mt-1">Use o simulador verde acima</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {testResults.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border transition-all ${
                        r.success
                          ? 'bg-green-950/10 border-green-800/20'
                          : 'bg-red-950/10 border-red-800/20'
                      }`}
                    >
                      {r.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white">{r.message}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{r.timestamp}</p>
                        {r.data && (
                          <details className="mt-1">
                            <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-gray-300">
                              JSON
                            </summary>
                            <pre className="text-[9px] text-gray-400 mt-1 bg-[#0f0f17] p-2 rounded overflow-x-auto max-h-[100px]">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminIntegrationsTab;
