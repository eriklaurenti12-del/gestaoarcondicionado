import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Copy, CheckCircle2, XCircle, Send, Loader2, 
  Link, ExternalLink, RefreshCw, Zap, Globe, Shield, 
  AlertTriangle, Clock, Settings, CreditCard, Smartphone,
  Activity, Eye, EyeOff, Code, Plug, ArrowUpRight,
  FileJson, ToggleLeft, Layers, Wallet, ChevronDown, ChevronUp,
  Bot, HelpCircle, Key, Plus, Trash2
} from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";

const WEBHOOK_URL = `https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/payment-webhook`;
const LEGACY_WEBHOOK_URL = `https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/ggcheckout-webhook`;

type TestResult = {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
  type: string;
};

type Platform = {
  name: string;
  slug: string;
  color: string;
  icon: string;
  description: string;
  webhookGuide: string[];
  events: string[];
  detected: boolean;
};

const PLATFORMS: Platform[] = [
  { name: 'GGCheckout', slug: 'ggcheckout', color: 'from-green-500 to-emerald-600', icon: '💳', description: 'Plataforma de checkout brasileira com PIX e cartão', webhookGuide: ['Acesse Configurações > Webhooks', 'Clique em "Adicionar Webhook"', 'Cole a URL e selecione "Pagamento Aprovado"', 'Salve e teste'], events: ['pix_paid', 'card_paid', 'failed'], detected: false },
  { name: 'Hotmart', slug: 'hotmart', color: 'from-orange-500 to-red-500', icon: '🔥', description: 'Maior plataforma de infoprodutos do Brasil', webhookGuide: ['Acesse Ferramentas > Webhook (Hottok)', 'Configure a URL de notificação', 'Selecione eventos de compra aprovada', 'Ative o webhook'], events: ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_CANCELED'], detected: false },
  { name: 'Kiwify', slug: 'kiwify', color: 'from-purple-500 to-violet-600', icon: '🥝', description: 'Plataforma de vendas digitais com checkout otimizado', webhookGuide: ['Acesse Configurações > Webhooks', 'Adicione nova URL de webhook', 'Selecione "Compra Aprovada"', 'Salve a configuração'], events: ['order_paid', 'subscription_created', 'order_refunded'], detected: false },
  { name: 'Eduzz', slug: 'eduzz', color: 'from-blue-500 to-indigo-600', icon: '📦', description: 'Plataforma completa para venda de produtos digitais', webhookGuide: ['Acesse Configurações > Notificações', 'Configure o Postback URL', 'Selecione status "Pago"', 'Ative as notificações'], events: ['paid', 'refunded', 'waiting_payment'], detected: false },
  { name: 'Monetizze', slug: 'monetizze', color: 'from-teal-500 to-cyan-600', icon: '💰', description: 'Plataforma de afiliados e vendas digitais', webhookGuide: ['Acesse Configurações > Postback', 'Informe a URL de postback', 'Selecione "Compra Finalizada"', 'Salve'], events: ['Finalizada', 'Cancelada', 'Reembolsada'], detected: false },
  { name: 'PagSeguro', slug: 'pagseguro', color: 'from-green-400 to-green-600', icon: '🟢', description: 'Gateway de pagamento do UOL/PagBank', webhookGuide: ['Acesse Vendas > Configurações', 'Configure a URL de notificação', 'Selecione transações aprovadas', 'Salve'], events: ['paid', 'available', 'cancelled'], detected: false },
  { name: 'Mercado Pago', slug: 'mercadopago', color: 'from-sky-400 to-blue-500', icon: '🔵', description: 'Solução de pagamentos do Mercado Livre', webhookGuide: ['Acesse Configurações > Notificações IPN', 'Configure a URL de notificação', 'Selecione "Payments"', 'Salve'], events: ['payment.created', 'payment.updated'], detected: false },
  { name: 'Stripe', slug: 'stripe', color: 'from-indigo-500 to-purple-600', icon: '💎', description: 'Gateway de pagamento internacional', webhookGuide: ['Acesse Developers > Webhooks', 'Clique em "Add Endpoint"', 'Cole a URL e selecione eventos', 'Salve'], events: ['checkout.session.completed', 'payment_intent.succeeded'], detected: false },
  { name: 'Cakto', slug: 'cakto', color: 'from-pink-500 to-rose-600', icon: '🎂', description: 'Plataforma de checkout e vendas digitais brasileira', webhookGuide: ['Acesse Configurações > Integrações', 'Clique em "Webhook"', 'Cole a URL do webhook', 'Selecione os eventos de pagamento (aprovado, recusado)', 'Salve e teste'], events: ['payment_approved', 'payment_refused', 'subscription_active'], detected: false },
  { name: 'Braip', slug: 'braip', color: 'from-amber-500 to-orange-600', icon: '🚀', description: 'Plataforma de vendas e afiliados digitais', webhookGuide: ['Acesse Configurações > Postback', 'Adicione a URL de notificação', 'Selecione "Venda Aprovada"', 'Ative'], events: ['approved', 'refunded', 'chargeback'], detected: false },
  { name: 'Yampi', slug: 'yampi', color: 'from-violet-500 to-fuchsia-600', icon: '🛒', description: 'Plataforma de checkout e e-commerce', webhookGuide: ['Acesse Configurações > Webhooks', 'Adicione URL', 'Selecione eventos de pedido', 'Salve'], events: ['order.paid', 'order.cancelled'], detected: false },
  { name: 'Pepper (Hotmart)', slug: 'pepper', color: 'from-red-500 to-orange-500', icon: '🌶️', description: 'Checkout da Hotmart com alta conversão', webhookGuide: ['Mesmo processo do Hotmart', 'Acesse Ferramentas > Webhook', 'Configure eventos de compra', 'Salve'], events: ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'], detected: false },
];

export const AdminIntegrationsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({
    checkout_mensal: '',
    checkout_trimestral: '',
    checkout_semestral: '',
    checkout_anual: '',
    checkout_vitalicio: '',
    whatsapp_suporte: '',
    preco_mensal: '',
    preco_trimestral: '',
    preco_semestral: '',
    preco_anual: '',
    preco_vitalicio: '',
    promo_end_date: '',
    plano_ativo_checkout: 'anual',
    plataforma_ativa: 'ggcheckout',
  });
  const [testEmail, setTestEmail] = useState('');
  const [testAmount, setTestAmount] = useState('39.90');
  const [testPlatform, setTestPlatform] = useState('ggcheckout');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [showWebhookUrl, setShowWebhookUrl] = useState(true);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [detectedPlatforms, setDetectedPlatforms] = useState<string[]>([]);
  const [integrationKeys, setIntegrationKeys] = useState<Array<{ id: string; name: string; value: string; showValue: boolean }>>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  const [simulationType, setSimulationType] = useState<'mensal' | 'anual' | 'custom'>('mensal');
  
  // Contextual AI help state
  const [aiHelpOpen, setAiHelpOpen] = useState<string | null>(null);
  const [aiHelpLoading, setAiHelpLoading] = useState(false);
  const [aiHelpResponse, setAiHelpResponse] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    testConnection();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from('admin_settings').select('*');
      if (error) throw error;
      const settingsMap: Record<string, string> = {};
      (data as any[])?.forEach(item => { settingsMap[item.key] = item.value || ''; });
      setSettings(prev => ({ ...prev, ...settingsMap }));
      
      // Load integration keys
      const loadedKeys: Array<{ id: string; name: string; value: string; showValue: boolean }> = [];
      (data as any[])?.forEach(item => {
        if (item.key.startsWith('integration_key_')) {
          const keyName = item.key.replace('integration_key_', '');
          loadedKeys.push({ id: item.key, name: keyName, value: item.value || '', showValue: false });
        }
      });
      setIntegrationKeys(loadedKeys);
      
      // Detect platforms from checkout URLs
      const detected: string[] = [];
      const allValues = Object.values(settingsMap).join(' ').toLowerCase();
      PLATFORMS.forEach(p => {
        if (allValues.includes(p.slug) || allValues.includes(p.name.toLowerCase())) {
          detected.push(p.slug);
        }
      });
      setDetectedPlatforms(detected);
    } catch (error: any) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (['checkout_mensal', 'checkout_trimestral', 'checkout_semestral', 'checkout_anual', 'checkout_vitalicio', 'whatsapp_suporte', 'preco_mensal', 'preco_trimestral', 'preco_semestral', 'preco_anual', 'preco_vitalicio', 'promo_end_date', 'plano_ativo_checkout', 'plataforma_ativa'].includes(key)) {
          await supabase.from('admin_settings').upsert({ key, value, description: `Config: ${key}` }, { onConflict: 'key' });
        }
      }
      toast({ title: "Salvo!", description: "Integrações atualizadas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label || 'url');
    toast({ title: "Copiado!", description: `${label || 'URL'} copiada para a área de transferência.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' });
      const data = await res.json();
      setConnectionStatus(data.success ? 'online' : 'offline');
      setLastPing(new Date().toLocaleString('pt-BR'));
      addTestResult(data.success, data.message || 'Teste de conexão', 'connection', data);
    } catch {
      setConnectionStatus('offline');
      setLastPing(new Date().toLocaleString('pt-BR'));
      addTestResult(false, 'Falha na conexão com o webhook', 'connection');
    }
  };

  const addTestResult = (success: boolean, message: string, type: string, data?: any) => {
    setTestResults(prev => [{ success, message, data, type, timestamp: new Date().toLocaleString('pt-BR') }, ...prev.slice(0, 19)]);
  };

  const generatePlatformPayload = (platform: string, email: string, amount: number, eventType: 'success' | 'error') => {
    const base = { customer: { email, phone: '11999999999' } };
    switch (platform) {
      case 'hotmart':
        return { ...base, hottok: 'test_token', event: eventType === 'success' ? 'PURCHASE_APPROVED' : 'PURCHASE_CANCELED', data: { buyer: { email }, purchase: { price: { value: amount }, transaction: `HM_${Date.now()}` } } };
      case 'kiwify':
        return { ...base, event: eventType === 'success' ? 'order_paid' : 'order_refunded', order_id: `KW_${Date.now()}`, amount };
      case 'eduzz':
        return { ...base, event: eventType === 'success' ? 'paid' : 'refunded', trans_cod: `ED_${Date.now()}`, amount, email };
      case 'monetizze':
        return { ...base, event: eventType === 'success' ? 'Finalizada' : 'Cancelada', chave_unica: `MN_${Date.now()}`, amount, email };
      case 'cakto':
        return { ...base, event: eventType === 'success' ? 'payment_approved' : 'payment_refused', transaction_id: `CK_${Date.now()}`, amount, email };
      case 'braip':
        return { ...base, event: eventType === 'success' ? 'approved' : 'refunded', transaction_id: `BR_${Date.now()}`, amount, email };
      case 'stripe':
        return { type: eventType === 'success' ? 'checkout.session.completed' : 'payment_intent.payment_failed', data: { object: { customer_email: email, amount_total: Math.round(amount * 100), id: `cs_${Date.now()}` } } };
      case 'mercadopago':
        return { action: 'payment.updated', data: { id: `MP_${Date.now()}` }, email, amount, event: eventType === 'success' ? 'paid' : 'cancelled' };
      case 'yampi':
        return { ...base, event: eventType === 'success' ? 'order.paid' : 'order.cancelled', amount, email, id: `YM_${Date.now()}` };
      default: // ggcheckout, pagseguro, pepper
        return { ...base, event: eventType === 'success' ? 'pix_paid' : 'failed', transaction_id: `${platform.toUpperCase()}_${Date.now()}`, amount };
    }
  };

  const testWebhookPayment = async (eventType: 'success' | 'error') => {
    if (!testEmail) {
      toast({ title: "Email obrigatório", description: "Informe um email para o teste.", variant: "destructive" });
      return;
    }
    const testId = `${testPlatform}_${eventType}`;
    setTesting(testId);
    try {
      const payload = generatePlatformPayload(testPlatform, testEmail, parseFloat(testAmount) || 39.90, eventType);
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      const platformName = PLATFORMS.find(p => p.slug === testPlatform)?.name || testPlatform;
      addTestResult(data.success, `[${platformName}] ${eventType === 'success' ? 'Pagamento' : 'Erro'}: ${data.message || data.error || 'OK'}`, testPlatform, data);
      
      if (data.success && !detectedPlatforms.includes(testPlatform)) {
        setDetectedPlatforms(prev => [...prev, testPlatform]);
      }
      
      toast({
        title: data.success ? `✅ ${platformName} - Teste OK!` : `Resultado do teste`,
        description: data.message || data.error || 'Webhook processado',
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: any) {
      addTestResult(false, `Erro no teste ${testPlatform}: ${error.message}`, testPlatform);
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const askAiHelp = async (question: string, section: string) => {
    setAiHelpOpen(section);
    setAiHelpLoading(true);
    setAiHelpResponse(null);
    try {
      const { data, error } = await supabase.functions.invoke('integration-ai-assistant', {
        body: { message: question, history: [] },
      });
      if (error) throw error;
      setAiHelpResponse(data.reply || 'Sem resposta.');
    } catch (error: any) {
      setAiHelpResponse(`❌ Erro: ${error.message}`);
    } finally {
      setAiHelpLoading(false);
    }
  };

  const AiHelpButton: React.FC<{ section: string; questions: string[] }> = ({ section, questions }) => (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setAiHelpOpen(aiHelpOpen === section ? null : section)}
        className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-7 px-2"
      >
        <HelpCircle className="w-3.5 h-3.5 mr-1" />
        <span className="text-[10px]">Ajuda IA</span>
      </Button>
      {aiHelpOpen === section && (
        <div className="absolute right-0 top-8 z-50 w-80 bg-[#1a1a24] border border-purple-500/30 rounded-lg shadow-xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-purple-400 font-medium flex items-center gap-1">
              <Bot className="w-3 h-3" /> Ajuda Rápida
            </span>
            <Button size="sm" variant="ghost" onClick={() => { setAiHelpOpen(null); setAiHelpResponse(null); }} className="h-5 w-5 p-0 text-gray-500 hover:text-white">✕</Button>
          </div>
          {!aiHelpResponse && !aiHelpLoading && (
            <div className="space-y-1">
              {questions.map((q, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant="ghost"
                  onClick={() => askAiHelp(q, section)}
                  className="w-full justify-start text-left text-gray-300 hover:text-white hover:bg-[#2a2a3a] text-[11px] h-auto py-1.5 px-2"
                >
                  {q}
                </Button>
              ))}
            </div>
          )}
          {aiHelpLoading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-xs text-gray-400">Consultando IA...</span>
            </div>
          )}
          {aiHelpResponse && (
            <div className="bg-[#0f0f17] rounded-lg p-3 border border-[#2a2a3a] max-h-[250px] overflow-y-auto">
              <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{aiHelpResponse}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAiHelpResponse(null)}
                className="mt-2 text-purple-400 hover:text-purple-300 text-[10px] h-6 px-2"
              >
                ← Voltar às perguntas
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'testing': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <AdminGuideCards tab="integrations" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 relative">
            <Zap className="w-6 h-6 text-purple-400" />
            <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ${getStatusColor()} border-2 border-[#0a0a0f]`} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Central de Integrações</h2>
            <p className="text-gray-400 text-sm">Webhooks, checkout, plataformas e testes em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastPing && <span className="text-xs text-gray-500 hidden sm:inline">Último ping: {lastPing}</span>}
          <Button size="sm" variant="outline" onClick={testConnection} className="bg-[#1a1a24] border-[#2a2a3a] text-white hover:bg-[#2a2a3a]">
            <RefreshCw className={`w-4 h-4 mr-1 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
            <div>
              <p className="text-xs text-gray-500">Webhook</p>
              <p className="text-sm font-medium text-white">{connectionStatus === 'online' ? 'Ativo' : connectionStatus === 'testing' ? 'Testando' : connectionStatus === 'offline' ? 'Offline' : 'Aguardando'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardContent className="p-4 flex items-center gap-3">
            <Layers className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-gray-500">Plataformas</p>
              <p className="text-sm font-medium text-white">{PLATFORMS.length} compatíveis</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs text-gray-500">Detectadas</p>
              <p className="text-sm font-medium text-white">{detectedPlatforms.length} ativa{detectedPlatforms.length !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs text-gray-500">Testes</p>
              <p className="text-sm font-medium text-white">{testResults.length} realizados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Simulator Bar - visible across all tabs */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-green-600/20 via-emerald-600/15 to-green-600/20 border border-green-500/30 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Simulador Rápido</span>
        </div>
        <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
          <Select value={testPlatform} onValueChange={setTestPlatform}>
            <SelectTrigger className="bg-[#1a1a24] border-green-500/30 text-white h-8 text-xs w-[140px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
              {PLATFORMS.map(p => (
                <SelectItem key={p.slug} value={p.slug} className="text-white text-xs">
                  <span className="mr-1">{p.icon}</span> {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="email@teste.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="bg-[#1a1a24] border-green-500/30 text-white placeholder:text-gray-600 text-xs h-8 w-[160px]"
          />
          <Input
            placeholder="Valor"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            className="bg-[#1a1a24] border-green-500/30 text-white placeholder:text-gray-600 text-xs h-8 w-[80px]"
          />
          <Button
            size="sm"
            disabled={!testEmail || !!testing}
            onClick={() => testWebhookPayment('success')}
            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Testar Pagamento
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!testEmail || !!testing}
            onClick={() => testWebhookPayment('error')}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-8 text-xs"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Simular Erro
          </Button>
        </div>
        {testResults.length > 0 && (
          <div className="flex items-center gap-1.5">
            {testResults[0].success ? (
              <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Último: OK
              </Badge>
            ) : (
              <Badge className="bg-red-600/20 text-red-400 border-red-500/30 text-[10px]">
                <XCircle className="w-3 h-3 mr-1" />
                Último: Erro
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Tabs internas */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a] w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="checkout" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Checkout
          </TabsTrigger>
          <TabsTrigger value="platforms" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <Plug className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Plataformas
          </TabsTrigger>
          <TabsTrigger value="testing" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Testar
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <FileJson className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Logs ({testResults.length})
          </TabsTrigger>
          <TabsTrigger value="keys" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm">
            <Key className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Chaves
          </TabsTrigger>
        </TabsList>

        {/* TAB: Webhook Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="bg-gradient-to-br from-[#1a1a24] via-[#1a1a2e] to-[#1a1a24] border-[#2a2a3a] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
             <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Endpoint do Webhook Universal
                </div>
                <div className="flex items-center gap-1">
                  <AiHelpButton section="webhook" questions={['Como configurar o webhook?', 'O pagamento não ativou o acesso, o que fazer?', 'Quais plataformas são suportadas?']} />
                  <Button size="sm" variant="ghost" onClick={() => setShowWebhookUrl(!showWebhookUrl)} className="text-gray-400 hover:text-white">
                    {showWebhookUrl ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-400">Selecione sua plataforma e copie o código do webhook universal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plataforma Ativa Selector */}
              <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a] space-y-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Plug className="w-4 h-4 text-purple-400" />
                  Plataforma de Pagamento Ativa
                </h4>
                <p className="text-xs text-gray-500">Selecione sua plataforma principal. O webhook universal funciona com todas, mas exibirá o guia específico.</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.slice(0, 8).map(p => (
                    <Button
                      key={p.slug}
                      size="sm"
                      variant={settings.plataforma_ativa === p.slug ? 'default' : 'outline'}
                      className={settings.plataforma_ativa === p.slug
                        ? `bg-gradient-to-r ${p.color} text-white border-0`
                        : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a] hover:text-white'}
                      onClick={() => {
                        setSettings(prev => ({ ...prev, plataforma_ativa: p.slug }));
                        setTestPlatform(p.slug);
                      }}
                    >
                      <span className="mr-1">{p.icon}</span> {p.name}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.slice(8).map(p => (
                    <Button
                      key={p.slug}
                      size="sm"
                      variant={settings.plataforma_ativa === p.slug ? 'default' : 'outline'}
                      className={settings.plataforma_ativa === p.slug
                        ? `bg-gradient-to-r ${p.color} text-white border-0`
                        : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a] hover:text-white'}
                      onClick={() => {
                        setSettings(prev => ({ ...prev, plataforma_ativa: p.slug }));
                        setTestPlatform(p.slug);
                      }}
                    >
                      <span className="mr-1">{p.icon}</span> {p.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Webhook URL */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input 
                    value={showWebhookUrl ? WEBHOOK_URL : '••••••••••••••••••••••••••••••••••'} 
                    readOnly 
                    className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 font-mono text-xs sm:text-sm pr-10" 
                  />
                  <Badge className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">POST</Badge>
                </div>
                <Button onClick={() => copyToClipboard(WEBHOOK_URL, 'URL')} variant="outline" className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] min-w-[90px]">
                  {copied === 'URL' ? <><CheckCircle2 className="w-4 h-4 mr-1 text-green-400" />OK</> : <><Copy className="w-4 h-4 mr-1" />Copiar</>}
                </Button>
              </div>

              {/* Webhook Code Block - universal */}
              <div className="bg-[#0f0f17] rounded-lg border border-[#2a2a3a] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-[#13131d] border-b border-[#2a2a3a]">
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    Código Webhook Universal — {PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.name || 'GGCheckout'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const code = `// Webhook URL (cole na sua plataforma)\n// ${WEBHOOK_URL}\n\n// Plataforma: ${PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.name || 'Universal'}\n// Método: POST\n// Content-Type: application/json\n\n// O webhook aceita qualquer formato de payload.\n// Detecta automaticamente: ${PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.events.join(', ') || 'todos os eventos'}\n\n// Exemplo de payload:\n${JSON.stringify(generatePlatformPayload(settings.plataforma_ativa || 'ggcheckout', 'cliente@email.com', 99.90, 'success'), null, 2)}`;
                      copyToClipboard(code, 'Código');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 h-7 px-2 text-[10px]"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar Código
                  </Button>
                </div>
                <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto max-h-[200px] leading-relaxed">
{`// Webhook URL (cole na plataforma ${PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.name || ''})
// ${WEBHOOK_URL}

// Método: POST | Content-Type: application/json
// Eventos aceitos: ${PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.events.join(', ') || 'universal'}

// Payload de exemplo (${PLATFORMS.find(p => p.slug === settings.plataforma_ativa)?.name || 'universal'}):
${JSON.stringify(generatePlatformPayload(settings.plataforma_ativa || 'ggcheckout', 'cliente@email.com', 99.90, 'success'), null, 2)}`}
                </pre>
              </div>

              {/* Platform-specific guide */}
              {(() => {
                const activePlatform = PLATFORMS.find(p => p.slug === settings.plataforma_ativa);
                if (!activePlatform) return null;
                return (
                  <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a] space-y-3">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <span>{activePlatform.icon}</span>
                      Guia: {activePlatform.name}
                    </h4>
                    <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
                      {activePlatform.webhookGuide.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-[10px] text-gray-500 mr-1">Eventos:</span>
                      {activePlatform.events.map(evt => (
                        <Badge key={evt} className="bg-green-600/10 text-green-400 border border-green-600/20 text-[10px] font-mono">{evt}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="bg-gradient-to-r from-purple-600/10 to-cyan-600/10 rounded-lg p-4 border border-purple-600/20">
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Como funciona automaticamente
                </h4>
                <p className="text-xs text-gray-400">
                  O webhook detecta automaticamente a plataforma pelo formato do payload. Ao receber um pagamento aprovado, 
                  busca o usuário pelo email, determina o plano pelo valor (usando os preços configurados na aba Checkout) e ativa a assinatura 
                  instantaneamente. Notificações são salvas para o painel admin.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveAllSettings} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Checkout Links */}
        <TabsContent value="checkout" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Links de Pagamento por Plano
              </CardTitle>
              <CardDescription className="text-gray-400">
                Configure links de checkout e preços para cada plano. Esses links são usados na landing page, tela de ativação e reconhecimento automático via webhook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Plano Ativo Selector */}
              <Card className="bg-[#0f0f17] border-[#2a2a3a]">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      🎯 Plano Ativo no Checkout (SubscriptionGate)
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">Escolha qual plano aparece como link principal de pagamento na tela de bloqueio.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'mensal', label: 'Mensal', icon: '💳' },
                      { id: 'trimestral', label: 'Trimestral', icon: '📘' },
                      { id: 'semestral', label: 'Semestral', icon: '📗' },
                      { id: 'anual', label: 'Anual', icon: '⭐' },
                      { id: 'vitalicio', label: 'Vitalício', icon: '👑' },
                    ].map(plan => (
                      <Button
                        key={plan.id}
                        size="sm"
                        variant={settings.plano_ativo_checkout === plan.id ? 'default' : 'outline'}
                        className={settings.plano_ativo_checkout === plan.id
                          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                          : 'bg-[#1a1a24] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a] hover:text-white'}
                        onClick={() => setSettings(prev => ({ ...prev, plano_ativo_checkout: plan.id }))}
                      >
                        {plan.icon} {plan.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Plan Cards */}
              {[
                { id: 'mensal', label: 'Mensal', icon: '💳', placeholder: '29.90' },
                { id: 'trimestral', label: 'Trimestral', icon: '📘', placeholder: '69.90' },
                { id: 'semestral', label: 'Semestral', icon: '📗', placeholder: '149.90' },
                { id: 'anual', label: 'Anual', icon: '⭐', placeholder: '199.90' },
                { id: 'vitalicio', label: 'Vitalício', icon: '👑', placeholder: '499.90' },
              ].map(plan => {
                const isActive = settings.plano_ativo_checkout === plan.id;
                return (
                  <Card key={plan.id} className={`bg-[#1a1a24] border-[#2a2a3a] transition-all ${isActive ? 'ring-2 ring-green-500/40 border-green-500/30' : ''}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{plan.icon}</span>
                        <h4 className="text-sm font-semibold text-white">{plan.label}</h4>
                        {isActive && <Badge className="bg-green-600 text-white text-[9px]">Ativo</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
                          <Input
                            type="number" step="0.01"
                            value={settings[`preco_${plan.id}`] || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, [`preco_${plan.id}`]: e.target.value }))}
                            className="bg-[#0f0f17] border-[#2a2a3a] text-white"
                            placeholder={plan.placeholder}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Link do Checkout</label>
                          <div className="flex gap-1">
                            <Input
                              value={settings[`checkout_${plan.id}`] || ''}
                              onChange={(e) => setSettings(prev => ({ ...prev, [`checkout_${plan.id}`]: e.target.value }))}
                              className="bg-[#0f0f17] border-[#2a2a3a] text-white"
                              placeholder="https://checkout..."
                            />
                            {settings[`checkout_${plan.id}`] && (
                              <>
                                <Button variant="outline" size="icon" onClick={() => copyToClipboard(settings[`checkout_${plan.id}`], `Link ${plan.label}`)} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] shrink-0"><Copy className="w-4 h-4" /></Button>
                                <Button variant="outline" size="icon" onClick={() => window.open(settings[`checkout_${plan.id}`], '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] shrink-0"><ExternalLink className="w-4 h-4" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* WhatsApp */}
              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-green-400" />
                  WhatsApp do Suporte
                </label>
                <div className="flex gap-2">
                  <Input placeholder="https://wa.me/5511999999999" value={settings.whatsapp_suporte} onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_suporte: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  {settings.whatsapp_suporte && (
                    <Button variant="outline" size="icon" onClick={() => window.open(settings.whatsapp_suporte, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>

              {/* Sync info */}
              <div className="bg-gradient-to-r from-blue-600/10 to-cyan-600/10 rounded-lg p-4 border border-blue-600/20">
                <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-1">
                  🔄 Sincronização Automática
                </h4>
                <p className="text-xs text-gray-400">
                  Esses links e preços são usados em: <strong className="text-white">Landing Page</strong> (seção de preços), 
                  <strong className="text-white"> Tela de Ativação</strong> (SubscriptionGate) e <strong className="text-white"> Webhook</strong> (detecção automática de plano por valor). 
                  O código de pagamento gerado automaticamente identifica o plano escolhido.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveAllSettings} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="platforms" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Clique em uma plataforma para ver o guia de configuração</p>
            <div className="flex items-center gap-2">
              <AiHelpButton section="platforms" questions={['Como configurar o webhook na Cakto?', 'Como integrar o Hotmart com meu sistema?', 'Como configurar Kiwify para liberar acesso?', 'Posso usar Stripe com esse webhook?']} />
              <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">{PLATFORMS.length} plataformas</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLATFORMS.map(platform => {
              const isDetected = detectedPlatforms.includes(platform.slug);
              const isExpanded = expandedPlatform === platform.slug;
              return (
                <Card 
                  key={platform.slug} 
                  className={`bg-[#1a1a24] border-[#2a2a3a] cursor-pointer transition-all hover:border-[#3a3a5a] ${isDetected ? 'ring-1 ring-green-500/30' : ''} ${isExpanded ? 'col-span-1 sm:col-span-2' : ''}`}
                  onClick={() => setExpandedPlatform(isExpanded ? null : platform.slug)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${platform.color} flex items-center justify-center text-lg`}>
                          {platform.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-white">{platform.name}</h4>
                            {isDetected && <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[9px]">Detectada</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); copyToClipboard(WEBHOOK_URL, platform.name); }} className="text-gray-500 hover:text-white h-8 px-2">
                          <Copy className="w-3 h-3" />
                        </Button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#2a2a3a] space-y-3">
                        <div className="bg-[#0f0f17] rounded-lg p-3 border border-[#2a2a3a]">
                          <h5 className="text-xs font-medium text-white mb-2">📋 Passo a passo:</h5>
                          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                            {platform.webhookGuide.map((step, i) => <li key={i}>{step}</li>)}
                          </ol>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-400 mb-2">Eventos suportados:</h5>
                          <div className="flex flex-wrap gap-1">
                            {platform.events.map(evt => (
                              <Badge key={evt} className="bg-[#0f0f17] text-gray-300 border border-[#2a2a3a] text-[10px] font-mono">{evt}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); copyToClipboard(WEBHOOK_URL, platform.name); }} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs">
                            <Copy className="w-3 h-3 mr-1" />
                            Copiar Webhook
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setTestPlatform(platform.slug); setActiveSection('testing'); }} className="bg-[#2a2a3a] border-[#3a3a4a] text-white text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            Testar
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={saveAllSettings} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* TAB: Testar */}
        <TabsContent value="testing" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" />
                  Simulador de Venda & Webhook
                </div>
                <AiHelpButton section="testing" questions={['Como testar se meu webhook está funcionando?', 'O pagamento não ativou o acesso, o que fazer?', 'O que significa cada resultado do teste?']} />
              </CardTitle>
              <CardDescription className="text-gray-400">Simule vendas completas - gera email fake, valores realistas e testa todo o fluxo de ativação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Simulação */}
              <div className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 rounded-lg p-4 border border-green-600/20 space-y-4">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  Tipo de Simulação
                </h4>

                {/* Plan type selector */}
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={() => {
                      setSimulationType('mensal');
                      setTestAmount(settings.preco_mensal || '50');
                    }}
                    variant={simulationType === 'mensal' ? 'default' : 'outline'}
                    size="sm"
                    className={simulationType === 'mensal' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-[#0f0f17] border-green-600/30 text-green-400 hover:bg-green-600/10'}
                  >
                    💳 Somente Mensal
                  </Button>
                  <Button 
                    onClick={() => {
                      setSimulationType('anual');
                      setTestAmount(settings.preco_anual || '200');
                    }}
                    variant={simulationType === 'anual' ? 'default' : 'outline'}
                    size="sm"
                    className={simulationType === 'anual' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#0f0f17] border-amber-600/30 text-amber-400 hover:bg-amber-600/10'}
                  >
                    ⭐ Somente Anual
                  </Button>
                  <Button 
                    onClick={() => setSimulationType('custom')}
                    variant={simulationType === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className={simulationType === 'custom' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-[#0f0f17] border-purple-600/30 text-purple-400 hover:bg-purple-600/10'}
                  >
                    ✏️ Valor Personalizado
                  </Button>
                  <Button 
                    onClick={() => {
                      setSimulationType('custom');
                      setTestAmount(String((Math.random() * 500 + 10).toFixed(2)));
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-[#0f0f17] border-cyan-600/30 text-cyan-400 hover:bg-cyan-600/10"
                  >
                    🎲 Aleatório
                  </Button>
                </div>

                {/* Editable price fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Valor Mensal para simulação (R$)
                    </label>
                    <Input 
                      type="number" step="0.01"
                      value={simulationType === 'mensal' ? testAmount : (settings.preco_mensal || '')}
                      onChange={(e) => {
                        if (simulationType === 'mensal') setTestAmount(e.target.value);
                        setSettings(prev => ({ ...prev, preco_mensal: e.target.value }));
                      }}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white"
                      placeholder="Ex: 79.90"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Valor Anual para simulação (R$)
                    </label>
                    <Input 
                      type="number" step="0.01"
                      value={simulationType === 'anual' ? testAmount : (settings.preco_anual || '')}
                      onChange={(e) => {
                        if (simulationType === 'anual') setTestAmount(e.target.value);
                        setSettings(prev => ({ ...prev, preco_anual: e.target.value }));
                      }}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white"
                      placeholder="Ex: 79.90"
                    />
                  </div>
                </div>

                {/* Quick generate fake email */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button 
                    onClick={() => {
                      const fakeEmail = `teste_${Date.now()}@simulacao.fake`;
                      setTestEmail(fakeEmail);
                      const amt = simulationType === 'anual' ? (settings.preco_anual || '200') : (settings.preco_mensal || '50');
                      if (simulationType !== 'custom') setTestAmount(amt);
                      toast({ title: "📧 Email fake gerado!", description: `${fakeEmail} — R$ ${parseFloat(simulationType === 'custom' ? testAmount : amt).toFixed(2)}` });
                    }} 
                    variant="outline" 
                    size="sm"
                    className="bg-[#0f0f17] border-green-600/30 text-green-400 hover:bg-green-600/10"
                  >
                    🧪 Gerar Email Fake + Preencher
                  </Button>
                  <p className="text-[10px] text-gray-500 flex items-center">
                    💡 Gera email automático e preenche valor do plano selecionado
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Plataforma</label>
                  <Select value={testPlatform} onValueChange={setTestPlatform}>
                    <SelectTrigger className="bg-[#0f0f17] border-[#2a2a3a] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                      {PLATFORMS.map(p => (
                        <SelectItem key={p.slug} value={p.slug} className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white">
                          {p.icon} {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Email (real ou fake)</label>
                  <Input placeholder="usuario@email.com ou use botão acima" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Valor (R$)</label>
                  <Input placeholder="39.90" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                </div>
              </div>

              {/* Info about detection */}
              <div className="bg-[#0f0f17] rounded-lg p-3 border border-[#2a2a3a] space-y-2">
                <p className="text-xs text-cyan-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Como o sistema processa:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-green-600/20 text-green-400 flex items-center justify-center text-[9px] font-bold">1</span>
                    Recebe webhook → detecta plataforma
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center text-[9px] font-bold">2</span>
                    Busca email → identifica plano pelo valor
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-purple-600/20 text-purple-400 flex items-center justify-center text-[9px] font-bold">3</span>
                    Ativa assinatura → notifica admin
                  </div>
                </div>
                <p className="text-[10px] text-amber-400 mt-1">
                  💡 Emails fake (@simulacao.fake) retornarão "usuário não encontrado" — isso é esperado! O webhook ainda valida todo o fluxo e salva a notificação.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => testWebhookPayment('success')} disabled={!!testing} className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none">
                  {testing?.includes('success') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Simular Pagamento Aprovado
                </Button>
                <Button onClick={() => testWebhookPayment('error')} disabled={!!testing} variant="destructive" className="flex-1 sm:flex-none">
                  {testing?.includes('error') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Simular Erro/Recusa
                </Button>
                <Button onClick={testConnection} disabled={connectionStatus === 'testing'} variant="outline" className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] flex-1 sm:flex-none">
                  {connectionStatus === 'testing' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Ping Conexão
                </Button>
              </div>

              {/* Preview do payload */}
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  Ver payload que será enviado
                </summary>
                <pre className="text-xs text-gray-400 mt-2 bg-[#0f0f17] p-3 rounded-lg border border-[#2a2a3a] overflow-x-auto max-h-[200px]">
                  {JSON.stringify(generatePlatformPayload(testPlatform, testEmail || 'email@exemplo.com', parseFloat(testAmount) || 39.90, 'success'), null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Logs */}
        <TabsContent value="logs" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-cyan-400" />
                  Histórico de Testes & Eventos
                </div>
                {testResults.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setTestResults([])} className="text-gray-500 hover:text-white text-xs">Limpar tudo</Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileJson className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum teste realizado ainda</p>
                  <p className="text-xs mt-1">Use a aba "Testar" para simular pagamentos</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {testResults.map((result, i) => {
                    const platformInfo = PLATFORMS.find(p => p.slug === result.type);
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${result.success ? 'bg-green-950/10 border-green-800/20 hover:border-green-800/40' : 'bg-red-950/10 border-red-800/20 hover:border-red-800/40'}`}>
                        {result.success ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {platformInfo && (
                              <span className="text-xs">{platformInfo.icon}</span>
                            )}
                            <p className="text-sm text-white">{result.message}</p>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">{result.timestamp}</p>
                          {result.data && (
                            <details className="mt-2">
                              <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300">Resposta JSON</summary>
                              <pre className="text-[10px] text-gray-400 mt-1 bg-[#0f0f17] p-2 rounded overflow-x-auto max-h-[150px]">{JSON.stringify(result.data, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Chaves de Integração */}
        <TabsContent value="keys" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Key className="w-5 h-5 text-amber-400" />
                Chaves de Integração
              </CardTitle>
              <CardDescription className="text-gray-400">
                Cole sua chave secreta, salve e o sistema reconhece automaticamente. Edite a qualquer momento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new key - paste & save */}
              <div className="p-4 rounded-xl border border-dashed border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5 space-y-3">
                <p className="text-xs text-green-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" /> Cole e salve sua chave
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Nome da chave (ex: API_KEY_HOTMART, TOKEN_KIWIFY)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                    className="bg-[#1a1a24] border-[#2a2a3a] text-white placeholder:text-gray-600 text-sm"
                  />
                  <div className="relative">
                    <Input
                      placeholder="Cole aqui sua chave secreta (Ctrl+V)"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      className="bg-[#1a1a24] border-[#2a2a3a] text-white placeholder:text-gray-600 text-sm pr-20 font-mono"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setNewKeyValue(text);
                          toast({ title: "Colado!", description: "Chave colada da área de transferência." });
                        } catch {
                          toast({ title: "Erro", description: "Não foi possível colar. Cole manualmente.", variant: "destructive" });
                        }
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 text-[10px]"
                    >
                      <Copy className="w-3 h-3 mr-1" /> Colar
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!newKeyName || !newKeyValue || saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const dbKey = `integration_key_${newKeyName}`;
                        await supabase.from('admin_settings').upsert(
                          { key: dbKey, value: newKeyValue, description: `Chave de integração: ${newKeyName}` },
                          { onConflict: 'key' }
                        );
                        const existing = integrationKeys.findIndex(k => k.name === newKeyName);
                        if (existing >= 0) {
                          setIntegrationKeys(prev => prev.map((k, i) => i === existing ? { ...k, value: newKeyValue } : k));
                        } else {
                          setIntegrationKeys(prev => [...prev, { id: dbKey, name: newKeyName, value: newKeyValue, showValue: false }]);
                        }
                        setNewKeyName('');
                        setNewKeyValue('');
                        toast({ title: "✅ Chave salva!", description: `${newKeyName} salva e pronta para uso.` });
                      } catch (error: any) {
                        toast({ title: "Erro ao salvar chave", description: error.message, variant: "destructive" });
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Salvar Chave
                  </Button>
                  {newKeyValue && (
                    <span className="text-[10px] text-green-400/70 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Chave detectada ({newKeyValue.length} caracteres)
                    </span>
                  )}
                </div>
              </div>

              {/* Existing keys */}
              {integrationKeys.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Key className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma chave de integração cadastrada</p>
                  <p className="text-xs mt-1">Cole chaves de API para conectar com serviços externos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Chaves salvas ({integrationKeys.length})</p>
                  {integrationKeys.map((keyItem, idx) => (
                    <div key={keyItem.id} className="p-3 rounded-lg bg-[#0f0f17] border border-[#2a2a3a] hover:border-amber-500/30 transition-all space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Key className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{keyItem.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {keyItem.showValue ? keyItem.value : `${'•'.repeat(Math.min(keyItem.value.length, 24))} (${keyItem.value.length} chars)`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setIntegrationKeys(prev => prev.map((k, i) => i === idx ? { ...k, showValue: !k.showValue } : k))} className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                            {keyItem.showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => copyToClipboard(keyItem.value, keyItem.name)} className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setNewKeyName(keyItem.name); setNewKeyValue(keyItem.value); }} className="h-8 w-8 p-0 text-gray-400 hover:text-amber-400" title="Editar">
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await supabase.from('admin_settings').update({ value: '' }).eq('key', keyItem.id);
                                setIntegrationKeys(prev => prev.filter((_, i) => i !== idx));
                                toast({ title: "Chave removida", description: `${keyItem.name} foi removida.` });
                              } catch (error: any) {
                                toast({ title: "Erro", description: error.message, variant: "destructive" });
                              }
                            }}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Chaves são salvas de forma segura. Use o simulador verde acima para testar se a integração está recebendo corretamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AdminIntegrationsTab;
