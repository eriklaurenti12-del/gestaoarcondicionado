import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Webhook, Play, CheckCircle2, XCircle, Clock, 
  Mail, MessageSquare, Send, Plus, Trash2, 
  Settings2, Activity, Zap, ExternalLink, Copy,
  RefreshCw, AlertTriangle, Eye
} from "lucide-react";
import { toast } from 'sonner';
import { AdminGuideCards } from "@/components/AdminGuideCards";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: 'email' | 'whatsapp' | 'both';
  trigger: 'new_user' | 'payment' | 'access_granted' | 'manual';
  active: boolean;
  lastTest?: { status: 'success' | 'error'; timestamp: string; response?: string };
}

interface TestLog {
  id: string;
  webhookName: string;
  type: string;
  status: 'success' | 'error' | 'pending';
  timestamp: string;
  payload: object;
  response?: string;
}

const STORAGE_KEY = 'admin_n8n_webhooks';

const AdminN8nTab: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', type: 'email' as const, trigger: 'new_user' as const });
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [customPayload, setCustomPayload] = useState('');
  const [selectedWebhookForTest, setSelectedWebhookForTest] = useState('');
  const [viewLog, setViewLog] = useState<TestLog | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setWebhooks(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
  }, [webhooks]);

  const addWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast.error('Preencha nome e URL do webhook');
      return;
    }
    if (!newWebhook.url.startsWith('http')) {
      toast.error('URL inválida. Use http:// ou https://');
      return;
    }
    const webhook: WebhookConfig = {
      id: Date.now().toString(),
      ...newWebhook,
      active: true
    };
    setWebhooks(prev => [...prev, webhook]);
    setNewWebhook({ name: '', url: '', type: 'email', trigger: 'new_user' });
    setShowAddForm(false);
    toast.success('Webhook adicionado!');
  };

  const removeWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success('Webhook removido');
  };

  const toggleWebhook = (id: string) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  const getDefaultPayload = (trigger: string, type: string) => {
    const base = {
      event: trigger,
      timestamp: new Date().toISOString(),
      source: 'gestao-ar-condicionado',
    };

    const userData = {
      user_name: 'João Silva',
      user_email: 'joao@exemplo.com',
      user_phone: '11999998888',
    };

    switch (trigger) {
      case 'new_user':
        return { ...base, ...userData, action: 'Novo cadastro no sistema' };
      case 'payment':
        return { ...base, ...userData, amount: 39.90, plan: 'mensal', payment_method: 'PIX', action: 'Pagamento confirmado' };
      case 'access_granted':
        return { ...base, ...userData, plan: 'mensal', end_date: '2026-03-20', action: 'Acesso liberado' };
      default:
        return { ...base, ...userData, action: 'Teste manual', message: type === 'email' ? 'Enviar email de teste' : 'Enviar WhatsApp de teste' };
    }
  };

  const testWebhook = async (webhook: WebhookConfig, payload?: object) => {
    setTestingId(webhook.id);
    const testPayload = payload || getDefaultPayload(webhook.trigger, webhook.type);

    const log: TestLog = {
      id: Date.now().toString(),
      webhookName: webhook.name,
      type: webhook.type,
      status: 'pending',
      timestamp: new Date().toISOString(),
      payload: testPayload,
    };
    setTestLogs(prev => [log, ...prev].slice(0, 50));

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'no-cors',
        body: JSON.stringify(testPayload),
      });

      const updatedLog = { ...log, status: 'success' as const, response: 'Requisição enviada com sucesso (modo no-cors)' };
      setTestLogs(prev => prev.map(l => l.id === log.id ? updatedLog : l));
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, lastTest: { status: 'success', timestamp: new Date().toISOString() } } : w));
      toast.success(`Webhook "${webhook.name}" disparado!`);
    } catch (error: any) {
      const updatedLog = { ...log, status: 'error' as const, response: error.message };
      setTestLogs(prev => prev.map(l => l.id === log.id ? updatedLog : l));
      setWebhooks(prev => prev.map(w => w.id === webhook.id ? { ...w, lastTest: { status: 'error', timestamp: new Date().toISOString(), response: error.message } } : w));
      toast.error(`Erro ao disparar webhook: ${error.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const testCustomPayload = () => {
    const webhook = webhooks.find(w => w.id === selectedWebhookForTest);
    if (!webhook) { toast.error('Selecione um webhook'); return; }
    let payload;
    try {
      payload = customPayload ? JSON.parse(customPayload) : undefined;
    } catch {
      toast.error('JSON inválido');
      return;
    }
    testWebhook(webhook, payload);
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case 'new_user': return 'Novo Usuário';
      case 'payment': return 'Pagamento';
      case 'access_granted': return 'Acesso Liberado';
      case 'manual': return 'Manual';
      default: return trigger;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4 text-blue-400" />;
      case 'whatsapp': return <MessageSquare className="w-4 h-4 text-green-400" />;
      case 'both': return <Zap className="w-4 h-4 text-purple-400" />;
      default: return <Webhook className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <AdminGuideCards tab="n8n" />
      {/* Header info */}
      <Card className="bg-gradient-to-r from-orange-900/20 to-red-900/20 border-orange-800/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Webhook className="w-6 h-6 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Automação n8n</h3>
              <p className="text-sm text-gray-400 mt-1">
                Configure webhooks do n8n para enviar emails e mensagens WhatsApp automaticamente quando novos usuários se cadastram, pagamentos são confirmados ou acessos são liberados.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => window.open('https://n8n.io', '_blank')} className="text-orange-400 hover:text-orange-300 h-7">
                  <ExternalLink className="w-3 h-3 mr-1" /> Abrir n8n
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="webhooks" className="w-full">
        <TabsList className="bg-[#1a1a24] border border-[#2a2a3a]">
          <TabsTrigger value="webhooks" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <Settings2 className="w-4 h-4 mr-1" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="templates" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <Mail className="w-4 h-4 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="test" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <Play className="w-4 h-4 mr-1" /> Testar
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
            <Activity className="w-4 h-4 mr-1" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white font-medium">Webhooks Configurados ({webhooks.length})</h3>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="bg-cyan-600 hover:bg-cyan-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Novo Webhook
            </Button>
          </div>

          {showAddForm && (
            <Card className="bg-[#0f0f17] border-[#2a2a3a]">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-sm">Nome</Label>
                    <Input value={newWebhook.name} onChange={e => setNewWebhook(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Boas-vindas WhatsApp" className="bg-[#1a1a24] border-[#2a2a3a] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">URL do Webhook n8n</Label>
                    <Input value={newWebhook.url} onChange={e => setNewWebhook(p => ({ ...p, url: e.target.value }))} placeholder="https://seu-n8n.app/webhook/..." className="bg-[#1a1a24] border-[#2a2a3a] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Tipo de Ação</Label>
                    <Select value={newWebhook.type} onValueChange={(v: any) => setNewWebhook(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                        <SelectItem value="email" className="text-white focus:bg-[#2a2a3a] focus:text-white">📧 Enviar Email</SelectItem>
                        <SelectItem value="whatsapp" className="text-white focus:bg-[#2a2a3a] focus:text-white">💬 Enviar WhatsApp</SelectItem>
                        <SelectItem value="both" className="text-white focus:bg-[#2a2a3a] focus:text-white">⚡ Email + WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-300 text-sm">Gatilho</Label>
                    <Select value={newWebhook.trigger} onValueChange={(v: any) => setNewWebhook(p => ({ ...p, trigger: v }))}>
                      <SelectTrigger className="bg-[#1a1a24] border-[#2a2a3a] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                        <SelectItem value="new_user" className="text-white focus:bg-[#2a2a3a] focus:text-white">👤 Novo Usuário</SelectItem>
                        <SelectItem value="payment" className="text-white focus:bg-[#2a2a3a] focus:text-white">💰 Pagamento Confirmado</SelectItem>
                        <SelectItem value="access_granted" className="text-white focus:bg-[#2a2a3a] focus:text-white">✅ Acesso Liberado</SelectItem>
                        <SelectItem value="manual" className="text-white focus:bg-[#2a2a3a] focus:text-white">🔧 Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addWebhook} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAddForm(false)} className="text-gray-400">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {webhooks.length === 0 ? (
            <Card className="bg-[#1a1a24] border-[#2a2a3a]">
              <CardContent className="p-8 text-center">
                <Webhook className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">Nenhum webhook configurado</p>
                <p className="text-xs text-gray-500 mt-1">Adicione um webhook do n8n para começar a automatizar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {webhooks.map(webhook => (
                <Card key={webhook.id} className={`border transition-colors ${webhook.active ? 'bg-[#1a1a24] border-[#2a2a3a]' : 'bg-[#0f0f17] border-[#1a1a24] opacity-60'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getTypeIcon(webhook.type)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{webhook.name}</span>
                            <Badge variant="outline" className="text-xs">{getTriggerLabel(webhook.trigger)}</Badge>
                            {webhook.lastTest && (
                              <Badge className={webhook.lastTest.status === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                                {webhook.lastTest.status === 'success' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                {webhook.lastTest.status === 'success' ? 'OK' : 'Erro'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{webhook.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { navigator.clipboard.writeText(webhook.url); toast.success('URL copiada!'); }}
                          className="text-gray-400 hover:text-white h-8"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={testingId === webhook.id || !webhook.active}
                          onClick={() => testWebhook(webhook)}
                          className="text-cyan-400 hover:text-cyan-300 h-8"
                        >
                          {testingId === webhook.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        </Button>
                        <Switch checked={webhook.active} onCheckedChange={() => toggleWebhook(webhook.id)} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeWebhook(webhook.id)}
                          className="text-red-400 hover:text-red-300 h-8"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-cyan-500" />
                Templates Prontos para n8n
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">Copie o payload JSON e use no nó HTTP Request do n8n para enviar emails ou WhatsApp automaticamente</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Welcome Email Template */}
              {[
                {
                  title: '📧 Email de Boas-vindas',
                  description: 'Enviado quando um novo usuário se cadastra',
                  trigger: 'new_user',
                  color: 'blue',
                  payload: {
                    event: 'new_user',
                    action: 'send_email',
                    to: '{{user_email}}',
                    subject: 'Bem-vindo ao AC Service Pro! 🎉',
                    body: 'Olá {{user_name}},\n\nSeja bem-vindo ao AC Service Pro!\n\nSeu cadastro foi realizado com sucesso. Agora você pode organizar seus clientes, agendamentos e finanças em um só lugar.\n\nAcesse: https://gestaoarcondicionado.lovable.app\n\nQualquer dúvida, estamos no WhatsApp!\n\nEquipe AC Service Pro',
                    source: 'gestao-ar-condicionado'
                  }
                },
                {
                  title: '✅ Email de Pagamento Confirmado',
                  description: 'Enviado quando o pagamento é aprovado',
                  trigger: 'payment',
                  color: 'green',
                  payload: {
                    event: 'payment_success',
                    action: 'send_email',
                    to: '{{user_email}}',
                    subject: 'Pagamento Confirmado - AC Service Pro ✅',
                    body: 'Olá {{user_name}},\n\nSeu pagamento de R$ {{amount}} foi confirmado!\n\nPlano: {{plan}}\nVálido até: {{end_date}}\n\nSeu acesso já está liberado. Aproveite todas as funcionalidades!\n\nAcesse: https://gestaoarcondicionado.lovable.app\n\nEquipe AC Service Pro',
                    source: 'gestao-ar-condicionado'
                  }
                },
                {
                  title: '🚀 Email de Acesso Liberado',
                  description: 'Enviado quando o acesso é ativado',
                  trigger: 'access_granted',
                  color: 'cyan',
                  payload: {
                    event: 'access_granted',
                    action: 'send_email',
                    to: '{{user_email}}',
                    subject: 'Acesso Liberado - AC Service Pro 🚀',
                    body: 'Olá {{user_name}},\n\nSeu acesso ao AC Service Pro foi liberado!\n\nAgora você pode:\n✅ Cadastrar clientes e equipamentos\n✅ Criar ordens de serviço e orçamentos\n✅ Controlar financeiro e agenda\n✅ Gerar relatórios PDF\n\nAcesse agora: https://gestaoarcondicionado.lovable.app\n\nEquipe AC Service Pro',
                    source: 'gestao-ar-condicionado'
                  }
                },
                {
                  title: '💬 WhatsApp de Boas-vindas',
                  description: 'Mensagem automática via WhatsApp',
                  trigger: 'new_user',
                  color: 'green',
                  payload: {
                    event: 'new_user',
                    action: 'send_whatsapp',
                    to: '{{user_phone}}',
                    message: 'Olá {{user_name}}! 👋\n\nBem-vindo ao AC Service Pro! 🎉\n\nSeu cadastro foi realizado. Acesse o sistema e comece a organizar seus serviços de ar condicionado.\n\n🔗 https://gestaoarcondicionado.lovable.app\n\nQualquer dúvida, é só chamar aqui! 😊',
                    source: 'gestao-ar-condicionado'
                  }
                },
                {
                  title: '💬 WhatsApp de Pagamento',
                  description: 'Confirmação de pagamento via WhatsApp',
                  trigger: 'payment',
                  color: 'green',
                  payload: {
                    event: 'payment_success',
                    action: 'send_whatsapp',
                    to: '{{user_phone}}',
                    message: 'Olá {{user_name}}! ✅\n\nSeu pagamento de R$ {{amount}} foi confirmado!\n\n📋 Plano: {{plan}}\n📅 Válido até: {{end_date}}\n\nSeu acesso já está liberado! 🚀\n\n🔗 https://gestaoarcondicionado.lovable.app',
                    source: 'gestao-ar-condicionado'
                  }
                }
              ].map((template, index) => (
                <Card key={index} className="bg-[#0f0f17] border-[#2a2a3a]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white">{template.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{template.description}</p>
                        <Badge variant="outline" className="text-xs mt-2">{getTriggerLabel(template.trigger)}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(template.payload, null, 2));
                            toast.success('Payload copiado!');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 h-7"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCustomPayload(JSON.stringify(template.payload, null, 2));
                            // Switch to test tab  
                            const testTab = document.querySelector('[value="test"]') as HTMLElement;
                            testTab?.click();
                          }}
                          className="text-purple-400 hover:text-purple-300 h-7"
                        >
                          <Play className="w-3 h-3 mr-1" /> Usar no Teste
                        </Button>
                      </div>
                    </div>
                    <pre className="text-xs text-gray-500 mt-3 p-2 bg-[#1a1a24] rounded overflow-x-auto max-h-[100px]">
                      {JSON.stringify(template.payload, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}

              {/* n8n Setup Guide */}
              <Card className="bg-gradient-to-r from-orange-900/10 to-red-900/10 border-orange-800/20">
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-2">
                    <Webhook className="w-4 h-4 text-orange-400" /> Como usar no n8n
                  </h4>
                  <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
                    <li>Crie um workflow no n8n com trigger <strong className="text-white">Webhook</strong></li>
                    <li>Copie a URL do webhook gerada pelo n8n</li>
                    <li>Cole aqui na aba <strong className="text-white">Webhooks</strong> e selecione o gatilho</li>
                    <li>No n8n, adicione um nó <strong className="text-white">Send Email</strong> (Resend, Gmail, SMTP) ou <strong className="text-white">HTTP Request</strong> para WhatsApp API</li>
                    <li>Use os campos do payload (<code className="text-cyan-400">{'{{user_email}}'}</code>, <code className="text-cyan-400">{'{{user_name}}'}</code>) como variáveis</li>
                    <li>Ative o workflow e teste aqui!</li>
                  </ol>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="mt-4 space-y-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Play className="w-5 h-5 text-cyan-500" />
                Testar Webhook
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Selecionar Webhook</Label>
                <Select value={selectedWebhookForTest} onValueChange={setSelectedWebhookForTest}>
                  <SelectTrigger className="bg-[#0f0f17] border-[#2a2a3a] text-white mt-1">
                    <SelectValue placeholder="Escolha um webhook..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a]">
                    {webhooks.filter(w => w.active).map(w => (
                      <SelectItem key={w.id} value={w.id} className="text-white focus:bg-[#2a2a3a] focus:text-white">
                        {w.name} ({getTriggerLabel(w.trigger)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-gray-300 text-sm">Payload JSON (opcional)</Label>
                  {selectedWebhookForTest && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      const wh = webhooks.find(w => w.id === selectedWebhookForTest);
                      if (wh) setCustomPayload(JSON.stringify(getDefaultPayload(wh.trigger, wh.type), null, 2));
                    }} className="text-xs text-cyan-400 h-6">
                      Gerar payload padrão
                    </Button>
                  )}
                </div>
                <Textarea
                  value={customPayload}
                  onChange={e => setCustomPayload(e.target.value)}
                  placeholder='{"event": "new_user", "user_name": "João", "user_email": "joao@email.com"}'
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white font-mono text-xs min-h-[120px]"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={testCustomPayload}
                  disabled={!selectedWebhookForTest || testingId !== null}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {testingId ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Disparar Teste
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setCustomPayload(''); setSelectedWebhookForTest(''); }}
                  className="text-gray-400"
                >
                  Limpar
                </Button>
              </div>

              {/* Quick test buttons */}
              <div className="border-t border-[#2a2a3a] pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Testes Rápidos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {webhooks.filter(w => w.active).map(wh => (
                    <Button
                      key={wh.id}
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook(wh)}
                      disabled={testingId === wh.id}
                      className="bg-[#0f0f17] border-[#2a2a3a] text-white hover:bg-[#2a2a3a] justify-start"
                    >
                      {testingId === wh.id ? <RefreshCw className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2 text-cyan-400" />}
                      {wh.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  Histórico de Testes ({testLogs.length})
                </CardTitle>
                {testLogs.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setTestLogs([])} className="text-gray-400 hover:text-white">
                    Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {testLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum teste realizado</p>
                    <p className="text-xs mt-1">Os logs dos testes aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#2a2a3a]">
                    {testLogs.map(log => (
                      <div key={log.id} className="p-3 hover:bg-[#2a2a3a]/30 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : log.status === 'error' ? <XCircle className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />}
                            <span className="text-sm text-white font-medium">{log.webhookName}</span>
                            <Badge variant="outline" className="text-xs">{log.type}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                            <Button size="sm" variant="ghost" onClick={() => setViewLog(viewLog?.id === log.id ? null : log)} className="text-gray-400 h-6">
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {log.response && (
                          <p className={`text-xs mt-1 ${log.status === 'error' ? 'text-red-400' : 'text-green-400'}`}>{log.response}</p>
                        )}
                        {viewLog?.id === log.id && (
                          <pre className="text-xs text-gray-400 mt-2 p-2 bg-[#0f0f17] rounded overflow-x-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminN8nTab;
