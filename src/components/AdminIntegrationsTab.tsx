import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Webhook, Copy, CheckCircle2, XCircle, Send, Loader2, 
  Link, ExternalLink, RefreshCw, Zap, Globe, Shield, 
  AlertTriangle, Clock, ArrowRight
} from "lucide-react";

const WEBHOOK_URL = `https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/ggcheckout-webhook`;

type TestResult = {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
};

export const AdminIntegrationsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({
    checkout_mensal: '',
    checkout_anual: '',
    whatsapp_suporte: '',
  });
  const [testEmail, setTestEmail] = useState('');
  const [testAmount, setTestAmount] = useState('39.90');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');

  useEffect(() => {
    loadSettings();
    testConnection();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*');
      if (error) throw error;
      const settingsMap: Record<string, string> = {};
      (data as any[])?.forEach(item => {
        settingsMap[item.key] = item.value || '';
      });
      setSettings(prev => ({ ...prev, ...settingsMap }));
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
        if (['checkout_mensal', 'checkout_anual', 'whatsapp_suporte'].includes(key)) {
          await supabase.from('admin_settings').update({ value }).eq('key', key);
        }
      }
      toast({ title: "Salvo!", description: "Integrações atualizadas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!", description: "URL do webhook copiada para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' });
      const data = await res.json();
      setConnectionStatus(data.success ? 'online' : 'offline');
      addTestResult(data.success, data.message || 'Teste de conexão', data);
    } catch {
      setConnectionStatus('offline');
      addTestResult(false, 'Falha na conexão com o webhook');
    }
  };

  const addTestResult = (success: boolean, message: string, data?: any) => {
    setTestResults(prev => [{ success, message, data, timestamp: new Date().toLocaleString('pt-BR') }, ...prev.slice(0, 9)]);
  };

  const testWebhookPayment = async (type: 'pix' | 'card' | 'error') => {
    if (!testEmail) {
      toast({ title: "Email obrigatório", description: "Informe um email para o teste.", variant: "destructive" });
      return;
    }
    setTesting(type);
    try {
      const payload: any = {
        customer: { email: testEmail, phone: '11999999999' },
        amount: parseFloat(testAmount) || 39.90,
      };
      if (type === 'pix') { payload.event = 'pix_paid'; payload.transaction_id = `test_pix_${Date.now()}`; }
      else if (type === 'card') { payload.event = 'card_paid'; payload.transaction_id = `test_card_${Date.now()}`; }
      else { payload.event = 'failed'; payload.transaction_id = `test_fail_${Date.now()}`; }

      const res = await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      addTestResult(data.success, `Teste ${type.toUpperCase()}: ${data.message || data.error || 'OK'}`, data);
      toast({
        title: data.success ? "Teste enviado!" : "Resultado do teste",
        description: data.message || data.error || 'Webhook processado',
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: any) {
      addTestResult(false, `Erro no teste ${type}: ${error.message}`);
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
          <Zap className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Integrações & Webhooks</h2>
          <p className="text-gray-400">Gerencie webhooks, checkout e conexões do sistema</p>
        </div>
      </div>

      {/* Status do Webhook */}
      <Card className="bg-gradient-to-r from-[#1a1a24] to-[#1a1a2e] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Status do Webhook
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus === 'testing' && <Badge className="bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Testando...</Badge>}
              {connectionStatus === 'online' && <Badge className="bg-green-600/20 text-green-400 border border-green-600/30"><CheckCircle2 className="w-3 h-3 mr-1" />Online</Badge>}
              {connectionStatus === 'offline' && <Badge className="bg-red-600/20 text-red-400 border border-red-600/30"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>}
              {connectionStatus === 'idle' && <Badge className="bg-gray-600/20 text-gray-400 border border-gray-600/30">Aguardando</Badge>}
              <Button size="sm" variant="ghost" onClick={testConnection} className="text-gray-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">URL do Webhook (cole na sua plataforma de pagamento)</label>
            <div className="flex gap-2 mt-1">
              <Input value={WEBHOOK_URL} readOnly className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 font-mono text-sm" />
              <Button onClick={() => copyToClipboard(WEBHOOK_URL)} variant="outline" className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a] min-w-[100px]">
                {copied ? <><CheckCircle2 className="w-4 h-4 mr-1 text-green-400" /> Copiado</> : <><Copy className="w-4 h-4 mr-1" /> Copiar</>}
              </Button>
            </div>
          </div>
          <div className="bg-[#0f0f17] rounded-lg p-4 border border-[#2a2a3a]">
            <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Como configurar
            </h4>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Copie a URL do webhook acima</li>
              <li>Acesse sua plataforma de pagamento (GGCheckout, Hotmart, Kiwify, etc.)</li>
              <li>Vá em configurações de webhook / notificações</li>
              <li>Cole a URL e selecione os eventos de pagamento (pix_paid, card_paid, etc.)</li>
              <li>Salve e teste com o painel abaixo</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Links de Checkout */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Link className="w-5 h-5 text-cyan-400" />
            Links de Checkout
          </CardTitle>
          <CardDescription className="text-gray-400">Links de pagamento que aparecem na landing page e na tela de ativação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Checkout Mensal (R$ 39,90)</label>
            <div className="flex gap-2">
              <Input placeholder="https://pay.ggcheckout.com.br/..." value={settings.checkout_mensal} onChange={(e) => setSettings(prev => ({ ...prev, checkout_mensal: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              {settings.checkout_mensal && <Button variant="outline" size="icon" onClick={() => window.open(settings.checkout_mensal, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Checkout Anual (R$ 370,00)</label>
            <div className="flex gap-2">
              <Input placeholder="https://pay.ggcheckout.com.br/..." value={settings.checkout_anual} onChange={(e) => setSettings(prev => ({ ...prev, checkout_anual: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              {settings.checkout_anual && <Button variant="outline" size="icon" onClick={() => window.open(settings.checkout_anual, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">WhatsApp Suporte</label>
            <div className="flex gap-2">
              <Input placeholder="https://wa.me/5511999999999" value={settings.whatsapp_suporte} onChange={(e) => setSettings(prev => ({ ...prev, whatsapp_suporte: e.target.value }))} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
              {settings.whatsapp_suporte && <Button variant="outline" size="icon" onClick={() => window.open(settings.whatsapp_suporte, '_blank')} className="bg-[#2a2a3a] border-[#3a3a4a] text-white hover:bg-[#3a3a4a]"><ExternalLink className="w-4 h-4" /></Button>}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={saveAllSettings} disabled={saving} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Salvar Links
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teste de Webhook */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Send className="w-5 h-5 text-amber-400" />
            Testar Webhook
          </CardTitle>
          <CardDescription className="text-gray-400">Envie eventos de teste para validar a integração. O email precisa estar cadastrado no sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Email do usuário (cadastrado)</label>
              <Input placeholder="usuario@email.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Valor (R$)</label>
              <Input placeholder="39.90" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} className="bg-[#0f0f17] border-[#2a2a3a] text-white" />
            </div>
          </div>
          <div className="bg-[#0f0f17] rounded-lg p-3 border border-[#2a2a3a]">
            <p className="text-xs text-amber-400 flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3" />
              Atenção: Testes com valores ≤ R$50 ativam plano mensal, acima ativa plano anual.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => testWebhookPayment('pix')} disabled={!!testing} className="bg-green-600 hover:bg-green-700 text-white">
              {testing === 'pix' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Testar PIX Pago
            </Button>
            <Button onClick={() => testWebhookPayment('card')} disabled={!!testing} className="bg-blue-600 hover:bg-blue-700 text-white">
              {testing === 'card' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Testar Cartão Pago
            </Button>
            <Button onClick={() => testWebhookPayment('error')} disabled={!!testing} variant="destructive">
              {testing === 'error' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Testar Erro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados dos Testes */}
      {testResults.length > 0 && (
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Histórico de Testes
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTestResults([])} className="text-gray-500 hover:text-white text-xs">Limpar</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {testResults.map((result, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${result.success ? 'bg-green-950/20 border-green-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
                  {result.success ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{result.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{result.timestamp}</p>
                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Ver resposta completa</summary>
                        <pre className="text-xs text-gray-400 mt-1 bg-[#0f0f17] p-2 rounded overflow-x-auto">{JSON.stringify(result.data, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plataformas compatíveis */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Globe className="w-5 h-5 text-purple-400" />
            Plataformas Compatíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {['GGCheckout', 'Hotmart', 'Kiwify', 'Eduzz', 'Monetizze', 'PagSeguro', 'Mercado Pago', 'Stripe'].map(platform => (
              <div key={platform} className="flex items-center gap-2 p-3 rounded-lg bg-[#0f0f17] border border-[#2a2a3a]">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-300">{platform}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            O webhook aceita payloads de diversas plataformas automaticamente. Basta configurar a URL acima como endpoint de notificação na plataforma escolhida.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegrationsTab;
