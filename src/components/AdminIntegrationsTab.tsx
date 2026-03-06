import React, { useState, useEffect, useRef } from 'react';
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
  Bot, MessageSquare, Sparkles, HelpCircle
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
    checkout_anual: '',
    whatsapp_suporte: '',
    preco_mensal: '39.90',
    preco_anual: '370',
    promo_end_date: '',
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

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const aiQuickQuestions = [
    'Como configurar o webhook na Cakto?',
    'Como integrar o Hotmart com meu sistema?',
    'O pagamento não ativou o acesso, o que fazer?',
    'Como testar se meu webhook está funcionando?',
    'Quais plataformas são suportadas?',
    'Como configurar Kiwify para liberar acesso?',
    'Posso usar Stripe com esse webhook?',
    'Como mudar o checkout para outra plataforma?',
  ];

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
        if (['checkout_mensal', 'checkout_anual', 'whatsapp_suporte', 'preco_mensal', 'preco_anual'].includes(key)) {
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

  const sendAiMessage = async (message?: string) => {
    const msg = message || aiInput.trim();
    if (!msg || aiLoading) return;
    
    setAiInput('');
    const newMessages = [...aiMessages, { role: 'user' as const, content: msg }];
    setAiMessages(newMessages);
    setAiLoading(true);
    
    setTimeout(() => aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);

    try {
      const { data, error } = await supabase.functions.invoke('integration-ai-assistant', {
        body: { message: msg, history: aiMessages.slice(-10) },
      });
      
      if (error) throw error;
      
      setAiMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Erro ao processar resposta.' }]);
    } catch (error: any) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: `❌ Erro: ${error.message}. Tente novamente.` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  };

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
          <TabsTrigger value="ai-assistant" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white text-xs sm:text-sm">
            <Bot className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            IA Assistente
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
                  Endpoint do Webhook
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowWebhookUrl(!showWebhookUrl)} className="text-gray-400 hover:text-white">
                  {showWebhookUrl ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
              </CardTitle>
              <CardDescription className="text-gray-400">Cole esta URL na sua plataforma de pagamento para receber notificações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a]">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    Configuração Rápida
                  </h4>
                  <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
                    <li>Copie a URL do webhook</li>
                    <li>Cole na plataforma de pagamento</li>
                    <li>Selecione eventos de pagamento</li>
                    <li>Salve e teste abaixo</li>
                  </ol>
                </div>
                <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a]">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-400" />
                    Eventos Reconhecidos
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {['pix_paid', 'card_paid', 'paid', 'approved', 'PURCHASE_APPROVED', 'order_paid', 'payment_approved'].map(evt => (
                      <Badge key={evt} className="bg-green-600/10 text-green-400 border border-green-600/20 text-[10px] font-mono">{evt}</Badge>
                    ))}
                  </div>
                </div>
              </div>

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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Checkout Links */}
        <TabsContent value="checkout" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Links de Pagamento
              </CardTitle>
              <CardDescription className="text-gray-400">Atualize os links que aparecem na landing page, tela de ativação e para os usuários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-cyan-400" />
                    Checkout Mensal
                  </label>
                  {settings.checkout_mensal && <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">Configurado</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="https://pay.ggcheckout.com.br/..." value={settings.checkout_mensal} onChange={(e) => setSettings(prev => ({ ...prev, checkout_mensal: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  {settings.checkout_mensal && (
                    <>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(settings.checkout_mensal, 'Link Mensal')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><Copy className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => window.open(settings.checkout_mensal, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-400" />
                    Checkout Anual
                    <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 text-[10px]">Destaque</Badge>
                  </label>
                  {settings.checkout_anual && <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">Configurado</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="https://pay.ggcheckout.com.br/..." value={settings.checkout_anual} onChange={(e) => setSettings(prev => ({ ...prev, checkout_anual: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
                  {settings.checkout_anual && (
                    <>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(settings.checkout_anual, 'Link Anual')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><Copy className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => window.open(settings.checkout_anual, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>
                    </>
                  )}
                </div>
              </div>

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

              {/* Preços para detecção automática do webhook */}
              <div className="bg-gradient-to-r from-purple-600/10 to-cyan-600/10 rounded-lg p-4 border border-purple-600/20 space-y-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  Preços para Detecção Automática (Webhook)
                </h4>
                <p className="text-xs text-gray-400">
                  O webhook usa estes valores para detectar automaticamente se o pagamento é mensal ou anual. 
                  Valores ≥ 80% do preço anual = anual, senão = mensal.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Preço Mensal (R$)</label>
                    <Input 
                      type="number" step="0.01"
                      value={settings.preco_mensal} 
                      onChange={(e) => setSettings(prev => ({ ...prev, preco_mensal: e.target.value }))} 
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" 
                      placeholder="39.90"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Preço Anual (R$)</label>
                    <Input 
                      type="number" step="0.01"
                      value={settings.preco_anual} 
                      onChange={(e) => setSettings(prev => ({ ...prev, preco_anual: e.target.value }))} 
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white" 
                      placeholder="370"
                    />
                  </div>
                </div>
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

        {/* TAB: Plataformas */}
        <TabsContent value="platforms" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Clique em uma plataforma para ver o guia de configuração</p>
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">{PLATFORMS.length} plataformas</Badge>
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
        </TabsContent>

        {/* TAB: Testar */}
        <TabsContent value="testing" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Send className="w-5 h-5 text-amber-400" />
                Simulador de Venda & Webhook
              </CardTitle>
              <CardDescription className="text-gray-400">Simule vendas completas - gera email fake, valores realistas e testa todo o fluxo de ativação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Fake Sale Buttons */}
              <div className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 rounded-lg p-4 border border-green-600/20 space-y-3">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-400" />
                  Simulação Rápida (Email Fake)
                </h4>
                <p className="text-xs text-gray-400">
                  Gera um email fake automaticamente e simula uma venda completa. Útil para testar se o webhook está processando corretamente sem afetar usuários reais.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={() => {
                      const fakeEmail = `teste_${Date.now()}@simulacao.fake`;
                      setTestEmail(fakeEmail);
                      setTestAmount('39.90');
                      toast({ title: "📧 Email fake gerado!", description: `${fakeEmail} — R$ 39,90 (Mensal)` });
                    }} 
                    variant="outline" 
                    size="sm"
                    className="bg-[#0f0f17] border-green-600/30 text-green-400 hover:bg-green-600/10"
                  >
                    🧪 Gerar Venda Mensal (R$ 39,90)
                  </Button>
                  <Button 
                    onClick={() => {
                      const fakeEmail = `teste_${Date.now()}@simulacao.fake`;
                      setTestEmail(fakeEmail);
                      setTestAmount('370');
                      toast({ title: "📧 Email fake gerado!", description: `${fakeEmail} — R$ 370,00 (Anual)` });
                    }} 
                    variant="outline" 
                    size="sm"
                    className="bg-[#0f0f17] border-amber-600/30 text-amber-400 hover:bg-amber-600/10"
                  >
                    🧪 Gerar Venda Anual (R$ 370,00)
                  </Button>
                  <Button 
                    onClick={() => {
                      const fakeEmail = `teste_${Date.now()}@simulacao.fake`;
                      setTestEmail(fakeEmail);
                      setTestAmount(String((Math.random() * 500 + 10).toFixed(2)));
                      toast({ title: "📧 Email fake gerado!", description: `${fakeEmail} — Valor aleatório` });
                    }} 
                    variant="outline" 
                    size="sm"
                    className="bg-[#0f0f17] border-purple-600/30 text-purple-400 hover:bg-purple-600/10"
                  >
                    🎲 Valor Aleatório
                  </Button>
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

        {/* TAB: IA Assistente */}
        <TabsContent value="ai-assistant" className="mt-4 space-y-4">
          <Card className="bg-gradient-to-br from-[#1a1a24] via-[#12121e] to-[#1a1a24] border-[#2a2a3a] overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
                  <Bot className="w-5 h-5 text-cyan-400" />
                </div>
                Assistente IA de Integrações
                <Badge className="bg-gradient-to-r from-purple-600/30 to-cyan-600/30 text-cyan-300 border-cyan-600/30 text-[10px] ml-auto">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Powered by AI
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Pergunte sobre configuração de webhooks, integração com plataformas, resolução de problemas e testes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Questions */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Perguntas rápidas
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiQuickQuestions.map((q, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant="outline"
                      disabled={aiLoading}
                      onClick={() => { setActiveSection('ai-assistant'); sendAiMessage(q); }}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a] hover:text-white text-[11px] h-7 px-2"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="bg-[#0a0a12] rounded-xl border border-[#2a2a3a] overflow-hidden">
                <div 
                  ref={aiScrollRef}
                  className="h-[400px] overflow-y-auto p-4 space-y-4"
                >
                  {aiMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Assistente de Integrações</h3>
                        <p className="text-sm text-gray-500 max-w-md">
                          Pergunte qualquer coisa sobre configuração de webhooks, checkout, plataformas de pagamento ou resolução de problemas.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                        {['Como integrar a Cakto?', 'Como testar o webhook?', 'Pagamento não liberou acesso', 'Trocar plataforma de checkout'].map((suggestion, i) => (
                          <Button
                            key={i}
                            variant="outline"
                            disabled={aiLoading}
                            onClick={() => sendAiMessage(suggestion)}
                            className="bg-[#1a1a24] border-[#2a2a3a] text-gray-300 hover:bg-[#2a2a3a] hover:text-white text-xs justify-start"
                          >
                            <MessageSquare className="w-3 h-3 mr-2 text-purple-400 flex-shrink-0" />
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white' 
                          : 'bg-[#1a1a24] border border-[#2a2a3a] text-gray-200'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Bot className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-[10px] text-cyan-400 font-medium">IA Assistente</span>
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  ))}

                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="border-t border-[#2a2a3a] p-3">
                  <div className="flex gap-2">
                    <Input
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                      placeholder="Pergunte sobre integrações, webhooks, plataformas..."
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600"
                      disabled={aiLoading}
                    />
                    <Button 
                      onClick={() => sendAiMessage()} 
                      disabled={aiLoading || !aiInput.trim()} 
                      className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-4"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  {aiMessages.length > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[10px] text-gray-600">Pressione Enter para enviar</p>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setAiMessages([])} 
                        className="text-gray-600 hover:text-gray-300 text-[10px] h-5 px-2"
                      >
                        Limpar conversa
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="bg-gradient-to-r from-purple-600/10 to-cyan-600/10 rounded-lg p-3 border border-purple-600/20">
                <p className="text-xs text-gray-400 flex items-center gap-2">
                  <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  A IA conhece todas as plataformas suportadas, eventos de webhook, lógica de ativação e pode guiar você passo a passo na configuração de qualquer integração.
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
